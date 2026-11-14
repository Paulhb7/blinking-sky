import { useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, Printer, ScanLine, X } from "lucide-react";
import { VOTES, dayLabel, expectedShift, mjdLabel, sexagesimal, type SpxCatalog, type SpxFrame, type SpxTarget, type Vote } from "./data";
import DecryptedText from "./reactbits/DecryptedText";
import "./panel.css";

export type SpherexView = { kind: "date" | "colour"; frame: number; playing: boolean; flagged: boolean; opacity: number; pixelBox: boolean };

const CHIP: Record<string, [string, string]> = {
  start: ["Known object", "known"], unpublished: ["Candidate · not confirmed", "cand"], blind: ["Blind test · already typed", "known"],
  published: ["Candidate · published without a spectrum", "cand"], rejected: ["Rejected · false dip", "off"],
  queue: ["Unchecked source", "cand"], position: ["Your position", "known"],
};
const monthLabel = (mjd: number) => new Date((mjd - 40587) * 86400000).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (v: number | null | undefined, n = 2) => v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(n);
const frameCaption = (f: SpxFrame) => f.kind === "date"
  ? `${f.images === 1 ? "Single exposure" : `${f.images} exposures averaged`}${f.dateRange ? ` · ${dayLabel(f.dateRange[0])} to ${dayLabel(f.dateRange[1])}` : ""}${f.band ? ` · ${f.band[0]}–${f.band[1]} µm` : ""}`
  : `${f.images} exposures averaged · all dates · ${f.band ? `${f.band[0]}–${f.band[1]} µm` : ""}`;

/** Per-image photometry binned on the template grid, with the fitted template and the two bands of the methane index. */
export function Spectrum({ target, method, height = 190 }: { target: SpxTarget; method: SpxCatalog["method"]; height?: number }) {
  const d = target.dwarf;
  if (!d) return null;
  const W = 420, H = height, L = 40, R = 8, T = 10, B = 26;
  const points = d.spectrum.filter(([w]) => w >= 0.95);
  const top = Math.max(...points.map(([, f, e]) => f + Math.min(e, f > 0 ? f : e)), ...(d.template ?? []).map(([, v]) => v), 1) * 1.08;
  const low = Math.min(0, ...points.map(([, f]) => f)) * 1.1;
  const x = (w: number) => L + (Math.log(w) - Math.log(0.95)) / (Math.log(5.05) - Math.log(0.95)) * (W - L - R);
  const y = (v: number) => T + (top - v) / (top - low) * (H - T - B);
  const band = (key: string, cls: string, label: string) => {
    const [a, b] = method.bands[key];
    return <g key={key}><rect className={cls} x={x(a)} y={T} width={x(b) - x(a)} height={H - T - B} /><text className="spx-axis" x={(x(a) + x(b)) / 2} y={T + 10} textAnchor="middle">{label}</text></g>;
  };
  const ticks = [1, 1.5, 2, 3, 4, 5];
  const step = top > 800 ? 500 : top > 300 ? 100 : top > 120 ? 50 : 20;
  const yTicks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  return (
    <svg className="spx-spectrum" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Measured SPHEREx spectrum of ${target.name}${d.type ? `, with the fitted ${d.type} template` : ""}`}>
      {band("CH4", "spx-band ch4", "CH₄")}
      {band("PEAK", "spx-band peak", "peak")}
      {yTicks.map((v) => <g key={v}><line className="spx-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text className="spx-axis" x={L - 5} y={y(v) + 3} textAnchor="end">{v}</text></g>)}
      {ticks.map((w) => <text key={w} className="spx-axis" x={x(w)} y={H - 10} textAnchor="middle">{w}</text>)}
      <text className="spx-axis" x={W - R} y={H - 1} textAnchor="end">wavelength, µm</text>
      <text className="spx-axis" x={L - 34} y={T + 2} textAnchor="start">µJy</text>
      {d.template && <polyline className="spx-template" points={d.template.filter(([w]) => w >= 0.95).map(([w, v]) => `${x(w).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />}
      {points.map(([w, f, e]) => <g key={w}>
        <line className="spx-err" x1={x(w)} x2={x(w)} y1={y(Math.min(top, f + e))} y2={y(Math.max(low, f - e))} />
        <circle className="spx-pt" cx={x(w)} cy={y(Math.max(low, Math.min(top, f)))} r="1.9" />
      </g>)}
    </svg>
  );
}

/** The methane index against its threshold: low means the source is dark in the methane band. */
export function MethaneGauge({ target, method }: { target: SpxTarget; method: SpxCatalog["method"] }) {
  const d = target.dwarf;
  if (!d) return null;
  const max = 1.2, pos = (v: number) => `${Math.max(0, Math.min(1, v / max)) * 100}%`;
  return (
    <div className="spx-gauge" role="img" aria-label={`Methane index ${fmt(d.R)} plus or minus ${fmt(d.eR)}; threshold ${method.threshold}`}>
      <div className="spx-gauge-bar">
        <i className="spx-gauge-zone" style={{ width: pos(method.threshold) }} />
        <i className="spx-gauge-err" style={{ left: pos(d.R - d.eR), width: `calc(${pos(d.R + d.eR)} - ${pos(d.R - d.eR)})` }} />
        <i className="spx-gauge-dot" style={{ left: pos(d.R) }} />
        <i className="spx-gauge-line" style={{ left: pos(method.threshold) }} />
        <i className="spx-gauge-line star" style={{ left: pos(1) }} />
      </div>
      <div className="spx-gauge-labels"><span style={{ left: pos(0) }}>0</span><span style={{ left: pos(method.threshold) }}>{method.threshold} threshold</span><span style={{ left: pos(1) }}>1 · no dip</span></div>
    </div>
  );
}

function Sheet({ target, catalog, onClose }: { target: SpxTarget; catalog: SpxCatalog; onClose: () => void }) {
  const d = target.dwarf;
  if (!d) return null;
  const shift = expectedShift(target);
  const candidate = ["unpublished", "published", "queue", "position"].includes(target.group);
  const facts: [string, string][] = [
    ["Position (2025.9)", `${sexagesimal(target.ra, target.dec)} · ${target.ra.toFixed(5)}° ${target.dec.toFixed(5)}°`],
    ["SPHEREx data", `${d.images} exposures, ${mjdLabel(d.dates[0])} to ${mjdLabel(d.dates[1])}`],
    ["Signal-to-noise, 3.83–5.0 µm", fmt(d.snr, 1)],
    ["Methane index", `${fmt(d.R)} ± ${fmt(d.eR)} (${d.dip === "firm" ? "dip" : d.dip === "likely" ? "likely dip" : "no dip"}; threshold ${catalog.method.threshold})`],
    ["Fitted type", d.type ? `${d.type} ± ${fmt(d.typeUnc, 0)} (reduced χ² ${fmt(d.chi2, 1)})` : "—"],
    ["Catalogued motion", target.motion ? `${fmt(target.motion.total)}″ per year (${target.motion.source})${shift ? `; ${fmt(shift.arcsec, 1)}″ over the SPHEREx dates` : ""}` : "—"],
    ["WISE magnitudes", `W1 ${fmt(d.W1)} · W2 ${fmt(d.W2)}`],
  ];
  return (
    <div className="spx-sheet-wrap" role="dialog" aria-label={`${candidate ? "Candidate" : "Validation"} sheet for ${target.name}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="spx-sheet-bar">
        <button type="button" onClick={() => window.print()}><Printer size={13} /> Print or save as PDF</button>
        <button type="button" onClick={onClose}><X size={13} /> Close</button>
      </div>
      <article className="spx-sheet">
        <header>
          <div><p className="spx-eyebrow">{candidate ? "Candidate sheet" : target.group === "rejected" ? "Rejected source" : "Validation sheet"}</p><h2>{target.name}</h2></div>
          <div className="spx-sheet-status"><span className={`spx-chip ${CHIP[target.group][1]}`}>{CHIP[target.group][0]}</span><span>Generated {new Date().toISOString().slice(0, 10)}</span></div>
        </header>
        <p className="spx-sheet-lead">{d.published}.{d.decision ? ` ${d.decision}.` : ""}</p>
        {target.frames.length > 0 && <section><h3>SPHEREx images</h3>
          <div className="spx-sheet-figs">{target.frames.map((f) => <figure key={f.id}>
            <img src={f.image} alt={`${target.name}, ${f.label}`} /><figcaption><b>{f.label}</b>{frameCaption(f)}</figcaption></figure>)}</div>
          <p className="spx-small">North up, east left, {target.geometry ? Math.round(target.geometry.width * target.geometry.gridPixelArcsec) : ""}″ across. Same stretch for every frame. Date frames use a fixed sky grid.</p>
        </section>}
        <section><h3>Spectrum</h3><Spectrum target={target} method={catalog.method} height={210} /><p className="spx-small">Points: SPHEREx photometry binned from the single exposures, 1σ bars. Line: best-fitting template. Shaded: the two bands of the methane index.</p></section>
        <section><h3>Measurements</h3><dl className="spx-sheet-dl">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
        {d.deep && <section><h3>Deeper images and colours</h3>
          <div className="spx-sheet-figs">{[[d.deep.optical, "Legacy Surveys DR10, 67″ across"], [d.deep.wise, "unWISE W1/W2, 128″ across"]].filter(([src]) => src).map(([src, cap]) => <figure key={src}>
            <img src={src} alt={`${target.name}, ${cap}`} /><figcaption>{cap}</figcaption></figure>)}</div>
          <p>{d.deep.note}</p>
          <p className="spx-small">z {fmt(d.deep.z)} (AB) · J {fmt(d.deep.J)} (Vega) · z−J {fmt(d.deep.zJ)} · J−W2 {fmt(d.deep.JW2)}{d.deep.pmOptical ? ` · independent optical motion (${d.deep.pmOptical[0]}, ${d.deep.pmOptical[1]}) ± ${d.deep.pmOptical[2]} mas/yr against CatWISE (${d.deep.pmCatwise[0]}, ${d.deep.pmCatwise[1]})` : ""}</p>
        </section>}
        <section><h3>Before any claim</h3><ol>
          <li>Search the full-text literature (NASA ADS) and ask the citizen-science lists: “no publication found” is not “unknown”.</li>
          <li>Obtain a classical spectrum; the type here comes from stacked low-resolution photometry.</li>
          <li>Re-measure the motion on an independent survey.</li>
        </ol></section>
        <footer><p>{catalog.credit}</p><p>{catalog.status} Generated in Project Atlas; nothing was sent anywhere.</p></footer>
      </article>
    </div>
  );
}

type Props = {
  target: SpxTarget; catalog: SpxCatalog; view: SpherexView; ready: boolean; error: string; vote?: Vote;
  onView: (next: Partial<SpherexView>) => void; onClose: () => void; onRecenter: () => void; onRetry: () => void;
  onVote: (vote: Vote) => void; onMore?: () => void; onNext?: () => void;
};

export default function SpherexPanel({ target, catalog, view, ready, error, vote, onView, onClose, onRecenter, onRetry, onVote, onMore, onNext }: Props) {
  const [sheet, setSheet] = useState(false);
  const d = target.dwarf;
  const kinds = (["date", "colour"] as const).filter((k) => target.frames.some((f) => f.kind === k));
  const frames = target.frames.map((f, index) => ({ f, index })).filter(({ f }) => f.kind === view.kind);
  const current = target.frames[view.frame];
  const shift = expectedShift(target);
  const [chip, chipClass] = target.id.startsWith("spx-") ? ["Published SPHEREx dwarf", "known"] : CHIP[target.group];
  return (
    <aside className="spx-panel" aria-label={`SPHEREx observations of ${target.name}`}>
      <header className="spx-head">
        <div>
          <span className={`spx-chip ${chipClass}`}>{chip}</span>
          <h2><DecryptedText key={target.id} text={target.name} animateOn="view" sequential speed={28} /></h2>
          <p className="spx-mono">{sexagesimal(target.ra, target.dec)}</p>
        </div>
        <button type="button" className="spx-icon" onClick={onClose} aria-label="Close the SPHEREx panel"><X size={14} /></button>
      </header>
      <p className="spx-blurb">{target.blurb}</p>
      {target.live && <section className="spx-card spx-live" aria-live="polite">
        {target.live.error ? <p role="alert">{target.live.error}.</p> : <>
          <div className="spx-progress"><i style={{ width: `${target.live.total ? Math.round(target.live.done / target.live.total * 100) : 3}%` }} /></div>
          <p className="spx-caption">{target.live.finished ? `${target.live.done} exposures read from NASA's archive · ${target.live.megabytes.toFixed(0)} MB` : target.live.total ? `Reading exposure ${target.live.done} of ${target.live.total} from NASA's archive · ${target.live.megabytes.toFixed(0)} MB` : "Looking up the SPHEREx exposures that cover this position…"}</p>
          {target.live.finished && onMore && d && !d.spectrum.some(([w]) => w < 2.3) && <button type="button" className="spx-btn" onClick={onMore}>Complete the spectrum (0.75–2.4 µm)</button>}
        </>}
      </section>}

      {target.frames.length > 0 ? <section className="spx-card">
        <div className="spx-tabs" role="tablist" aria-label="What changes between frames">
          {kinds.map((k) => <button key={k} type="button" role="tab" aria-selected={view.kind === k} onClick={() => onView({ kind: k, frame: target.frames.findIndex((f) => f.kind === k), playing: false })}>{k === "date" ? "Across dates" : "Across colours"}</button>)}
        </div>
        <p className="spx-hint">{view.kind === "date" ? "Same colour, different dates, fixed sky grid: what changes moved or varied." : "Same sky, two colours, all dates averaged. The view follows the target. A methane dwarf fades in the methane band; ordinary stars stay."}</p>
        <div className="spx-frames">
          {frames.map(({ f, index }) => (
            <button key={f.id} type="button" aria-pressed={view.frame === index} onClick={() => onView({ frame: index, playing: false })}>
              <img src={f.image} alt="" /><span>{f.label}</span>
            </button>
          ))}
        </div>
        <div className="spx-row">
          <button type="button" className="spx-play" disabled={frames.length < 2 || !ready} onClick={() => onView({ playing: !view.playing })} aria-label={view.playing ? "Pause the blink" : "Blink the frames"}>{view.playing ? <Pause size={14} /> : <Play size={14} />}</button>
          <p className="spx-caption">{error ? <span role="alert">Images unavailable. <button type="button" className="spx-link" onClick={onRetry}>Retry</button></span> : !ready ? "Loading observations…" : current ? frameCaption(current) : ""}</p>
        </div>
        {view.kind === "date" && shift && target.motion && <p className="spx-note">Catalogued motion {fmt(target.motion.total)}″ per year ({target.motion.source}): {fmt(shift.arcsec, 1)}″ between the first and last date, {fmt(shift.pixels, 1)} SPHEREx pixel{shift.pixels >= 1.5 ? "s" : ""}.{shift.pixels < 0.4 ? " Too small to see by eye here: the methane band is what gives this one away." : ""}</p>}
        <div className="spx-row wrap">
          <button type="button" className="spx-btn" onClick={onRecenter}>Recenter</button>
          <label className="spx-tog"><input type="checkbox" checked={view.pixelBox} onChange={(e) => onView({ pixelBox: e.target.checked })} /> 1 SPHEREx pixel</label>
          {target.frames.some((f) => f.flagged) && <label className="spx-tog"><input type="checkbox" checked={view.flagged} onChange={(e) => onView({ flagged: e.target.checked })} /><ScanLine size={12} /> Flagged pixels</label>}
          <label className="spx-tog grow">Opacity<input aria-label="SPHEREx image opacity" type="range" min="0" max="1" step="0.05" value={view.opacity} onChange={(e) => onView({ opacity: Number(e.target.value) })} /></label>
        </div>
        <p className="spx-small">{target.stacked ? "Real SPHEREx exposures, averaged. Missing pixels are black. The dashed square is one native 6.15″ pixel." : "Real single exposures. Black core: saturated or missing data."}</p>
      </section> : <section className="spx-card"><p className="spx-hint">{target.live ? "The image builds up as the exposures arrive: a faint source needs a few dozen before it shows." : "No image stack has been built for this field yet: the marker on the sky shows where it is, and the spectrum below is measured on the single exposures."}</p><button type="button" className="spx-btn" onClick={onRecenter}>Recenter</button></section>}

      {(target.group === "queue" || target.group === "position") && target.frames.length > 0 && <section className="spx-card spx-vote">
        <h3>What do you see?</h3>
        <p className="spx-hint">Blink the two colours, then say what the source at the centre does. Your answer stays in this browser.</p>
        <div className="spx-votes">{VOTES.map((v) => <button key={v.id} type="button" aria-pressed={vote === v.id} title={v.hint} onClick={() => onVote(v.id)}>{v.label}</button>)}</div>
        {vote === "fades" && d && d.dip !== "none" && d.snr >= 5 && <p className="spx-found"><b>{target.group === "queue" ? "You may be the first person to see this." : "The measurement agrees with you."}</b> Quick-look methane index {fmt(d.R)} ± {fmt(d.eR)}. It is a candidate, not a confirmation{target.group === "queue" ? "" : ", and a free position may already be known"}: open its sheet for what to check next.</p>}
        {vote === "fades" && d && (d.dip === "none" || !(d.snr >= 5)) && <p className="spx-note">The quick look does not see a methane dip here{d.snr >= 5 ? ` (index ${fmt(d.R)} ± ${fmt(d.eR)})` : ": the source is too faint to measure"}. Your eye may still be right: it stays in your list.</p>}
        {vote && onNext && <button type="button" className="spx-btn primary" onClick={onNext}>Next unchecked source →</button>}
      </section>}

      {d && <section className="spx-card">
        <h3>What is it made of?</h3>
        <p className="spx-hint">Cold brown dwarfs are bright near 4 µm and almost black at 3.3 µm, where methane absorbs. The index compares the two.</p>
        <MethaneGauge target={target} method={catalog.method} />
        <p className="spx-verdict">{!Number.isFinite(d.R) ? <>{target.live && !target.live.finished ? "Measuring…" : "Too faint to measure the index here."}</> : <><b>{fmt(d.R)} ± {fmt(d.eR)}</b> · {d.dip === "firm" ? "methane dip" : d.dip === "likely" ? "likely methane dip" : "no dip"}{d.quick ? " · quick look" : ""}</>}{d.type ? <> · fits a <b>{d.type} ± {fmt(d.typeUnc, 0)}</b> template{d.knownType ? ` (published type ${d.knownType})` : ""}</> : null}</p>
        <Spectrum target={target} method={catalog.method} />
        <p className="spx-small">Points: measured on {d.images} single exposures, binned, 1σ bars.{d.template ? " Line: best-fitting template (Gagné et al. 2026)." : ""}{d.quick ? " Quick-look photometry made in this browser; a PSF-fitted analysis is the reference." : ""}</p>
        <dl className="spx-facts">
          <div><dt>W2</dt><dd>{fmt(d.W2)}</dd></div><div><dt>Signal / noise</dt><dd>{fmt(d.snr, 1)}</dd></div>
          <div><dt>Motion</dt><dd>{target.motion ? `${fmt(target.motion.total)}″/yr` : "—"}</dd></div><div><dt>Dates</dt><dd>{monthLabel(d.dates[0])} – {monthLabel(d.dates[1])}</dd></div>
        </dl>
      </section>}

      {d && <section className="spx-card">
        <h3>Known or new?</h3>
        <p className={`spx-status ${target.group}`}>{d.published}.</p>
        {d.decision && <p className="spx-note">{d.decision}.</p>}
        {d.deep && <>
          <div className="spx-deep">{[[d.deep.optical, "Optical, 0.26″ pixels"], [d.deep.wise, "WISE, 2010–2021"]].filter(([src]) => src).map(([src, cap]) => <figure key={src}>
            <img src={src} alt={`${target.name}: ${cap}`} /><figcaption>{cap}</figcaption></figure>)}</div>
          <p className="spx-note">{d.deep.note}</p>
          <p className="spx-small">Legacy Surveys DR10 and unWISE cutouts, north up, centred on the 2015 position.{d.deep.zJ !== null ? ` z−J ${fmt(d.deep.zJ)}, J−W2 ${fmt(d.deep.JW2)}.` : ""}</p>
        </>}
        {target.group === "unpublished" && <p className="spx-small">Searched: SIMBAD, VizieR, published brown-dwarf lists and SPHEREx tables. Not searched: full-text literature. “No publication found” is not “unknown”.</p>}
        <div className="spx-row wrap">
          <button type="button" className="spx-btn primary" onClick={() => setSheet(true)}>{["unpublished", "published", "queue", "position"].includes(target.group) ? "Candidate sheet" : "Validation sheet"}</button>
          <a className="spx-btn" target="_blank" rel="noreferrer" href={`https://simbad.cds.unistra.fr/simbad/sim-coo?Coord=${target.ra.toFixed(5)}+${target.dec.toFixed(5)}&Radius=20&Radius.unit=arcsec`}>SIMBAD ↗</a>
          <a className="spx-btn" target="_blank" rel="noreferrer" href={`https://www.legacysurvey.org/viewer?ra=${target.ra.toFixed(5)}&dec=${target.dec.toFixed(5)}&layer=ls-dr10&zoom=15`}>Deep image ↗</a>
        </div>
      </section>}

      <details className="spx-card spx-details">
        <summary>Data & limitations</summary>
        <p>{catalog.credit}</p>
        {target.processing && <ul>{target.processing.map((p) => <li key={p}>{p}</li>)}</ul>}
        {target.display && <p>{target.display}.</p>}
        {d && <><p>{catalog.status}</p><ul>{catalog.method.limits.map((l) => <li key={l}>{l}</li>)}</ul></>}
        {target.source && <a href={target.source} target="_blank" rel="noreferrer" className="spx-link">Measurements & processing ↗</a>}
      </details>
      {/* Outside the panel: its backdrop filter would clip a fixed overlay. */}
      {sheet && createPortal(<Sheet target={target} catalog={catalog} onClose={() => setSheet(false)} />, document.body)}
    </aside>
  );
}
