"""Space Apps 2026 (14-15 Nov) — package the cold-dwarf results for the Atlas SPHEREx view.

Reads the earlier research folder (read-only): per-image SPHEREx measurements, frozen analysis and template fits.
Writes one JSON for the web app: public/data/spherex/cold-dwarfs.json. No network access.

usage: <python with numpy> build_catalog.py <H3_cold_dwarfs dir> <holo-mars dir>
"""
import json, math, pathlib, re, shutil, sys
import numpy as np

H3 = pathlib.Path(sys.argv[1]); APP = pathlib.Path(sys.argv[2])
sys.path.insert(0, str(H3 / "scripts"))
import analyze as A  # noqa: E402  frozen band definitions
import typefit as TF  # noqa: E402

OUT = APP / "public/data/spherex"
(OUT / "deep").mkdir(parents=True, exist_ok=True)
EPOCH = 2025.9  # positions are propagated to the middle of the SPHEREx baseline


def safe(name): return "".join(c if c.isalnum() or c in "+-_." else "_" for c in name)
def r(x, n=3): return None if x is None or not np.isfinite(x) else round(float(x), n)


REPL = [("type photométrique", "photometric type"), ("photométrique", "photometric"), ("à 142 pc", "at 142 pc"), ("couleur Spitzer", "Spitzer colour"),
        ("mouvement non confirmé", "motion not confirmed"), (" et ", " and "), ("non vérifié pour celle-ci", "not checked for this one"), (" ; ", "; ")]


def status(pub):
    """French research note -> (group, English sentence)."""
    p = pub
    for a, b in REPL: p = p.replace(a, b)
    if pub.startswith("aucune publication trouvée"):
        extra = "; an SDSS source lies 1.4″ away, nature not checked" if "SDSS" in pub else ""
        return "unpublished", "No publication found in the catalogs and lists searched" + extra
    if pub.startswith("candidate K24"):
        return "published", "Published candidate (Kirkpatrick et al. 2024, photometric type); no published spectrum found"
    if pub.startswith("candidate publiée sans spectre"):
        return "published", "Published candidate, no published spectrum found — " + p.split("— ", 1)[1]
    if pub.startswith("naine typée par spectre"):
        return "blind", "Already typed from a spectrum — " + p.split("— ", 1)[1]
    if pub.startswith("protoétoile"):
        return "rejected", "Known protostar — IRAS 03282+3035 (SIMBAD)"
    if pub.startswith("région"):
        return "rejected", "Star-forming region — dense core in Ophiuchus (SIMBAD)"
    if pub.startswith("artefact"):
        return "rejected", "Artefact — diffraction spike of a bright star (unWISE image)"
    raise ValueError(pub)


def decision(d):
    if d.startswith("gardée, voisin"): return "kept", "Kept; a neighbour inside the SPHEREx pixel needs watching"
    if d.startswith("gardée"): return "kept", ""
    if "ajustement" in d: return "rejected", "Rejected: the fitted spectrum is not compatible with a dwarf of type T4 or later"
    if "protoétoile" in d: return "rejected", "Rejected: protostar. Its ice absorption mimics the methane dip"
    if "Ophiuchus" in d: return "rejected", "Rejected: nebulosity of a dense core, not a point source"
    if "aigrette" in d: return "rejected", "Rejected: diffraction spike of a bright star"
    raise ValueError(d)


# Reading of the deep imaging for the 12 candidates with no publication found (earlier check, translated).
NOTES = {
    "J235953.52-280957.6": "Red point source seen in z only (r > 26); no J-band image available.",
    "J043050.49-072453.9": "Colours and motion of a late T dwarf.",
    "J111646.88-233305.8": "Colours of a late T dwarf.",
    "J121122.23-160045.9": "Colours of a late T dwarf; J−H = −0.24.",
    "J143401.92-065526.3": "Seen in J only; the expected z ≈ 22.5 is below the survey limit.",
    "J020114.67-325005.1": "Motion confirmed independently by optical astrometry.",
    "J114142.55+592837.2": "Red point source in z; no J-band image.",
    "J101027.39+152220.6": "Fragile: a faint blue source (g, r ≈ 24.5) lies 0.9″ away.",
    "J000415.20-213707.8": "Colours of a late T dwarf.",
    "J140138.51-200050.1": "Motion confirmed independently by optical astrometry.",
    "J013425.70+333752.4": "Fragile: outside the deep surveys; SDSS sees a faint source classed as a galaxy 1.4″ away.",
    "J234020.49-084813.3": "Colours of a late T dwarf; SPHEREx signal-to-noise at the limit.",
}

summary = {s["name"]: s for s in json.load(open(H3 / "results/summary.json"))}
fits = json.load(open(H3 / "results/typefit.json"))["fits"]
colours = {c["name"]: c for c in json.load(open(H3 / "results/unpub12/colours.json"))}
GRID = TF.GRID


def model(F, E, fit):
    """Best template scaled exactly as in the frozen fit (typefit.fit)."""
    ok = np.isfinite(F) & np.isfinite(E) & (E > 0) & (GRID >= 1.0)
    g, m = TF.TPL[fit["type"]]
    m = np.interp(GRID, g, m); m = m / np.nanmax(m[ok])
    y = fit["amp"] * m
    if fit["two_comp"]:
        rj = GRID ** -2.0; y = y + fit["amp_star"] * rj / rj[ok].max()
    return y


def entry(c, extra_group=None):
    name = c["name"]; js = json.loads((H3 / "results/meas3" / f"{safe(name)}.json").read_text())
    s = summary[name]; fit = fits.get(name)
    F, E = TF.bin_on_grid(js["meas"], int(s.get("kbest", 12)))
    spec = [[r(w), r(f, 1), r(e, 1)] for w, f, e in zip(GRID, F, E) if np.isfinite(f) and np.isfinite(e)]
    tpl = None
    if fit:
        y = model(F, E, fit); tpl = [[r(w), r(v, 1)] for w, v in zip(GRID, y) if np.isfinite(v)]
    dt = EPOCH - js["ep"]; pmra, pmdec = js.get("pmra") or 0.0, js.get("pmdec") or 0.0
    ra = js["ra"] + pmra / 3.6e6 * dt / math.cos(math.radians(js["dec"])); dec = js["dec"] + pmdec / 3.6e6 * dt
    mjd = [m["mjd"] for m in js["meas"]]
    short = re.search(r"J\d{6}\.\d+[+-]\d{6}\.\d", name)
    desig = short.group(0) if short else name
    if "published" in c: group, pub = status(c["published"])
    else: group, pub = extra_group
    dec_state, dec_text = decision(c["decision"]) if "decision" in c else ("kept", "")
    if dec_state == "rejected": group = "rejected"
    out = dict(
        id=safe(desig if short else name), name=("CWISE " + desig) if name.startswith("POOL_") else name.replace("_", " "), group=group,
        ra=r(ra, 6), dec=r(dec, 6), epoch=EPOCH, pm=[r(pmra, 1), r(pmdec, 1)], pmTotal=r(math.hypot(pmra, pmdec) / 1000, 3),
        W1=r(js.get("W1")), W2=r(js.get("W2")), snr=r(s["snr_LW"], 1), R=r(s["R_CH4"]), eR=r(s["e_R"]),
        dip="firm" if s["verdict"] == "creux méthane" else "likely" if "probable" in s["verdict"] else "none",
        type=fit["type"] if fit else None, typeUnc=r(fit["unc_final"], 1) if fit else None, chi2=r(fit["chi2_red"], 1) if fit else None,
        published=pub, decision=dec_text, images=len(js["meas"]), dates=[r(min(mjd), 1), r(max(mjd), 1)],
        bands={k: [r(s[f"F_{k}"], 1), r(s[f"e_{k}"], 1), s[f"n_{k}"]] for k in ("J", "H", "CH4", "PEAK", "B45", "LW")},
        spectrum=spec, template=tpl)
    if s.get("spt"): out["knownType"] = str(s["spt"])
    cz = colours.get(desig)
    if cz and group == "unpublished":
        out["deep"] = dict(note=NOTES[desig], z=r(cz["z"], 2), J=r(cz["J"], 2), zJ=r(cz["zJ"], 2), JW2=r(cz["JW2"], 2), shape=("point source" if cz["lstype"] == "PSF" else None),
                           sep=r(cz["sep"], 2), sep2015=r(cz["sep15"], 2), pmCatwise=cz["cw_pm"], pmOptical=[r(v, 0) for v in cz["nsc_pm"]] if np.isfinite(cz["nsc_pm"][0]) and max(abs(v) for v in cz["nsc_pm"]) < 3000 else None)
        for sub, key in (("ls", "optical"), ("w", "wise")):
            src = H3 / "raw/ls_jpeg" / f"{desig}_{sub}.jpg"
            if src.exists():
                shutil.copyfile(src, OUT / "deep" / f"{out['id']}_{sub}.jpg"); out["deep"][key] = f"/data/spherex/deep/{out['id']}_{sub}.jpg"
    return out


cands = json.load(open(H3 / "results/final_candidates.json"))
items = [entry(c) for c in cands]
# Two confirmed dwarfs used as demonstrations: the fastest (motion) and a bright methane dwarf (colour).
for n, txt in (("WISE J085510.83-071442.5", "Confirmed: the coldest known brown dwarf, 2.3 pc away (Luhman 2014)"),
               ("2MASSI J0415195-093506", "Confirmed: T8 spectral standard (Burgasser et al. 2002)")):
    items.append(entry(dict(name=n), ("reference", txt)))

# Validation sample for the methane index (frozen method), away from the Galactic plane.
CLASS = {"": "Confirmed T/Y dwarfs", "star": "Field stars", "red": "Fixed red sources", "vred": "Fixed very red sources"}
controls = [dict(c=CLASS[s["kind"]], W2=r(s["W2"], 2), snr=r(s["snr_LW"], 1), R=r(s["R_CH4"]), eR=r(s["e_R"]), dip=s["verdict"].startswith("creux méthane"))
            for s in summary.values() if s["kind"] in CLASS and np.isfinite(s.get("snr_LW", np.nan)) and s["snr_LW"] >= 5 and np.isfinite(s["R_CH4"])]

doc = dict(
    schemaVersion=1, generated="2026-11-14",
    title="Cold brown dwarf candidates in SPHEREx",
    status="Candidates. Types come from stacked low-resolution SPHEREx photometry, not from classical spectroscopy.",
    credit="SPHEREx level-2 images (DR1, QR3): NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA. Positions and motions: CatWISE2020. Templates: Gagné et al. 2026.",
    method=dict(index="R = flux(3.15–3.50 µm) / flux(3.83–4.20 µm)", threshold=0.30, snrMin=5,
                bands={k: list(v) for k, v in A.BANDS.items()},
                limits=["Reliable to W2 ≈ 15.2, about one in two to 16.0, nothing beyond.", "Not usable for searching in the Galactic plane: most sources are blended.",
                        "The 'likely' level was added after seeing the data.", "'No publication found' is not 'unknown': full-text literature search was not possible."]),
    validation=[dict(c="Confirmed T/Y dwarfs, W2 < 15.25", n=21, dips=19), dict(c="Confirmed T/Y dwarfs, W2 15.25–16.0", n=4, dips=2), dict(c="Confirmed T/Y dwarfs, W2 16.0–16.2", n=4, dips=0),
                dict(c="Field stars", n=65, dips=0), dict(c="Fixed red sources", n=51, dips=0), dict(c="Fixed very red sources", n=24, dips=0), dict(c="Empty positions", n=116, dips=0)],
    selection=dict(extracted=1681, undetected=970, blended=555, dips=35, falseDips=3),
    groups=dict(unpublished="No publication found", blind="Blind test: already typed", published="Published without a spectrum", rejected="False dips, rejected", reference="Confirmed dwarfs"),
    targets=items, controls=controls)
(OUT / "cold-dwarfs.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
from collections import Counter
print(Counter(i["group"] for i in items), "controls", len(controls), "bytes", (OUT / "cold-dwarfs.json").stat().st_size)
