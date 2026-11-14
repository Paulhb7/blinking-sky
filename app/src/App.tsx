import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Shuffle } from "lucide-react";
import Landing from "./Landing";
import CountUp from "./reactbits/CountUp";
import GradientText from "./reactbits/GradientText";
import Panel, { type SpherexView } from "./Panel";
import Slides from "./deck/Slides";
import { GROUPS, loadQueue, loadSpherexCatalog, readVotes, sexagesimal, writeVote, type QueueSource, type SpxCatalog, type SpxTarget, type Vote } from "./data";
import { startLive, type LiveInput } from "./live";
import { Sky, TELESCOPE_FOV, type Marker } from "./sky/Sky";
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
  const live = useRef<ReturnType<typeof startLive> | null>(null);
  const autoKind = useRef(true);

  const prepared = useMemo(() => catalog?.targets.find((t) => t.id === selected) ?? null, [catalog, selected]);
  const target = liveTarget && liveTarget.id === selected ? liveTarget : prepared;

  useEffect(() => {
    if (!host.current) return;
    const s = new Sky(host.current); sky.current = s;
    let tick = 0;
    s.onMove = (ra, dec, fov) => { if (++tick % 12 === 0) setWhere(`${sexagesimal(ra, dec)} · field ${fov >= 1 ? fov.toFixed(0) + "°" : fov * 60 >= 1 ? (fov * 60).toFixed(1) + "′" : (fov * 3600).toFixed(0) + "″"}`); };
    fetch(`${BASE}/data/stars.bin`).then((r) => r.arrayBuffer()).then((b) => s.setStars(b)).catch(() => {});
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
  }, [catalog, queue, liveTarget?.id, liveTarget?.group, liveTarget?.ra, liveTarget?.dec]);

  const choose = useCallback((id: string) => {
    const next = catalog?.targets.find((t) => t.id === id);
    if (!next) return;
    live.current?.stop(); live.current = null; setLiveTarget(null);
    const kind = defaultKind(next);
    setSelected(id); setPanel(true); setOpen(next.group);
    setView((v) => ({ ...v, kind, frame: firstFrame(next, kind), playing: next.frames.filter((f) => f.kind === kind).length > 1, flagged: false }));
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
  // Home: the sky drifts, wide. Entering it flies to the first field.
  useEffect(() => { sky.current?.setHome(screen === "home"); }, [screen]);
  const enter = useCallback((then?: () => void) => { setScreen("sky"); setPresenting(false); if (then) then(); else if (!selected) choose("J085510.83-071442.5"); }, [selected, choose]);
  useEffect(() => { if (catalog && !selected && screen === "sky") choose("J085510.83-071442.5"); }, [catalog, selected, screen, choose]);
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
    const d = target?.dwarf;
    if (target?.id === "barnard") { look = { kind: "star", temperature: 3200, methane: 0, brightness: 1, seed: 3 }; caption = "<b>3D view</b><em>Illustration · not an image</em><span>Red dwarf star, about 3,200 K</span>"; }
    else if (target && d && (d.dip !== "none" || target.group === "start") && d.snr >= 5 && target.group !== "rejected") {
      const temperature = temperatureOf(d.type ?? d.knownType), methane = Math.max(0, Math.min(1, 1 - d.R / 0.6));
      // The portrait dims with the object: in the methane band it keeps only the measured fraction of its light.
      const brightness = frame?.id === "ch4" ? Math.max(0.05, Math.min(1, d.R)) : 1;
      look = { kind: "dwarf", temperature, methane, brightness, seed: hashSeed(target.id) };
      caption = `<b>3D view</b><em>Drawn from the measurements · not an image</em><span>${d.type ? `${d.type} template · about ${Math.round(temperature / 50) * 50} K` : "Cold dwarf · type not fitted"} · methane index ${d.R.toFixed(2)}</span>`;
    }
    s.setPortrait(look, caption);
  }, [target?.id, target?.dwarf?.dip, target?.dwarf?.R, target?.dwarf?.type, target?.dwarf?.snr, target?.group, frame?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    <div className="app" data-screen={screen} data-presenting={presenting || undefined}>
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
        <p className="fine">Drag to look around · scroll to zoom · click a circle. Circles: SPHEREx fields. Small dots: red sources nobody has checked. Stars: the real bright stars (HYG, to magnitude 8.5); the Milky Way glow is an illustration. Data: NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA. Nothing you do here is sent anywhere.</p>
      </aside>
      <p className="where">{where}</p>
      {screen === "home" && <Landing queueSize={queue.length} images="1.6 million" onEnter={() => enter()} onUnchecked={() => enter(nextUnchecked)} onPresent={() => setPresenting(true)} />}
      {presenting && <Slides catalog={catalog} queueSize={queue.length} onClose={() => setPresenting(false)} onLaunch={() => enter()} />}
      {target && catalog && panel && <Panel target={target} catalog={catalog} view={view} ready={target.frames.length > 0} error="" vote={votes[target.id]?.vote}
        onView={(next) => { if (next.kind) autoKind.current = false; setView((v) => ({ ...v, ...next })); }} onClose={() => setPanel(false)}
        onRecenter={() => sky.current?.flyTo(target.geometry?.centerRaDeg ?? target.ra, target.geometry?.centerDecDeg ?? target.dec, target.id === "barnard" ? 0.45 : TELESCOPE_FOV, 1.2)} onRetry={() => {}}
        onVote={(vote: Vote) => setVotes(writeVote(target, vote))} onMore={live.current ? () => live.current?.more() : undefined} onNext={target.group === "queue" ? nextUnchecked : undefined} />}
    </div>
  );
}
