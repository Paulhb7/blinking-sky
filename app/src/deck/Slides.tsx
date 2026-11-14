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
      <div>{names.map((name, i) => <img key={name} src={`${BASE}/shots/${name}.jpg`} alt={i === 0 ? `Blinking Sky: ${caption[0]}` : ""} style={{ opacity: i === index ? 1 : 0 }} />)}</div>
      <figcaption>{caption[Math.min(index, caption.length - 1)]}</figcaption>
    </figure>
  );
}

/** The NASA Space Apps 2026 talk, "Planet X and SPHEREx": where it starts, the tool, what it found, what anyone can do next. */
export default function Slides({ catalog, queueSize, onClose, onLaunch }: { catalog: SpxCatalog | null; queueSize: number; onClose: () => void; onLaunch: () => void }) {
  const count = (group: string) => catalog?.targets.filter((t) => t.group === group).length ?? 0;
  const kept = catalog?.targets.filter((t) => t.dwarf && t.group !== "start" && t.group !== "rejected").length ?? 0;
  const blind = catalog?.targets.filter((t) => t.group === "blind") ?? [];
  const best = catalog?.targets.find((t) => t.id === "J235953.52-280957.6");
  const slides: DeckSlide[] = [
    { title: "Blinking Sky", sub: "NASA Space Apps 2026", body: (
      <div className="pz-center">
        <Kicker>NASA Space Apps Challenge 2026</Kicker>
        <h1 className="pz-hero">Blinking <span>Sky.</span></h1>
        <p className="pz-tagline">Planet X and SPHEREx</p>
        <p className="pz-lead narrow">A public telescope view of NASA&apos;s SPHEREx images: see what moves, see what it is made of, and be the first to look.</p>
      </div>) },
    { title: "I blinked the sky", sub: "Backyard Worlds", body: (
      <div className="pz-center">
        <Kicker>Where this starts</Kicker>
        <h1 className="pz-h1">I was one of the first to <span>blink the sky.</span></h1>
        <p className="pz-lead">Backyard Worlds: Planet 9 opened in 2017. You flip between WISE images of the same patch of sky, years apart, and look for the dot that jumps. I was among its first volunteers, hunting for Planet Nine and for cold neighbours of the Sun.</p>
        <p className="pz-question">It taught me one thing: anyone can find something</p>
      </div>) },
    { title: "Nobody can look at it all", sub: "Now, SPHEREx", body: (<>
      <SectionTitle eyebrow="Now, SPHEREx" pre="Nobody can look at it " accent="all" />
      <div className="pz-center wide">
        <div className="pz-stats">{[["102", "Colours of infrared light", "0.75 to 5 µm"], ["6 months", "To map the whole sky", "Again and again since 2025"], ["1.6M", "Public images today", "DR1 and QR3, level 2"], ["1 billion+", "Objects in them", "Stars, comets, brown dwarfs"]].map(([n, label, src]) => <div key={label} className="pz-stat"><b>{n}</b><span>{label}</span><small>{src}</small></div>)}</div>
        <p className="pz-note">Things reveal themselves by <b>changing between images</b>. Someone has to look.</p>
      </div></>) },
    { title: "The tool I wished I had", sub: "Why", body: (<>
      <SectionTitle eyebrow="Why" pre="The tool I " accent="wished" post=" I had" />
      <div className="pz-center wide">
        <div className="pz-cards two">
          <div className="pz-card"><em>What I had</em><b>The blink told me that it moved</b><p>A dot that jumps between two dates is close to us. What it is, a star, a galaxy, a cold dwarf, took a telescope and months to learn.</p></div>
          <div className="pz-card"><em>What SPHEREx adds</em><b>A spectrum behind every pixel</b><p>The same blink, plus 102 colours. Not only “it moved”, but “it is cold, and its air holds methane”.</p></div>
        </div>
        <p className="pz-note">So this is what I am building now. <b>Blinking Sky</b>: real images, on the real sky, for anyone.</p>
      </div></>) },
    { title: "One sky, real images", sub: "The tool", body: ({ active }) => (<>
      <SectionTitle eyebrow="The tool" pre="One sky, real " accent="images" />
      <div className="pz-center shot"><Shots active={active} names={["ui-home", "ui-wide"]} pace={2600} caption={["It opens in any browser: no account, no install", "The real bright stars, and one circle per SPHEREx field. Click one: the sky turns to it and zooms in."]} /></div></>) },
    { title: "See it move", sub: "Across dates", body: ({ active }) => (<>
      <SectionTitle eyebrow="Across dates" pre="See it " accent="move" />
      <div className="pz-center shot"><Shots active={active} names={["ui-0855-0", "ui-0855-1", "ui-0855-2"]} caption={["May 2025 · WISE 0855−0714, the coldest known brown dwarf, 7.4 light-years away", "November 2025 · real exposures averaged per season, on a fixed sky grid", "May 2026 · it has crossed 8″: more than one SPHEREx pixel"]} /></div></>) },
    { title: "See what it is made of", sub: "Across colours", body: ({ active }) => (<>
      <SectionTitle eyebrow="Across colours" pre="See what it is " accent="made of" />
      <div className="pz-center shot"><Shots active={active} names={["ui-0415-lw", "ui-0415-ch4"]} caption={["At 4 microns · 2MASS 0415−0935, a known cold dwarf, is the brightest thing in the field", "At 3.3 microns · methane swallows its light: it vanishes, and its portrait goes dark with it"]} /></div></>) },
    { title: "Does it work?", sub: "Checked on known objects", body: (<>
      <SectionTitle eyebrow="Checked before looking" pre="Does it " accent="work" post="?" />
      <div className="pz-center wide">
        <table className="pz-table"><thead><tr><th>Known objects, away from the Galactic plane</th><th>Tested</th><th>Methane dip</th></tr></thead>
          <tbody>{(catalog?.validation ?? []).map((v) => <tr key={v.c}><td>{v.c}</td><td className="num">{v.n}</td><td className={`num${v.dips ? " hit" : ""}`}>{v.dips}</td></tr>)}</tbody></table>
        <p className="pz-note">Method frozen before looking at the targets. <b>0 false dips in 256 controls</b>; reliable to W2 ≈ 15.2.</p>
      </div></>) },
    { title: "What we found", sub: `${kept || 48} candidates`, body: (<>
      <SectionTitle eyebrow="What we found" pre={`${kept || 48} cold dwarf `} accent="candidates" />
      <div className="pz-center wide">
        <div className="pz-stats">{[[String(count("unpublished") || 12), "No publication found", "New selection from CatWISE"], [String(count("published") || 33), "Published, never with a spectrum", "SPHEREx adds the spectral evidence"], [String(count("blind") || 3), "Blind test", "Already typed: recovered unknowingly"], [String(count("rejected") || 4), "False dips, rejected", "Protostar, dense core, star spike, bad fit"]].map(([n, label, src]) => <div key={label} className="pz-stat"><b>{n}</b><span>{label}</span><small>{src}</small></div>)}</div>
        <p className="pz-note">All fit late T or Y templates. They are <b>candidates</b>: the type comes from stacked SPHEREx photometry, not from a classical spectrum.</p>
      </div></>) },
    { title: "One of the twelve", sub: "No publication found", body: ({ active }) => (<>
      <SectionTitle eyebrow="Candidate · not confirmed" pre="One of the " accent="twelve" />
      <div className="pz-center shot"><Shots active={active} pace={1700} names={["ui-j2359-lw", "ui-j2359-ch4", "ui-j2359-spectrum", "ui-sheet"]} caption={["CWISE J2359−2809 at 4 microns: a faint source at the centre", "At 3.3 microns it fades", `Its measured spectrum fits a ${best?.dwarf?.type ?? "T7"} template; it moves ${best?.motion ? best.motion.total.toFixed(2) : "0.29"}″ a year`, "Every candidate gets a sheet: images, spectrum, checks, and what to do before any claim"]} /></div></>) },
    { title: "The blind test", sub: "Three it had no way to know", body: (<>
      <SectionTitle eyebrow="The blind test" pre="Three it had no way to " accent="know" />
      <div className="pz-center wide">
        <table className="pz-table"><thead><tr><th>Picked by the same selection</th><th>Type from SPHEREx</th><th>Type from a published spectrum</th></tr></thead>
          <tbody>{blind.map((t) => <tr key={t.id}><td><b>{t.name}</b></td><td className="hit">{t.dwarf?.type} ± {t.dwarf?.typeUnc?.toFixed(0)}</td><td>{t.dwarf?.published.match(/sdT[\d.]+/)?.[0] ?? "typed"} · Keck / SIMBAD</td></tr>)}</tbody></table>
        <p className="pz-note">And one surprise: a source classed <b>L1</b> from photometry in 2024 shows a clear dip and fits a <b>T7</b>.</p>
      </div></>) },
    { title: "Your turn", sub: "Nobody has checked these", body: ({ active }) => (<>
      <SectionTitle eyebrow="Now it is anyone's" pre="Show me one " accent="nobody" post=" has checked" />
      <div className="pz-center shot"><Shots active={active} pace={1900} names={["ui-live-0", "ui-live-1", "ui-live-2", "ui-vote"]} caption={["One click: the browser finds every exposure of that spot in NASA's archive", "It reads a small window of each. The image builds up as they arrive", `About 170 exposures, 50 MB, under a minute. ${queueSize || 382} red sources are waiting`, "Blink, then say what you see. If it fades in methane, you may be the first to know"]} /></div></>) },
    { title: "What tempers it", sub: "Limits", body: (<>
      <SectionTitle eyebrow="Honest limits" pre="What " accent="tempers" post=" it" />
      <div className="pz-center wide"><ul className="pz-list">
        <li><b>Candidates, not confirmations.</b> No classical spectrum yet.</li>
        <li><b>“No publication found” is not “unknown”.</b> Full-text literature could not be searched; two of the twelve are fragile.</li>
        <li><b>Faint limit.</b> Reliable to W2 ≈ 15.2, one in two to 16.0, nothing beyond. The live measurement is a quick look.</li>
        <li><b>Not in the Galactic plane.</b> SPHEREx pixels are 6″ wide: most sources there are blended.</li>
        <li><b>Others are on it too.</b> A 2026 study already covers 6,003 dwarfs with SPHEREx; this goes about 1.5 magnitudes fainter.</li>
      </ul></div></>) },
    { title: "How it is built", sub: "Open data, static files", body: (<>
      <SectionTitle eyebrow="Under the hood" pre="How it is " accent="built" />
      <div className="pz-center wide"><div className="pz-cards two">
        <div className="pz-card"><em>Data</em><b>Straight from NASA&apos;s public archive</b><p>An index of all 1.6 million images in 58 MB. For one source the page reads 0.3 MB per image instead of the 65 MB file.</p></div>
        <div className="pz-card"><em>Images</em><b>Real pixels, on a fixed sky grid</b><p>No animation, no amplification. Missing pixels stay black. Every frame says how many exposures it averages.</p></div>
        <div className="pz-card"><em>The object</em><b>Drawn from its measurements</b><p>The 3D view takes its colour from the fitted temperature and its bands from the methane index. It is labelled as an illustration.</p></div>
        <div className="pz-card"><em>Open</em><b>No account, no server, no secret</b><p>Static files and open code. Votes stay in your browser. Every candidate comes with what to check before any claim.</p></div>
      </div></div></>) },
    { title: "Open the sky", sub: "Live demo", body: (
      <div className="pz-center">
        <Kicker>Live demo</Kicker>
        <h1 className="pz-hero">Your <span>turn.</span></h1>
        <p className="pz-lead narrow">Planet X is still out there, or it is not. Either way, the sky is now something anyone can blink.</p>
        <div className="pz-actions"><button type="button" className="pz-cta big" onClick={onLaunch}>Open the sky →</button></div>
      </div>) },
  ];
  return <Deck brand={["Blinking ", "SKY"]} mark="Blinking Sky · NASA Space Apps 2026" slides={slides} onClose={onClose} onLaunch={onLaunch} />;
}
