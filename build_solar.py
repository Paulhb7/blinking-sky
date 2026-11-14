"""Space Apps 2026 — the Solar System layer of Blinking Sky: every small body for which the earlier work already holds a
list of SPHEREx exposures (IRSA Moving Object Search Tool, detectors 5 and 6), with one visit each: up to six single
exposures a few hours apart in which the body crosses a fixed 10 arcmin field. No image is read here: the browser reads
them. Positions: where the body was at that visit (from its sky position and distance, and the Earth's place that day).
usage: <python with numpy, astropy> build_solar.py <H1_co2_activity dir> <holo-mars dir> app/public/data
"""
import glob, json, math, pathlib, re, sys
import numpy as np
from astropy.time import Time
from astropy.coordinates import get_body_barycentric

H1, APP, OUT = (pathlib.Path(a) for a in sys.argv[1:4])
def sep(a, b): return math.hypot((a["ra"] - b["ra"]) * math.cos(math.radians(a["dec"])), a["dec"] - b["dec"]) * 3600
sb = json.load(open(APP / "public/data/small-bodies.json"))
byNumber = {}
for i, n in enumerate(sb["names"]):
    m = re.match(r"^(\d+)\s", n)
    if m: byNumber[m.group(1)] = (n, sb["cls"][i])
    m = re.match(r"^(\d+[PD]|[CP]/\S+)", n)
    if m: byNumber[m.group(1)] = (n, "COM")
named = {str(t["des"]): t for f in ("targets.json", "targets_night.json") if (H1 / "results" / f).exists() for t in json.load(open(H1 / "results" / f))}
bodies, skipped = [], 0
for f in sorted(glob.glob(str(H1 / "results/phot/*.json")) + glob.glob(str(H1 / "results/phot_night/*.json"))):
    d = json.load(open(f)); des = str(d["des"]); meas = sorted([m for m in d.get("meas", []) if m.get("key")], key=lambda m: m["mjd"])
    if len(meas) < 3 or any(b["des"] == des for b in bodies): skipped += 1; continue
    runs, cur = [], [meas[0]]
    for m in meas[1:]:
        if m["mjd"] - cur[-1]["mjd"] < 0.5: cur.append(m)
        else: runs.append(cur); cur = [m]
    runs.append(cur)
    good = [r for r in runs if len(r) >= 3 and 40 <= sep(r[0], r[-1]) <= 420]
    if not good: skipped += 1; continue
    run = max(good, key=len); pick = [run[i] for i in sorted(set(np.linspace(0, len(run) - 1, min(6, len(run))).round().astype(int)))]
    ra0 = (pick[0]["ra"] + pick[-1]["ra"]) / 2; dec0 = (pick[0]["dec"] + pick[-1]["dec"]) / 2
    name, cls = byNumber.get(des, (None, None))
    t = named.get(des, {})
    name = name or (t.get("name") if t.get("name") and t.get("name") != des else None) or (des if re.search(r"[A-Za-z]", des) else f"({des})")
    m = re.match(r"^(\d+)\s+(.+?)\s*(\(.*\))?$", name)
    if m: name = f"({m.group(1)}) {m.group(2)}"
    comet = bool(re.match(r"^\d+[PD]|^[CP]/", des))
    kind = "comet" if comet or cls == "COM" else "centaur" if cls in ("CEN",) or t.get("kind") == "cen" else "near-Earth" if cls in ("APO", "AMO", "ATE", "IEO") else "trojan" if cls in ("TJN",) else "asteroid"
    bodies.append(dict(des=des, name=name, kind=kind, v=pick[0].get("v"), rh=pick[0].get("rh"), delta=pick[0].get("delta"), ra=round(ra0, 5), dec=round(dec0, 5),
                       moved=round(sep(pick[0], pick[-1])), hours=round((pick[-1]["mjd"] - pick[0]["mjd"]) * 24, 1), mjd=round(pick[0]["mjd"], 3),
                       frames=[[m["key"], round(m["ra"], 5), round(m["dec"], 5), round(m["mjd"], 4), round(m["lam"], 2)] for m in pick]))
# Heliocentric place at the visit, equatorial axes, au: the Earth's place that day plus the line of sight times the distance.
tt = Time([b["mjd"] for b in bodies], format="mjd"); earth = (get_body_barycentric("earth", tt) - get_body_barycentric("sun", tt)).xyz.to_value("au").T
keep = []
for b, e in zip(bodies, earth):
    if not b["delta"]: continue
    a, d = math.radians(b["ra"]), math.radians(b["dec"])
    p = e + b["delta"] * np.array([math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d)])
    b["p"] = [round(float(v), 4) for v in p]; b["id"] = "sb-" + re.sub(r"[^A-Za-z0-9]", "", b["des"]); del b["delta"]; keep.append(b)
keep.sort(key=lambda b: (b["v"] is None, b["v"] or 99))
planets = json.load(open(APP / "public/data/solar-system.json"))["bodies"]
# The map needs one light file; the image lists are fetched in small pieces, only for the body that is opened.
CHUNK = 128; (OUT / "solar").mkdir(exist_ok=True)
for k in range(0, len(keep), CHUNK):
    json.dump({b["id"]: b["frames"] for b in keep[k:k + CHUNK]}, open(OUT / "solar" / f"frames-{k // CHUNK}.json", "w"), separators=(",", ":"))
json.dump(dict(schemaVersion=1, generated="2026-11-14", count=len(keep), chunk=CHUNK,
               credit="Image lists and predicted positions: IRSA Moving Object Search Tool (earlier small-body work); orbital elements of the planets: JPL Horizons; classes: JPL Small-Body Database.",
               note="Each body is placed where it was at the date of its SPHEREx visit, not where it is today.",
               planets=[{k: p[k] for k in ("id", "name", "epochJd", "e", "i", "node", "peri", "meanAnomaly", "meanMotion", "a")} for p in planets],
               bodies=[{k: v for k, v in b.items() if k != "frames"} for b in keep]),
          open(OUT / "solar.json", "w"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print(len(keep), "bodies with a usable visit;", skipped, "without;", Counter(b["kind"] for b in keep), "| bytes", (OUT / "solar.json").stat().st_size)
print([ (b["name"], b["v"]) for b in keep[:8]])
