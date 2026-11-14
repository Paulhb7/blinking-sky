// Reads small windows of public SPHEREx level-2 images straight from NASA's bucket (HTTP byte ranges),
// places them on a fixed north-up sky grid and measures a source in them. Runs in a browser, a worker or Node.

export const S3 = "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/";
export const NATIVE_PIXEL = 6.15;            // arcsec
export const GRID = { n: 61, pixel: 2.05 };  // output grid: one third of a native pixel, 125 arcsec across
const DEG = Math.PI / 180;
const NX = 2040;
const counters = { bytes: 0, requests: 0 };
export const stats = () => ({ ...counters });

async function range(url, first, last, signal) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { Range: last === undefined ? `bytes=${first}` : `bytes=${first}-${last}` }, signal });
      if (response.status !== 206) throw new Error(`HTTP ${response.status}`); // never accept a whole 65 MB file
      const buffer = await response.arrayBuffer();
      counters.bytes += buffer.byteLength; counters.requests += 1;
      return { buffer, total: Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0 };
    } catch (error) {
      if (signal?.aborted || attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

/** FITS header cards → { KEY: value }, up to END. Returns the header and the byte length of its blocks. */
export function parseHeader(bytes, start = 0) {
  const header = {}, text = new TextDecoder("ascii");
  for (let i = start; i + 80 <= bytes.length; i += 80) {
    const card = text.decode(bytes.subarray(i, i + 80));
    const key = card.slice(0, 8).trim();
    if (key === "END") return { header, length: Math.ceil((i + 80 - start) / 2880) * 2880 };
    if (card[8] !== "=") continue;
    let value = card.slice(10);
    if (value.trimStart().startsWith("'")) value = value.slice(value.indexOf("'") + 1, value.lastIndexOf("'")).trim();
    else { value = value.split("/")[0].trim(); value = value === "T" ? true : value === "F" ? false : Number(value); }
    header[key] = value;
  }
  return { header, length: 0 };
}

/** TAN-SIP sky ↔ pixel (0-based pixel coordinates), from the IMAGE header. */
export function makeWcs(h) {
  const poly = (prefix) => {
    const order = h[`${prefix}_ORDER`] ?? 0, terms = [];
    for (let p = 0; p <= order; p++) for (let q = 0; p + q <= order; q++) { const c = h[`${prefix}_${p}_${q}`]; if (c) terms.push([p, q, c]); }
    return (u, v) => { let s = 0; for (const [p, q, c] of terms) s += c * u ** p * v ** q; return s; };
  };
  const A = poly("A"), B = poly("B"), AP = poly("AP"), BP = poly("BP");
  const c1 = h.CDELT1 ?? 1, c2 = h.CDELT2 ?? 1;
  const m11 = h.PC1_1 * c1, m12 = h.PC1_2 * c1, m21 = h.PC2_1 * c2, m22 = h.PC2_2 * c2, det = m11 * m22 - m12 * m21;
  const a0 = h.CRVAL1 * DEG, d0 = h.CRVAL2 * DEG, sd0 = Math.sin(d0), cd0 = Math.cos(d0);
  return {
    toPixel(ra, dec) {
      const a = ra * DEG, d = dec * DEG, da = a - a0, cosc = sd0 * Math.sin(d) + cd0 * Math.cos(d) * Math.cos(da);
      if (cosc <= 0) return null;
      const xi = Math.cos(d) * Math.sin(da) / cosc / DEG, eta = (cd0 * Math.sin(d) - sd0 * Math.cos(d) * Math.cos(da)) / cosc / DEG;
      const U = (m22 * xi - m12 * eta) / det, V = (-m21 * xi + m11 * eta) / det;
      // Inverse distortion: the header's AP/BP as a first guess, then the forward polynomial inverted exactly.
      let u = U + AP(U, V), v = V + BP(U, V);
      for (let k = 0; k < 4; k++) { const nu = U - A(u, v), nv = V - B(u, v); u = nu; v = nv; }
      return [u + h.CRPIX1 - 1, v + h.CRPIX2 - 1];
    },
    toSky(x, y) {
      const u = x + 1 - h.CRPIX1, v = y + 1 - h.CRPIX2, f = u + A(u, v), g = v + B(u, v);
      const xi = (m11 * f + m12 * g) * DEG, eta = (m21 * f + m22 * g) * DEG;
      const rho = Math.hypot(xi, eta), c = Math.atan(rho), sc = Math.sin(c), cc = Math.cos(c);
      if (rho === 0) return [h.CRVAL1, h.CRVAL2];
      const dec = Math.asin(cc * sd0 + eta * sc * cd0 / rho);
      const ra = a0 + Math.atan2(xi * sc, rho * cd0 * cc - eta * sd0 * sc);
      return [((ra / DEG) % 360 + 360) % 360, dec / DEG];
    },
  };
}

/** Wavelength and bandwidth (µm) at a detector pixel, bilinear on the file's control-point table (its last HDU). */
function waveAt(tailBuffer, x, y) {
  const bytes = new Uint8Array(tailBuffer), text = new TextDecoder("ascii");
  // The table header starts on a block boundary somewhere in the tail; its grid size differs between detectors.
  let start = -1;
  for (let o = bytes.length - 2880 * 2; o >= 0; o -= 2880) if (text.decode(bytes.subarray(o, o + 8)) === "XTENSION") { start = o; break; }
  if (start < 0) throw new Error("wavelength table not found");
  const { header: h, length } = parseHeader(bytes, start);
  const nx = parseInt(h.TFORM1, 10), ny = parseInt(h.TFORM2, 10), view = new DataView(tailBuffer, start + length), X = [], Y = [];
  for (let i = 0; i < nx; i++) X.push(view.getInt32(i * 4));
  for (let i = 0; i < ny; i++) Y.push(view.getInt32((nx + i) * 4));
  const at = (iy, ix, k) => view.getFloat32(4 * (nx + ny) + ((iy * nx + ix) * 2 + k) * 4);
  const cell = (arr, v) => { let i = 0; while (i < arr.length - 2 && arr[i + 1] < v) i++; return i; };
  const ix = cell(X, x + 1), iy = cell(Y, y + 1), fx = (x + 1 - X[ix]) / (X[ix + 1] - X[ix]), fy = (y + 1 - Y[iy]) / (Y[iy + 1] - Y[iy]);
  const lerp = (k) => at(iy, ix, k) * (1 - fx) * (1 - fy) + at(iy, ix + 1, k) * fx * (1 - fy) + at(iy + 1, ix, k) * (1 - fx) * fy + at(iy + 1, ix + 1, k) * fx * fy;
  return [lerp(0), lerp(1)];
}

/** Gaussian width (native pixels) of the quick-look photometry, by detector, and the factor that brings its fluxes
 * onto the PSF-fitted scale (measured on confirmed dwarfs, see validate.mjs). */
export const PSF_SIGMA = { 1: 0.62, 2: 0.62, 3: 0.64, 4: 0.68, 5: 0.74, 6: 0.80 };
export const FLUX_SCALE = { 1: 1.12, 2: 1.19, 3: 1.22, 4: 1.11, 5: 1.24, 6: 1.24 };

/**
 * One exposure at one sky position: its window on the output grid, and a quick-look flux.
 * `half` (native half-window, pixels) and `grid` widen the field for moving bodies.
 * `want(wave)` may decline the pixels once the wavelength is known (two small requests instead of three).
 * Returns null when the position is off the detector.
 */
export async function readExposure(key, ra, dec, { signal, want, half: HALF = 16, grid = GRID } = {}) {
  const url = S3 + key;
  const head = await range(url, 0, 28799, signal);
  const bytes = new Uint8Array(head.buffer);
  const { header: h, length } = parseHeader(bytes, 2880);
  if (!length || !h.CRVAL1) throw new Error("unexpected file layout");
  const wcs = makeWcs(h), at = wcs.toPixel(ra, dec);
  if (!at) return null;
  const [x, y] = at, xc = Math.round(x), yc = Math.round(y);
  if (!(xc > HALF + 2 && xc < NX - HALF - 3 && yc > HALF + 2 && yc < NX - HALF - 3)) return null;
  // A suffix range: the file size is not readable from a web page (Content-Range is not an exposed header).
  const tail = await range(url, -14400, undefined, signal);
  const [wave, bandwidth] = waveAt(tail.buffer, x, y);
  const info = { key, mjd: h["MJD-AVG"], detector: h.DETECTOR, wave, bandwidth, x, y };
  if (want && !want(wave, info)) return { ...info, skipped: true };
  const y0 = yc - HALF, x0 = xc - HALF, side = 2 * HALF + 1, dataStart = 2880 + length;
  const rows = await range(url, dataStart + y0 * NX * 4, dataStart + (y0 + side) * NX * 4 - 1, signal);
  const view = new DataView(rows.buffer), native = new Float32Array(side * side);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) native[j * side + i] = view.getFloat32((j * NX + x0 + i) * 4);
  // Local background: clipped median of the window (the zodiacal light is smooth over two arcminutes).
  let values = Array.from(native).filter(Number.isFinite).sort((a, b) => a - b);
  if (values.length < side * side * 0.5) return null;
  let median = values[values.length >> 1], sigma = 0;
  for (let k = 0; k < 3; k++) {
    const dev = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b); sigma = 1.4826 * dev[dev.length >> 1];
    values = values.filter((v) => Math.abs(v - median) < 3 * sigma + 1e-12); median = values[values.length >> 1];
  }
  for (let i = 0; i < native.length; i++) native[i] -= median;
  // Quick-look flux: Gaussian-weighted fit at the exact position, in µJy.
  const s = PSF_SIGMA[info.detector] ?? 0.7, omega = (h.OMEGA_MEDIAN ?? 37.82) / 206265 ** 2 * 1e12;
  let sp = 0, spd = 0, spp = 0, bad = 0;
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    const px = xc + i, py = yc + j, v = native[(py - y0) * side + (px - x0)];
    const p = Math.exp(-((px - x) ** 2 + (py - y) ** 2) / (2 * s * s)) / (2 * Math.PI * s * s);
    if (!Number.isFinite(v)) { bad += p; continue; }
    sp += p; spd += p * v; spp += p * p;
  }
  const scale = omega / (FLUX_SCALE[info.detector] ?? 1);
  const flux = spp ? spd / spp * scale : NaN, error = spp ? sigma / Math.sqrt(spp) * scale : NaN;
  // Resample on the north-up grid centred on the position.
  const n = grid.n, out = new Float32Array(n * n), half = (n - 1) / 2;
  for (let r = 0; r < n; r++) {
    const d = dec - (r - half) * grid.pixel / 3600, cosd = Math.cos(d * DEG);
    for (let c = 0; c < n; c++) {
      const p = wcs.toPixel(ra - (c - half) * grid.pixel / 3600 / cosd, d);
      let v = NaN;
      if (p) {
        const fx0 = p[0] - x0, fy0 = p[1] - y0, ix = Math.floor(fx0), iy = Math.floor(fy0), fx = fx0 - ix, fy = fy0 - iy;
        if (ix >= 0 && iy >= 0 && ix < side - 1 && iy < side - 1) {
          v = native[iy * side + ix] * (1 - fx) * (1 - fy) + native[iy * side + ix + 1] * fx * (1 - fy) + native[(iy + 1) * side + ix] * (1 - fx) * fy + native[(iy + 1) * side + ix + 1] * fx * fy;
        }
      }
      out[r * n + c] = v;
    }
  }
  return { ...info, window: out, flux, error, badFraction: bad / (sp + bad || 1), sigma };
}

/** Mean of the windows after rejecting single-image outliers; also returns the per-pixel count. */
export function stackWindows(windows) {
  const n = GRID.n * GRID.n, mean = new Float32Array(n).fill(NaN), column = [];
  if (!windows.length) return mean;
  for (let p = 0; p < n; p++) {
    column.length = 0;
    for (const w of windows) if (Number.isFinite(w[p])) column.push(w[p]);
    if (!column.length) continue;
    column.sort((a, b) => a - b);
    const median = column[column.length >> 1];
    const dev = column.map((v) => Math.abs(v - median)).sort((a, b) => a - b), sigma = 1.4826 * dev[dev.length >> 1];
    let sum = 0, count = 0;
    for (const v of column) if (Math.abs(v - median) <= 4 * sigma + 1e-9) { sum += v; count++; }
    mean[p] = count ? sum / count : median;
  }
  return mean;
}

/** Robust noise of a stack, from its outer rows. */
export function stackNoise(image) {
  const n = GRID.n, edge = [];
  for (let p = 0; p < n * 12; p++) { if (Number.isFinite(image[p])) edge.push(image[p]); const q = image[n * n - 1 - p]; if (Number.isFinite(q)) edge.push(q); }
  if (edge.length < 20) return 0;
  edge.sort((a, b) => a - b); const median = edge[edge.length >> 1];
  const dev = edge.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  return 1.4826 * dev[dev.length >> 1];
}

/** Weighted mean of fluxes in a wavelength band, with clipping of single-image outliers. */
export function bandFlux(points, lo, hi) {
  let sel = points.filter((p) => p.wave >= lo && p.wave < hi && Number.isFinite(p.flux) && p.error > 0 && p.badFraction < 0.3);
  if (sel.length < 3) return { flux: NaN, error: NaN, n: sel.length };
  for (let k = 0; k < 3; k++) {
    const f = sel.map((p) => p.flux).sort((a, b) => a - b), median = f[f.length >> 1];
    const dev = f.map((v) => Math.abs(v - median)).sort((a, b) => a - b), mad = 1.4826 * dev[dev.length >> 1];
    const keep = sel.filter((p) => Math.abs(p.flux - median) < 4 * Math.max(p.error, mad));
    if (keep.length === sel.length || keep.length < 3) break;
    sel = keep;
  }
  let sw = 0, swf = 0;
  for (const p of sel) { const w = 1 / p.error ** 2; sw += w; swf += w * p.flux; }
  const mean = swf / sw; let chi = 0;
  for (const p of sel) chi += (p.flux - mean) ** 2 / p.error ** 2;
  return { flux: mean, error: Math.sqrt(1 / sw) * Math.max(1, Math.sqrt(chi / Math.max(sel.length - 1, 1))), n: sel.length };
}

export const BANDS = { J: [1.2, 1.33], H: [1.52, 1.64], CH4: [3.15, 3.5], PEAK: [3.83, 4.2], B45: [4.42, 5.0], LW: [3.83, 5.0] };

/** Methane index and its error from the measured points: flux(3.15–3.50 µm) / flux(3.83–4.20 µm). */
export function methaneIndex(points) {
  const a = bandFlux(points, ...BANDS.CH4), b = bandFlux(points, ...BANDS.PEAK), lw = bandFlux(points, ...BANDS.LW);
  const R = a.flux / b.flux, eR = Math.abs(R) * Math.hypot(a.error / a.flux || 0, b.error / b.flux) || a.error / b.flux;
  return { R, eR: Math.hypot(a.error / b.flux, a.flux * b.error / b.flux ** 2), snr: lw.flux / lw.error, ch4: a, peak: b, lw };
}

/** Binned spectrum (µJy) on a logarithmic wavelength grid. */
export function binSpectrum(points, perDex = 40) {
  const out = [];
  for (let l = Math.log(0.74); l < Math.log(5.02); l += 1 / perDex) {
    const lo = Math.exp(l), hi = Math.exp(l + 1 / perDex), b = bandFlux(points, lo, hi);
    if (b.n >= 3 && Number.isFinite(b.flux)) out.push([Math.sqrt(lo * hi), b.flux, b.error]);
  }
  return out;
}

/** Position of a moving source at a date (MJD), from its catalogued position, epoch (decimal year) and motion (mas/yr). */
export function positionAt(source, mjd) {
  const dt = 2000 + (mjd - 51544.5) / 365.25 - (source.epoch ?? 2015.4), [pmra, pmdec] = source.pm ?? [0, 0];
  return [source.ra + pmra / 3.6e6 * dt / Math.cos(source.dec * DEG), source.dec + pmdec / 3.6e6 * dt];
}

/** S3 key of a level-2 file from its name: <release>/level2/<week>_<survey>/<version>/<detector>/<file>. */
export function keyOf(file, release = "dr1") {
  const stem = file.replace(/\.fits$/, ""), part = stem.split("_"), version = stem.split("_spx_")[1];
  return `${release}/level2/${part[1]}_${part[2]}/${version}/${part[4].slice(-1)}/${file}`;
}

/** Runs tasks with a bounded number in flight; `each` is called as results arrive. */
export async function pool(items, limit, task, each) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; let result = null; try { result = await task(item); } catch { result = null; } await each?.(result, item); }
  }));
}
