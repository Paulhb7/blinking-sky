import { useEffect } from "react";
import type { SpxCatalog } from "../data";
import { Deck, Kicker, SectionTitle, type DeckSlide } from "./Deck";

/** What the talk can ask of the tool behind it. */
export type Director = {
  scene: (name: "orbit" | "galaxies" | "milkyway" | "sun") => void;
  galaxy: (name: string) => void;
  target: (id: string, kind?: "date" | "colour") => void;
  selection: () => void;
  hunt: () => void;
  clear: () => void;
};

/** Runs a short script on the live tool while its slide is up: [seconds after the slide appears, action]. */
function Run({ active, steps }: { active: boolean; steps: [number, () => void][] }) {
  useEffect(() => {
    if (!active) return;
    const timers = steps.map(([at, action]) => window.setTimeout(action, at * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
/** A live slide: a title above the running tool and a line of commentary under it. */
const LiveSlide = ({ eyebrow, title, accent, caption }: { eyebrow: string; title: string; accent: string; caption: string }) => (<>
  <div className="pz-live-top"><span>{eyebrow}</span><h2>{title}<b>{accent}</b></h2></div>
  <p className="pz-live-cap">{caption}</p>
</>);

/** The NASA Space Apps 2026 talk, "Planet X and SPHEREx", in ten slides. Nothing is a recording: the text slides sit over
 * the turning galaxy, and the others are the tool itself, driven live. */
export default function Slides({ catalog, queueSize, direct, onClose, onLaunch, onSlide }: { catalog: SpxCatalog | null; queueSize: number; direct: Director; onClose: () => void; onLaunch: () => void; onSlide: (index: number, live: boolean) => void }) {
  const twelve = catalog?.targets.filter((t) => t.group === "unpublished").length || 12;
  const suspects = (queueSize || 382).toLocaleString("en-GB");
  const orbit: [number, () => void][] = [[0, () => { direct.clear(); direct.scene("orbit"); }]];
  const slides: DeckSlide[] = [
    // 01 — Who
    { title: "Blinking Sky", sub: "Paul and Aziz", body: ({ active }) => (<>
      <Run active={active} steps={orbit} />
      <div className="pz-center wide">
        <Kicker>NASA Space Apps Challenge 2026 · Planet X and SPHEREx</Kicker>
        <h1 className="pz-hero">Blinking <span>Sky</span></h1>
        <div className="pz-people">
          <div className="pz-person"><b>Paul</b><span>AI researcher · amateur astronomer</span><p>One of the first volunteers of Backyard Worlds, the project that taught thousands of people to blink the sky.</p></div>
          <div className="pz-person"><b>Aziz</b><span>High-school student · AI developer</span><p>Builds the tools he wishes existed.</p></div>
        </div>
      </div></>) },
    // 02 — What SPHEREx is
    { title: "What is SPHEREx?", sub: "A new map of the whole sky", body: ({ active }) => (<>
      <Run active={active} steps={orbit} />
      <SectionTitle eyebrow="The telescope" pre="What is " accent="SPHEREx" post="?" />
      <div className="pz-center wide">
        <div className="pz-stats">{[["2025", "Launched by NASA", "A small telescope in Earth orbit"], ["The whole sky", "Photographed every six months", "Again and again"], ["102", "Colours of infrared light", "From 0.75 to 5 microns"], ["1.6 million", "Images already public", "Free, for anyone"]].map(([n, label, src]) => <div key={label} className="pz-stat"><b>{n}</b><span>{label}</span><small>{src}</small></div>)}</div>
        <p className="pz-note">One picture says where things are. <b>102 colours say what they are made of.</b> Two dates say what moved.</p>
      </div></>) },
    // 03 — The galaxies, live
    { title: "Every galaxy, one click", sub: "Live", live: true, body: ({ active }) => (<>
      <Run active={active} steps={[[0, () => { direct.clear(); direct.scene("galaxies"); }], [4.2, () => direct.galaxy("NGC 4639")]]} />
      <LiveSlide eyebrow="The map" title="Click a galaxy. " accent="See it in SPHEREx." caption="43,463 galaxies at their measured distance. One is picked: the camera flies 49 million light-years, and its SPHEREx image builds up from NASA's archive." /></>) },
    // 04 — The zoom, down to a star that moves, live
    { title: "Down to a star that moves", sub: "Live", live: true, body: ({ active }) => (<>
      <Run active={active} steps={[[0, () => { direct.clear(); direct.scene("galaxies"); }], [2.8, () => direct.scene("milkyway")], [6.4, () => direct.scene("sun")], [10, () => direct.target("barnard", "date")]]} />
      <LiveSlide eyebrow="One continuous map" title="From the galaxies down to a star that " accent="moves" caption="The galaxies, our Milky Way, the Sun's neighbours, then Barnard's Star: two real SPHEREx exposures a year apart. It has moved by 10″." /></>) },
    // 05 — The problem
    { title: "But where do you look?", sub: "The problem", body: ({ active }) => (<>
      <Run active={active} steps={orbit} />
      <div className="pz-center">
        <Kicker>The problem</Kicker>
        <h1 className="pz-h1">A billion objects. <span>No list of them.</span></h1>
        <p className="pz-lead">SPHEREx photographs everything, and nobody has yet written down what is in its images. You can ask it what any point of the sky is. You cannot ask it where the interesting points are.</p>
        <p className="pz-question">SPHEREx says what. Not where.</p>
      </div></>) },
    // 06 — The idea
    { title: "The value is in the crossing", sub: "The idea", body: ({ active }) => (<>
      <Run active={active} steps={orbit} />
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
    // 07 — The method, live
    { title: "From 282,058 to " + suspects, sub: "Live", live: true, body: ({ active }) => (<>
      <Run active={active} steps={[[0, () => { direct.clear(); direct.scene("sun"); }], [1.6, () => direct.selection()]]} />
      <LiveSlide eyebrow="The method" title="From 282,058 red sources to " accent={`${suspects} suspects`} caption="The selection, replayed. Checked first on known objects: 19 of 21 cold dwarfs show the methane dip, 0 of 256 stars, red sources and empty positions do." /></>) },
    // 08 — One candidate, live
    { title: "One candidate", sub: "Live", live: true, body: ({ active }) => (<>
      <Run active={active} steps={[[0, () => direct.target("J235953.52-280957.6", "colour")]]} />
      <LiveSlide eyebrow="Candidate · not confirmed" title="It fades where " accent="methane absorbs" caption="CWISE J2359−2809: bright at 4 microns, gone at 3.3. Its 3D view dims with it. In no catalog or list we could search." /></>) },
    // 09 — Twelve
    { title: `${twelve} candidates`, sub: "Scaling the method", body: ({ active }) => (<>
      <Run active={active} steps={orbit} />
      <SectionTitle eyebrow="Scaling the method" pre={`${twelve} cold dwarf `} accent="candidates" />
      <div className="pz-center wide">
        <div className="pz-stats">{[[String(twelve), "With no publication found", "Late T dwarfs, 50 to 130 light-years away"], ["10", "Also seen in deep optical images", "A red point source that moved"], ["33", "More, published without a spectrum", "SPHEREx adds the spectral evidence"], ["3", "Blind test", "Already typed by others: recovered unknowingly"]].map(([n, label, src]) => <div key={label} className="pz-stat"><b>{n}</b><span>{label}</span><small>{src}</small></div>)}</div>
        <p className="pz-note">Candidates, not confirmations: the type comes from stacked SPHEREx photometry. <b>“No publication found” is not “unknown”.</b></p>
      </div></>) },
    // 10 — The platform, live
    { title: "A way to find the next one", sub: "Live", live: true, body: ({ active }) => (<>
      <Run active={active} steps={[[0, () => { direct.clear(); direct.scene("sun"); }], [3.2, () => direct.hunt()]]} />
      <LiveSlide eyebrow="What we bring" title="A platform, and a way to find the " accent="next one" caption={`${suspects} suspects are waiting. One is opened now, live: nobody has ever looked at it in SPHEREx.`} /></>) },
  ];
  return <Deck brand={["Blinking ", "SKY"]} mark="Blinking Sky · NASA Space Apps 2026" slides={slides} onClose={onClose} onLaunch={onLaunch} onSlide={onSlide} />;
}
