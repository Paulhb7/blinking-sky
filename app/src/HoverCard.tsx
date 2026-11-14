import { useEffect, useState } from "react";
import { quickLook } from "./live";
import type { SpxTarget } from "./data";

export type Hovered = { name: string; ra: number; dec: number; line: string; x: number; y: number; target?: SpxTarget };

/** A quick preview where the pointer rests: stored stacks when the field is prepared, else a first look read from the archive. */
export default function HoverCard({ hovered }: { hovered: Hovered }) {
  const stored = hovered.target?.frames.filter((f) => f.kind === "colour") ?? [];
  const [look, setLook] = useState<{ image: string; exposures: number } | null | "none">(null);
  useEffect(() => {
    if (stored.length) return;
    const abort = new AbortController();
    // Only when the pointer rests: moving across the map must not start a download for every dot.
    const timer = window.setTimeout(() => quickLook(hovered.ra, hovered.dec, abort.signal).then((r) => { if (!abort.signal.aborted) setLook(r ?? "none"); }), 380);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [hovered.ra, hovered.dec, stored.length]);
  const d = hovered.target?.dwarf, left = Math.min(hovered.x + 18, window.innerWidth - 300), top = Math.max(12, Math.min(hovered.y - 40, window.innerHeight - 250));
  return (
    <div className="hover-card glass" style={{ left, top }} role="status">
      <b>{hovered.name}</b>
      <span>{hovered.line}</span>
      {stored.length ? <div className="hover-frames">{stored.map((f) => <figure key={f.id}><img src={f.image} alt="" /><figcaption>{f.label.split(" · ")[0]}</figcaption></figure>)}</div>
        : look === null ? <p className="hover-wait">Reading a few exposures…</p>
        : look === "none" ? <p className="hover-wait">No SPHEREx image here yet.</p>
        : <div className="hover-frames one"><figure><img src={look.image} alt="" /><figcaption>3.8–5 µm · first look, {look.exposures} exposures</figcaption></figure></div>}
      {d && Number.isFinite(d.R) && <span>Methane index {d.R.toFixed(2)} ± {d.eR.toFixed(2)}{d.type ? ` · fits ${d.type}` : ""}</span>}
      <em>Click to fly there</em>
    </div>
  );
}
