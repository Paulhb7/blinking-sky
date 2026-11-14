import { readFileSync } from "node:fs";
import { readExposure, positionAt, keyOf, pool, stackWindows, methaneIndex, stats, GRID } from "./src/spherex/core.js";
const name = process.argv[2] ?? "2MASSI_J0415195-093506";
const js = JSON.parse(readFileSync(`${process.env.REFERENCE_DIR}/${name}.json`));
const src = { ra: js.ra, dec: js.dec, epoch: js.ep, pm: [js.pmra, js.pmdec] };
const meas = js.meas.filter((m) => m.fbad < 0.3).slice(0, Number(process.argv[3] ?? 60));
const t0 = Date.now(), rows = [];
await pool(meas, 12, async (m) => {
  const [ra, dec] = positionAt(src, m.mjd);
  let r = null;
  for (const rel of ["dr1", "qr3"]) { try { r = await readExposure(keyOf(m.key, rel), ra, dec); break; } catch {} }
  return r && { r, m };
}, (x) => { if (x) rows.push(x); });
const dx = rows.map(({ r, m }) => Math.hypot(r.x - m.x, r.y - m.y)), dw = rows.map(({ r, m }) => Math.abs(r.wave - m.wave));
console.log(name, rows.length, "exposures in", ((Date.now() - t0) / 1000).toFixed(1), "s", stats());
console.log("pixel position vs astropy: max", Math.max(...dx).toExponential(2), "px | wavelength: max diff", Math.max(...dw).toExponential(2), "um");
for (const det of [1, 2, 3, 4, 5, 6]) {
  const s = rows.filter(({ r, m }) => r.detector === det && m.flux > 5 * m.eflux);
  if (!s.length) continue;
  const ratio = s.map(({ r, m }) => r.flux / m.flux).sort((a, b) => a - b);
  console.log("det", det, "n", s.length, "quick-look / PSF-fit flux: median", ratio[ratio.length >> 1].toFixed(3), "p16-p84", ratio[Math.floor(ratio.length * 0.16)].toFixed(2), ratio[Math.floor(ratio.length * 0.84)].toFixed(2), "| error ratio", (s.map(({ r, m }) => r.error / m.eflux).sort((a, b) => a - b)[s.length >> 1]).toFixed(2));
}
const pts = rows.map(({ r }) => r); const mi = methaneIndex(pts); console.log("methane index", mi.R.toFixed(3), "+-", mi.eR.toFixed(3), "snr", mi.snr.toFixed(1), "n", mi.ch4.n, mi.peak.n);
