import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { VOTES, fetchCommunity, type Community, type QueueSource } from "./data";

const ago = (at: number) => { const s = Math.max(0, (Date.now() - at) / 1000); return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };
const short = (id: string) => `${id.slice(0, 5)}${id.slice(10, 15)}`.replace("-", "−");

/** What the visitors of the review queue have said so far: totals, and the latest votes. Like Backyard Worlds, many eyes on the same sources. */
export default function CommunityPanel({ queue, onOpen, onClose }: { queue: QueueSource[]; onOpen: (source: QueueSource) => void; onClose: () => void }) {
  const [data, setData] = useState<Community | null | undefined>(undefined);
  useEffect(() => { let stale = false; fetchCommunity().then((c) => { if (!stale) setData(c); }); return () => { stale = true; }; }, []);
  return (
    <aside className="community glass" aria-label="Community votes">
      <header><p className="legend-title"><Users size={12} /> Community votes</p><button type="button" className="spx-icon" onClick={onClose} aria-label="Close the community votes"><X size={14} /></button></header>
      {data === undefined ? <p className="community-note">Loading the votes…</p> : data === null ? <p className="community-note">The votes cannot be reached right now.</p> : <>
        <p className="community-total"><b>{data.votes.toLocaleString("en-GB")}</b> vote{data.votes === 1 ? "" : "s"} on <b>{data.sources.toLocaleString("en-GB")}</b> of {queue.length || 382} sources</p>
        <p className="community-note">As in Backyard Worlds, many eyes look at the same sources. One vote per visitor and per source, with no name and no account.</p>
        {data.latest.length === 0 ? <p className="community-note">Nobody has voted yet. Open “Show me one nobody has checked” and be the first.</p> : <ul>
          {data.latest.map((v, i) => { const source = queue.find((q) => q.id === v.id), label = VOTES.find((x) => x.id === v.vote)?.label ?? v.vote;
            return <li key={`${v.id}-${v.at}-${i}`}><button type="button" disabled={!source} onClick={() => source && onOpen(source)}><span className="community-id">{short(v.id)}</span><span className={`community-vote ${v.vote}`}>{label}</span><span className="community-ago">{ago(v.at)}</span></button></li>; })}
        </ul>}
      </>}
    </aside>
  );
}
