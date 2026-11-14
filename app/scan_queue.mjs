// Space Apps 2026 — quick-look methane test on the brightest unchecked sources of the review queue, with the same
// code the browser runs (src/spherex). Reads windows of the public SPHEREx images; writes scan_queue.json.
// usage: node scan_queue.mjs [how many, default 90]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const dir = new URL("./public/index", import.meta.url).pathname;
const net = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (typeof u === "string" && u.startsWith("/index")) { try { const b = readFileSync(dir + u.replace("/index", "")); return { ok: true, json: async () => JSON.parse(b.toString()), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; } catch { return { ok: false }; } }
  return net(u, o);
};
const { readExposure, positionAt, pool, methaneIndex, stats } = await import("./src/spherex/core.js");
const { imagesAt } = await import("./src/spherex/index.js");
const queue = JSON.parse(readFileSync(new URL("./public/data/queue.json", import.meta.url))).sources.slice(0, Number(process.argv[2] ?? 90));
const out = existsSync("scan_queue.json") ? JSON.parse(readFileSync("scan_queue.json")) : {};
const ERROR_SCALE = 1.6;
async function one(q) {
  if (out[q.id]) return;
  const [ra, dec] = positionAt({ ra: q.ra, dec: q.dec, epoch: q.epoch, pm: q.pm }, 61000);
  const images = (await imagesAt(ra, dec)).filter((i) => i.detector >= 4), points = [], b0 = stats().bytes;
  await pool(images, 8, (i) => readExposure(i.key, ra, dec), (r) => { if (r && r.window) points.push({ wave: r.wave, flux: r.flux, error: r.error * ERROR_SCALE, badFraction: r.badFraction }); });
  const m = methaneIndex(points);
  out[q.id] = { name: q.name, W2: q.W2, pm: q.pmTotal, sigma: q.pmSigma, exposures: points.length, snr: +m.snr.toFixed(1), R: +m.R.toFixed(3), eR: +m.eR.toFixed(3), nCH4: m.ch4.n, nPeak: m.peak.n, MB: Math.round((stats().bytes - b0) / 1e6) };
  writeFileSync("scan_queue.json", JSON.stringify(out, null, 1));
  console.log(q.id, JSON.stringify(out[q.id]));
}
await pool(queue, 3, one);
console.log("total GB", (stats().bytes / 1e9).toFixed(2));
