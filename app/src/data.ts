/** The SPHEREx fields of Blinking Sky: frames on a fixed sky grid, and what was measured there. */

export type SpxGeometry = {
  system: string; centerRaDeg: number; centerDecDeg: number; width: number; height: number;
  gridPixelArcsec: number; nativePixelArcsec: number; referencePixelZeroBased: [number, number];
};
export type SpxFrame = {
  id: string; kind: "date" | "colour"; label: string; image: string; flagged?: string;
  /** Number of exposures averaged in this frame (1 for a single exposure). */
  images: number; band?: [number, number]; date?: string; dateRange?: [string, string];
};
export type SpxGroup = "start" | "solar" | "unpublished" | "blind" | "published" | "rejected" | "queue" | "position";
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
  live?: { done: number; total: number; megabytes: number; finished: boolean; error?: string; pmSigma?: number };
  epoch?: number; pmMas?: [number, number];
  /** A Solar System body crossing a fixed field in single exposures. */
  solar?: { kind: "comet" | "asteroid" | "centaur"; hours: number; movedArcsec: number; sunDistanceAu: number; earthDistanceAu: number };
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
