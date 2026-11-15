/** The SPHEREx fields of Blinking Sky: frames on a fixed sky grid, and what was measured there. */

export type SpxGeometry = {
  system: string; centerRaDeg: number; centerDecDeg: number; width: number; height: number;
  gridPixelArcsec: number; nativePixelArcsec: number; referencePixelZeroBased: [number, number];
};
export type FrameKind = "date" | "colour" | "survey";
export type SpxFrame = {
  id: string; kind: FrameKind; label: string; image: string; flagged?: string;
  /** For a frame from another survey: what it is and when it was taken, in one line. */
  caption?: string;
  /** Number of exposures averaged in this frame (1 for a single exposure). */
  images: number; band?: [number, number]; date?: string; dateRange?: [string, string];
  /** Where the moving body is in this frame: column and row on the grid. */
  at?: [number, number];
  /** Brightness of the source at this date, 3.83–5 µm: flux and 1σ error, µJy (in-browser quick look). */
  flux?: [number, number];
};
export type SpxGroup = "start" | "variable" | "solar" | "unpublished" | "blind" | "published" | "rejected" | "queue" | "position";
export type SpxDeep = {
  note: string; z: number | null; J: number | null; zJ: number | null; JW2: number | null; shape: string | null;
  sep: number | null; sep2015: number | null; pmCatwise: [number, number]; pmOptical: [number, number, number] | null; optical?: string; wise?: string;
};
export type SpxTarget = {
  id: string; name: string; group: SpxGroup; ra: number; dec: number;
  /** One line on why this field is worth a look. */
  blurb: string;
  geometry?: SpxGeometry; frames: SpxFrame[]; focusFov?: number; stacked: boolean;
  /** Proper motion, arcseconds per year (east, north) when catalogued. */
  motion?: { east: number; north: number; total: number; source: string };
  dwarf?: {
    W1: number | null; W2: number | null; snr: number; R: number; eR: number; dip: "firm" | "likely" | "none";
    type: string | null; typeUnc: number | null; chi2: number | null; knownType?: string;
    published: string; decision: string; images: number; dates: [number, number];
    bands: Record<string, [number | null, number | null, number]>;
    spectrum: [number, number, number][]; template: [number, number][] | null; deep?: SpxDeep;
    /** True when the numbers come from the in-browser quick look rather than the frozen PSF-fit analysis. */
    quick?: boolean;
  };
  /** Set while exposures are being read from the archive in this browser. */
  live?: { done: number; total: number; megabytes: number; finished: boolean; error?: string; pmSigma?: number; /** width of the field read, arcminutes */ fieldArcmin?: number };
  epoch?: number; pmMas?: [number, number];
  /** A Solar System body crossing a fixed field in single exposures. */
  solar?: { kind: "comet" | "asteroid" | "centaur" | "trojan" | "near-Earth"; hours: number; movedArcsec: number; sunDistanceAu: number; earthDistanceAu?: number; /** Julian day of the visit */ jd?: number; /** id of the body on the Solar System map */ body?: string };
  processing?: string[]; display?: string; source?: string;
};
export type SpxMethod = {
  index: string; threshold: number; snrMin: number; bands: Record<string, [number, number]>; limits: string[];
};
export type SpxCatalog = {
  targets: SpxTarget[]; method: SpxMethod; status: string; credit: string;
  validation: { c: string; n: number; dips: number }[];
  selection: { extracted: number; undetected: number; blended: number; dips: number; falseDips: number };
  controls: { c: string; W2: number; snr: number; R: number; eR: number; dip: boolean }[];
};

export const GROUPS: { id: SpxGroup; label: string; hint: string }[] = [
  { id: "start", label: "Start here", hint: "Known objects: check that the tool shows what is expected." },
  { id: "variable", label: "Stars that changed brightness", hint: "Young stars that were brighter at one SPHEREx pass than at another. Read live from NASA's archive: blink the dates." },
  { id: "solar", label: "Solar System · moves in hours", hint: "Comets and asteroids crossing a fixed patch of sky, one real exposure per frame." },
  { id: "unpublished", label: "Candidates · no publication found", hint: "Methane dip in SPHEREx, motion in CatWISE, nothing found in the lists searched." },
  { id: "blind", label: "Blind test", hint: "Picked by the same selection, then found to be already typed from a spectrum." },
  { id: "published", label: "Candidates · published without a spectrum", hint: "Known candidates: SPHEREx adds the first spectral evidence found for them." },
  { id: "rejected", label: "False dips, rejected", hint: "Sources that passed the methane test and failed the fit or the image check." },
];

const mjdToDate = (mjd: number) => new Date((mjd - 40587) * 86400000).toISOString().slice(0, 10);
export const dayLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const mjdLabel = (mjd: number) => dayLabel(mjdToDate(mjd));

export function sexagesimal(ra: number, dec: number) {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const t = Math.round(((ra % 360) + 360) % 360 / 15 * 36000);
  const d = Math.round(Math.abs(dec) * 3600);
  return `${pad(Math.floor(t / 36000))}h${pad(Math.floor(t / 600) % 60)}m${pad(Math.floor(t / 10) % 60)}.${t % 10}s ${dec < 0 ? "−" : "+"}${pad(Math.floor(d / 3600))}°${pad(Math.floor(d / 60) % 60)}′${pad(d % 60)}″`;
}

/** Years between the first and last date frame, and the shift the catalogued motion predicts over them. */
export function expectedShift(target: SpxTarget) {
  const dates = target.frames.filter((f) => f.kind === "date" && f.date).map((f) => Date.parse(f.date as string));
  if (dates.length < 2 || !target.motion) return null;
  const years = (Math.max(...dates) - Math.min(...dates)) / (365.25 * 86400000);
  const arcsec = target.motion.total * years;
  return { years, arcsec, pixels: arcsec / (target.geometry?.nativePixelArcsec ?? 6.15) };
}

type BarnardJson = {
  target: string; frame: SpxGeometry; processing: string[]; displayUnits: string;
  epochs: { date: string; image: string; maskedImage: string; wavelengthMicron?: number }[];
};
type DwarfJson = {
  id: string; name: string; group: "unpublished" | "blind" | "published" | "rejected" | "reference"; ra: number; dec: number; pm: [number, number]; pmTotal: number;
  W1: number | null; W2: number | null; snr: number; R: number; eR: number; dip: "firm" | "likely" | "none"; type: string | null; typeUnc: number | null; chi2: number | null;
  knownType?: string; published: string; decision: string; images: number; dates: [number, number];
  bands: Record<string, [number | null, number | null, number]>; spectrum: [number, number, number][]; template: [number, number][] | null; deep?: SpxDeep;
};
type MoverJson = { id: string; name: string; kind: "comet" | "asteroid" | "centaur"; blurb: string; ra: number; dec: number; frame: SpxGeometry; frames: SpxFrame[]; hours: number; movedArcsec: number; sunDistanceAu: number; earthDistanceAu: number };
type StackJson = Record<string, { frame: SpxGeometry; frames: SpxFrame[]; processing: string[]; display: { unit: string } }>;

const NAME: Record<string, string> = { "J085510.83-071442.5": "WISE 0855−0714", "2MASSI_J0415195-093506": "2MASS 0415−0935" };
const BLURB: Record<string, string> = {
  "J085510.83-071442.5": "The coldest known brown dwarf, 7.4 light-years away. It crosses more than one SPHEREx pixel in a year: step through the dates.",
  "2MASSI_J0415195-093506": "A bright methane dwarf. Switch to colours: it vanishes in the methane band while the field stars stay.",
};

const local = (path: string) => path.replace("/data/spherex/", "/data/");

export async function loadSpherexCatalog(basePath: string, signal?: AbortSignal): Promise<SpxCatalog> {
  const get = async (path: string) => {
    const response = await fetch(basePath + path, { signal });
    if (!response.ok) throw new Error("SPHEREx data unavailable");
    return response.json();
  };
  const movers = await get("/data/movers.json").catch(() => ({ bodies: [], processing: [], credit: "" })) as { bodies: MoverJson[]; processing: string[]; credit: string };
  const [barnard, dwarfs, stacks] = await Promise.all([
    get("/data/barnard.json") as Promise<BarnardJson>,
    get("/data/cold-dwarfs.json"),
    get("/data/stacks.json").catch(() => ({})) as Promise<StackJson>,
  ]);
  const targets: SpxTarget[] = [{
    id: "barnard", name: "Barnard's Star", group: "start", ra: barnard.frame.centerRaDeg, dec: barnard.frame.centerDecDeg,
    blurb: "The fastest star in the sky. Two single exposures a year apart: blink them and it steps north.",
    geometry: barnard.frame, focusFov: 0.12, stacked: false,
    frames: barnard.epochs.map((e, i) => ({ id: `date${i}`, kind: "date" as const, label: dayLabel(e.date), image: local(e.image), flagged: local(e.maskedImage), images: 1, date: e.date, band: [1.9, 1.95] as [number, number] })),
    motion: { east: -0.8, north: 10.36, total: 10.39, source: "Gaia DR3" },
    processing: barnard.processing, display: barnard.displayUnits, source: "/data/barnard.json",
  }];
  for (const d of dwarfs.targets as DwarfJson[]) {
    const stack = stacks[d.id];
    const group: SpxGroup = d.group === "reference" ? "start" : d.group;
    targets.push({
      id: d.id, name: NAME[d.id] ?? d.name, group, ra: d.ra, dec: d.dec,
      blurb: BLURB[d.id] ?? (group === "rejected" ? d.decision : d.deep?.note ?? d.published),
      geometry: stack?.frame, stacked: Boolean(stack),
      frames: (stack?.frames ?? []).map((f) => ({ ...f, image: local(f.image), label: f.kind === "date" && f.date ? dayLabel(f.date) : f.label })),
      epoch: 2025.9, pmMas: d.pm,
      motion: { east: d.pm[0] / 1000, north: d.pm[1] / 1000, total: d.pmTotal, source: "CatWISE2020" },
      dwarf: { W1: d.W1, W2: d.W2, snr: d.snr, R: d.R, eR: d.eR, dip: d.dip, type: d.type, typeUnc: d.typeUnc, chi2: d.chi2, knownType: d.knownType, published: d.published, decision: d.decision, images: d.images, dates: d.dates, bands: d.bands, spectrum: d.spectrum, template: d.template,
        deep: d.deep && { ...d.deep, optical: d.deep.optical && local(d.deep.optical), wise: d.deep.wise && local(d.deep.wise) } },
      processing: stack?.processing, display: stack ? `8-bit grayscale, shared asinh stretch (${stack.display.unit}); not quantitative photometry` : undefined, source: "/data/cold-dwarfs.json",
    });
  }
  for (const m of movers.bodies) targets.push({
    id: m.id, name: m.name, group: "solar", ra: m.ra, dec: m.dec, blurb: `${m.blurb} Here it crosses ${m.movedArcsec}″ in ${m.hours} hours, ${m.sunDistanceAu} au from the Sun.`,
    geometry: m.frame, stacked: false, frames: m.frames.map((f) => ({ ...f, image: local(f.image) })),
    solar: { kind: m.kind, hours: m.hours, movedArcsec: m.movedArcsec, sunDistanceAu: m.sunDistanceAu, earthDistanceAu: m.earthDistanceAu },
    processing: movers.processing, display: "8-bit grayscale, shared asinh stretch; not quantitative photometry", source: "/data/movers.json",
  });
  // The two reference dwarfs sit with Barnard's Star at the top of the list.
  targets.sort((a, b) => Number(b.group === "start") - Number(a.group === "start"));
  return { targets, method: dwarfs.method, status: dwarfs.status, credit: dwarfs.credit, validation: dwarfs.validation, selection: dwarfs.selection, controls: dwarfs.controls };
}

export type QueueSource = { id: string; name: string; ra: number; dec: number; epoch: number; pm: [number, number]; pmTotal: number; pmSigma: number; W1: number; W2: number };
export async function loadQueue(basePath: string): Promise<{ sources: QueueSource[]; selection: string }> {
  const response = await fetch(basePath + "/data/queue.json");
  if (!response.ok) throw new Error("Review queue unavailable");
  return response.json();
}

/** Votes stay in this browser; nothing is sent anywhere. */
export type Vote = "fades" | "stays" | "blend" | "artefact" | "nothing";
export const VOTES: { id: Vote; label: string; hint: string }[] = [
  { id: "fades", label: "Fades in methane", hint: "Bright at 4 µm, gone or much fainter at 3.3 µm" },
  { id: "stays", label: "Stays the same", hint: "As bright in both colours: a star or a galaxy" },
  { id: "blend", label: "Two sources", hint: "More than one object inside the SPHEREx pixel" },
  { id: "artefact", label: "Artefact", hint: "A spike, a streak, an edge" },
  { id: "nothing", label: "Nothing there", hint: "No source at the centre" },
];
const KEY = "blinking-sky.votes.v1";
export function readVotes(): Record<string, { vote: Vote; at: string; name: string; ra: number; dec: number; R?: number; snr?: number }> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export function writeVote(target: SpxTarget, vote: Vote) {
  const all = readVotes();
  all[target.id] = { vote, at: new Date().toISOString(), name: target.name, ra: target.ra, dec: target.dec, R: target.dwarf?.R, snr: target.dwarf?.snr };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage blocked: the vote lives for this visit only */ }
  return all;
}

/** The Solar System layer: planets, and every small body with a SPHEREx visit in the lists at hand. */
import type { Planet, SolarBody } from "./sky/galaxy";
export type SolarFrame = [key: string, ra: number, dec: number, mjd: number, wave: number];
export type SolarData = { count: number; chunk: number; credit: string; note: string; planets: Planet[]; bodies: SolarBody[] };
export async function loadSolar(basePath: string): Promise<SolarData> {
  const response = await fetch(basePath + "/data/solar.json");
  if (!response.ok) throw new Error("Solar System data unavailable");
  return response.json();
}
/** The exposures of one body's visit: fetched only when the body is opened. */
export async function loadSolarFrames(basePath: string, data: SolarData, id: string): Promise<SolarFrame[]> {
  const k = data.bodies.findIndex((b) => b.id === id);
  const response = await fetch(`${basePath}/data/solar/frames-${Math.floor(k / data.chunk)}.json`);
  if (k < 0 || !response.ok) throw new Error("No image list for this body");
  return (await response.json())[id] ?? [];
}

/** Known young stars whose brightness changed between two SPHEREx passes, in our earlier measurements. They have no
 * prepared stack: the tool reads them live, so the visitor checks the change on the exposures themselves. */
export const VARIABLES: { id: string; name: string; ra: number; dec: number; W1: number; W2: number; blurb: string }[] = [
  { id: "var-vela", name: "2MASS J08482227-4241152", ra: 132.0928, dec: -42.68755, W1: 10.43, W2: 9.05,
    blurb: "A young star in Vela, still inside its cloud. In our earlier measurements it was about four times brighter at 4 µm in May 2026 than six months before. Blink the dates and read the brightness at each one." },
  { id: "var-crux", name: "AGAL G300.323-00.199", ra: 187.1166, dec: -62.95387, W1: 9.45, W2: 7.70,
    blurb: "A young star in a dense clump of gas in the Southern Cross. In our earlier measurements it was more than twice as bright at 2–5 µm in July 2026 as a year before. Blink the dates and read the brightness at each one." },
];

/** The difference between two frames that share one stretch: last minus first. The 8-bit asinh display is inverted,
 * so this is a picture of what changed, not photometry. Grey: no change. White: brighter or arrived. Black: fainter or left. */
export async function differenceImage(first: string, last: string): Promise<string> {
  const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const [a, b] = await Promise.all([load(first), load(last)]);
  const w = a.naturalWidth, h = a.naturalHeight, k = Math.asinh(5);
  const pixels = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!; x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
  const pa = pixels(a), pb = pixels(b);
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const ctx = out.getContext("2d")!, data = ctx.createImageData(w, h), gain = 6, norm = Math.asinh(gain);
  for (let i = 0; i < w * h; i++) {
    const va = pa[i * 4] / 255, vb = pb[i * 4] / 255;
    // A pixel that is black in either frame is missing or below the floor there: no difference is drawn.
    const d = va === 0 || vb === 0 ? 0 : (Math.sinh(vb * k) - Math.sinh(va * k)) / 5;
    const g = Math.round(255 * Math.max(0, Math.min(1, 0.5 + 0.5 * Math.asinh(d * gain) / norm)));
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = g; data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return out.toDataURL("image/png");
}

/** The same patch of sky in other surveys, on the grid of the SPHEREx frame: same centre, same width, north up.
 * The cut-outs come from the Legacy Surveys viewer (legacysurvey.org), which receives the position. A layer that
 * does not cover the position comes back empty and is dropped. */
const SURVEYS: { id: string; layer: string; label: string; caption: string; gain: number }[] = [
  { id: "wise", layer: "unwise-neo7", label: "WISE", caption: "WISE, 3.4 and 4.6 µm (unWISE coadd of 2010–2020). Red here means brighter at 4.6 µm. A nearby object is not where it is today.", gain: 1.7 },
  { id: "legacy", layer: "ls-dr10", label: "Optical", caption: "Visible and near-infrared light, g, r, i, z (DESI Legacy Imaging Surveys DR10). A cold brown dwarf is faint or absent here.", gain: 1.25 },
  { id: "ps1", layer: "ps1", label: "Optical", caption: "Visible light, g, r, i (Pan-STARRS DR1). A cold brown dwarf is faint or absent here.", gain: 1.1 },
];
export async function surveyFrames(ra: number, dec: number, sizeArcsec: number, signal?: AbortSignal): Promise<SpxFrame[]> {
  const pixels = 320, scale = sizeArcsec / pixels;
  const one = async (sv: typeof SURVEYS[number]): Promise<SpxFrame | null> => {
    try {
      const url = `https://www.legacysurvey.org/viewer/cutout.jpg?ra=${ra.toFixed(6)}&dec=${dec.toFixed(6)}&layer=${sv.layer}&pixscale=${scale.toFixed(4)}&size=${pixels}`;
      const blob = await (await fetch(url, { signal })).blob();
      const bitmap = await createImageBitmap(blob);
      const c = document.createElement("canvas"); c.width = c.height = pixels;
      const ctx = c.getContext("2d")!; ctx.drawImage(bitmap, 0, 0, pixels, pixels);
      const img = ctx.getImageData(0, 0, pixels, pixels), d = img.data;
      // An empty cut-out is one flat colour: measure the spread before keeping it.
      let sum = 0, sq = 0; for (let i = 0; i < d.length; i += 16) { const v = d[i] + d[i + 1] + d[i + 2]; sum += v; sq += v * v; }
      const n = d.length / 16, spread = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
      if (spread < 4) return null;
      for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * sv.gain); d[i + 1] = Math.min(255, d[i + 1] * sv.gain); d[i + 2] = Math.min(255, d[i + 2] * sv.gain); }
      ctx.putImageData(img, 0, 0);
      return { id: `survey-${sv.id}`, kind: "survey", label: sv.label, caption: sv.caption, image: c.toDataURL("image/jpeg", 0.9), images: 0 };
    } catch { return null; }
  };
  const [wise, legacy] = await Promise.all([one(SURVEYS[0]), one(SURVEYS[1])]);
  // Pan-STARRS is slower: only asked where the Legacy Surveys have nothing.
  const optical = legacy ?? (dec > -30 ? await one(SURVEYS[2]) : null);
  return [wise, optical].filter((f): f is SpxFrame => f !== null);
}

/** Shared votes: what all visitors said of one source of the queue. A vote is sent with a random number kept in this
 * browser, so that one visitor counts once per source; no name and no account. */
export type SharedVotes = { counts: Record<Vote, number>; total: number };
const CLIENT_KEY = "blinking-sky.client.v1";
function clientId() {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(CLIENT_KEY, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
const shared = async (response: Response): Promise<SharedVotes | null> => { if (!response.ok) return null; const body = await response.json(); return body && body.counts ? { counts: body.counts, total: body.total } : null; };
export const fetchSharedVotes = (id: string): Promise<SharedVotes | null> => fetch(`/api/votes?id=${encodeURIComponent(id)}`).then(shared).catch(() => null);
export const sendSharedVote = (id: string, vote: Vote): Promise<SharedVotes | null> =>
  fetch("/api/votes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, vote, client: clientId() }) }).then(shared).catch(() => null);

/** The whole community: how many votes on how many sources, and the latest ones. */
export type Community = { votes: number; sources: number; latest: { id: string; vote: Vote; at: number }[] };
export const fetchCommunity = (): Promise<Community | null> => fetch("/api/votes").then(async (r) => { if (!r.ok) return null; const b = await r.json(); return typeof b.votes === "number" ? { votes: b.votes, sources: b.sources, latest: b.latest ?? [] } : null; }).catch(() => null);
