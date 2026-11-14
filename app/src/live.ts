import { BANDS, GRID, binSpectrum, methaneIndex, pool, positionAt, readExposure, stackNoise, stackWindows, stats } from "./spherex/core.js";
import { imagesAt } from "./spherex/index.js";
import { dayLabel, type SolarFrame, type SpxFrame, type SpxGroup, type SpxTarget } from "./data";
import type { SolarBody } from "./sky/galaxy";

/** Builds a field in this browser: finds the public SPHEREx exposures that cover a position, reads a small window of
 * each from NASA's bucket, and stacks them by season and by colour while they arrive. */

export type LiveInput = { id: string; name: string; ra: number; dec: number; group: SpxGroup; epoch?: number; pm?: [number, number]; pmTotal?: number; pmSigma?: number; W1?: number; W2?: number; blurb: string; published: string; /** spectral type already published for this object */ knownType?: string };
type Point = { wave: number; flux: number; error: number; badFraction: number; mjd: number; detector: number };
const ERROR_SCALE = 1.6; // stacked errors are underestimated by about this factor (measured on empty positions in the earlier analysis)
const date = (mjd: number) => new Date((mjd - 40587) * 86400000).toISOString().slice(0, 10);

function render(image: Float32Array, lo: number, hi: number, n = GRID.n) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!, data = ctx.createImageData(n, n), k = Math.asinh(5);
  for (let i = 0; i < n * n; i++) {
    const v = Number.isFinite(image[i]) ? Math.max(0, Math.min(1, Math.asinh((image[i] - lo) / (hi - lo) * 5) / k)) : 0; // missing pixels stay black
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = Math.round(v * 255); data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

export function startLive(input: LiveInput, onUpdate: (target: SpxTarget) => void) {
  const abort = new AbortController(), source = { ra: input.ra, dec: input.dec, epoch: input.epoch ?? 2025.9, pm: input.pm ?? [0, 0] as [number, number] };
  const points: Point[] = [], windows: { w: Float32Array; wave: number; mjd: number }[] = [];
  let total = 0, done = 0, finished = false, error = "", seasons: number[] = [], lastEmit = 0, queued = false, fullSpectrum = false;
  const bytes0 = stats().bytes;
  const [ra, dec] = positionAt(source, 61000); // one fixed sky grid, at the middle of the SPHEREx dates

  const build = (): SpxTarget => {
    const lw = windows.filter((x) => x.wave >= BANDS.LW[0] && x.wave < BANDS.LW[1]), ch4 = windows.filter((x) => x.wave >= BANDS.CH4[0] && x.wave < BANDS.CH4[1]);
    const frames: SpxFrame[] = [];
    let lo = 0, hi = 1;
    if (lw.length >= 3) {
      const all = stackWindows(lw.map((x) => x.w)), sigma = stackNoise(all) || 1e-3, c = (GRID.n - 1) / 2;
      let peak = 0; for (let r = c - 3; r <= c + 3; r++) for (let q = c - 3; q <= c + 3; q++) { const v = all[r * GRID.n + q]; if (Number.isFinite(v)) peak = Math.max(peak, v); }
      lo = -2 * sigma; hi = Math.max(peak * 1.1, 12 * sigma);
      seasons.forEach((start, i) => {
        const end = seasons[i + 1] ?? Infinity, part = lw.filter((x) => x.mjd >= start && x.mjd < end);
        if (part.length < 4) return;
        const mjds = part.map((x) => x.mjd).sort((a, b) => a - b);
        frames.push({ id: `date${i}`, kind: "date", label: dayLabel(date(mjds[mjds.length >> 1])), date: date(mjds[mjds.length >> 1]), dateRange: [date(mjds[0]), date(mjds[mjds.length - 1])], images: part.length, band: [3.83, 5], image: render(stackWindows(part.map((x) => x.w)), lo, hi) });
      });
      frames.push({ id: "lw", kind: "colour", label: "3.83–5.0 µm", images: lw.length, band: [3.83, 5], image: render(all, lo, hi) });
      if (ch4.length >= 4) frames.push({ id: "ch4", kind: "colour", label: "3.15–3.50 µm · methane band", images: ch4.length, band: [3.15, 3.5], image: render(stackWindows(ch4.map((x) => x.w)), lo, hi) });
    }
    const scaled = points.map((p) => ({ ...p, error: p.error * ERROR_SCALE }));
    const m = methaneIndex(scaled), measured = Number.isFinite(m.snr) && m.lw.n >= 6;
    const hasIndex = measured && m.snr >= 5 && Number.isFinite(m.R) && m.ch4.n >= 3 && m.peak.n >= 3;
    const mjds = points.map((p) => p.mjd);
    const band = (b: { flux: number; error: number; n: number }): [number | null, number | null, number] => [Number.isFinite(b.flux) ? b.flux : null, Number.isFinite(b.error) ? b.error : null, b.n];
    return {
      id: input.id, name: input.name, group: input.group, ra, dec, blurb: input.blurb, stacked: true, epoch: 2026.03, pmMas: input.pm,
      geometry: frames.length ? { system: "ICRS TAN", centerRaDeg: ra, centerDecDeg: dec, width: GRID.n, height: GRID.n, gridPixelArcsec: GRID.pixel, nativePixelArcsec: 6.15, referencePixelZeroBased: [(GRID.n - 1) / 2, (GRID.n - 1) / 2] } : undefined,
      frames,
      motion: input.pmTotal ? { east: (input.pm?.[0] ?? 0) / 1000, north: (input.pm?.[1] ?? 0) / 1000, total: input.pmTotal, source: "CatWISE2020" } : undefined,
      dwarf: {
        W1: input.W1 ?? null, W2: input.W2 ?? null, snr: measured ? m.snr : NaN, R: hasIndex ? m.R : NaN, eR: hasIndex ? m.eR : NaN,
        dip: hasIndex && m.R < 0.3 ? "firm" : hasIndex && m.R - m.eR < 0.3 ? "likely" : "none",
        type: null, typeUnc: null, chi2: null, knownType: input.knownType, published: input.published, decision: "", images: points.length, dates: mjds.length ? [Math.min(...mjds), Math.max(...mjds)] : [0, 0],
        bands: { CH4: band(m.ch4), PEAK: band(m.peak), LW: band(m.lw) }, spectrum: binSpectrum(scaled, 25), template: null, quick: true,
      },
      live: { done, total, megabytes: (stats().bytes - bytes0) / 1e6, finished, error: error || undefined, pmSigma: input.pmSigma },
      processing: ["Windows of the public level-2 images, read in this browser from NASA's bucket", "Local median background subtracted per exposure; no pixel flags applied", "Bilinear resampling on a fixed north-up grid of 2.05″ pixels", "Mean after rejection of single-exposure outliers; missing pixels are black",
        "Quick-look photometry: Gaussian-weighted fit at the catalogued position, scaled to PSF-fitted fluxes of known dwarfs; errors widened by 1.6"],
      display: "8-bit grayscale, shared asinh stretch; not quantitative photometry",
    };
  };
  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < 450) { if (!queued) { queued = true; setTimeout(() => { queued = false; if (!abort.signal.aborted) emit(true); }, 460); } return; }
    lastEmit = now; onUpdate(build());
  };

  const read = async (list: { key: string; mjd: number; detector: number }[]) => {
    total += list.length; emit(true);
    await pool(list, 10, (item) => readExposure(item.key, ra, dec, { signal: abort.signal }), (r) => {
      done += 1;
      if (abort.signal.aborted) return;
      if (r && r.window) { points.push({ wave: r.wave, flux: r.flux, error: r.error, badFraction: r.badFraction, mjd: r.mjd, detector: r.detector }); windows.push({ w: r.window, wave: r.wave, mjd: r.mjd }); }
      emit();
    });
  };
  let rest: { key: string; mjd: number; detector: number }[] = [];
  (async () => {
    try {
      emit(true);
      const images = await imagesAt(ra, dec, `${import.meta.env.BASE_URL}index`.replace(/\/\//g, "/"));
      if (!images.length) throw new Error("SPHEREx has no public image of this position yet");
      const long = images.filter((i) => i.detector >= 5), mid = images.filter((i) => i.detector === 4); rest = images.filter((i) => i.detector <= 3);
      const ms = long.map((i) => i.mjd).sort((a, b) => a - b); seasons = ms.length ? [ms[0]] : [];
      for (let i = 1; i < ms.length; i++) if (ms[i] - ms[i - 1] > 60) seasons.push(ms[i]);
      // Interleave the seasons so every date frame grows from the start.
      const bySeason = seasons.map((s, i) => long.filter((x) => x.mjd >= s && x.mjd < (seasons[i + 1] ?? Infinity))), mixed: typeof long = [];
      for (let k = 0; bySeason.some((b) => k < b.length); k++) for (const b of bySeason) if (k < b.length) mixed.push(b[k]);
      await read(mixed); await read(mid);
      if (fullSpectrum) await read(rest);
    } catch (reason) { if (!abort.signal.aborted) error = String((reason as Error).message ?? reason); }
    finished = true; if (!abort.signal.aborted) emit(true);
  })();
  return {
    stop: () => abort.abort(),
    /** Also read the short-wavelength detectors (0.75–2.4 µm) to complete the spectrum. */
    more: async () => { if (fullSpectrum) return; fullSpectrum = true; if (finished && rest.length) { finished = false; await read(rest); finished = true; emit(true); } },
  };
}

/** A fast first look at a position: a handful of 3.8–5 µm exposures spread over the dates, stacked. About 2 MB. */
const looks = new Map<string, Promise<{ image: string; exposures: number } | null>>();
export function quickLook(ra: number, dec: number, signal?: AbortSignal) {
  const key = `${ra.toFixed(4)},${dec.toFixed(4)}`;
  const cached = looks.get(key);
  if (cached) return cached;
  const run = (async () => {
    const images = (await imagesAt(ra, dec, `${import.meta.env.BASE_URL}index`.replace(/\/\//g, "/"))).filter((i) => i.detector >= 5);
    if (!images.length) return null;
    const want = 8, step = Math.max(1, Math.floor(images.length / want)), pick = images.filter((_, i) => i % step === 0).slice(0, want), windows: Float32Array[] = [];
    await pool(pick, 8, (item) => readExposure(item.key, ra, dec, { signal }), (r) => { if (r?.window && r.wave >= BANDS.LW[0]) windows.push(r.window); });
    if (signal?.aborted || windows.length < 3) return null;
    const all = stackWindows(windows), sigma = stackNoise(all) || 1e-3, c = (GRID.n - 1) / 2;
    let peak = 0; for (let r = c - 3; r <= c + 3; r++) for (let q = c - 3; q <= c + 3; q++) { const v = all[r * GRID.n + q]; if (Number.isFinite(v)) peak = Math.max(peak, v); }
    return { image: render(all, -2 * sigma, Math.max(peak * 1.1, 12 * sigma)), exposures: windows.length };
  })().catch(() => null);
  looks.set(key, run);
  run.then((result) => { if (!result) looks.delete(key); });   // an aborted or failed look can be tried again
  return run;
}

/** A Solar System body crossing a fixed field: the single exposures of one visit, read here and put on one north-up
 * grid of 5″ pixels, 10′ across. The stars stay, the body moves. No stacking, nothing moved or amplified. */
const FIELD = { n: 121, pixel: 5 };
export function startMover(body: SolarBody, list: SolarFrame[], onUpdate: (target: SpxTarget) => void) {
  const abort = new AbortController(), got: (Float32Array | null)[] = list.map(() => null), noise: number[] = [], bytes0 = stats().bytes;
  let done = 0, finished = false, error = "";
  const cos = Math.cos(body.dec * Math.PI / 180), half = (FIELD.n - 1) / 2;
  const at = (f: SolarFrame): [number, number] => [half - (f[1] - body.ra) * cos * 3600 / FIELD.pixel, half - (f[2] - body.dec) * 3600 / FIELD.pixel];
  const stamp = (mjd: number) => new Date((mjd - 40587) * 86400000).toISOString();
  const build = (): SpxTarget => {
    const ok = list.map((f, i) => ({ f, w: got[i], p: at(f) })).filter((x): x is { f: SolarFrame; w: Float32Array; p: [number, number] } => x.w !== null);
    const frames: SpxFrame[] = [];
    if (ok.length) {
      // One stretch for every frame, set by the noise and by the body's own brightness (median over the frames, so one cosmic ray cannot set it).
      const sigma = [...noise].sort((a, b) => a - b)[noise.length >> 1] || 1e-3;
      const peaks = ok.map(({ w, p }) => { let m = 0; for (let r = Math.round(p[1]) - 2; r <= Math.round(p[1]) + 2; r++) for (let c = Math.round(p[0]) - 2; c <= Math.round(p[0]) + 2; c++) { const v = w[r * FIELD.n + c]; if (Number.isFinite(v)) m = Math.max(m, v); } return m; }).sort((a, b) => a - b);
      const lo = -2 * sigma, hi = Math.min(Math.max(peaks[peaks.length >> 1] * 1.1, 14 * sigma), 90 * sigma);
      ok.forEach(({ f, w, p }, i) => { const t = stamp(f[3]); frames.push({ id: `date${i}`, kind: "date", label: `${t.slice(0, 10)} · ${t.slice(11, 16)} UT`, date: t.slice(0, 10), images: 1, band: [f[4], f[4]], image: render(w, lo, hi, FIELD.n), at: p }); });
    }
    const what = body.kind === "comet" ? "A comet" : body.kind === "centaur" ? "A centaur, between Jupiter and Neptune" : body.kind === "trojan" ? "A Jupiter trojan, sharing Jupiter's orbit" : body.kind === "near-Earth" ? "A near-Earth asteroid" : "An asteroid";
    return {
      id: body.id, name: body.name, group: "solar", ra: body.ra, dec: body.dec, stacked: false, frames,
      blurb: `${what}${body.rh ? `, ${body.rh.toFixed(2)} au from the Sun that day` : ""}. Each frame is one SPHEREx exposure of the same patch of sky: the stars stay, the body crosses ${body.moved}″ in ${body.hours} hours. The corner marks show where it was predicted to be.`,
      geometry: frames.length ? { system: "ICRS TAN", centerRaDeg: body.ra, centerDecDeg: body.dec, width: FIELD.n, height: FIELD.n, gridPixelArcsec: FIELD.pixel, nativePixelArcsec: 6.15, referencePixelZeroBased: [half, half] } : undefined,
      solar: { kind: body.kind, hours: body.hours, movedArcsec: body.moved, sunDistanceAu: body.rh ?? Math.hypot(...body.p), jd: body.mjd + 2400000.5, body: body.id },
      live: { done, total: list.length, megabytes: (stats().bytes - bytes0) / 1e6, finished, error: error || undefined },
      processing: ["Single exposures of one visit, 3.8–5 µm, read in this browser from NASA's bucket; the wavelength differs a little from one exposure to the next", "Local median background subtracted per exposure; no pixel flags applied, so a cosmic-ray hit can show in one frame",
        "Bilinear resampling on one fixed north-up grid of 5″ pixels, 10′ across", "Same stretch for every frame; missing pixels are black; nothing is moved or amplified", "Predicted positions: IRSA Moving Object Search Tool"],
      display: "8-bit grayscale, shared asinh stretch; not quantitative photometry",
    };
  };
  (async () => {
    try {
      onUpdate(build());
      await pool(list.map((f, i) => ({ f, i })), 6, ({ f }) => readExposure(f[0], body.ra, body.dec, { signal: abort.signal, half: 56, grid: FIELD }), (r, { i }) => {
        done += 1;
        if (abort.signal.aborted) return;
        if (r?.window) { got[i] = r.window; noise.push(r.sigma); }
        onUpdate(build());
      });
      if (!got.some(Boolean)) throw new Error("None of the exposures of this visit could be read");
    } catch (reason) { if (!abort.signal.aborted) error = String((reason as Error).message ?? reason); }
    finished = true; if (!abort.signal.aborted) onUpdate(build());
  })();
  return { stop: () => abort.abort(), more: async () => {} };
}
