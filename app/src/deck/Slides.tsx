import { useEffect, useState } from "react";
import type { SpxCatalog } from "../data";
import { Deck, Kicker, SectionTitle, type DeckSlide } from "./Deck";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Captures of the whole interface, taken from the running tool; several of them alternate like the blink they show. */
function Shots({ active, names, caption, pace = 1300 }: { active: boolean; names: string[]; caption: string[]; pace?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || names.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % names.length), pace);
    return () => window.clearInterval(timer);
  }, [active, names.length, pace]);
  return (
    <figure className="pz-shot">
      <div>{names.map((name, i) => <img key={`${name}-${i}`} src={`${BASE}/shots/${name}.jpg`} alt={i === 0 ? `Blinking Sky: ${caption[0]}` : ""} style={{ opacity: i === index ? 1 : 0 }} />)}</div>
      <figcaption>{caption[Math.min(index, caption.length - 1)]}</figcaption>
    </figure>
  );
}

/** The NASA Space Apps 2026 talk, "Planet X and SPHEREx", in ten slides: who, what SPHEREx is, the map, the problem,
 * the idea (crossing catalogs), the method, one candidate, twelve, and what the platform is for. */
export default function Slides({ catalog, queueSize, onClose, onLaunch }: { catalog: SpxCatalog | null; queueSize: number; onClose: () => void; onLaunch: () => void }) {
  const twelve = catalog?.targets.filter((t) => t.group === "unpublished").length || 12;
  const best = catalog?.targets.find((t) => t.id === "J235953.52-280957.6");
  const suspects = (queueSize || 382).toLocaleString("en-GB");
  const slides: DeckSlide[] = [
    // 01 — Who
    { title: "Blinking Sky", sub: "Paul and Aziz", body: (
      <div className="pz-center wide">
        <Kicker>NASA Space Apps Challenge 2026 · Planet X and SPHEREx</Kicker>
        <h1 className="pz-hero">Blinking <span>Sky</span></h1>
        <div className="pz-people">
          <div className="pz-person"><b>Paul</b><span>AI researcher · amateur astronomer</span><p>One of the first volunteers of Backyard Worlds, the project that taught thousands of people to blink the sky.</p></div>
          <div className="pz-person"><b>Aziz</b><span>High-school student · AI developer</span><p>Builds the tools he wishes existed.</p></div>
        </div>
      </div>) },
    // 02 — What SPHEREx is
    { title: "What is SPHEREx?", sub: "A new map of the whole sky", body: (<>
      <SectionTitle eyebrow="The telescope" pre="What is " accent="SPHEREx" post="?" />
      <div className="pz-center wide">
        <div className="pz-stats">{[["2025", "Launched by NASA", "A small telescope in Earth orbit"], ["The whole sky", "Photographed every six months", "Again and again"], ["102", "Colours of infrared light", "From 0.75 to 5 microns"], ["1.6 million", "Images already public", "Free, for anyone"]].map(([n, label, src]) => <div key={label} className="pz-stat"><b>{n}</b><span>{label}</span><small>{src}</small></div>)}</div>
        <p className="pz-note">One picture says where things are. <b>102 colours say what they are made of.</b> Two dates say what moved.</p>
      </div></>) },
    // 03 — The galaxies
    { title: "Every galaxy, one click", sub: "The map", body: ({ active }) => (<>
      <SectionTitle eyebrow="The map" pre="Click a galaxy. " accent="See it in SPHEREx." />
      <div className="pz-center shot"><Shots active={active} pace={2800} names={["d-galaxies", "d-galaxy-hover", "d-galaxy-image"]} caption={["43,463 galaxies at their measured distance. The Milky Way is the dot in the middle.", "Rest the pointer on one: a first look arrives from NASA's archive in two seconds.", "Click: the real SPHEREx image of NGC 4639, 49 million light-years away, built from 208 exposures."]} /></div></>) },
    // 04 — The zoom, down to a star that moves
    { title: "Down to a star that moves", sub: "From galaxies to Barnard's Star", body: ({ active }) => (<>
      <SectionTitle eyebrow="One continuous map" pre="From the galaxies down to a star that " accent="moves" />
      <div className="pz-center shot"><Shots active={active} pace={1700} names={["d-galaxies", "d-milkyway", "d-near", "d-barnard-0", "d-barnard-1", "d-barnard-0", "d-barnard-1"]} caption={["The galaxies around us", "Our galaxy, the Milky Way", "Around the Sun: every dot is a dwarf SPHEREx has already named", "Barnard's Star in SPHEREx, August 2025", "August 2026: it has moved by 10″. Two real exposures, nothing animated.", "August 2025", "August 2026"]} /></div></>) },
    // 05 — The problem
    { title: "But where do you look?", sub: "The problem", body: (
      <div className="pz-center">
        <Kicker>The problem</Kicker>
        <h1 className="pz-h1">A billion objects. <span>No list of them.</span></h1>
        <p className="pz-lead">SPHEREx photographs everything, and nobody has yet written down what is in its images. You can ask it what any point of the sky is. You cannot ask it where the interesting points are.</p>
        <p className="pz-question">SPHEREx says what. Not where.</p>
      </div>) },
    // 06 — The idea
    { title: "The value is in the crossing", sub: "The idea", body: (<>
      <SectionTitle eyebrow="The idea" pre="The value is in the " accent="crossing" />
      <div className="pz-center wide">
        <div className="pz-cross">
          <div className="pz-card"><em>WISE · 2010–2021</em><b>Where to look</b><p>Two infrared colours and ten years of images. A cold neighbour of the Sun is very red, and it shifts a little.</p></div>
          <i>×</i>
          <div className="pz-card"><em>Published lists</em><b>What is already known</b><p>Thousands of dwarfs and candidates found by others. They are removed first.</p></div>
          <i>×</i>
          <div className="pz-card"><em>SPHEREx · 2025–</em><b>What it is</b><p>102 colours. A cold dwarf is bright at 4 microns and black at 3.3, where methane absorbs.</p></div>
        </div>
        <p className="pz-note">No single catalog has the answer. <b>WISE says where. SPHEREx says what.</b></p>
      </div></>) },
    // 07 — The method
    { title: "From 282,058 to " + suspects, sub: "The method, and why to trust it", body: ({ active }) => (<>
      <SectionTitle eyebrow="The method" pre={"From 282,058 red sources to "} accent={`${suspects} suspects`} />
      <div className="pz-center shot small"><Shots active={active} names={["d-funnel"]} caption={["The selection, replayed in the tool. Then each suspect is opened in SPHEREx, in the browser, in under a minute."]} /></div>
      <p className="pz-note under">Checked first on known objects: <b>19 of 21</b> confirmed cold dwarfs show the methane dip. <b>0 of 256</b> stars, red sources and empty positions do.</p></>) },
    // 08 — One candidate
    { title: "One candidate", sub: "CWISE J2359−2809", body: ({ active }) => (<>
      <SectionTitle eyebrow="Candidate · not confirmed" pre="It fades where " accent="methane" post=" absorbs" />
      <div className="pz-center shot"><Shots active={active} pace={1600} names={["d-j2359-lw", "d-j2359-ch4"]} caption={[`CWISE J2359−2809 at 4 microns: a faint source at the centre. It fits a ${best?.dwarf?.type ?? "T7"} template, about 750 K.`, "At 3.3 microns it is gone. In no catalog or list we could search."]} /></div></>) },
    // 09 — Twelve
    { title: `${twelve} candidates`, sub: "Scaling the method", body: (<>
      <SectionTitle eyebrow="Scaling the method" pre={`${twelve} cold dwarf `} accent="candidates" />
      <div className="pz-center wide">
        <div className="pz-stats">{[[String(twelve), "With no publication found", "Late T dwarfs, 50 to 130 light-years away"], ["10", "Also seen in deep optical images", "A red point source that moved"], ["33", "More, published without a spectrum", "SPHEREx adds the spectral evidence"], ["3", "Blind test", "Already typed by others: recovered unknowingly"]].map(([n, label, src]) => <div key={label} className="pz-stat"><b>{n}</b><span>{label}</span><small>{src}</small></div>)}</div>
        <p className="pz-note">Candidates, not confirmations: the type comes from stacked SPHEREx photometry. <b>“No publication found” is not “unknown”.</b></p>
      </div></>) },
    // 10 — The platform
    { title: "A way to find the next one", sub: "Your turn", body: ({ active }) => (<>
      <SectionTitle eyebrow="What we bring" pre="A platform, and a way to find the " accent="next one" />
      <div className="pz-center shot small"><Shots active={active} pace={2600} names={["d-twelve", "d-home"]} caption={[`${suspects} suspects are waiting. Pick one, blink it, say what you see: if it fades in methane, its dot turns solid.`, "Open in any browser. No account, no server: the images come straight from NASA."]} /></div>
      <div className="pz-actions under"><button type="button" className="pz-cta big" onClick={onLaunch}>Open the sky →</button></div></>) },
  ];
  return <Deck brand={["Blinking ", "SKY"]} mark="Blinking Sky · NASA Space Apps 2026" slides={slides} onClose={onClose} onLaunch={onLaunch} />;
}
