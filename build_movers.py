"""Space Apps 2026 — Solar System bodies crossing a fixed patch of sky in single SPHEREx exposures.

For each body, takes the exposures of one visit (a few hours to two days) from the earlier small-body work (image
list and predicted positions from the IRSA Moving Object Search Tool, checked there against JPL Horizons), reads a
window of each from the public bucket and resamples it on one fixed north-up grid: the stars stay, the body moves.
Single exposures, no stacking, no motion added. Writes app/public/data/movers.json and movers/*.png.
usage: <python with numpy, astropy, requests, PIL> build_movers.py <H1_co2_activity dir> <H3_cold_dwarfs dir> app/public/data
"""
import json, math, pathlib, sys, time
import numpy as np
from PIL import Image
H1, H3, OUT = (pathlib.Path(a) for a in sys.argv[1:4])
sys.path.insert(0, str(H3 / "scripts"))
import spx  # noqa: E402
(OUT / "movers").mkdir(parents=True, exist_ok=True)
N, PIX, HALF = 121, 5.0, 56   # 10 arcmin field of 5 arcsec pixels; native half-window in rows
BODIES = [
    dict(file="29P", id="29P", name="29P/Schwassmann–Wachmann", kind="comet", blurb="An active comet beyond Jupiter, known for its outbursts. Each frame is one SPHEREx exposure of the same patch of sky: the stars stay, the comet moves."),
    dict(file="2", id="pallas", name="(2) Pallas", kind="asteroid", blurb="The third largest asteroid, 500 km across. Each frame is one SPHEREx exposure of the same patch of sky: the stars stay, the asteroid moves."),
    dict(file="31", id="euphrosyne", name="(31) Euphrosyne", kind="asteroid", blurb="A large dark asteroid of the outer main belt. Each frame is one SPHEREx exposure of the same patch of sky."),
]
def when(mjd): return time.strftime("%Y-%m-%dT%H:%M", time.gmtime((mjd - 40587) * 86400))
def sep(a, b): return math.hypot((a["ra"] - b["ra"]) * math.cos(math.radians(a["dec"])), a["dec"] - b["dec"]) * 3600

def window(key, ra, dec):
    rf, lay, wcs = spx.open_image(key)
    x, y = (float(v) for v in wcs.world_to_pixel_values(ra, dec)); xc, yc = int(round(x)), int(round(y))
    if not (HALF + 2 < xc < 2040 - HALF - 2 and HALF + 2 < yc < 2040 - HALF - 2): return None
    y0, y1, x0, x1 = yc - HALF, yc + HALF + 1, xc - HALF, xc + HALF + 1
    img, _ = spx.read_rows(rf, lay, "IMAGE", y0, y1, x0, x1); zod, _ = spx.read_rows(rf, lay, "ZODI", y0, y1, x0, x1)
    flg = spx.read_flags_rows(rf, lay, y0, y1, x0, x1)
    d = np.where((flg & spx.BAD) != 0, np.nan, img - zod); a = d[np.isfinite(d)]   # defect pixels dropped; source and moving-object flags kept
    med = np.median(a)
    for _ in range(3):
        s = 1.4826 * np.median(np.abs(a - med)); a = a[np.abs(a - med) < 3 * s + 1e-12]; med = np.median(a)
    d = d - med
    k = (np.arange(N) - (N - 1) / 2) * PIX / 3600.0
    dd = dec - k[:, None] + 0 * k[None, :]; aa = ra + (-k[None, :]) / np.cos(np.radians(dd))
    px, py = wcs.world_to_pixel_values(aa, dd); px = px - x0; py = py - y0
    ix = np.floor(px).astype(int); iy = np.floor(py).astype(int); fx = px - ix; fy = py - iy
    ok = (ix >= 0) & (iy >= 0) & (ix < d.shape[1] - 1) & (iy < d.shape[0] - 1)
    ix = np.clip(ix, 0, d.shape[1] - 2); iy = np.clip(iy, 0, d.shape[0] - 2)
    v = d[iy, ix] * (1 - fx) * (1 - fy) + d[iy, ix + 1] * fx * (1 - fy) + d[iy + 1, ix] * (1 - fx) * fy + d[iy + 1, ix + 1] * fx * fy
    return np.where(ok, v, np.nan), float(1.4826 * np.median(np.abs(a - med)))

out = []
for b in BODIES:
    meas = sorted(json.load(open(H1 / "results/phot" / f"{b['file']}.json"))["meas"], key=lambda m: m["mjd"])
    # visits: runs of exposures less than 12 hours apart, kept when the body crosses 40 to 420 arcsec
    runs, cur = [], [meas[0]]
    for m in meas[1:]:
        if m["mjd"] - cur[-1]["mjd"] < 0.5: cur.append(m)
        else: runs.append(cur); cur = [m]
    runs.append(cur)
    good = [r for r in runs if len(r) >= 3 and 40 <= sep(r[0], r[-1]) <= 420]
    if not good: print(b["name"], "no usable visit:", [(len(r), round(sep(r[0], r[-1]))) for r in runs]); continue
    run = max(good, key=len)
    pick = [run[i] for i in sorted(set(np.linspace(0, len(run) - 1, min(6, len(run))).round().astype(int)))]
    ra0 = (pick[0]["ra"] + pick[-1]["ra"]) / 2; dec0 = (pick[0]["dec"] + pick[-1]["dec"]) / 2
    frames, sig = [], []
    for m in pick:
        try: r = window(m["key"], ra0, dec0)
        except Exception as e: print("  skip", m["key"].split("/")[-1], str(e)[:60]); continue
        if r is None: continue
        # where the body is on the grid in this exposure (column from the east side, row from the north)
        gx = (N - 1) / 2 - (m["ra"] - ra0) * math.cos(math.radians(dec0)) * 3600 / PIX; gy = (N - 1) / 2 - (m["dec"] - dec0) * 3600 / PIX
        frames.append(dict(m=m, img=r[0], at=[round(gx, 1), round(gy, 1)])); sig.append(r[1])
    if len(frames) < 3: print(b["name"], "too few frames"); continue
    # brightness of the body: the median over the frames, so that one cosmic ray cannot set the stretch
    s = float(np.median(sig)); peak = float(np.median([np.nanmax(f["img"][int(f["at"][1]) - 2:int(f["at"][1]) + 3, int(f["at"][0]) - 2:int(f["at"][0]) + 3]) for f in frames]))
    lo, hi = -2 * s, min(max(peak * 1.1, 14 * s), 90 * s)
    recs = []
    for i, f in enumerate(frames):
        v = np.arcsinh((f["img"] - lo) / (hi - lo) * 5) / np.arcsinh(5.0); v = np.where(np.isfinite(v), np.clip(v, 0, 1), 0)
        path = OUT / "movers" / f"{b['id']}_{i}.png"; Image.fromarray((v * 255).astype(np.uint8), "L").save(path)
        recs.append(dict(id=f"date{i}", kind="date", label=when(f["m"]["mjd"]).replace("T", " · ") + " UT", date=when(f["m"]["mjd"])[:10], time=when(f["m"]["mjd"]), images=1,
                         band=[round(f["m"]["lam"], 2), round(f["m"]["lam"], 2)], image=f"/data/movers/{path.name}", at=f["at"]))
    hours = (frames[-1]["m"]["mjd"] - frames[0]["m"]["mjd"]) * 24; moved = sep(frames[0]["m"], frames[-1]["m"])
    out.append(dict(id=b["id"], name=b["name"], kind=b["kind"], blurb=b["blurb"], ra=round(ra0, 6), dec=round(dec0, 6),
                    frame=dict(system="ICRS TAN", centerRaDeg=round(ra0, 6), centerDecDeg=round(dec0, 6), width=N, height=N, gridPixelArcsec=PIX, nativePixelArcsec=6.15, referencePixelZeroBased=[(N - 1) // 2, (N - 1) // 2]),
                    frames=recs, hours=round(hours, 1), movedArcsec=round(moved), sunDistanceAu=round(frames[0]["m"]["rh"], 2), earthDistanceAu=round(frames[0]["m"]["delta"], 2), vmag=frames[0]["m"].get("v")))
    print(f"{b['name']}: {len(recs)} frames over {hours:.1f} h, moved {moved:.0f} arcsec, peak/sigma {peak / s:.0f}", flush=True)
json.dump(dict(schemaVersion=1, generated="2026-11-14", credit="SPHEREx level-2 images: NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA. Image lists and predicted positions: IRSA Moving Object Search Tool; ephemerides: JPL Horizons.",
               processing=["Single exposures, 3.8–5 µm; the wavelength differs a little from one exposure to the next", "Zodiacal model and local median background subtracted; flagged defect pixels are black", "Bilinear resampling on one fixed north-up grid of 5″ pixels, 10′ across", "Same stretch for every frame of a body; missing pixels are black; nothing is moved or amplified"],
               bodies=out), open(OUT / "movers.json", "w"), ensure_ascii=False, separators=(",", ":"))
with open(pathlib.Path(__file__).resolve().parents[1] / "data_budget.txt", "a") as f: f.write(f"2026-11-14 build_movers.py: {spx.STATS['bytes'] / 1e9:.3f} GB read\n")
print("GB read", spx.STATS["bytes"] / 1e9)
