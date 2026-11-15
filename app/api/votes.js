// Shared votes of the review queue. One vote per browser and per source, counted for everyone.
// Storage: Upstash Redis through its REST interface; the keys come from the project's environment.
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const VOTES = ["fades", "stays", "blend", "artefact", "nothing"];
const SOURCE = /^J\d{6}\.\d{2}[+-]\d{6}\.\d$/;   // a source of the queue, by its CatWISE designation
const CLIENT = /^[0-9a-f-]{16,40}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function redis(commands) {
  const response = await fetch(`${URL_}/pipeline`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(commands) });
  if (!response.ok) throw new Error(`storage ${response.status}`);
  return (await response.json()).map((r) => r.result);
}
const tally = (values) => { const counts = Object.fromEntries(VOTES.map((v) => [v, 0])); for (const v of values ?? []) if (v in counts) counts[v] += 1; return { counts, total: (values ?? []).filter((v) => v in counts).length }; };

export async function GET(request) {
  if (!URL_ || !TOKEN) return json({ error: "storage not configured" }, 503);
  const params = new URL(request.url).searchParams, id = params.get("id");
  if (params.has("all")) {
    // Every source that has at least one vote, with its counts: the community page.
    try {
      const [ids] = await redis([["SMEMBERS", "sources"]]);
      const list = (ids ?? []).filter((x) => SOURCE.test(x)).slice(0, 400);
      const values = list.length ? await redis(list.map((x) => ["HVALS", `v:${x}`])) : [];
      return json({ sources: list.map((x, i) => ({ id: x, ...tally(values[i]) })).filter((x) => x.total > 0) });
    } catch { return json({ error: "storage unavailable" }, 502); }
  }
  try {
    if (!id) {
      // The whole picture: how many votes on how many sources, and the latest ones.
      const [votes, sources, recent] = await redis([["GET", "total"], ["SCARD", "sources"], ["LRANGE", "recent", 0, 29]]);
      const latest = (recent ?? []).map((r) => { try { return typeof r === "string" ? JSON.parse(r) : r; } catch { return null; } }).filter((r) => r && SOURCE.test(r.id) && VOTES.includes(r.vote));
      return json({ votes: Number(votes ?? 0), sources: Number(sources ?? 0), latest });
    }
    if (!SOURCE.test(id)) return json({ error: "unknown source" }, 400);
    const [values] = await redis([["HVALS", `v:${id}`]]);
    return json({ id, ...tally(values) });
  } catch { return json({ error: "storage unavailable" }, 502); }
}

export async function POST(request) {
  if (!URL_ || !TOKEN) return json({ error: "storage not configured" }, 503);
  let body; try { body = JSON.parse((await request.text()).slice(0, 400)); } catch { return json({ error: "bad request" }, 400); }
  const { id, vote, client } = body ?? {};
  if (typeof id !== "string" || !SOURCE.test(id) || !VOTES.includes(vote) || typeof client !== "string" || !CLIENT.test(client)) return json({ error: "bad request" }, 400);
  try {
    // At most 40 votes a minute from one address: enough for a person, not for a script.
    const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim(), slot = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
    const [hits] = await redis([["INCR", slot], ["EXPIRE", slot, 90]]);
    if (Number(hits) > 40) return json({ error: "too many votes, wait a minute" }, 429);
    const [added] = await redis([["HSET", `v:${id}`, client, vote], ["SADD", "sources", id], ["LPUSH", "recent", JSON.stringify({ id, vote, at: Date.now() })], ["LTRIM", "recent", 0, 99]]);
    const [values] = await redis(Number(added) === 1 ? [["HVALS", `v:${id}`], ["INCR", "total"]] : [["HVALS", `v:${id}`]]);
    return json({ id, ...tally(values) });
  } catch { return json({ error: "storage unavailable" }, 502); }
}
