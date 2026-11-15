import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import { VOTES, fetchCommunity, fetchCommunitySources, type Community, type QueueSource, type SharedVotes, type Vote } from "./data";

const ago = (at: number) => { const s = Math.max(0, (Date.now() - at) / 1000); return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };
const short = (id: string) => `${id.slice(0, 5)}${id.slice(10, 15)}`.replace("-", "−");
const label = (vote: Vote) => VOTES.find((x) => x.id === vote)?.label ?? vote;

/** The community page: what the visitors of the review queue have said so far. Inspired by Backyard Worlds: Planet 9,
 * where many volunteers look at the same sources and their agreement is the result. */
export default function CommunityPage({ queue, onOpen, onBack, onVote }: { queue: QueueSource[]; onOpen: (source: QueueSource) => void; onBack: () => void; onVote: () => void }) {
  const [data, setData] = useState<Community | null | undefined>(undefined);
  const [sources, setSources] = useState<({ id: string } & SharedVotes)[]>([]);
  useEffect(() => {
    let stale = false;
    fetchCommunity().then((c) => { if (!stale) setData(c); });
    fetchCommunitySources().then((s) => { if (!stale) setSources(s); });
    return () => { stale = true; };
  }, []);
  const total = queue.length || 382;
  // A source "fades" for the community when most of its voters said so.
  const fading = useMemo(() => sources.filter((s) => s.counts.fades > 0 && s.counts.fades * 2 >= s.total), [sources]);
  const ranked = useMemo(() => [...sources].sort((a, b) => b.total - a.total || b.counts.fades - a.counts.fades).slice(0, 12), [sources]);
  const find = (id: string) => queue.find((q) => q.id === id);
  return (
    <main className="community-page">
      <div className="home-veil" aria-hidden="true" />
      <header className="home-top"><span>Blinking <b>Sky</b></span><span>Community votes</span>
        <button type="button" className="home-gh" onClick={onBack}><ArrowLeft size={14} /><span>Back</span></button></header>
      <section className="community-hero">
        <p className="home-kicker"><Users size={13} /> Citizen science · inspired by Backyard Worlds: Planet 9</p>
        <h1>What the community saw</h1>
        <p className="home-lead">382 red, moving sources from WISE have never been examined in SPHEREx. Anyone can look at one, blink it in two colours and say what it does. One vote per visitor and per source, with no name and no account. When several visitors agree that a source fades in the methane band, it is worth a telescope&apos;s time.</p>
        <button type="button" className="home-cta" onClick={onVote}>Vote on a source nobody has checked <ArrowRight size={16} /></button>
      </section>
      {data === undefined ? <p className="community-empty">Loading the votes…</p> : data === null ? <p className="community-empty">The votes cannot be reached right now.</p> : <>
        <section className="community-stats" aria-label="Totals">
          <div><b>{data.votes.toLocaleString("en-GB")}</b><span>vote{data.votes === 1 ? "" : "s"} cast</span></div>
          <div><b>{data.sources.toLocaleString("en-GB")}<small> / {total}</small></b><span>sources looked at</span><i><em style={{ width: `${Math.min(100, data.sources / total * 100)}%` }} /></i></div>
          <div><b className="amber">{fading.length}</b><span>where most visitors see a fade in methane</span></div>
        </section>
        {data.votes === 0 ? <p className="community-empty">Nobody has voted yet. Be the first: every vote here is a real look at a real source.</p> : <section className="community-cols">
          <div>
            <h2>Latest votes</h2>
            <ul className="community-list">{data.latest.slice(0, 14).map((v, i) => { const source = find(v.id);
              return <li key={`${v.id}-${v.at}-${i}`}><button type="button" disabled={!source} onClick={() => source && onOpen(source)}><span className="community-id">{short(v.id)}</span><span className={`community-vote ${v.vote}`}>{label(v.vote)}</span><span className="community-ago">{ago(v.at)}</span></button></li>; })}</ul>
          </div>
          <div>
            <h2>Most looked at</h2>
            <ul className="community-list">{ranked.map((s) => { const source = find(s.id), top = (Object.keys(s.counts) as Vote[]).sort((a, b) => s.counts[b] - s.counts[a])[0];
              return <li key={s.id}><button type="button" disabled={!source} onClick={() => source && onOpen(source)}><span className="community-id">{short(s.id)}</span>
                <span className="community-bar" title={VOTES.filter((v) => s.counts[v.id] > 0).map((v) => `${v.label}: ${s.counts[v.id]}`).join(" · ")}>{VOTES.filter((v) => s.counts[v.id] > 0).map((v) => <em key={v.id} className={v.id} style={{ flexGrow: s.counts[v.id] }} />)}</span>
                <span className={`community-vote ${top}`}>{label(top)}</span><span className="community-ago">{s.total} vote{s.total > 1 ? "s" : ""}</span></button></li>; })}</ul>
          </div>
        </section>}
      </>}
      <footer className="home-foot"><p>A vote is a look, not a measurement: the tool shows its own quick-look measurement after each vote. Sources are candidates until a telescope confirms them.</p></footer>
    </main>
  );
}
