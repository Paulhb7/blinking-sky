import { ArrowRight, Eye, Layers, MousePointerClick, Presentation, Users } from "lucide-react";
import BlurText from "./reactbits/BlurText";
import CountUp from "./reactbits/CountUp";
import GradientText from "./reactbits/GradientText";
import Magnet from "./reactbits/Magnet";
import ShinyText from "./reactbits/ShinyText";
import SpotlightCard from "./reactbits/SpotlightCard";
import StarBorder from "./reactbits/StarBorder";

/** The first screen: what this is, in one breath, over the live sky. */
export default function Landing({ queueSize, images, onEnter, onUnchecked, onPresent, onCommunity }: { queueSize: number; images: string; onEnter: () => void; onUnchecked: () => void; onPresent: () => void; onCommunity: () => void }) {
  return (
    <main className="home">
      <div className="home-veil" aria-hidden="true" />
      <header className="home-top"><span>Blinking <b>Sky</b></span><span>NASA Space Apps Challenge 2026 · Planet X and SPHEREx</span>
        <a className="home-gh" href="https://github.com/Paulhb7/blinking-sky" target="_blank" rel="noreferrer" aria-label="Source code on GitHub" title="Source code on GitHub">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.14c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" /></svg>
          <span>GitHub</span>
        </a></header>
      <section className="home-hero">
        <p className="home-kicker"><ShinyText text="Real images from NASA's SPHEREx telescope" color="#5ef2ff" shineColor="#ffffff" speed={3.5} /></p>
        <h1 aria-label="The sky changes. Come and look."><BlurText text="The sky changes." animateBy="words" direction="bottom" delay={110} className="home-h1-line" /><GradientText colors={["#5ef2ff", "#d6fbff", "#00b8d9", "#5ef2ff"]} animationSpeed={7} className="home-h1-accent">Come and look.</GradientText></h1>
        <p className="home-lead">Every six months SPHEREx photographs the whole sky again, in 102 colours of infrared light. Blink two dates to see what moves or changes brightness. Blink two colours to see what it is made of. No account, nothing to install.</p>
        <div className="home-actions">
          <Magnet padding={60} magnetStrength={5}><button type="button" className="home-cta" onClick={onEnter}>Open the sky <ArrowRight size={16} /></button></Magnet>
          <StarBorder as="button" type="button" className="home-star" color="#ffb454" duration={5} radius={999} backgroundColor="rgba(8, 10, 14, 0.82)" textColor="#ffd9a3" onClick={onUnchecked}>Show me one nobody has checked</StarBorder>
        </div>
        <div className="home-links"><button type="button" className="home-link" onClick={onCommunity}><Users size={13} /> Community votes</button><button type="button" className="home-link" onClick={onPresent}><Presentation size={13} /> Watch the two-minute story</button></div>
      </section>
      <section className="home-steps" aria-label="How it works">
        <SpotlightCard className="home-step" spotlightColor="rgba(94, 242, 255, 0.24)"><MousePointerClick size={18} /><h2>Pick a spot</h2><p>A known star, a candidate, any position, or let the tool hand you a source no one has examined.</p></SpotlightCard>
        <SpotlightCard className="home-step" spotlightColor="rgba(94, 242, 255, 0.24)"><Layers size={18} /><h2>Blink it</h2><p>Your browser reads the real exposures from NASA&apos;s archive and stacks them while you watch.</p></SpotlightCard>
        <SpotlightCard className="home-step" spotlightColor="rgba(94, 242, 255, 0.24)"><Eye size={18} /><h2>Say what you see</h2><p>Does it move? Did it get brighter? Does it fade where methane absorbs? A cold world looks like nothing else.</p></SpotlightCard>
      </section>
      <footer className="home-foot">
        <div><b><CountUp to={1.6} decimals={1} duration={1.6} /> million</b><span>public SPHEREx images indexed</span></div>
        <div><b><CountUp to={48} duration={1.6} /></b><span>cold dwarf candidates measured so far</span></div>
        <div><b>{queueSize ? <CountUp to={queueSize} duration={1.8} /> : "—"}</b><span>red sources nobody has checked</span></div>
        <p>Data: NASA/JPL-Caltech/SPHEREx · NASA/IPAC IRSA · CatWISE2020 · HYG star database. Candidates are not confirmations.</p>
      </footer>
    </main>
  );
}
