// Which public SPHEREx images cover a sky position: a lookup in the tiled footprint index (public/index/).
const DEG = Math.PI / 180;
let meta = null;
const tiles = new Map();

async function loadMeta(base) {
  meta ??= fetch(`${base}/meta.json`).then((r) => { if (!r.ok) throw new Error("image index unavailable"); return r.json(); });
  return meta;
}
function loadTile(base, band, cell) {
  const id = `b${band}_${cell}`;
  if (!tiles.has(id)) tiles.set(id, fetch(`${base}/${id}.bin`).then((r) => (r.ok ? r.arrayBuffer() : new ArrayBuffer(0))).catch(() => new ArrayBuffer(0)));
  return tiles.get(id);
}

/** Exposures whose detector contains (ra, dec), with a margin: [{ key, mjd, detector }]. The exact test is made on the file's own WCS. */
export async function imagesAt(ra, dec, base = "/index") {
  const m = await loadMeta(base), radius = 2.7, nb = m.cells.length, wanted = [];
  const b0 = Math.max(0, Math.floor((dec - radius + 90) / m.step)), b1 = Math.min(nb - 1, Math.floor((dec + radius + 90) / m.step));
  for (let b = b0; b <= b1; b++) {
    const n = m.cells[b], edge = Math.min(89.9, Math.max(Math.abs(-90 + b * m.step), Math.abs(-90 + (b + 1) * m.step), Math.abs(dec)));
    const span = radius / Math.cos(edge * DEG);
    if (span >= 180 || n === 1) { for (let c = 0; c < n; c++) wanted.push([b, c]); continue; }
    const c0 = Math.floor((ra - span) / 360 * n), c1 = Math.floor((ra + span) / 360 * n);
    for (let c = c0; c <= c1; c++) wanted.push([b, ((c % n) + n) % n]);
  }
  const seen = new Set(), out = [];
  const a = ra * DEG, d = dec * DEG;
  for (const buffer of await Promise.all(wanted.filter(([b, c]) => !seen.has(`${b}_${c}`) && seen.add(`${b}_${c}`)).map(([b, c]) => loadTile(base, b, c)))) {
    const view = new DataView(buffer);
    for (let o = 0; o + m.record <= buffer.byteLength; o += m.record) {
      const a0 = view.getFloat32(o, true) * DEG, d0 = view.getFloat32(o + 4, true) * DEG;
      const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
      if (cosc < Math.cos(radius * DEG)) continue;
      const xi = Math.cos(d) * Math.sin(a - a0) / cosc / DEG, eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc / DEG;
      const c11 = view.getFloat32(o + 12, true), c12 = view.getFloat32(o + 16, true), c21 = view.getFloat32(o + 20, true), c22 = view.getFloat32(o + 24, true), det = c11 * c22 - c12 * c21;
      const dx = (c22 * xi - c12 * eta) / det, dy = (-c21 * xi + c11 * eta) / det;
      if (Math.abs(dx) > 1035 || Math.abs(dy) > 1035) continue;
      const exposure = String(view.getUint16(o + 28, true)).padStart(4, "0"), week = m.weeks[view.getUint8(o + 30)], version = m.versions[view.getUint8(o + 31)];
      const sub = view.getUint8(o + 32), flag = view.getUint8(o + 33), detector = flag & 127, release = flag & 128 ? "qr3" : "dr1";
      out.push({ key: `${release}/level2/${week}/${version}/${detector}/level2_${week}_${exposure}_${sub}D${detector}_spx_${version}.fits`, mjd: view.getFloat32(o + 8, true) + 60000, detector });
    }
  }
  return out.sort((p, q) => p.mjd - q.mjd);
}
