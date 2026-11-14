import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Shuffle } from "lucide-react";
import HoverCard, { type Hovered } from "./HoverCard";
import Landing from "./Landing";
import CountUp from "./reactbits/CountUp";
import GradientText from "./reactbits/GradientText";
import Panel, { type SpherexView } from "./Panel";
import Slides from "./deck/Slides";
import { GROUPS, loadQueue, loadSpherexCatalog, readVotes, sexagesimal, writeVote, type QueueSource, type SpxCatalog, type SpxTarget, type Vote } from "./data";
import { startLive, type LiveInput } from "./live";
import { Sky, TELESCOPE_FOV, type Marker } from "./sky/Sky";
import { photometricDistance, setRelation, type GalaxyObject } from "./sky/galaxy";
import { temperatureOf, type PortraitLook } from "./sky/portrait";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const VIEW: SpherexView = { kind: "date", frame: 0, playing: false, flagged: false, opacity: 1, pixelBox: true };
const shortName = (name: string) => name.replace(/^CWISE J(\d{4})\d{2}\.\d+([+-]\d{4})\d{2}\.\d$/, "J$1$2").replace("-", "−");
const firstFrame = (t: SpxTarget, kind: "date" | "colour") => Math.max(0, t.frames.findIndex((f) => f.kind === kind));
const defaultKind = (t: SpxTarget): "date" | "colour" => (t.motion && t.motion.total > 2 && t.frames.some((f) => f.kind === "date")) || !t.frames.some((f) => f.kind === "colour") ? "date" : "colour";
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
  const [query, setQuery] = useState("");
  const [where, setWhere] = useState("");
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [screen, setScreen] = useState<"home" | "sky">(params.has("sky") ? "sky" : "home");
  const [presenting, setPresenting] = useState(params.has("present"));
  const [level, setLevel] = useState<"galaxy" | "sky">("galaxy");
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [published, setPublished] = useState<{ count: number; measured: number; estimated: number } | null>(null);
  const live = useRef<ReturnType<typeof startLive> | null>(null);
  const autoKind = useRef(true);

  const prepared = useMemo(() => catalog?.targets.find((t) => t.id === selected) ?? null, [catalog, selected]);
  const target = liveTarget && liveTarget.id === selected ? liveTarget : prepared;

  useEffect(() => {
    if (!host.current) return;
    const s = new Sky(host.current); sky.current = s;
    if (import.meta.env.DEV) (window as unknown as { __sky: Sky }).__sky = s;
    let tick = 0;
    s.onMove = (ra, dec, fov) => { if (++tick % 12 === 0) setWhere(`${sexagesimal(ra, dec)} · field ${fov >= 1 ? fov.toFixed(0) + "°" : fov * 60 >= 1 ? (fov * 60).toFixed(1) + "′" : (fov * 3600).toFixed(0) + "″"}`); };
    s.onLevel = setLevel;
    fetch(`${BASE}/data/stars.bin`).then((r) => r.arrayBuffer()).then((b) => s.setStars(b)).catch(() => {});
    Promise.all([fetch(`${BASE}/data/galaxy.json`).then((r) => r.json()), fetch(`${BASE}/data/spherex-dwarfs.bin`).then((r) => r.arrayBuffer()), fetch(`${BASE}/data/spherex-dwarfs.json`).then((r) => r.json())])
      .then(([frame, b, meta]) => { setRelation(meta.absoluteW2); s.setGalaxyFrame(frame); s.setDwarfs(b, meta); setPublished({ count: meta.count, measured: meta.measured, estimated: meta.estimated }); }).catch(() => {});
    Promise.all([loadSpherexCatalog(BASE), loadQueue(BASE)]).then(([c, q]) => { setCatalog(c); setQueue(q.sources); }).catch((e) => setError(String(e.message ?? e)));
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
    for (const q of queue) { const d = photometricDistance("T7", q.W2); if (d) objects.push({ id: q.id, name: shortName(q.name), ra: q.ra, dec: q.dec, tone: "queue", distance: d, basis: "assumed" }); }
    sky.current.setObjects(objects);
  }, [catalog, queue, published, liveTarget?.id, liveTarget?.group, liveTarget?.ra, liveTarget?.dec]);

  const choose = useCallback((id: string) => {
    const next = catalog?.targets.find((t) => t.id === id);
    if (!next) return;
    live.current?.stop(); live.current = null; setLiveTarget(null);
    const kind = defaultKind(next);
    setSelected(id); setPanel(true); setOpen(next.group);
    setView((v) => ({ ...v, kind, frame: firstFrame(next, kind), playing: next.frames.filter((f) => f.kind === kind).length > 1, flagged: false }));
    // In the galaxy, a field that is not one of the dots still needs a place: its measured or estimated distance.
    const MEASURED: Record<string, number> = { barnard: 1.83, "J085510.83-071442.5": 2.28, "2MASSI_J0415195-093506": 5.7 };
    const parsecs = MEASURED[next.id] ?? photometricDistance(next.dwarf?.type, next.dwarf?.W2)?.[1] ?? 20;
    sky.current?.aimAt(next.ra, next.dec, parsecs);
    sky.current?.flyTo(next.geometry?.centerRaDeg ?? next.ra, next.geometry?.centerDecDeg ?? next.dec, next.id === "barnard" ? 0.45 : TELESCOPE_FOV);
  }, [catalog]);

  const goLive = useCallback((input: LiveInput) => {
    live.current?.stop();
    autoKind.current = true;
    setSelected(input.id); setPanel(true); setLiveTarget(null);
    setView((v) => ({ ...v, kind: "colour", frame: 0, playing: false, flagged: false }));
    sky.current?.flyTo(input.ra, input.dec, TELESCOPE_FOV);
    live.current = startLive(input, (t) => setLiveTarget(t));
  }, []);
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
      if (what.kind === "dwarf") {
        const target = catalog?.targets.find((t) => Math.hypot((t.ra - what.ra) * Math.cos(what.dec * Math.PI / 180), t.dec - what.dec) < 0.004);
        return setHovered({ name: what.name, ra: what.ra, dec: what.dec, x, y, target, line: `SPHEREx type ${what.type} · ${Math.round(what.distance * 3.26)} light-years${what.measured ? "" : " (estimated)"}` });
      }
      const target = catalog?.targets.find((t) => t.id === what.id), q = queue.find((v) => v.id === what.id);
      if (target) setHovered({ name: target.name, ra: target.ra, dec: target.dec, x, y, target, line: "Candidate · no publication found" });
      else if (q) setHovered({ name: q.name, ra: q.ra, dec: q.dec, x, y, line: `Unchecked · red in WISE, motion ${q.pmTotal.toFixed(2)}″ a year at ${q.pmSigma.toFixed(1)}σ` });
    };
  }, [catalog, queue]);
  useEffect(() => { if (level !== "galaxy" || screen !== "sky") setHovered(null); }, [level, screen]);
  // A published SPHEREx dwarf clicked in the galaxy: fly to it and rebuild its image and spectrum from the archive.
  useEffect(() => {
    if (!sky.current) return;
    sky.current.onDwarf = (dwarf) => {
      const known = catalog?.targets.find((t) => Math.hypot((t.ra - dwarf.ra) * Math.cos(dwarf.dec * Math.PI / 180), t.dec - dwarf.dec) < 0.004);
      if (known) return choose(known.id);
      sky.current!.destination = dwarf.position;
      goLive({ id: `spx-${dwarf.index}`, name: dwarf.name, ra: dwarf.ra, dec: dwarf.dec, group: "position", knownType: dwarf.type,
        blurb: `SPHEREx type ${dwarf.type}, about ${Math.round(dwarf.distance * 3.26)} light-years away (${dwarf.measured ? "measured parallax" : "distance estimated from type and brightness"}). Its SPHEREx type is published: here its image and spectrum are rebuilt from the archive.`,
        published: `In the published SPHEREx table of ultracool dwarfs (Gagné et al. 2026), group “${dwarf.group}”` });
    };
  }, [catalog, choose, goLive]);
  // Home: the sky drifts, wide. Entering it flies to the first field.
  useEffect(() => { sky.current?.setHome(screen === "home"); }, [screen]);
  const enter = useCallback((then?: () => void) => { setScreen("sky"); setPresenting(false); then?.(); }, []);
  // Opening the tool straight on the sky (?sky) starts on the first field; from the landing page it starts in the neighbourhood.
  useEffect(() => { if (catalog && !selected && screen === "sky" && params.has("sky")) choose("J085510.83-071442.5"); }, [catalog, selected, screen, choose, params]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "p" && !presenting && (e.target as HTMLElement | null)?.tagName !== "INPUT" && !e.metaKey && !e.ctrlKey) setPresenting(true); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [presenting]);

  // While a live field builds up, show the colour frames as soon as they exist and keep the frame index valid.
  useEffect(() => {
    if (!target) return;
    setView((v) => {
      const has = (k: "date" | "colour") => target.frames.some((f) => f.kind === k);
      let kind = v.kind;
      // A live field opens on its two colours as soon as both exist, and starts blinking.
      const both = target.frames.filter((f) => f.kind === "colour").length > 1;
      if (target.live && autoKind.current && both) { autoKind.current = false; return { ...v, kind: "colour", frame: firstFrame(target, "colour"), playing: true }; }
      if (!has(kind)) kind = has("colour") && !target.live ? "colour" : has("date") ? "date" : "colour";
      const frame = target.frames[v.frame]?.kind === kind ? v.frame : firstFrame(target, kind);
      return kind === v.kind && frame === v.frame ? v : { ...v, kind, frame };
    });
  }, [target]);
  useEffect(() => {
    if (!view.playing || !target) return;
    const frames = target.frames.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === view.kind).map(({ i }) => i);
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
    s.setFrame({ ra: g.centerRaDeg, dec: g.centerDecDeg, sizeArcsec: g.width * g.gridPixelArcsec, image: view.flagged && frame.flagged ? frame.flagged : frame.image,
      label: `${shortName(target.name)} · SPHEREx ${frame.kind === "date" ? frame.label : frame.label.split(" · ")[0]}${frame.images > 1 ? ` · ${frame.images} exposures` : ""}` });
  }, [target?.id, target?.geometry?.centerRaDeg, frame?.image, frame?.flagged, view.flagged, frame?.label, frame?.images]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sky.current?.setFrameOpacity(view.opacity); }, [view.opacity]);
  useEffect(() => {
    const s = sky.current;
    if (!s) return;
    let look: PortraitLook | null = null, caption = "";
    const d = target?.dwarf, type = d?.type ?? d?.knownType, hasDip = Boolean(d && d.dip !== "none" && d.snr >= 5);
    const head = (note: string) => `<b>3D view</b><em>${note}</em>`;
    if (target?.id === "barnard") { look = { kind: "star", temperature: 3200, methane: 0, brightness: 1, seed: 3 }; caption = head("Illustration · not an image") + "<span>Red dwarf star, about 3,200 K</span>"; }
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
  }, [target?.id, target?.dwarf?.dip, target?.dwarf?.R, target?.dwarf?.type, target?.dwarf?.knownType, target?.dwarf?.snr, target?.group, target?.live?.finished, frame?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const measure = () => sky.current?.setInsets({ left: (leftRef.current?.offsetWidth ?? 0) + 28, right: panel && target && window.innerWidth > 900 ? Math.min(400, window.innerWidth - 48) + 28 : 0 });
    measure(); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure);
  }, [panel, target]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const byName = catalog?.targets.find((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()) && query.trim().length > 3);
    if (byName) return choose(byName.id);
    const p = parsePosition(query);
    if (p) lookAt(p[0], p[1]); else setError("Type a position such as “133.795 -7.245” or “08h55m10.8s -07°14′42″”.");
  };
  const checked = queue.filter((q) => votes[q.id]).length;
  const found = Object.entries(votes).filter(([, v]) => v.vote === "fades").length;

  return (
    <div className="app" data-screen={screen} data-level={level} data-presenting={presenting || undefined}>
      <div className="sky" ref={host} />
      <aside className="left glass" ref={leftRef} aria-label="Blinking Sky">
        <header>
          <p className="eyebrow">NASA SPHEREx · real images</p>
          <h1>Blinking <GradientText colors={["#a5f3fc", "#e0f7ff", "#7dd3fc", "#a5f3fc"]} animationSpeed={8} className="brand-accent">Sky</GradientText></h1>
          <p className="lead">The infrared sky, seen again every six months in 102 colours. Blink two dates to see what moves. Blink two colours to see what it is made of.</p>
        </header>
        <button type="button" className="primary" onClick={nextUnchecked} disabled={!queue.length}><Shuffle size={14} /> Show me one nobody has checked</button>
        <p className="count">{queue.length ? <><CountUp key={queue.length - checked} to={queue.length - checked} from={Math.max(0, queue.length - checked - 40)} duration={0.9} /> unchecked sources · you have looked at {checked}{found ? <> · <b>{found} marked as fading</b></> : null}</> : "Loading the review queue…"}</p>
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
              {isOpen && <><p className="hint">{g.hint}</p><div className="pills">{list.map((t) => <button key={t.id} type="button" className={g.id === "unpublished" ? "amber" : ""} aria-pressed={selected === t.id} title={t.name} onClick={() => choose(t.id)}>{shortName(t.name)}</button>)}</div></>}
            </div>;
          })}
        </nav>}
        <div className="row">
          <button type="button" onClick={() => { if (target) { setPanel(true); sky.current?.flyTo(target.geometry?.centerRaDeg ?? target.ra, target.geometry?.centerDecDeg ?? target.dec, target.id === "barnard" ? 0.45 : TELESCOPE_FOV, 1.4); } }}>Telescope view</button>
          <button type="button" onClick={() => sky.current?.wide()}>Wide sky</button>
        </div>
        <div className="left-links"><button type="button" onClick={() => setScreen("home")}>← Home</button><button type="button" onClick={() => setPresenting(true)}>Presentation · P</button></div>
        <p className="fine">In the galaxy: drag to turn, scroll to zoom, click a dot to fly to it. At the telescope: real SPHEREx exposures, read from NASA&apos;s archive. The galaxy&apos;s shape is a model; distances marked estimated or assumed are not measurements. Data: NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA · Gagné et al. 2026 · Gaia DR3 · CatWISE2020. Nothing you do here is sent anywhere.</p>
      </aside>
      <p className="where">{where}</p>
      {screen === "sky" && <nav className="levels glass" aria-label="Scale">
        <button type="button" onClick={() => setScreen("home")}>Home</button>
        <button type="button" aria-pressed={level === "galaxy"} onClick={() => sky.current?.goLevel("galaxy")}>Galaxy view</button>
        <button type="button" aria-pressed={level === "sky"} onClick={() => sky.current?.goLevel("sky")}>Sky view</button>
      </nav>}
      {screen === "sky" && level === "galaxy" && !(target && panel) && <aside className="legend glass" aria-label="Legend">
        <p className="legend-title">What the dots are</p>
        <ul>
          <li><i className="lg small" style={{ background: "linear-gradient(90deg, #ffa866, #ff5c47, #eb5ca8, #9e73ff)" }} /><span><b>Small coloured dots</b> · dwarfs already typed by SPHEREx{published ? ` (${published.count.toLocaleString("en-GB")})` : ""}: M orange, L red, T magenta, Y violet</span></li>
          <li><i className="lg ring amber" /><span><b>Yellow, filled</b> · our 12 candidates with no publication found</span></li>
          <li><i className="lg hollow" /><span><b>Yellow, hollow</b> · {queue.length || 382} sources nobody has checked</span></li>
          <li><i className="lg line" /><span><b>Line</b> · its distance is estimated: the candidate is somewhere along it</span></li>
        </ul>
        <p className="legend-foot">The galaxy&apos;s shape is a model. Hollow dots sit where they would be <b>if</b> they are cold dwarfs. Rest the pointer on a dot for a first look; click to fly there.</p>
      </aside>}
      {hovered && screen === "sky" && level === "galaxy" && !presenting && <HoverCard key={`${hovered.ra},${hovered.dec}`} hovered={hovered} />}
      {screen === "home" && <Landing queueSize={queue.length} images="1.6 million" onEnter={() => enter()} onUnchecked={() => enter(nextUnchecked)} onPresent={() => setPresenting(true)} />}
      {presenting && <Slides catalog={catalog} queueSize={queue.length} onClose={() => setPresenting(false)} onLaunch={() => enter()} />}
      {target && catalog && panel && <Panel target={target} catalog={catalog} view={view} ready={target.frames.length > 0} error="" vote={votes[target.id]?.vote}
        onView={(next) => { if (next.kind) autoKind.current = false; setView((v) => ({ ...v, ...next })); }} onClose={() => setPanel(false)}
        onRecenter={() => sky.current?.flyTo(target.geometry?.centerRaDeg ?? target.ra, target.geometry?.centerDecDeg ?? target.dec, target.id === "barnard" ? 0.45 : TELESCOPE_FOV, 1.2)} onRetry={() => {}}
        onVote={(vote: Vote) => setVotes(writeVote(target, vote))} onMore={live.current ? () => live.current?.more() : undefined} onNext={target.group === "queue" ? nextUnchecked : undefined} />}
    </div>
  );
}
