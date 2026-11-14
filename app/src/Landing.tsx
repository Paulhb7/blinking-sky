import { ArrowRight, Eye, Layers, MousePointerClick, Presentation } from "lucide-react";

/** The first screen: what this is, in one breath, over the live sky. */
export default function Landing({ queueSize, images, onEnter, onUnchecked, onPresent }: { queueSize: number; images: string; onEnter: () => void; onUnchecked: () => void; onPresent: () => void }) {
  return (
    <main className="home">
      <div className="home-veil" aria-hidden="true" />
      <header className="home-top"><span>Blinking <b>Sky</b></span><span>NASA Space Apps Challenge 2026 · Planet X and SPHEREx</span></header>
      <section className="home-hero">
        <p className="home-kicker">Real images from NASA&apos;s SPHEREx telescope</p>
        <h1>The sky changes.<br /><span>Come and look.</span></h1>
        <p className="home-lead">Every six months SPHEREx photographs the whole sky again, in 102 colours of infrared light. Blink two dates to see what moves. Blink two colours to see what it is made of. No account, nothing to install.</p>
        <div className="home-actions">
          <button type="button" className="home-cta" onClick={onEnter}>Open the sky <ArrowRight size={16} /></button>
          <button type="button" className="home-ghost" onClick={onUnchecked}>Show me one nobody has checked</button>
        </div>
        <button type="button" className="home-link" onClick={onPresent}><Presentation size={13} /> Watch the two-minute story</button>
      </section>
      <section className="home-steps" aria-label="How it works">
        <article><MousePointerClick size={18} /><h2>Pick a spot</h2><p>A known star, a candidate, any position, or let the tool hand you a source no one has examined.</p></article>
        <article><Layers size={18} /><h2>Blink it</h2><p>Your browser reads the real exposures from NASA&apos;s archive and stacks them while you watch.</p></article>
        <article><Eye size={18} /><h2>Say what you see</h2><p>Does it move? Does it fade where methane absorbs? A cold world looks like nothing else.</p></article>
      </section>
      <footer className="home-foot">
        <div><b>{images}</b><span>public SPHEREx images indexed</span></div>
        <div><b>48</b><span>cold dwarf candidates measured so far</span></div>
        <div><b>{queueSize || "—"}</b><span>red sources nobody has checked</span></div>
        <p>Data: NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA · CatWISE2020 · HYG star database. Candidates are not confirmations.</p>
      </footer>
    </main>
  );
}
