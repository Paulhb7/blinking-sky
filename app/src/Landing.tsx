import { ArrowRight, Eye, Layers, MousePointerClick, Presentation } from "lucide-react";
import BlurText from "./reactbits/BlurText";
import CountUp from "./reactbits/CountUp";
import GradientText from "./reactbits/GradientText";
import Magnet from "./reactbits/Magnet";
import ShinyText from "./reactbits/ShinyText";
import SpotlightCard from "./reactbits/SpotlightCard";
import StarBorder from "./reactbits/StarBorder";

/** The first screen: what this is, in one breath, over the live sky. */
export default function Landing({ queueSize, images, onEnter, onUnchecked, onPresent }: { queueSize: number; images: string; onEnter: () => void; onUnchecked: () => void; onPresent: () => void }) {
  return (
    <main className="home">
      <div className="home-veil" aria-hidden="true" />
      <header className="home-top"><span>Blinking <b>Sky</b></span><span>NASA Space Apps Challenge 2026 · Planet X and SPHEREx</span></header>
      <section className="home-hero">
        <p className="home-kicker"><ShinyText text="Real images from NASA's SPHEREx telescope" color="#5ef2ff" shineColor="#ffffff" speed={3.5} /></p>
        <h1 aria-label="The sky changes. Come and look."><BlurText text="The sky changes." animateBy="words" direction="bottom" delay={110} className="home-h1-line" /><GradientText colors={["#5ef2ff", "#d6fbff", "#00b8d9", "#5ef2ff"]} animationSpeed={7} className="home-h1-accent">Come and look.</GradientText></h1>
        <p className="home-lead">Every six months SPHEREx photographs the whole sky again, in 102 colours of infrared light. Blink two dates to see what moves or changes brightness. Blink two colours to see what it is made of. No account, nothing to install.</p>
        <div className="home-actions">
          <Magnet padding={60} magnetStrength={5}><button type="button" className="home-cta" onClick={onEnter}>Open the sky <ArrowRight size={16} /></button></Magnet>
          <StarBorder as="button" type="button" className="home-star" color="#ffb454" duration={5} radius={999} backgroundColor="rgba(8, 10, 14, 0.82)" textColor="#ffd9a3" onClick={onUnchecked}>Show me one nobody has checked</StarBorder>
        </div>
        <button type="button" className="home-link" onClick={onPresent}><Presentation size={13} /> Watch the two-minute story</button>
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
