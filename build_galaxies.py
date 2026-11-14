"""Space Apps 2026 — galaxies for the map of Blinking Sky. No network access.
The 2MASS Redshift Survey (Huchra et al. 2012): 43,463 galaxies with a measured redshift, as placed by Project Atlas
(flat LCDM, H0 = 67.7, Om = 0.31). Record (float32, little-endian): x, y, z (kpc, Sun at the origin, galactic axes), K magnitude.
usage: <python with numpy> build_galaxies.py <holo-mars dir> app/public/data"""
import json, pathlib, sys
import numpy as np
APP, OUT = (pathlib.Path(a) for a in sys.argv[1:3])
c = json.load(open(APP / "public/data/cosmic-web.json"))
P = np.array(c["positions"], float).reshape(-1, 3) - np.array([-8.2, 0.02, 0.0])
rec = np.zeros(len(P), dtype=[("x", "<f4"), ("y", "<f4"), ("z", "<f4"), ("k", "<f4")])
rec["x"], rec["y"], rec["z"], rec["k"] = P[:, 0], P[:, 1], P[:, 2], np.array([np.nan if v is None else v for v in c["kmag"]], float)
(OUT / "galaxies.bin").write_bytes(rec.tobytes())
d = np.linalg.norm(P, axis=1) / 1000
json.dump(dict(schemaVersion=1, source=c["source"], cosmology=c["cosmology"], count=int(len(rec)), record="x, y, z (kpc, Sun at the origin, galactic axes of Project Atlas), K magnitude; float32",
               names=c["names"]),
          open(OUT / "galaxies.json", "w"), separators=(",", ":"))
print(len(rec), "galaxies; distance Mpc percentiles", np.percentile(d, [5, 50, 95, 100]).round(0), "| bytes", rec.nbytes, (OUT / "galaxies.json").stat().st_size)
