"""Space Apps 2026 (14-15 Nov) — real SPHEREx stacked images for the Atlas SPHEREx view.

For each showcase target, reads small windows of the public level-2 images (byte ranges on the public S3 bucket, no
account, no paid compute), resamples them on a fixed north-up sky grid and averages them:
  * per observing season at 3.83-5.0 um (fixed sky grid: a nearby dwarf moves between seasons);
  * all dates, in the frame that follows the target: methane band (3.15-3.50 um) against 3.83-5.0 um.
Nothing is kept except the PNG stacks and their metadata. Bytes read are appended to data_budget.txt.

usage: <python with numpy, astropy, requests, PIL> stack_images.py <H3_cold_dwarfs dir> <holo-mars dir> [target id ...]
"""
import json, math, pathlib, sys, time, concurrent.futures as cf
import numpy as np
from PIL import Image

H3 = pathlib.Path(sys.argv[1]); APP = pathlib.Path(sys.argv[2]); ONLY = set(sys.argv[3:])
sys.path.insert(0, str(H3 / "scripts"))
import spx  # noqa: E402

OUT = APP / "public/data/spherex"; (OUT / "stacks").mkdir(parents=True, exist_ok=True)
N, PIX = 61, 2.05          # output grid: 61 px of 2.05 arcsec (one third of a native pixel), 125 arcsec across
HALF = 17                  # native half-window in rows
BANDS = {"ch4": (3.15, 3.50), "lw": (3.83, 5.00)}
def safe(name): return "".join(c if c.isalnum() or c in "+-_." else "_" for c in name)


def s3key(fn):
    # level2_2025W22_1B_0475_1D1_spx_l2b-v27-2026-199.fits -> <release>/level2/2025W22_1B/l2b-v27-2026-199/1/<file>
    p = fn[:-5].split("_"); week = p[1] + "_" + p[2]; det = p[4][-1]; ver = fn[:-5].split("_spx_")[1]
    return f"level2/{week}/{ver}/{det}/{fn}"


def window(fn, ra, dec):
    """Zodi-subtracted, background-subtracted window resampled on the output grid centred on (ra, dec). NaN = no data."""
    last = None
    for rel in ("dr1", "qr3"):
        try:
            rf, lay, wcs = spx.open_image(f"{rel}/{s3key(fn)}"); break
        except Exception as e: last = e
    else: raise last
    x, y = (float(v) for v in wcs.world_to_pixel_values(ra, dec))
    xc, yc = int(round(x)), int(round(y))
    if not (HALF + 2 < xc < 2040 - HALF - 2 and HALF + 2 < yc < 2040 - HALF - 2): return None
    y0, y1, x0, x1 = yc - HALF, yc + HALF + 1, xc - HALF, xc + HALF + 1
    img, _ = spx.read_rows(rf, lay, "IMAGE", y0, y1, x0, x1); zod, _ = spx.read_rows(rf, lay, "ZODI", y0, y1, x0, x1)
    flg = spx.read_flags_rows(rf, lay, y0, y1, x0, x1)
    d = img - zod; bad = ((flg & spx.BAD) != 0) | ~np.isfinite(d)
    a = d[~bad]
    if a.size < 200: return None
    med = np.median(a)
    for _ in range(3):
        s = 1.4826 * np.median(np.abs(a - med)); a = a[np.abs(a - med) < 3 * s + 1e-12]; med = np.median(a)
    d = np.where(bad, np.nan, d - med)
    k = (np.arange(N) - (N - 1) / 2) * PIX / 3600.0
    dd = dec - k[:, None] + 0 * k[None, :]                        # row 0 = north
    aa = ra - k[None, :] / np.cos(np.radians(dec)) * -1 * -1 + 0 * k[:, None]  # placeholder, fixed below
    aa = ra + (-k[None, :]) / np.cos(np.radians(dd))               # column 0 = east (RA larger on the left)
    px, py = wcs.world_to_pixel_values(aa, dd)
    px = px - x0; py = py - y0
    ix = np.floor(px).astype(int); iy = np.floor(py).astype(int); fx = px - ix; fy = py - iy
    ok = (ix >= 0) & (iy >= 0) & (ix < d.shape[1] - 1) & (iy < d.shape[0] - 1)
    ix = np.clip(ix, 0, d.shape[1] - 2); iy = np.clip(iy, 0, d.shape[0] - 2)
    v = d[iy, ix] * (1 - fx) * (1 - fy) + d[iy, ix + 1] * fx * (1 - fy) + d[iy + 1, ix] * (1 - fx) * fy + d[iy + 1, ix + 1] * fx * fy
    return np.where(ok, v, np.nan)


def stack(cube):
    c = np.array(cube); med = np.nanmedian(c, axis=0)
    sig = 1.4826 * np.nanmedian(np.abs(c - med), axis=0)
    c = np.where(np.abs(c - med) > 4 * sig + 1e-9, np.nan, c)      # single-image outliers (cosmic rays)
    return np.nanmean(c, axis=0), np.sum(np.isfinite(c), axis=0)


def png(a, lo, hi, path):
    v = np.arcsinh((a - lo) / (hi - lo) * 5) / np.arcsinh(5.0)
    v = np.where(np.isfinite(v), np.clip(v, 0, 1), 0)              # missing pixels stay black, no inpainting
    Image.fromarray((v * 255).astype(np.uint8), "L").save(path)


def mjd_date(m): return time.strftime("%Y-%m-%d", time.gmtime((m - 40587) * 86400))


def run(t):
    js = json.loads((H3 / "results/meas3" / f"{t['src']}.json").read_text())
    meas = [m for m in js["meas"] if m["fbad"] < 0.3]
    ep, pmra, pmdec = js["ep"], js.get("pmra") or 0.0, js.get("pmdec") or 0.0
    def pos(mjd):
        dt = 2000.0 + (mjd - 51544.5) / 365.25 - ep
        return js["ra"] + pmra / 3.6e6 * dt / math.cos(math.radians(js["dec"])), js["dec"] + pmdec / 3.6e6 * dt
    lw = [m for m in meas if BANDS["lw"][0] <= m["wave"] < BANDS["lw"][1]]
    ch = [m for m in meas if BANDS["ch4"][0] <= m["wave"] < BANDS["ch4"][1]]
    mid = float(np.median([m["mjd"] for m in lw])); fixed = pos(mid)
    b0 = spx.STATS["bytes"]
    jobs = [("fixed", m, fixed) for m in lw] + [("follow", m, pos(m["mjd"])) for m in lw + ch]
    if math.hypot(pmra, pmdec) < 600:   # under 0.6 arcsec per year the two frames differ by less than a tenth of a pixel
        jobs = [("both", m, fixed) for m in lw] + [("follow", m, fixed) for m in ch]
    def one(j):
        try: return j, window(j[1]["key"], *j[2])
        except Exception as e: return j, None
    with cf.ThreadPoolExecutor(16) as ex: res = list(ex.map(one, jobs))
    got = [(j, w) for j, w in res if w is not None]
    # seasons: gaps of more than 60 days split the 3.83-5.0 um images
    ms = sorted({m["mjd"] for m in lw}); cuts = [ms[0]]
    for a, b in zip(ms[:-1], ms[1:]):
        if b - a > 60: cuts.append(b)
    frames = []
    def add(fid, kind, label, sel, extra=None):
        cube = [w for j, w in got if sel(j)]
        if len(cube) < 4: return
        img, n = stack(cube); frames.append(dict(id=fid, kind=kind, label=label, images=len(cube), img=img, **(extra or {})))
    for i, c in enumerate(cuts):
        hi = cuts[i + 1] if i + 1 < len(cuts) else 1e9
        mm = [m["mjd"] for m in lw if c <= m["mjd"] < hi]
        add(f"date{i}", "date", mjd_date(float(np.median(mm))), lambda j, c=c, hi=hi: j[0] in ("fixed", "both") and c <= j[1]["mjd"] < hi,
            dict(date=mjd_date(float(np.median(mm))), dateRange=[mjd_date(min(mm)), mjd_date(max(mm))], band=[3.83, 5.0]))
    add("lw", "colour", "3.83–5.0 µm", lambda j: j[0] in ("follow", "both") and j[1]["wave"] >= 3.83, dict(band=[3.83, 5.0]))
    add("ch4", "colour", "3.15–3.50 µm · methane band", lambda j: j[0] == "follow" and j[1]["wave"] < 3.6, dict(band=[3.15, 3.5]))
    if not frames: print(t["id"], "no frames"); return None
    ref = next((f for f in frames if f["id"] == "lw"), frames[0])["img"]
    edge = np.concatenate([ref[:12].ravel(), ref[-12:].ravel()]); sig = 1.4826 * np.nanmedian(np.abs(edge - np.nanmedian(edge)))
    c0 = (N - 1) // 2; peak = float(np.nanmax(ref[c0 - 3:c0 + 4, c0 - 3:c0 + 4]))
    lo, hi = -2.0 * sig, max(peak * 1.1, 12 * sig)
    out = []
    for f in frames:
        path = OUT / "stacks" / f"{t['id']}_{f['id']}.png"; png(f.pop("img"), lo, hi, path)
        out.append(dict(f, image=f"/data/spherex/stacks/{path.name}"))
    nbytes = spx.STATS["bytes"] - b0
    print(f"{t['id']}: {len(got)}/{len(jobs)} windows, {len(out)} frames, {nbytes/1e6:.0f} MB, peak/sigma {peak/sig:.1f}", flush=True)
    return dict(frame=dict(system="ICRS TAN", centerRaDeg=round(fixed[0], 6), centerDecDeg=round(fixed[1], 6), width=N, height=N, gridPixelArcsec=PIX, nativePixelArcsec=6.15,
                           northUp=True, eastLeft=True, referencePixelZeroBased=[c0, c0]),
                frames=out, bytesRead=nbytes,
                display=dict(type="asinh", unit="MJy/sr above the local background", vmin=round(float(lo), 4), vmax=round(float(hi), 4), sigma=round(float(sig), 4)),
                processing=["Zodiacal model and local median background subtracted per image", "Flagged defect pixels dropped; source and moving-object flags kept",
                            "Bilinear resampling on a fixed north-up grid of 2.05″ pixels", "Mean of the images after rejection of single-image outliers",
                            "Date frames use a fixed sky grid; colour frames follow the target's catalogued motion", "Missing pixels are black; no inpainting; same stretch for every frame of a target"])


cat = json.load(open(OUT / "cold-dwarfs.json"))
PRIORITY = {"reference": 0, "unpublished": 1, "blind": 2, "published": 3, "rejected": 4}
want = sorted(cat["targets"], key=lambda t: PRIORITY[t["group"]])
src = {t["id"]: t for t in want}
done = json.load(open(OUT / "stacks.json")) if (OUT / "stacks.json").exists() else {}
names = {safe(p.stem): p.stem for p in (H3 / "results/meas3").glob("*.json")}
for t in want:
    if ONLY and t["id"] not in ONLY: continue
    if t["id"] in done and not ONLY: continue
    cand = [n for n in names.values() if n.endswith(t["id"]) and not n.startswith(("STAT_", "TEST_", "N2_"))]
    t["src"] = cand[0]
    r = run(t)
    if r: done[t["id"]] = r; (OUT / "stacks.json").write_text(json.dumps(done, ensure_ascii=False, separators=(",", ":")))
tot = sum(v["bytesRead"] for v in done.values())
with open(pathlib.Path(__file__).resolve().parents[1] / "data_budget.txt", "a") as f:
    f.write(f"2026-11-14 stack_images.py: {spx.STATS['bytes']/1e9:.3f} GB read this run (stacks on disk account for {tot/1e9:.3f} GB read in total)\n")
print("total read this run GB", spx.STATS["bytes"] / 1e9)
