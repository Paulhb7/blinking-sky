// Builds the candidates poster (poster.html) from the tool's own data and real SPHEREx stacks.
import { readFileSync, writeFileSync } from "node:fs";
const data = new URL("../../app/public/data/", import.meta.url);
const c = JSON.parse(readFileSync(new URL("cold-dwarfs.json", data)));
const b64 = (id, k) => "data:image/png;base64," + readFileSync(new URL(`stacks/${id}_${k}.png`, data)).toString("base64");
const minus = (s) => s.replace(/-/g, "−");
const list = c.targets.filter((t) => t.group === "unpublished").sort((a, b) => b.snr - a.snr);
const short = (id) => minus(`${id.slice(0, 5)}${id.slice(10, 15)}`);
const card = (t, i) => `
  <article>
    <header><span class="n">${String(i + 1).padStart(2, "0")}</span><h2>${short(t.id)}</h2><span class="type">${t.type} ± ${t.typeUnc}</span></header>
    <div class="pair">
      <figure><div class="img"><img src="${b64(t.id, "lw")}" alt=""><i></i></div><figcaption>4 µm</figcaption></figure>
      <figure class="ch4"><div class="img"><img src="${b64(t.id, "ch4")}" alt=""><i></i></div><figcaption>3.3 µm · methane</figcaption></figure>
    </div>
    <p class="full">CWISE ${minus(t.id)}</p>
    <dl><div><dt>methane index</dt><dd>${minus(t.R.toFixed(2))} ± ${t.eR.toFixed(2)}</dd></div><div><dt>W2</dt><dd>${(Math.round(t.W2 * 100 + 1e-6) / 100).toFixed(2)}</dd></div><div><dt>S/N</dt><dd>${t.snr.toFixed(1)}</dd></div><div><dt>motion</dt><dd>${t.pmTotal.toFixed(2)}″/yr</dd></div></dl>
  </article>`;
writeFileSync(new URL("poster.html", import.meta.url), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1490px;overflow:hidden;position:relative;font-family:Inter,sans-serif;color:#f3fbff;
 background:radial-gradient(1200px 700px at 78% -8%,rgba(94,242,255,.13),transparent 60%),radial-gradient(900px 600px at 6% 108%,rgba(255,184,77,.10),transparent 60%),#030811;padding:58px 70px 0}
.stars{position:absolute;inset:0;background-image:radial-gradient(1.2px 1.2px at 12% 18%,#fff8,transparent 60%),radial-gradient(1px 1px at 31% 7%,#fff6,transparent 60%),radial-gradient(1.4px 1.4px at 57% 12%,#fff7,transparent 60%),radial-gradient(1px 1px at 88% 30%,#fff5,transparent 60%),radial-gradient(1.2px 1.2px at 95% 71%,#fff6,transparent 60%),radial-gradient(1px 1px at 3% 55%,#fff5,transparent 60%),radial-gradient(1.3px 1.3px at 47% 97%,#fff6,transparent 60%),radial-gradient(1px 1px at 70% 4%,#fff5,transparent 60%);pointer-events:none}
.top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:34px;position:relative}
.kicker{font-family:"DM Mono",monospace;font-size:19px;letter-spacing:.2em;text-transform:uppercase;color:#5ef2ff;margin-bottom:14px}
h1{font-size:64px;white-space:nowrap;font-weight:800;letter-spacing:-.035em;line-height:1}
h1 b{color:#ffb84d;font-weight:800}
.lead{max-width:600px;font-size:21px;line-height:1.42;color:#a9c3d2;text-align:right}
.lead b{color:#f3fbff;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;position:relative}
article{border:1px solid rgba(94,242,255,.24);background:linear-gradient(180deg,rgba(13,28,44,.82),rgba(6,14,24,.82));border-radius:14px;padding:16px 18px 15px;box-shadow:0 0 40px rgba(94,242,255,.05)}
header{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
.n{font-family:"DM Mono",monospace;font-size:15px;color:#ffb84d}
h2{font-size:27px;font-weight:700;letter-spacing:-.02em;flex:1}
.type{font-family:"DM Mono",monospace;font-size:15px;color:#030811;background:#ffb84d;border-radius:99px;padding:3px 10px;font-weight:500}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.img{position:relative;aspect-ratio:1;overflow:hidden;border-radius:8px;background:#000;border:1px solid rgba(94,242,255,.35)}
.ch4 .img{border-color:rgba(255,184,77,.5)}
.img img{position:absolute;left:-30%;top:-30%;width:160%;height:160%}
.img i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:1.5px dashed rgba(255,184,77,.85)}
figcaption{font-family:"DM Mono",monospace;font-size:13.5px;color:#5ef2ff;margin-top:6px}
.ch4 figcaption{color:#ffb84d}
.full{font-family:"DM Mono",monospace;font-size:13.5px;color:#a9c3d2;margin:10px 0 9px}
dl{display:grid;grid-template-columns:1.5fr .8fr .7fr 1fr;gap:8px;border-top:1px solid rgba(169,195,210,.18);padding-top:9px}
dt{font-family:"DM Mono",monospace;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:#7f9bab}
dd{font-size:17px;font-weight:600;margin-top:2px;white-space:nowrap}
footer{margin-top:26px;position:relative;display:flex;justify-content:space-between;gap:40px;font-size:15.5px;line-height:1.45;color:#a9c3d2}
footer p{max-width:1150px} footer b{color:#f3fbff;font-weight:600}
footer .credit{font-family:"DM Mono",monospace;font-size:13px;text-align:right;max-width:560px}
</style></head><body><div class="stars"></div>
<div class="top"><div><p class="kicker">Blinking Sky · SPHEREx × WISE · NASA Space Apps 2026</p><h1><b>Twelve</b> cold brown dwarf candidates</h1></div>
<p class="lead">Each one is <b>there at 4 µm and gone at 3.3 µm</b>, where methane absorbs: the mark of an atmosphere colder than an oven, a few dozen light-years away.</p></div>
<div class="grid">${list.map(card).join("")}</div>
<footer><p><b>Candidates, not confirmed objects.</b> Methane dip in SPHEREx, motion in CatWISE2020, no publication found in the catalogues and lists searched; some may already be known to other teams. Types come from stacked SPHEREx photometry, not from a spectrum. Real SPHEREx images, averaged, 78″ across; the dashed circle marks the catalogued position.</p>
<p class="credit">Data: NASA/JPL-Caltech SPHEREx · NASA/IPAC IRSA · CatWISE2020<br>blinking-sky.vercel.app</p></footer>
</body></html>`);
console.log(list.map((t, i) => `${i + 1}. CWISE ${t.id} | ${t.type}±${t.typeUnc} | W2 ${t.W2.toFixed(2)} | S/N ${t.snr} | R ${t.R.toFixed(2)}±${t.eR.toFixed(2)} | ${t.pmTotal.toFixed(2)}"/yr`).join("\n"));
