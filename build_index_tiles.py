"""Space Apps 2026 — cut the footprint index of all public SPHEREx level-2 images (1.6 million rows) into small binary
tiles a web page can fetch: app/public/index/meta.json and b<band>_<cell>.bin. No network access.

Record (36 bytes, little-endian): ra f32, dec f32 (deg, image centre), mjd-60000 f32, cd 4 x f32 (deg/pixel),
exposure u16, week u8, version u8, sub-exposure u8, detector u8 (bit 7 set: release qr3), 2 bytes of padding.
usage: <python with numpy> build_index_tiles.py cache/index.npz app/public/index
"""
import json, pathlib, re, sys
import numpy as np

src, out = sys.argv[1], pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
z = np.load(src); keys = z["keys"]; n = len(keys)
pat = re.compile(r"^(dr1|qr3)/level2/([^/]+)/([^/]+)/(\d)/level2_\2_(\d{4})_(\d)D\4_spx_\3\.fits$")
weeks, versions = {}, {}
rec = np.zeros(n, dtype=[("ra", "<f4"), ("dec", "<f4"), ("mjd", "<f4"), ("cd", "<f4", 4), ("exp", "<u2"), ("week", "u1"), ("ver", "u1"), ("sub", "u1"), ("det", "u1"), ("pad", "u1", 2)])
bad = 0
for i, k in enumerate(keys):
    m = pat.match(str(k))
    if not m: bad += 1; rec["det"][i] = 0; continue
    rel, wk, ver, det, exp, sub = m.groups()
    rec["week"][i] = weeks.setdefault(wk, len(weeks)); rec["ver"][i] = versions.setdefault(ver, len(versions))
    rec["exp"][i] = int(exp); rec["sub"][i] = int(sub); rec["det"][i] = int(det) | (128 if rel == "qr3" else 0)
assert len(weeks) < 256 and len(versions) < 256, (len(weeks), len(versions))
rec["ra"] = z["ra"]; rec["dec"] = z["dec"]; rec["mjd"] = z["mjd"] - 60000; rec["cd"] = z["cd"]
ok = (rec["det"] > 0) & np.isfinite(z["ra"]) & np.isfinite(z["dec"]) & np.all(np.abs(z["crpix"] - 1020.5) < 0.01, axis=1)
rec = rec[ok]; print(n, "rows,", bad, "unparsed keys,", len(rec), "kept")
STEP = 3.0; nb = int(180 / STEP)
band = np.clip(((rec["dec"].astype(float) + 90) / STEP).astype(int), 0, nb - 1)
cells = [max(1, int(round(360 / STEP * np.cos(np.radians(-90 + (b + 0.5) * STEP))))) for b in range(nb)]
cell = np.array([min(cells[b] - 1, int(r / 360 * cells[b])) for b, r in zip(band, rec["ra"].astype(float) % 360)])
order = np.lexsort((cell, band)); rec, band, cell = rec[order], band[order], cell[order]
edges = np.flatnonzero(np.diff(band * 1000 + cell)) + 1
total = 0; sizes = []
for a, b in zip(np.r_[0, edges], np.r_[edges, len(rec)]):
    (out / f"b{band[a]}_{cell[a]}.bin").write_bytes(rec[a:b].tobytes()); total += (b - a) * 36; sizes.append(b - a)
json.dump(dict(schemaVersion=1, step=STEP, cells=cells, record=36, images=int(len(rec)), weeks=list(weeks), versions=list(versions),
               source="Headers of the SPHEREx DR1 and QR3 level-2 images in the public bucket, read 2026-11-13/14",
               credit="NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA"), open(out / "meta.json", "w"))
print(len(sizes), "tiles,", round(total / 1e6, 1), "MB, largest tile", max(sizes) * 36 // 1024, "kB, median", int(np.median(sizes)) * 36 // 1024, "kB")
