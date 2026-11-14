import { useEffect, useState } from "react";
import { ArrowRight, Play, RotateCcw, X } from "lucide-react";
import CountUp from "./reactbits/CountUp";

/** The path from what is known to what you can find, told on the map in four steps. */
type Props = { step: number; published: number; suspects: number; candidates: number; onStep: (step: number) => void; onClose: () => void; onHunt: () => void; /** shows or hides the suspects on the map */ onSuspects: (shown: boolean) => void };

// The selection as it was run on the WISE catalog (build_queue.py): what each cut kept.
const CUTS: { log: string; kept: number; label: string }[] = [
  { log: "read CatWISE2020 · keep W1−W2 > 2.0, W2 S/N > 10", kept: 282058, label: "very red sources in the WISE catalog" },
  { log: "drop flagged sources and the Milky Way's plane (|b| < 15°)", kept: 37243, label: "clean, away from the plane" },
  { log: "keep a hint of motion: ≥ 0.10″ a year at 3.5σ or more, W2 < 15.5", kept: 1456, label: "with a hint of motion" },
  { log: "remove known dwarfs, published candidates and clumps of false detections", kept: 0, label: "in no known list: nobody has looked" },
];

/** Replays the selection of the suspects: the cuts scroll by, the counts fall, then the dots appear on the map. Nothing is computed now. */
function Selection({ suspects, onSuspects }: { suspects: number; onSuspects: (shown: boolean) => void }) {
  const [stage, setStage] = useState(0);   // 0: not started; 1–4: cuts shown so far
  useEffect(() => {
    if (stage === 0 || stage >= CUTS.length) return;
    const timer = window.setTimeout(() => setStage((s) => s + 1), 1150);
    return () => window.clearTimeout(timer);
  }, [stage]);
  useEffect(() => { onSuspects(stage >= CUTS.length); }, [stage, onSuspects]);
  const start = () => { onSuspects(false); setStage(1); };
  return (
    <div className="guide-run">
      {stage === 0 ? <button type="button" className="guide-launch" onClick={start}><Play size={13} /> Run the selection</button>
        : <button type="button" className="guide-launch again" onClick={start} disabled={stage < CUTS.length}><RotateCcw size={12} /> Replay</button>}
      <span className="guide-run-note">A replay of the script that picked the suspects on 14 Nov 2026. Nothing is computed now.</span>
      {stage > 0 && <ol className="guide-log">{CUTS.slice(0, stage).map((c, i) => <li key={c.log}><code>{c.log}</code><b><CountUp key={i} to={c.kept || suspects} from={i ? (CUTS[i - 1].kept) : 0} duration={0.9} separator="," /></b></li>)}</ol>}
      <div className="guide-funnel" aria-label="How the suspects were selected">
        {CUTS.map((c, i) => <div key={c.label} className={stage > i ? "on" : ""}><b>{stage > i ? (c.kept || suspects).toLocaleString("en-GB") : "—"}</b><span>{c.label}</span></div>)}
      </div>
    </div>
  );
}

export default function Guide({ step, published, suspects, candidates, onStep, onClose, onHunt, onSuspects }: Props) {
  const n = (v: number) => v.toLocaleString("en-GB");
  const steps = [
    { kicker: "1 · What is known", title: "Every dot is a world SPHEREx has already named", text: `${n(published)} dwarfs around the Sun whose SPHEREx type is published: small stars in orange, brown dwarfs in red and magenta, the coldest in violet. None of them is new.` },
    { kicker: "2 · Crossing the data", title: "SPHEREx says what a thing is, not where to look. The find is in the crossing.", text: "No single catalog has the answer. WISE, ten years older, gives the leads: a cold neighbour of the Sun is very red and shifts a little over the years. The published lists say which leads are already known. SPHEREx then says what the rest are." },
    { kicker: "3 · The test", title: "Methane tells them apart", text: `A cold dwarf is bright at 4 microns and almost black at 3.3, where methane absorbs. A galaxy is not. The same test, run earlier on the suspects with the clearest motion, gave the ${candidates} candidates in solid orange. Click one to replay how it was found.` },
    { kicker: "4 · Your turn", title: "Pick a suspect. Blink it. Say what you see.", text: "Your browser reads the real exposures from NASA's archive and stacks them while you watch. If it fades in methane and the measurement agrees, its dot turns solid on the map: a candidate nobody had seen." },
  ];
  const s = steps[step];
  return (
    <aside className="guide glass" aria-label="How it works" aria-live="polite">
      <button type="button" className="guide-close" onClick={onClose} aria-label="Close the guide"><X size={14} /></button>
      <p className="guide-kicker">{s.kicker}</p>
      <h2>{s.title}</h2>
      <p className="guide-text">{s.text}</p>
      {step === 1 && <div className="guide-cross" aria-label="The three sources that are crossed">
        <span><b>WISE</b>where to look: colour and motion</span><i>×</i><span><b>Published lists</b>what is already known</span><i>×</i><span><b>SPHEREx</b>what it is: 102 colours</span>
      </div>}
      {step === 1 && <Selection suspects={suspects} onSuspects={onSuspects} />}
      <div className="guide-foot">
        <div className="guide-dots">{steps.map((_, i) => <button key={i} type="button" aria-label={`Step ${i + 1}`} aria-current={i === step} onClick={() => onStep(i)} />)}</div>
        {step > 0 && <button type="button" className="guide-back" onClick={() => onStep(step - 1)}>Back</button>}
        {step < steps.length - 1 ? <button type="button" className="guide-next" onClick={() => onStep(step + 1)}>Next <ArrowRight size={14} /></button>
          : <button type="button" className="guide-next" onClick={onHunt}>Show me one nobody has checked <ArrowRight size={14} /></button>}
      </div>
    </aside>
  );
}
