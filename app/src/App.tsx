import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Shuffle } from "lucide-react";
import Guide from "./Guide";
import HoverCard, { type Hovered } from "./HoverCard";
import Landing from "./Landing";
import CountUp from "./reactbits/CountUp";
import GradientText from "./reactbits/GradientText";
import Panel, { type SpherexView } from "./Panel";
import Slides, { type Director } from "./deck/Slides";
import { GROUPS, VARIABLES, differenceImage, surveyFrames, fetchSharedVotes, sendSharedVote, type SharedVotes, type FrameKind, type SpxFrame, loadQueue, loadSolar, loadSolarFrames, loadSpherexCatalog, readVotes, sexagesimal, writeVote, type QueueSource, type SolarData, type SpxCatalog, type SpxTarget, type Vote } from "./data";
import CommunityPage from "./Community";
import { DEFAULT_FIELD, startLive, startMover, type FieldArcmin, type LiveInput } from "./live";
import { Sky, TELESCOPE_FOV, type Marker } from "./sky/Sky";
import { photometricDistance, setRelation, type GalaxyObject, type SolarBody } from "./sky/galaxy";
import { temperatureOf, type PortraitLook } from "./sky/portrait";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const VIEW: SpherexView = { kind: "date", frame: 0, playing: false, flagged: false, opacity: 1, pixelBox: true };
const shortName = (name: string) => name.replace(/^CWISE J(\d{4})\d{2}\.\d+([+-]\d{4})\d{2}\.\d$/, "J$1$2").replace("-", "−");
const firstFrame = (t: SpxTarget, kind: FrameKind) => Math.max(0, t.frames.findIndex((f) => f.kind === kind));
const defaultKind = (t: SpxTarget): "date" | "colour" => (t.motion && t.motion.total > 2 && t.frames.some((f) => f.kind === "date")) || !t.frames.some((f) => f.kind === "colour") ? "date" : "colour";
// The three bodies prepared in advance, under their id on the Solar System map.
const PREPARED_BODY: Record<string, string> = { "29P": "sb-29P", pallas: "sb-2", euphrosyne: "sb-31" };
const dayOf = (mjd: number) => new Date((mjd - 40587) * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const hashSeed = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973; return h / 97; };

/** "133.795 -7.245", "08h55m10.8s -07°14′42″" or a J designation → degrees. */
function parsePosition(text: string): [number, number] | null {
  const t = text.trim();
  const j = /J(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([+-−])(\d{2})(\d{2})(\d{2}(?:\.\d+)?)/.exec(t);
  if (j) return [15 * (+j[1] + +j[2] / 60 + +j[3] / 3600), (j[4] === "+" ? 1 : -1) * (+j[5] + +j[6] / 60 + +j[7] / 3600)];
  const n = t.replace(/[hms°′″'":,]/g, " ").replace("−", "-").split(/\s+/).filter(Boolean).map(Number);
  if (n.some(Number.isNaN)) return null;
  if (n.length === 2 && n[0] >= 0 && n[0] < 360 && Math.abs(n[1]) <= 90) return [n[0], n[1]];
  if (n.length === 6) { const sign = /^\s*\S+\s+\S+\s+\S+\s+[-−]/.test(t.replace(/[hms°′″'":,]/g, " ")) ? -1 : 1; return [15 * (n[0] + n[1] / 60 + n[2] / 3600), sign * (Math.abs(n[3]) + n[4] / 60 + n[5] / 3600)]; }
  return null;
}

export default function App() {
  const host = useRef<HTMLDivElement>(null), sky = useRef<Sky | null>(null);
  const leftRef = useRef<HTMLElement>(null);
  const [catalog, setCatalog] = useState<SpxCatalog | null>(null);
  const [queue, setQueue] = useState<QueueSource[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [liveTarget, setLiveTarget] = useState<SpxTarget | null>(null);
  const [panel, setPanel] = useState(true);
  const [open, setOpen] = useState<string | null>("start");
  const [view, setView] = useState<SpherexView>(VIEW);
  const [votes, setVotes] = useState(readVotes);
  // What all visitors said of the sources of the queue, as far as this visit has asked.
  const [sharedVotes, setSharedVotes] = useState<Record<string, SharedVotes>>({});
  const [query, setQuery] = useState("");
  const [where, setWhere] = useState("");
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // A position in the URL (?ra=&dec= in degrees, and ?fov=2|4|8) opens the tool on that patch of sky, so a link can be embedded.
  const urlPosition = useMemo((): [number, number] | null => {
    const ra = Number(params.get("ra")), dec = Number(params.get("dec"));
    return params.has("ra") && params.has("dec") && Number.isFinite(ra) && Number.isFinite(dec) && ra >= 0 && ra < 360 && Math.abs(dec) <= 90 ? [ra, dec] : null;
  }, [params]);
  const [fieldArcmin, setFieldArcmin] = useState<FieldArcmin>(() => { const f = Number(params.get("fov")); return f === 4 || f === 8 ? f : DEFAULT_FIELD; });
  const fieldRef = useRef<FieldArcmin>(fieldArcmin); fieldRef.current = fieldArcmin;
  const [screen, setScreen] = useState<"home" | "sky" | "community">(params.has("community") ? "community" : params.has("sky") || urlPosition ? "sky" : "home");
  // The talk: "full" for a text slide over the turning galaxy, "live" when the slide is the tool itself.
  const [presenting, setPresenting] = useState<"full" | "live" | null>(params.has("present") ? "full" : null);
  const [guideRun, setGuideRun] = useState(0);
  const [level, setLevel] = useState<"galaxy" | "sky">("galaxy");
  const [hovered, setHovered] = useState<Hovered | null>(null);
  // The guided introduction: shown the first time the map opens, and again from "How it works".
  const [guide, setGuide] = useState<number | null>(() => { try { return localStorage.getItem("blinking-sky.guide.v1") ? null : 0; } catch { return 0; } });
  const [suspectsShown, setSuspectsShown] = useState(false);
  const closeGuide = useCallback(() => { setGuide(null); try { localStorage.setItem("blinking-sky.guide.v1", "seen"); } catch { /* storage blocked */ } }, []);
  const [galaxyCount, setGalaxyCount] = useState(0);
  const [solar, setSolar] = useState<SolarData | null>(null);
  // True when the galaxy map is zoomed down to the planets.
  const [solarScale, setSolarScale] = useState(false);
  const [published, setPublished] = useState<{ count: number; measured: number; estimated: number } | null>(null);
  const live = useRef<ReturnType<typeof startLive> | null>(null);
  const autoKind = useRef(true);

  const selectedRef = useRef(""); selectedRef.current = selected;
  const prepared = useMemo(() => catalog?.targets.find((t) => t.id === selected) ?? null, [catalog, selected]);
  const base = liveTarget && liveTarget.id === selected ? liveTarget : prepared;
  // What changed between the first and the last date, as one more frame: last minus first.
  const [diff, setDiff] = useState<{ id: string; first: string; last: string; image: string; label: string } | null>(null);
  const dated = base?.frames.filter((f) => f.kind === "date") ?? [], firstDate = dated[0], lastDate = dated[dated.length - 1];
  useEffect(() => {
    if (!base || dated.length < 2 || !firstDate || !lastDate) { setDiff(null); return; }
    let stale = false;
    differenceImage(firstDate.image, lastDate.image).then((image) => { if (!stale) setDiff({ id: base.id, first: firstDate.image, last: lastDate.image, image, label: `Difference · ${lastDate.label} minus ${firstDate.label}` }); }).catch(() => {});
    return () => { stale = true; };
  }, [base?.id, firstDate?.image, lastDate?.image]); // eslint-disable-line react-hooks/exhaustive-deps
  // A source of the queue opens with the votes of the other visitors.
  useEffect(() => {
    if (base?.group !== "queue") return;
    const id = base.id; let stale = false;
    fetchSharedVotes(id).then((s) => { if (s && !stale) setSharedVotes((all) => ({ ...all, [id]: s })); });
    return () => { stale = true; };
  }, [base?.id, base?.group]);
  // The same patch in other surveys, asked for by the visitor: WISE and an optical survey, on the grid of the SPHEREx frame.
  const [surveys, setSurveys] = useState<{ id: string; size: number; frames: SpxFrame[] } | null>(null);
  const [surveyState, setSurveyState] = useState<"idle" | "loading" | "none">("idle");
  const fieldSize = base?.geometry ? base.geometry.width * base.geometry.gridPixelArcsec : 0;
  useEffect(() => { setSurveyState("idle"); }, [base?.id, fieldSize]);
  const loadSurveys = useCallback(() => {
    const g = base?.geometry; if (!base || !g) return;
    const id = base.id, size = g.width * g.gridPixelArcsec;
    setSurveyState("loading");
    surveyFrames(g.centerRaDeg, g.centerDecDeg, size).then((frames) => {
      if (selectedRef.current !== id) return;
      if (!frames.length) { setSurveyState("none"); return; }
      setSurveys({ id, size, frames }); setSurveyState("idle"); autoKind.current = false;
      setView((v) => ({ ...v, kind: "survey", frame: -1, playing: true }));
    });
  }, [base]);
  const target = useMemo(() => {
    if (!base) return base;
    const frames = [...base.frames];
    if (diff && diff.id === base.id && diff.first === firstDate?.image && diff.last === lastDate?.image) frames.push({ id: "diff", kind: "date" as const, label: diff.label, image: diff.image, images: 0 });
    if (surveys && surveys.id === base.id && Math.abs(surveys.size - fieldSize) < 0.5) {
      // SPHEREx first, so the blink goes from the SPHEREx image to the other surveys and back.
      const ours = base.frames.find((f) => f.id === "lw") ?? base.frames.find((f) => f.kind === "date");
      if (ours) frames.push({ ...ours, id: "survey-spherex", kind: "survey" as const, label: "SPHEREx", caption: `SPHEREx, ${ours.band ? `${ours.band[0]}–${ours.band[1]} µm` : "this field"}: the image built here from NASA's archive.` });
      frames.push(...surveys.frames);
    }
    return frames.length === base.frames.length ? base : { ...base, frames };
  }, [base, diff, firstDate?.image, lastDate?.image, surveys, fieldSize]);

  useEffect(() => {
    if (!host.current) return;
    const s = new Sky(host.current); sky.current = s;
    if (import.meta.env.DEV) (window as unknown as { __sky: Sky }).__sky = s;
    let tick = 0;
    s.onMove = (ra, dec, fov) => { if (++tick % 12 === 0) setWhere(`${sexagesimal(ra, dec)} · field ${fov >= 1 ? fov.toFixed(0) + "°" : fov * 60 >= 1 ? (fov * 60).toFixed(1) + "′" : (fov * 3600).toFixed(0) + "″"}`); };
    s.onLevel = setLevel; s.onScale = setSolarScale;
    fetch(`${BASE}/data/stars.bin`).then((r) => r.arrayBuffer()).then((b) => s.setStars(b)).catch(() => {});
    Promise.all([fetch(`${BASE}/data/galaxy.json`).then((r) => r.json()), fetch(`${BASE}/data/spherex-dwarfs.bin`).then((r) => r.arrayBuffer()), fetch(`${BASE}/data/spherex-dwarfs.json`).then((r) => r.json())])
      .then(([frame, b, meta]) => {
        setRelation(meta.absoluteW2); s.setGalaxyFrame(frame); s.setDwarfs(b, meta); setPublished({ count: meta.count, measured: meta.measured, estimated: meta.estimated });
        return Promise.all([fetch(`${BASE}/data/galaxies.bin`).then((r) => r.arrayBuffer()), fetch(`${BASE}/data/galaxies.json`).then((r) => r.json())]);
      }).then(([b, meta]) => { s.setGalaxies(b, meta); setGalaxyCount(meta.count); return loadSolar(BASE); }).then((data) => { s.setSolar(data); setSolar(data); }).catch(() => {});
    Promise.all([loadSpherexCatalog(BASE), loadQueue(BASE)]).then(([c, q]) => { c.targets.push(...VARIABLES.map((v): SpxTarget => ({ id: v.id, name: v.name, group: "variable", ra: v.ra, dec: v.dec, blurb: v.blurb, frames: [], stacked: false }))); setCatalog(c); setQueue(q.sources); }).catch((e) => setError(String(e.message ?? e)));
    return () => { live.current?.stop(); s.dispose(); sky.current = null; };
  }, []);

  // Markers: every prepared field, and the unchecked sources as faint dots.
  useEffect(() => {
    if (!catalog || !sky.current) return;
    const markers: Marker[] = catalog.targets.map((t) => ({ id: t.id, name: shortName(t.name), ra: t.ra, dec: t.dec, tone: t.group === "unpublished" ? "cand" : t.group === "rejected" ? "off" : "known" }));
    for (const q of queue) markers.push({ id: q.id, name: shortName(q.name), ra: q.ra, dec: q.dec, tone: "queue" });
    if (liveTarget?.group === "position") markers.push({ id: liveTarget.id, name: "Your position", ra: liveTarget.ra, dec: liveTarget.dec, tone: "known" });
    sky.current.setMarkers(markers);
    // The same fields in the galaxy: at a measured distance when there is one, else estimated from the fitted type and
    // the brightness; an unchecked source is placed where it would be if it is a T7 dwarf, and labelled as assumed.
    const objects: GalaxyObject[] = [];
    for (const t of catalog.targets) {
      // Only what is ours to show: the candidates with no publication found. The published ones are among the small dots.
      const estimate = t.group === "unpublished" ? photometricDistance(t.dwarf?.type, t.dwarf?.W2) : null;
      if (estimate) objects.push({ id: t.id, name: shortName(t.name), ra: t.ra, dec: t.dec, tone: "cand", distance: estimate, basis: "estimated" });
    }
    for (const q of queue) {
      // A look changes the dot: solid when it fades in methane and the measurement agrees, dimmed when it does not fade.
      const d = photometricDistance("T7", q.W2), v = votes[q.id];
      const state = !v ? undefined : v.vote !== "fades" ? "dismissed" as const : v.R !== undefined && v.R !== null && v.R < 0.3 && (v.snr ?? 0) >= 5 ? "found" as const : "flagged" as const;
      if (d) objects.push({ id: q.id, name: shortName(q.name), ra: q.ra, dec: q.dec, tone: "queue", distance: d, basis: "assumed", state });
    }
    sky.current.setObjects(objects);
  }, [catalog, queue, published, votes, liveTarget?.id, liveTarget?.group, liveTarget?.ra, liveTarget?.dec]);
  // During the guide the map shows one layer more at each step; the suspects only appear once their selection has been replayed.
  useEffect(() => { sky.current?.setReveal(guide === null ? 4 : guide === 1 ? (suspectsShown ? 2 : 1) : guide + 1, guide !== null && screen === "sky" && !(guide === 1 && suspectsShown)); }, [guide, screen, suspectsShown]);

  const choose = useCallback((id: string) => {
    const next = catalog?.targets.find((t) => t.id === id);
    if (!next) return;
    if (next.group === "variable") { const v = VARIABLES.find((x) => x.id === id); setOpen("variable"); return goLiveRef.current?.({ id, name: next.name, ra: next.ra, dec: next.dec, group: "variable", W1: v?.W1, W2: v?.W2, blurb: next.blurb, published: "Known young star; the change of brightness is ours to check", knownType: "star" }); }
    live.current?.stop(); live.current = null; setLiveTarget(null);
    const kind = defaultKind(next);
    setSelected(id); setPanel(true); setOpen(next.group);
    setView((v) => ({ ...v, kind, frame: firstFrame(next, kind), playing: next.frames.filter((f) => f.kind === kind).length > 1, flagged: false }));
    // In the galaxy, a field that is not one of the dots still needs a place: its measured or estimated distance.
    const MEASURED: Record<string, number> = { barnard: 1.83, "J085510.83-071442.5": 2.28, "2MASSI_J0415195-093506": 5.7 };
    // A Solar System body is, at this scale, at the Sun.
    const parsecs = next.solar ? 2e-4 : MEASURED[next.id] ?? photometricDistance(next.dwarf?.type, next.dwarf?.W2)?.[1] ?? 20;
    const field = next.geometry ? next.geometry.width * next.geometry.gridPixelArcsec / 3600 / 0.38 : TELESCOPE_FOV;
    if (!(next.solar && sky.current?.aimBody(PREPARED_BODY[next.id] ?? ""))) sky.current?.aimAt(next.ra, next.dec, parsecs);
    sky.current?.flyTo(next.geometry?.centerRaDeg ?? next.ra, next.geometry?.centerDecDeg ?? next.dec, next.id === "barnard" || next.solar ? field : TELESCOPE_FOV);
  }, [catalog]);

  const goLiveRef = useRef<((input: LiveInput) => void) | null>(null);
  const lastLive = useRef<LiveInput | null>(null);
  const goLive = useCallback((input: LiveInput) => {
    live.current?.stop();
    autoKind.current = true; lastLive.current = input;
    setSelected(input.id); setPanel(true); setLiveTarget(null);
    setView((v) => ({ ...v, kind: "colour", frame: 0, playing: false, flagged: false }));
    sky.current?.flyTo(input.ra, input.dec, TELESCOPE_FOV * fieldRef.current / DEFAULT_FIELD);
    live.current = startLive(input, (t) => setLiveTarget(t), fieldRef.current);
  }, []);
  goLiveRef.current = goLive;
  // Another field of view: the same position is read again from the archive on the wider or narrower grid.
  const changeField = useCallback((f: FieldArcmin) => {
    setFieldArcmin(f); fieldRef.current = f;
    if (lastLive.current && selectedRef.current === lastLive.current.id) goLive(lastLive.current);
  }, [goLive]);
  // A small body clicked on the Solar System map: fly to where it was, and read the exposures of its visit.
  const chooseBody = useCallback((body: SolarBody) => {
    const prepared = Object.keys(PREPARED_BODY).find((k) => PREPARED_BODY[k] === body.id);
    if (prepared && catalog?.targets.some((t) => t.id === prepared)) return choose(prepared);
    if (!solar) return;
    live.current?.stop(); live.current = null; autoKind.current = false;
    setSelected(body.id); setPanel(true); setLiveTarget(null); setOpen("solar");
    setView((v) => ({ ...v, kind: "date", frame: 0, playing: true, flagged: false }));
    sky.current?.aimBody(body.id);
    sky.current?.flyTo(body.ra, body.dec, 121 * 5 / 3600 / 0.38);
    const id = body.id;
    loadSolarFrames(BASE, solar, id).then((list) => { if (selectedRef.current === id) live.current = startMover(body, list, (t) => setLiveTarget(t)); }).catch((e) => setError(String(e.message ?? e)));
  }, [catalog, solar, choose]);
  const chooseQueue = useCallback((q: QueueSource) => goLive({
    id: q.id, name: q.name, ra: q.ra, dec: q.dec, group: "queue", epoch: q.epoch, pm: q.pm, pmTotal: q.pmTotal, pmSigma: q.pmSigma, W1: q.W1, W2: q.W2,
    blurb: `Red in WISE (W1−W2 = ${(q.W1 - q.W2).toFixed(1)}) with a hint of motion: ${q.pmTotal.toFixed(2)}″ a year at ${q.pmSigma.toFixed(1)}σ. Nobody has looked at it in SPHEREx. Does it fade in the methane band?`,
    published: "Not in the brown-dwarf catalogs and candidate lists used to build the queue",
  }), [goLive]);
  const nextUnchecked = useCallback(() => {
    const pool = queue.filter((q) => !votes[q.id] && q.id !== selected);
    if (pool.length) chooseQueue(pool[Math.floor(Math.random() * Math.min(pool.length, 120))]); // the brighter half first: they are measurable
  }, [queue, votes, selected, chooseQueue]);
  const pick = useCallback((id: string) => {
    if (catalog?.targets.some((t) => t.id === id)) choose(id);
    else { const q = queue.find((x) => x.id === id); if (q) chooseQueue(q); }
  }, [catalog, queue, choose, chooseQueue]);
  const lookAt = useCallback((ra: number, dec: number) => goLive({
    id: `pos-${ra.toFixed(4)}-${dec.toFixed(4)}`, name: sexagesimal(ra, dec), ra, dec, group: "position",
    blurb: "A position you chose. The image and the spectrum are built from every public SPHEREx exposure that covers it.",
    published: "No catalog check is run for a free position: use the links below",
  }), [goLive]);

  useEffect(() => { if (sky.current) { sky.current.onPick = pick; } }, [pick]);
  // Resting the pointer on a dot previews what is there.
  useEffect(() => {
    if (!sky.current) return;
    sky.current.onHover = (what, x, y) => {
      if (!what) return setHovered(null);
      if (what.kind === "body") {
        const b = solar?.bodies[what.index]; if (!b) return;
        return setHovered({ name: b.name, ra: b.ra, dec: b.dec, x, y, line: `${b.kind === "trojan" ? "Jupiter trojan" : b.kind === "near-Earth" ? "Near-Earth asteroid" : b.kind[0].toUpperCase() + b.kind.slice(1)}${b.rh ? ` · ${b.rh.toFixed(2)} au from the Sun` : ""}`,
          note: `Seen by SPHEREx on ${dayOf(b.mjd)}: it crossed ${b.moved}″ in ${b.hours} hours. Shown where it was that day.` });
      }
      if (what.kind === "galaxy") return setHovered({ name: what.name, ra: what.ra, dec: what.dec, x, y, line: `Galaxy · ${Math.round(what.distance * 3.26 / 1e6)} million light-years` });
      if (what.kind === "dwarf") {
        const target = catalog?.targets.find((t) => Math.hypot((t.ra - what.ra) * Math.cos(what.dec * Math.PI / 180), t.dec - what.dec) < 0.004);
        return setHovered({ name: what.name, ra: what.ra, dec: what.dec, x, y, target, line: `SPHEREx type ${what.type} · ${Math.round(what.distance * 3.26)} light-years${what.measured ? "" : " (estimated)"}` });
      }
      if (what.kind !== "object") return;
      const id = what.id, target = catalog?.targets.find((t) => t.id === id), q = queue.find((v) => v.id === id);
      if (target) setHovered({ name: target.name, ra: target.ra, dec: target.dec, x, y, target, line: "Candidate · no publication found" });
      else if (q) setHovered({ name: q.name, ra: q.ra, dec: q.dec, x, y, line: `Unchecked · red in WISE, motion ${q.pmTotal.toFixed(2)}″ a year at ${q.pmSigma.toFixed(1)}σ` });
    };
  }, [catalog, queue, solar]);
  useEffect(() => { if (level !== "galaxy" || screen !== "sky") setHovered(null); }, [level, screen]);
  // A published SPHEREx dwarf clicked in the galaxy: fly to it and rebuild its image and spectrum from the archive.
  useEffect(() => {
    if (!sky.current) return;
    sky.current.onDwarf = (picked) => {
      if (picked.kind === "body") { const b = solar?.bodies[picked.index]; if (b) chooseBody(b); return; }
      const known = catalog?.targets.find((t) => Math.hypot((t.ra - picked.ra) * Math.cos(picked.dec * Math.PI / 180), t.dec - picked.dec) < 0.004);
      if (known) return choose(known.id);
      sky.current!.destination = picked.position;
      if (picked.kind === "galaxy") return goLive({ id: `gal-${picked.index}`, name: picked.name, ra: picked.ra, dec: picked.dec, group: "position", knownType: "galaxy",
        blurb: `A galaxy about ${Math.round(picked.distance * 3.26 / 1e6)} million light-years away (redshift from the 2MASS Redshift Survey). Its SPHEREx image is built here from the archive.`,
        published: "In the 2MASS Redshift Survey (Huchra et al. 2012)" });
      goLive({ id: `spx-${picked.index}`, name: picked.name, ra: picked.ra, dec: picked.dec, group: "position", knownType: picked.type,
        blurb: `SPHEREx type ${picked.type}, about ${Math.round(picked.distance * 3.26)} light-years away (${picked.measured ? "measured parallax" : "distance estimated from type and brightness"}). Its SPHEREx type is published: here its image and spectrum are rebuilt from the archive.`,
        published: `In the published SPHEREx table of ultracool dwarfs (Gagné et al. 2026), group “${picked.group}”` });
    };
  }, [catalog, choose, goLive, solar, chooseBody]);
  // Home: the sky drifts, wide. Entering it flies to the first field.
  useEffect(() => { sky.current?.setHome(screen === "home"); }, [screen]);
  const enter = useCallback((then?: () => void) => { setScreen("sky"); setPresenting(null); then?.(); }, []);
  // Opening the tool straight on the sky (?sky) starts on the first field; from the landing page it starts in the neighbourhood.
  useEffect(() => { if (catalog && !selected && screen === "sky" && params.has("sky") && !urlPosition) choose("J085510.83-071442.5"); }, [catalog, selected, screen, choose, params, urlPosition]);
  // Opening on a position from the URL: a known field or an unchecked source within 14″ opens as itself, anything else as a free position.
  const booted = useRef(false);
  useEffect(() => {
    if (!catalog || !urlPosition || booted.current) return;
    booted.current = true;
    const [ra, dec] = urlPosition, cos = Math.cos(dec * Math.PI / 180), near = (t: { ra: number; dec: number }) => Math.hypot((t.ra - ra) * cos, t.dec - dec) < 0.004;
    const known = catalog.targets.find((t) => !t.solar && near(t)), q = queue.find(near);
    if (known) choose(known.id); else if (q) chooseQueue(q); else lookAt(ra, dec);
  }, [catalog, queue, urlPosition, choose, chooseQueue, lookAt]);
  // The address bar follows the field on screen, so the link can be copied and embedded: ?ra=&dec=, and ?fov= when not the default.
  const isLive = Boolean(base?.live);
  useEffect(() => {
    if (presenting) return;
    const url = new URL(window.location.href), q = url.searchParams;
    if (screen === "community") q.set("community", ""); else q.delete("community");
    if (base && !base.solar && screen === "sky") { q.set("ra", base.ra.toFixed(5)); q.set("dec", base.dec.toFixed(5)); if (fieldArcmin !== DEFAULT_FIELD && isLive) q.set("fov", String(fieldArcmin)); else q.delete("fov"); }
    else { q.delete("ra"); q.delete("dec"); q.delete("fov"); }
    const query = q.toString().replace(/(^|&)(sky|present|community)=(?=&|$)/g, "$1$2"); // the flags stay bare: ?sky, ?present
    const next = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
  }, [base?.id, base?.ra, base?.dec, base?.solar, isLive, fieldArcmin, presenting, screen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "p" && !presenting && (e.target as HTMLElement | null)?.tagName !== "INPUT" && !e.metaKey && !e.ctrlKey) setPresenting("full"); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [presenting]);

  // While a live field builds up, show the colour frames as soon as they exist and keep the frame index valid.
  useEffect(() => {
    if (!target) return;
    // A live field opens on its two colours as soon as both exist, and starts blinking; a variable star opens on its dates.
    if (target.live && autoKind.current) {
      const variable = target.group === "variable";
      const enough = variable ? target.frames.filter((f) => f.kind === "date" && f.id !== "diff").length > 1 : target.frames.filter((f) => f.kind === "colour").length > 1;
      if (enough) { autoKind.current = false; const kind = variable ? "date" as const : "colour" as const; setView((v) => ({ ...v, kind, frame: firstFrame(target, kind), playing: true })); return; }
    }
    setView((v) => {
      const has = (k: FrameKind) => target.frames.some((f) => f.kind === k);
      let kind = v.kind;
      if (!has(kind)) kind = has("colour") && !target.live ? "colour" : has("date") ? "date" : "colour";
      const frame = target.frames[v.frame]?.kind === kind ? v.frame : firstFrame(target, kind);
      return kind === v.kind && frame === v.frame ? v : { ...v, kind, frame };
    });
  }, [target]);
  useEffect(() => {
    if (!view.playing || !target) return;
    const frames = target.frames.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === view.kind && f.id !== "diff").map(({ i }) => i);
    if (frames.length < 2) return;
    const timer = window.setInterval(() => setView((v) => ({ ...v, frame: frames[(frames.indexOf(v.frame) + 1) % frames.length] })), 1100);
    return () => window.clearInterval(timer);
  }, [view.playing, view.kind, target]);

  // The sky follows the selection: the frame on the sphere, and the portrait drawn from the measurements.
  const frame = target?.frames[view.frame];
  useEffect(() => {
    const s = sky.current;
    if (!s) return;
    s.setSelected(target?.id ?? "");
    if (!target || !frame || !target.geometry) { s.setFrame(null); return; }
    const g = target.geometry;
    s.setFrame({ ra: g.centerRaDeg, dec: g.centerDecDeg, sizeArcsec: g.width * g.gridPixelArcsec, mark: frame.at ? [(frame.at[0] + 0.5) / g.width, (frame.at[1] + 0.5) / g.height] : target.solar ? undefined : [0.5, 0.5], image: view.flagged && frame.flagged ? frame.flagged : frame.image,
      label: frame.kind === "survey" ? `${shortName(target.name)} · ${frame.label}` : `${shortName(target.name)} · SPHEREx ${frame.kind === "date" ? frame.label : frame.label.split(" · ")[0]}${frame.images > 1 ? ` · ${frame.images} exposures` : ""}` });
  }, [target?.id, target?.geometry?.centerRaDeg, frame?.image, frame?.flagged, view.flagged, frame?.label, frame?.images]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sky.current?.setFrameOpacity(view.opacity); }, [view.opacity]);
  // With a Solar System body open, the planets on the map are shown at the day SPHEREx saw it; else today.
  useEffect(() => { sky.current?.setSolarDate(target?.solar?.jd ?? null); }, [target?.solar?.jd, solar]);
  useEffect(() => {
    const s = sky.current;
    if (!s) return;
    let look: PortraitLook | null = null, caption = "";
    const d = target?.dwarf, type = d?.type ?? d?.knownType, hasDip = Boolean(d && d.dip !== "none" && d.snr >= 5);
    const head = (note: string) => `<b>3D view</b><em>${note}</em>`;
    if (target?.id === "barnard") { look = { kind: "star", temperature: 3200, methane: 0, brightness: 1, seed: 3 }; caption = head("Illustration · not an image") + "<span>Red dwarf star, about 3,200 K</span>"; }
    else if (target?.solar) { look = { kind: target.solar.kind === "comet" ? "comet" : "rock", temperature: 200, methane: 0, brightness: 1, seed: hashSeed(target.id) % 97 }; caption = head("Illustration · the real shape is not known") + `<span>${target.solar.kind === "comet" ? "A comet" : target.solar.kind === "centaur" ? "A centaur" : target.solar.kind === "trojan" ? "A Jupiter trojan" : "An asteroid"}, ${Number(target.solar.sunDistanceAu).toFixed(1)} au from the Sun</span>`; }
    else if (target?.group === "variable") {
      // A young star: the illustration glows with the brightness measured at the date on screen.
      const fluxes = target.frames.filter((f) => f.kind === "date" && f.flux).map((f) => f.flux![0]), top = Math.max(1, ...fluxes);
      look = { kind: "star", temperature: 3600, methane: 0, brightness: frame?.flux ? Math.max(0.12, Math.min(1, frame.flux[0] / top)) : 1, seed: hashSeed(target.id) };
      caption = head("Illustration · not an image") + "<span>A young star: its glow follows the brightness measured at each date</span>";
    }
    else if (target && type === "galaxy") { look = { kind: "galaxy", temperature: 0, methane: 0, brightness: 1, seed: hashSeed(target.id) }; caption = head("Illustration · not an image") + "<span>A galaxy: billions of stars, far outside the Milky Way</span>"; }
    else if (target && d && target.group !== "rejected" && (hasDip || type)) {
      // Drawn from what is known: the type sets the temperature and colour, the methane index the bands.
      const temperature = temperatureOf(type), measured = Number.isFinite(d.R);
      const methane = measured ? Math.max(0, Math.min(1, 1 - d.R / 0.6)) : /^(T[4-9]|Y)/.test(type ?? "") ? 0.75 : 0.1;
      // The portrait dims with the object: in the methane band it keeps only the measured fraction of its light.
      const brightness = frame?.id === "ch4" && measured ? Math.max(0.05, Math.min(1, d.R)) : 1;
      look = { kind: /^M/.test(type ?? "") ? "star" : "dwarf", temperature, methane, brightness, seed: hashSeed(target.id) };
      caption = head("Drawn from the measurements · not an image") + `<span>${type ? `${d.type ? `${type} template` : `SPHEREx type ${type}`} · about ${Math.round(temperature / 50) * 50} K` : "Cold dwarf · type not fitted"}${measured ? ` · methane index ${d.R.toFixed(2)}` : ""}</span>`;
    } else if (target) {
      // Nothing measured says what it is yet: a plain grey body, said as such.
      look = { kind: "unknown", temperature: 800, methane: 0, brightness: 1, seed: hashSeed(target.id) };
      caption = head("Not identified · placeholder, not an image") + `<span>${target.live && !target.live.finished ? "Measuring: its colour and bands appear if methane shows up" : target.group === "rejected" ? "Rejected: not a cold dwarf" : "No methane dip measured: a star or a galaxy, type unknown"}</span>`;
    }
    s.setPortrait(look, caption);
  }, [target?.id, target?.solar, target?.dwarf?.dip, target?.dwarf?.R, target?.dwarf?.type, target?.dwarf?.knownType, target?.dwarf?.snr, target?.group, target?.live?.finished, frame?.id, frame?.flux?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const measure = () => sky.current?.setInsets({ left: (leftRef.current?.offsetWidth ?? 0) + 28, right: panel && target && window.innerWidth > 900 ? Math.min(400, window.innerWidth - 48) + 28 : 0 });
    measure(); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure);
  }, [panel, target]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const byName = catalog?.targets.find((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()) && query.trim().length > 3);
    if (byName) return choose(byName.id);
    const q = query.trim().toLowerCase(), body = q.length > 2 ? solar?.bodies.find((b) => b.name.toLowerCase().replace(/[()]/g, "").split(" ").includes(q)) ?? solar?.bodies.find((b) => b.name.toLowerCase().includes(q)) : undefined;
    if (body) return chooseBody(body);
    const p = parsePosition(query);
    if (p) lookAt(p[0], p[1]); else setError("Type a position such as “133.795 -7.245” or “08h55m10.8s -07°14′42″”.");
  };
  // One of the candidates, read again from the archive as if nobody had seen it: how it was found.
  const replay = (t: SpxTarget) => {
    sky.current?.aimAt(t.ra, t.dec, photometricDistance(t.dwarf?.type, t.dwarf?.W2)?.[1] ?? 20);
    goLive({ id: `${t.id}-replay`, name: t.name, ra: t.ra, dec: t.dec, group: "position", W1: t.dwarf?.W1 ?? undefined, W2: t.dwarf?.W2 ?? undefined,
      blurb: "Replay: this is how this candidate was found. It started as a red, moving source in WISE, like the unchecked ones. The exposures are read again from the archive: blink the two colours and see whether you would have caught it.",
      published: t.dwarf?.published ?? "" });
  };
  // What the talk asks of the tool: the same actions a visitor would take.
  const direct: Director = {
    scene: (name) => { sky.current?.show(name); },
    clear: () => { live.current?.stop(); live.current = null; setLiveTarget(null); setSelected(""); setHovered(null); setGuide(null); setGuideRun(0); setSuspectsShown(true); },
    galaxy: (name) => { const picked = sky.current?.galaxyNamed(name); if (picked) sky.current?.onDwarf(picked); },
    target: (id, kind) => { setGuide(null); choose(id); if (kind) window.setTimeout(() => setView((v) => ({ ...v, kind, playing: true })), 60); },
    selection: () => { setSuspectsShown(false); setGuide(1); setGuideRun((n) => n + 1); },
    hunt: () => { setGuide(null); nextUnchecked(); },
    replay: (id) => { setGuide(null); const t = catalog?.targets.find((v) => v.id === id); if (t) replay(t); },
  };
  // Development only: lets a test browser drive the tool like the talk does.
  if (import.meta.env.DEV) (window as unknown as { __direct?: Director }).__direct = direct;
  const checked = queue.filter((q) => votes[q.id]).length;
  const found = queue.filter((q) => { const v = votes[q.id]; return v?.vote === "fades" && v.R !== undefined && v.R !== null && v.R < 0.3 && (v.snr ?? 0) >= 5; }).length;
  const candidateCount = (catalog?.targets.filter((t) => t.group === "unpublished").length ?? 12);
  // How wide the telescope view opens on a field: Barnard's demonstration is wide, a live field follows its grid.
  const fovOf = (t: SpxTarget) => t.id === "barnard" ? 0.45 : t.live && t.geometry ? t.geometry.width * t.geometry.gridPixelArcsec / 3600 / 0.38 : TELESCOPE_FOV;

  return (
    <div className="app" data-screen={screen} data-level={level} data-presenting={presenting || undefined}>
      <div className="sky" ref={host} />
      <aside className="left glass" ref={leftRef} aria-label="Blinking Sky">
        <header>
          <p className="eyebrow">NASA SPHEREx · real images</p>
          <h1>Blinking <GradientText colors={["#5ef2ff", "#d6fbff", "#00b8d9", "#5ef2ff"]} animationSpeed={8} className="brand-accent">Sky</GradientText></h1>
          <p className="lead">The infrared sky, seen again every six months in 102 colours. Blink two dates to see what moves or changes brightness. Blink two colours to see what it is made of.</p>
        </header>
        <button type="button" className="primary" onClick={nextUnchecked} disabled={!queue.length}><Shuffle size={14} /> Show me one nobody has checked</button>
        <button type="button" className="community-open" onClick={() => setScreen("community")}>Community votes · what others saw</button>
        <p className="count">{queue.length ? <><CountUp key={queue.length - checked} to={queue.length - checked} from={Math.max(0, queue.length - checked - 40)} duration={0.9} /> unchecked sources · you have looked at {checked}{found ? <> · <b>{found} new candidate{found > 1 ? "s" : ""} found by you</b></> : null}</> : "Loading the review queue…"}</p>
        <form className="search" onSubmit={submit}>
          <Search size={13} /><input value={query} onChange={(e) => { setQuery(e.target.value); setError(""); }} placeholder="RA Dec, or a name · 133.795 -7.245" aria-label="Sky position or name" /><button type="submit">Go</button>
        </form>
        {error && <p className="warn" role="alert">{error}</p>}
        {catalog && <nav aria-label="Fields">
          {GROUPS.map((g) => {
            const list = catalog.targets.filter((t) => t.group === g.id);
            if (!list.length) return null;
            const isOpen = open === g.id;
            return <div key={g.id} className="group">
              <button type="button" className="group-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.id)}><span>{g.label}</span><span>{list.length} {isOpen ? "−" : "+"}</span></button>
              {isOpen && <><p className="hint">{g.hint}</p><div className="pills">{list.map((t) => <button key={t.id} type="button" className={g.id === "unpublished" ? "amber" : ""} aria-pressed={selected === t.id} title={t.name} onClick={() => choose(t.id)}>{shortName(t.name)}</button>)}</div>
                {g.id === "solar" && solar && <button type="button" className="solar-open" onClick={() => { setPanel(false); sky.current?.show("solar"); }}>Open the Solar System map · {solar.count.toLocaleString("en-GB")} bodies seen by SPHEREx</button>}</>}
            </div>;
          })}
        </nav>}
        <div className="row">
          <button type="button" onClick={() => { if (target) { setPanel(true); sky.current?.flyTo(target.geometry?.centerRaDeg ?? target.ra, target.geometry?.centerDecDeg ?? target.dec, fovOf(target), 1.4); } }}>Telescope view</button>
          <button type="button" onClick={() => sky.current?.wide()}>Wide sky</button>
        </div>
        <div className="left-links"><button type="button" onClick={() => setScreen("home")}>← Home</button><button type="button" onClick={() => { setGuide(0); sky.current?.goLevel("galaxy"); }}>How it works</button><button type="button" onClick={() => setPresenting("full")}>Presentation · P</button></div>
        <p className="fine">In the galaxy: drag to turn, scroll to zoom, click a dot to fly to it. At the telescope: real SPHEREx exposures, read from NASA&apos;s archive. The galaxy&apos;s shape is a model; distances marked estimated or assumed are not measurements. Data: NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA · Gagné et al. 2026 · Gaia DR3 · CatWISE2020. What leaves this page: a sky position to legacysurvey.org if you ask for other surveys, and your vote on an unchecked source, with no name. Nothing else.</p>
      </aside>
      <p className="where">{where}</p>
      {screen === "sky" && <nav className="levels glass" aria-label="Scale">
        <button type="button" onClick={() => setScreen("home")}>Home</button>
        <button type="button" aria-pressed={level === "galaxy" && solarScale} onClick={() => { setPanel(false); sky.current?.show("solar"); }}>Solar System</button>
        <button type="button" aria-pressed={level === "galaxy" && !solarScale} onClick={() => { if (level === "galaxy") sky.current?.show("sun"); else sky.current?.goLevel("galaxy"); }}>Galaxy view</button>
        <button type="button" aria-pressed={level === "sky"} onClick={() => sky.current?.goLevel("sky")}>Sky view</button>
      </nav>}
      {screen === "sky" && level === "galaxy" && solarScale && !(target && panel) && guide === null && <aside className="legend glass" aria-label="Legend">
        <p className="legend-title">The Solar System, seen by SPHEREx</p>
        <ul>
          <li><i className="lg small" style={{ background: "#73c7e6" }} /><span><b>Small dots</b> · {(solar?.count ?? 7083).toLocaleString("en-GB")} asteroids and comets with a SPHEREx visit in our lists. Jupiter trojans are bluer, comets white, centaurs violet</span></li>
          <li><i className="lg line" style={{ background: "#5ef2ff" }} /><span><b>Lines</b> · the orbits of the planets. Earth&apos;s is the bright one, 1 au from the Sun</span></li>
          <li><i className="lg ring" style={{ borderColor: "#9df6ff" }} /><span><b>Sun, Earth and planets</b> · where they are today, or on the day of the visit once a body is open</span></li>
        </ul>
        <p className="legend-foot">Each small body is drawn where it was <b>on the day SPHEREx saw it</b>, not where it is now: the dots are not one snapshot. Click one: its exposures are read from NASA&apos;s archive and you watch it move against the stars. Scroll out to return to the stars.</p>
      </aside>}
      {screen === "sky" && level === "galaxy" && !solarScale && !(target && panel) && guide === null && <aside className="legend glass" aria-label="Legend">
        <p className="legend-title">What the dots are</p>
        <ul>
          <li><i className="lg small" style={{ background: "linear-gradient(90deg, #ffa866, #ff5c47, #eb5ca8, #9e73ff)" }} /><span><b>Small coloured dots</b> · dwarfs already typed by SPHEREx{published ? ` (${published.count.toLocaleString("en-GB")})` : ""}: M orange, L red, T magenta, Y violet</span></li>
          <li><i className="lg ring amber" /><span><b>Yellow, filled</b> · {candidateCount} candidates with no publication found{found ? `, plus ${found} found by you` : ""}</span></li>
          <li><i className="lg hollow" /><span><b>Yellow, hollow</b> · {queue.length || 382} sources nobody has checked</span></li>
          <li><i className="lg gal" /><span><b>White dots, far out</b> · {galaxyCount ? galaxyCount.toLocaleString("en-GB") : "43,463"} galaxies at a measured distance. Zoom out past the Milky Way</span></li>
          <li><i className="lg line" /><span><b>Line</b> · its distance is estimated: the candidate is somewhere along it</span></li>
        </ul>
        <p className="legend-foot">The galaxy&apos;s shape is a model. Hollow dots sit where they would be <b>if</b> they are cold dwarfs. Rest the pointer on a dot for a first look; click to fly there.</p>
      </aside>}
      {guide !== null && screen === "sky" && level === "galaxy" && presenting !== "full" && !(target && panel) && <Guide key={guideRun} autoRun={guideRun > 0} step={guide} published={published?.count ?? 15739} suspects={queue.length || 382} candidates={candidateCount}
        onStep={(next) => { if (next === 1) setSuspectsShown(false); setGuide(next); }} onSuspects={setSuspectsShown} onClose={closeGuide} onHunt={() => { closeGuide(); nextUnchecked(); }} />}
      {hovered && screen === "sky" && level === "galaxy" && presenting !== "full" && <HoverCard key={`${hovered.ra},${hovered.dec}`} hovered={hovered} />}
      {screen === "home" && <Landing queueSize={queue.length} images="1.6 million" onEnter={() => enter()} onUnchecked={() => enter(nextUnchecked)} onPresent={() => setPresenting("full")} onCommunity={() => setScreen("community")} />}
      {screen === "community" && <CommunityPage queue={queue} onBack={() => setScreen("home")} onVote={() => enter(nextUnchecked)} onOpen={(q) => enter(() => chooseQueue(q))} />}
      {presenting && <Slides catalog={catalog} queueSize={queue.length} direct={direct} onSlide={(_, live) => { setScreen("sky"); setPresenting(live ? "live" : "full"); }}
        onClose={() => { setPresenting(null); setGuideRun(0); sky.current?.show("sun"); }} onLaunch={() => { setGuideRun(0); enter(); sky.current?.show("sun"); }} />}
      {target && catalog && panel && <Panel target={target} catalog={catalog} view={view} ready={target.frames.length > 0} error="" vote={votes[target.id]?.vote}
        onView={(next) => { if (next.kind) autoKind.current = false; setView((v) => ({ ...v, ...next })); }} onClose={() => setPanel(false)}
        onRecenter={() => sky.current?.flyTo(target.geometry?.centerRaDeg ?? target.ra, target.geometry?.centerDecDeg ?? target.dec, fovOf(target), 1.2)} onRetry={() => {}}
        field={target.live && !target.solar ? fieldArcmin : undefined} onField={changeField}
        onSurveys={loadSurveys} surveys={surveyState}
        onVote={(vote: Vote) => { setVotes(writeVote(target, vote)); if (target.group === "queue") sendSharedVote(target.id, vote).then((s) => { if (s) setSharedVotes((all) => ({ ...all, [target.id]: s })); }); }} shared={target.group === "queue" ? sharedVotes[target.id] : undefined} onMore={live.current ? () => live.current?.more() : undefined} onNext={target.group === "queue" ? nextUnchecked : undefined}
        onReplay={target.group === "unpublished" && !target.live ? () => replay(target) : undefined} />}
    </div>
  );
}
