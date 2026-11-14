"""Space Apps 2026 — the objects whose SPHEREx spectra are already published (Gagne et al. 2026, 16,917 ultracool
dwarfs and candidates typed from SPHEREx), with a distance each, for the galaxy map of Blinking Sky.

Distance, in this order: Gaia DR3 parallax (better than 5 sigma); UltracoolSheet parallax; else an estimate from the
SPHEREx type and the CatWISE W2 magnitude, using the type-magnitude relation measured on the objects of this same
table that do have a parallax. Inputs: the published table (local copy), cache/spiff_x_gaia.csv and
cache/spiff_x_catwise.csv (positional cross-matches made at NASA/IPAC IRSA on 2026-11-14, 4.5 and 5 arcsec).
usage: <python with numpy, astropy> build_spherex_dwarfs.py app/public/data <published tables dir>
Record (little-endian, 16 bytes): ra f32, dec f32 (deg, J2000), distance f32 (pc), type u8 (M0 = 0, L0 = 10, T0 = 20,
Y0 = 30), group u8 (0 known, 1 known candidate, 2 new candidate, 3 new in that study), basis u8 (0 measured,
1 estimated), pad."""
import csv, json, pathlib, re, sys
import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u

OUT = pathlib.Path(sys.argv[1]); HERE = pathlib.Path(__file__).parent
K = pathlib.Path(sys.argv[2])  # folder of the published SPHEREx tables, read-only
rows = list(csv.DictReader(open(K / "zenodo_spiff/tables/spiff_tables/spherex_autotype_datasets_fulltable.csv")))
n = len(rows)
sc = SkyCoord([x["ra_j2000"] for x in rows], [x["dec_j2000"] for x in rows], unit=(u.hourangle, u.deg))
def tnum(s):
    m = re.search(r"([MLTY])\s*(\d+(?:\.\d+)?)", s or "")
    return {"M": 0, "L": 10, "T": 20, "Y": 30}[m.group(1)] + float(m.group(2)) if m else np.nan
typ = np.array([tnum(x["spiff_autotype"]) for x in rows])
GROUP = {"Known": 0, "Known Candidates": 1, "New Candidates": 2, "New Discoveries": 3}
grp = np.array([GROUP[x["dataset"]] for x in rows])
ra, dec = sc.ra.deg, sc.dec.deg
def sep(i, a, d): return np.hypot((a - ra[i]) * np.cos(np.radians(dec[i])), d - dec[i]) * 3600

plx = np.full(n, np.nan); w2 = np.full(n, np.nan); best = np.full(n, 99.0)
for g in csv.DictReader(open(HERE / "cache/spiff_x_gaia.csv")):
    i = int(g["id"])
    try: p, poe = float(g["parallax"]), float(g["parallax_over_error"])
    except ValueError: continue
    s = sep(i, float(g["ra"]), float(g["dec"]))
    if poe > 5 and p > 2 and s < best[i]: best[i] = s; plx[i] = p
gaia = np.isfinite(plx)
bw = np.full(n, 99.0)
for c in csv.DictReader(open(HERE / "cache/spiff_x_catwise.csv")):
    i = int(c["id"])
    try: m = float(c["w2mpro"])
    except ValueError: continue
    s = sep(i, float(c["ra"]), float(c["dec"]))
    if s < bw[i]: bw[i] = s; w2[i] = m
U = [x for x in csv.DictReader(open(K / "ucs/ucs_main.csv")) if x["ra_j2000_formula"] not in ("", "nan")]
def fl(v):
    try: return float(v)
    except (ValueError, TypeError): return np.nan
us = SkyCoord([fl(x["ra_j2000_formula"]) for x in U] * u.deg, [fl(x["dec_j2000_formula"]) for x in U] * u.deg)
iu, du, _ = sc.match_to_catalog_sky(us)
up = np.array([fl(U[k]["plx_formula"]) for k in iu]); uw = np.array([fl(U[k]["W2"]) for k in iu])
ucs = (du.arcsec < 15) & np.isfinite(up) & (up > 1) & ~gaia
plx[ucs] = up[ucs]; w2 = np.where(np.isfinite(w2), w2, np.where(du.arcsec < 15, uw, np.nan))
dist = np.where(np.isfinite(plx), 1000 / plx, np.nan); measured = np.isfinite(dist)
# Type-magnitude relation from this sample: median absolute W2 per subtype where at least 8 objects have a parallax.
MW2 = w2 - 5 * np.log10(dist / 10)
rel = {}
for t in range(5, 33):
    s = measured & np.isfinite(MW2) & (np.round(typ) == t)
    if s.sum() >= 8: rel[t] = (float(np.median(MW2[s])), float(1.4826 * np.median(np.abs(MW2[s] - np.median(MW2[s])))), int(s.sum()))
ts = sorted(rel); print("relation:", {("MLTY"[t // 10] + str(t % 10)): (round(rel[t][0], 2), round(rel[t][1], 2), rel[t][2]) for t in ts})
est = ~measured & np.isfinite(w2) & np.isfinite(typ) & (typ >= ts[0]) & (typ <= ts[-1])
mrel = np.interp(typ[est], ts, [rel[t][0] for t in ts])
dist[est] = 10 ** ((w2[est] - mrel) / 5 + 1)
ok = np.isfinite(dist) & (dist > 0.5) & (dist < 2000) & np.isfinite(typ)
print(n, "objects | Gaia parallax", int(gaia.sum()), "| UltracoolSheet parallax", int(ucs.sum()), "| estimated", int((est & ok).sum()), "| no distance", int((~ok).sum()))
print("distance percentiles (pc):", np.percentile(dist[ok], [5, 50, 95]).round(0))
rec = np.zeros(int(ok.sum()), dtype=[("ra", "<f4"), ("dec", "<f4"), ("d", "<f4"), ("t", "u1"), ("g", "u1"), ("b", "u1"), ("pad", "u1")])
rec["ra"], rec["dec"], rec["d"], rec["t"], rec["g"], rec["b"] = ra[ok], dec[ok], dist[ok], np.round(typ[ok]).astype(int), grp[ok], (~measured[ok]).astype(int)
(OUT / "spherex-dwarfs.bin").write_bytes(rec.tobytes())
json.dump(dict(schemaVersion=1, count=int(ok.sum()), total=n, withoutDistance=int((~ok).sum()), measured=int((measured & ok).sum()), estimated=int((est & ok).sum()),
               source="Gagné et al. 2026, SPHEREx types of ultracool dwarfs (Zenodo 10.5281/zenodo.19051216); parallaxes: Gaia DR3 and the UltracoolSheet; W2: CatWISE2020",
               record=__doc__.split("Record")[1].strip(), groups=["Known", "Known candidate", "New candidate", "New in that study"],
               absoluteW2={("MLTY"[t // 10] + str(t % 10)): [round(rel[t][0], 2), round(rel[t][1], 2), rel[t][2]] for t in ts},
               names=[rows[i]["designation"] for i in np.flatnonzero(ok)], types=[rows[i]["spiff_autotype"] for i in np.flatnonzero(ok)]), open(OUT / "spherex-dwarfs.json", "w"), separators=(",", ":"))
print("bytes", rec.nbytes, (OUT / "spherex-dwarfs.json").stat().st_size)
