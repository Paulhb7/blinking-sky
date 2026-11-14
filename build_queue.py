"""Space Apps 2026 — the review queue of Blinking Sky: red CatWISE2020 sources with a marginal proper motion that the
earlier search left out and nobody has measured in SPHEREx. No network access.

Selection (from the cached CatWISE2020 scan, W1-W2 > 2.0, W2 S/N > 10, clean flags): |b| >= 15, W2 < 15.5, and either
motion >= 0.15 arcsec/yr at 3.5-5 sigma or 0.10-0.15 arcsec/yr at >= 5 sigma. Removed: sources within 20-25 arcsec of the
UltracoolSheet, of the SPHEREx table of Gagne et al. 2026, of the published candidate lists used earlier and of the
Backyard Worlds list of Schneider et al. 2026; sources in clumps (more than 5 selected red sources within 1 degree).
usage: <python with numpy, astropy> build_queue.py <H3_cold_dwarfs dir> app/public/data/queue.json
"""
import csv, glob, json, pathlib, re, sys
import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u

H3 = pathlib.Path(sys.argv[1]); OUT = pathlib.Path(sys.argv[2])
K4 = pathlib.Path("/Users/paul.barbaste/Desktop/h/h-astronomists/planet9/H_spherex/K4_brown_dwarfs/raw")  # read-only


def fl(s):
    try: return float(s)
    except (ValueError, TypeError): return np.nan


seen, rows = set(), []
for f in sorted(glob.glob(str(H3 / "raw/catwise_red/chunk_*.json"))):
    for r in json.load(open(f)):
        if r["source_name"] in seen: continue
        seen.add(r["source_name"])
        pmra, pmde, sra, sde = fl(r["pmra"]), fl(r["pmdec"]), fl(r["sigpmra"]), fl(r["sigpmdec"])
        d = dict(name=r["source_name"], ra=fl(r["ra_pm"]), dec=fl(r["dec_pm"]), pmra=pmra * 1000, pmdec=pmde * 1000, W1=fl(r["w1mpro"]), W2=fl(r["w2mpro"]), glat=fl(r["glat"]),
                 pm=float(np.hypot(pmra, pmde)), sig=float(np.hypot(pmra / sra, pmde / sde)) if sra and sde else np.nan,
                 clean=(str(r["ab_flags"]).zfill(2) == "00" and str(r["cc_flags"]).zfill(4) == "0000"))
        if np.isfinite([d["ra"], d["dec"], d["pm"], d["sig"], d["W1"], d["W2"]]).all() and d["clean"] and abs(d["glat"]) >= 15: rows.append(d)
moving = [r for r in rows if r["pm"] >= 0.10 and r["sig"] >= 3.5]
sel = [r for r in moving if r["W2"] < 15.5 and ((r["pm"] >= 0.15 and r["sig"] < 5) or (r["pm"] < 0.15 and r["sig"] >= 5))]
print(len(rows), "clean red sources at high latitude;", len(sel), "selected before the removals")
sc = SkyCoord([r["ra"] for r in sel] * u.deg, [r["dec"] for r in sel] * u.deg)
U = [x for x in csv.DictReader(open(K4 / "ucs/ucs_main.csv")) if np.isfinite(fl(x["ra_20250703_formula"]))]
S = list(csv.DictReader(open(K4 / "zenodo_spiff/tables/spiff_tables/spherex_autotype_datasets_fulltable.csv")))
P = json.load(open(H3 / "raw/candidates_pool.json"))
def desig(n):
    m = re.search(r"J(\d\d)(\d\d)(\d\d\.\d+)([+-])(\d\d)(\d\d)(\d\d\.?\d*)", n)
    if not m: return None
    ra = 15 * (int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600); de = int(m.group(5)) + int(m.group(6)) / 60 + float(m.group(7)) / 3600
    return ra, (-de if m.group(4) == "-" else de)
BY = [b for b in (desig(l[:20]) for l in open(H3 / "raw/vizier/Schneider2026_Table1.mrt") if l.startswith("J") or l.startswith("CWISE")) if b]
done = [json.load(open(f)) for f in []]
refs = [(SkyCoord([fl(x["ra_20250703_formula"]) for x in U] * u.deg, [fl(x["dec_20250703_formula"]) for x in U] * u.deg), 25),
        (SkyCoord([x["ra_j2000"] for x in S], [x["dec_j2000"] for x in S], unit=(u.hourangle, u.deg)), 25),
        (SkyCoord([p["ra"] for p in P] * u.deg, [p["dec"] for p in P] * u.deg), 20),
        (SkyCoord([b[0] for b in BY] * u.deg, [b[1] for b in BY] * u.deg), 20)]
known = np.zeros(len(sel), bool)
for cat, tol in refs:
    _, d, _ = sc.match_to_catalog_sky(cat); known |= d.arcsec < tol
# Already measured in the earlier search (any role): not "unchecked".
E = json.load(open(H3 / "results/summary.json")); names = {s["name"].replace("POOL_", "") for s in E}
known |= np.array([r["name"] in names for r in sel])
# Clumps of spurious red "moving" sources: count all moving red sources within 1 degree.
allc = SkyCoord([r["ra"] for r in moving] * u.deg, [r["dec"] for r in moving] * u.deg)
i1, _, _, _ = allc.search_around_sky(sc, 1.0 * u.deg); crowd = np.bincount(i1, minlength=len(sel)) - 1
keep = [dict(id="J" + r["name"].split("J")[-1], name="CWISE " + r["name"] if not r["name"].startswith("CWISE") else r["name"], ra=round(r["ra"], 6), dec=round(r["dec"], 6), epoch=2015.4,
             pm=[round(r["pmra"], 1), round(r["pmdec"], 1)], pmTotal=round(r["pm"], 3), pmSigma=round(r["sig"], 1), W1=round(r["W1"], 3), W2=round(r["W2"], 3))
        for r, k, c in zip(sel, known, crowd) if not k and c <= 5]
keep.sort(key=lambda r: r["W2"])
print("removed as known or already measured:", int(known.sum()), "| in clumps:", int((crowd > 5).sum()), "| queue:", len(keep))
print("W2 histogram:", np.histogram([r["W2"] for r in keep], bins=[12, 14, 14.5, 15, 15.25, 15.5])[0])
OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump(dict(schemaVersion=1, generated="2026-11-14", selection=__doc__.split("usage:")[0].strip(), credit="CatWISE2020 (Marocco et al. 2021)", sources=keep), open(OUT, "w"), separators=(",", ":"))
