// Draws the web of galaxies from the real positions (2MASS Redshift Survey, as used by the tool). usage: node web.mjs <yaw> <pitch> <distance kpc> <out.html>
import { readFileSync, writeFileSync } from "node:fs";
const [yaw = "0.6", pitch = "0.35", dist = "420000", out = "web.html"] = process.argv.slice(2);
const b64 = readFileSync(new URL("../../app/public/data/galaxies.bin", import.meta.url)).toString("base64");
writeFileSync(new URL(out, import.meta.url), `<!doctype html><meta charset="utf-8"><style>*{margin:0}body{background:#02060d;overflow:hidden}canvas{display:block;width:1920px;height:1080px}</style><canvas id="c" width="3840" height="2160"></canvas><script>
const raw = Uint8Array.from(atob("${b64}"), (c) => c.charCodeAt(0)), f = new Float32Array(raw.buffer);
const W = 3840, H = 2160, ctx = document.getElementById("c").getContext("2d");
const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.62); bg.addColorStop(0, "#07101f"); bg.addColorStop(1, "#02050b"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
const yaw = ${yaw}, pitch = ${pitch}, D = ${dist}, focal = H / (2 * Math.tan(21 * Math.PI / 180));
const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
const pts = [];
for (let i = 0; i < f.length; i += 4) {
  const x = f[i], y = f[i + 1], z = f[i + 2], K = f[i + 3];
  const x1 = x * cy - z * sy, z1 = x * sy + z * cy, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, depth = D - z2;
  if (depth < D * 0.08) continue;
  pts.push([W / 2 + x1 * focal / depth, H / 2 - y2 * focal / depth, depth, K, i]);
}
pts.sort((a, b) => b[2] - a[2]);
ctx.globalCompositeOperation = "lighter";
const dot = (x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(" + col + "," + a + ")"); g.addColorStop(1, "rgba(" + col + ",0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); };
// A soft haze first: it lets the filaments and the voids show as shapes.
for (const [x, y, depth] of pts) { if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue; dot(x, y, 46 * D / depth, "70,120,255", 0.007); }
for (const [x, y, depth, K, i] of pts) {
  if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
  const near = D / depth, h = (Math.sin(i * 12.9898) * 43758.5453) % 1, warm = Math.abs(h) > 0.72;
  const lum = Math.max(0.25, Math.min(1, (12.4 - K) / 4.5));
  dot(x, y, (2.0 + 4.6 * lum) * near, warm ? "255,205,150" : "185,215,255", 0.3 + 0.4 * lum);
  dot(x, y, 1.2 * near, "255,255,255", 0.75);
}
// Where we are: the Milky Way, one point among them.
const ox = W / 2, oy = H / 2; dot(ox, oy, 26, "94,242,255", 0.9); dot(ox, oy, 5, "255,255,255", 1);
ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = "rgba(94,242,255,0.75)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ox, oy, 30, 0, 7); ctx.stroke();
</script>`);
