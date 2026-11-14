import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./deck.css";

export type DeckSlide = { title: string; sub: string; /** the tool itself is the picture: the slide is a title and a caption over the live interface */ live?: boolean; body: ReactNode | ((nav: { next: () => void; active: boolean }) => ReactNode) };
type DeckProps = { brand: [string, string]; mark: string; slides: DeckSlide[]; onClose: () => void; onLaunch: () => void; onSlide?: (index: number, live: boolean) => void };

export const Kicker = ({ children }: { children: ReactNode }) => <div className="pz-kicker"><i />{children}<i /></div>;
export const SectionTitle = ({ eyebrow, pre, accent, post }: { eyebrow: string; pre?: string; accent: string; post?: string }) => (
  <div className="pz-section-title"><div className="pz-eyebrow">{eyebrow}</div><h2>{pre}<span>{accent}</span>{post}</h2></div>
);

/** A full-screen talk over the live sky: arrows, space or the wheel to move, 1-9 to jump, M for the menu, Esc to leave. */
export function Deck({ brand, mark, slides, onClose, onLaunch, onSlide }: DeckProps) {
  const [slide, setSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const go = useCallback((i: number) => setSlide(Math.max(0, Math.min(slides.length - 1, i))), [slides.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      let handled = true;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) go(slide + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) go(slide - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= slides.length) { go(Number(e.key) - 1); setMenu(false); }
      else if (e.key.toLowerCase() === "m") setMenu((o) => !o);
      else if (e.key === "Escape") { if (menu) setMenu(false); else onClose(); }
      else handled = false;
      if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [slide, slides.length, menu, go, onClose]);
  const live = Boolean(slides[slide].live);
  useEffect(() => { onSlide?.(slide, live); }, [slide, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastWheel = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    if (menu || live || Math.abs(e.deltaY) < 12) return;   // over a live slide the wheel zooms the map
    const now = Date.now();
    if (now - lastWheel.current < 800) return;
    lastWheel.current = now; go(slide + (e.deltaY > 0 ? 1 : -1));
  };
  const state = (i: number) => (i === slide ? "on" : i < slide ? "past" : "next");
  const name = <span>{brand[0]}<b>{brand[1]}</b></span>;
  return (
    <div className={`pz-root${live ? " pz-live" : ""}`} onWheel={onWheel} role="dialog" aria-label="Presentation">
      <div className="pz-noise" aria-hidden="true" /><div className="pz-glow" aria-hidden="true" />
      <div className="pz-top">
        <div className="pz-brand">{name}
          <button type="button" className={`pz-menu-btn${menu ? " open" : ""}`} onClick={() => setMenu((o) => !o)} aria-expanded={menu}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}</svg>
            Menu <em>{String(slide + 1).padStart(2, "0")}/{String(slides.length).padStart(2, "0")}</em>
          </button>
        </div>
        <div className="pz-top-right">
          <button type="button" className="pz-link" onClick={onClose}>Exit <kbd>Esc</kbd></button>
          <button type="button" className="pz-cta" onClick={onLaunch}>Open the sky →</button>
        </div>
      </div>
      <div className="pz-dots">{slides.map((s, i) => <button key={i} type="button" className={i === slide ? "on" : ""} onClick={() => go(i)} aria-label={`${i + 1}. ${s.title}`} title={s.title} />)}</div>
      {slide < slides.length - 1 && <button type="button" className="pz-hint" onClick={() => go(slide + 1)}><span>Scroll</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg></button>}
      {slides.map((s, i) => <section key={i} className="pz-slide" data-state={state(i)} inert={i !== slide}>{typeof s.body === "function" ? s.body({ next: () => go(i + 1), active: i === slide }) : s.body}</section>)}
      <div className="pz-mark">{mark}</div>
      <div className={`pz-backdrop${menu ? " open" : ""}`} onClick={() => setMenu(false)} aria-hidden="true" />
      <nav className={`pz-panel${menu ? " open" : ""}`} aria-label="Slides" inert={!menu}>
        <div className="pz-panel-head">{name}<button type="button" onClick={() => setMenu(false)} aria-label="Close menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
        <div className="pz-panel-kicker"><i />Presentation</div>
        <div className="pz-panel-label">Slides<i /></div>
        <div className="pz-panel-list">{slides.map((s, i) => (
          <button key={i} type="button" className={i === slide ? "on" : ""} onClick={() => { go(i); setMenu(false); }}><em>{String(i + 1).padStart(2, "0")}</em><span><b>{s.title}</b><small>{s.sub}</small></span></button>
        ))}</div>
        <button type="button" className="pz-cta wide" onClick={onLaunch}>Live demo <span>→</span></button>
        <div className="pz-panel-keys">← → navigate · 1–{Math.min(9, slides.length)} jump · M menu · Esc exit</div>
      </nav>
    </div>
  );
}
