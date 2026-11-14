// Muted headless screen recording of the tool. usage: node rec.mjs <outdir> <url> <steps json>
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const OUT = process.argv[2], URL_ = process.argv[3], STEPS = JSON.parse(process.argv[4]);
const PORT = 9347, profile = mkdtempSync(join(tmpdir(), "atlas-spx-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--mute-audio", "--enable-unsafe-webgpu", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1500,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0, cast = null; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => { const k = ++id; pending.set(k, resolve); ws.send(JSON.stringify({ id: k, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
const click = (text) => evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)} || b.textContent.trim().startsWith(${JSON.stringify(text)})); if (b) b.click(); return !!b; })()`);
const key = (k) => evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
try {
  let targets;
  for (let k = 0; k < 50; k++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await sleep(200); } }
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? {}); pending.delete(m.id); }
    if (m.method === "Page.screencastFrame") { cast?.(m.params); ws.send(JSON.stringify({ id: ++id, method: "Page.screencastFrameAck", params: { sessionId: m.params.sessionId } })); }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") console.log("console:", m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 400));
    if (m.method === "Runtime.exceptionThrown") console.log("exception:", m.params.exceptionDetails.exception?.description?.slice(0, 500));
  });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem('atlas-tutorial-done', '1'); if (!location.search.includes('guide')) localStorage.setItem('blinking-sky.guide.v1', 'seen'); localStorage.setItem('atlas.firstSteps.v2', 'done') } catch {}" });
  if (process.env.W) await send("Emulation.setDeviceMetricsOverride", { width: +process.env.W, height: +process.env.H, deviceScaleFactor: +(process.env.DPR ?? 1), mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.append(st); })" });
  await send("Page.navigate", { url: URL_ });
  const READY = process.env.READY ?? "Night sky";
  for (let k = 0; k < 80 && !(await evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(${JSON.stringify(READY)}))`)); k++) await sleep(500);
  await sleep(+(process.env.SETTLE ?? 3000));
  for (const [op, arg] of STEPS) {
    if (op === "click") console.log("click", arg, await click(arg));
    else if (op === "key") await key(arg);
    else if (op === "wait") await sleep(arg);
    else if (op === "eval") console.log("eval", await evaluate(arg));
    else if (op === "exact") console.log("exact", arg, await evaluate(`(() => { const b = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === ${JSON.stringify(arg)}).pop(); if (b) b.click(); return !!b; })()`));
    else if (op === "title") console.log("title", arg, await evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((b) => b.title === ${JSON.stringify(arg)} || b.getAttribute("aria-label") === ${JSON.stringify(arg)}); if (b) b.click(); return !!b; })()`));
    else if (op === "rec") { const [name, ms] = arg; const dir = join(OUT, name); mkdirSync(dir, { recursive: true }); const t0 = Date.now(); let n = 0; const lines = [];
      while (Date.now() - t0 < ms) { const t = Date.now() - t0; const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 92 }); const f = `f${String(n++).padStart(4, "0")}.jpg`; writeFileSync(join(dir, f), Buffer.from(data, "base64")); lines.push([f, t]); }
      writeFileSync(join(dir, "times.json"), JSON.stringify(lines)); console.log("rec", name, n, "frames", (n / ms * 1000).toFixed(1), "fps"); }
    else if (op === "cast") { const [name, ms] = arg; const dir = join(OUT, name); mkdirSync(dir, { recursive: true }); let n = 0, t0 = null; const lines = [];
      cast = (p) => { t0 ??= p.metadata.timestamp; const f = `f${String(n++).padStart(4, "0")}.jpg`; writeFileSync(join(dir, f), Buffer.from(p.data, "base64")); lines.push([f, Math.round((p.metadata.timestamp - t0) * 1000)]); };
      await send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 }); await sleep(ms); await send("Page.stopScreencast"); cast = null;
      writeFileSync(join(dir, "times.json"), JSON.stringify(lines)); console.log("cast", name, n, "frames", (n / ms * 1000).toFixed(1), "fps"); }
    else if (op === "save") { const [file, expr] = arg; const url = await evaluate(expr); if (url) { writeFileSync(join(OUT, file), Buffer.from(String(url).split(",")[1], "base64")); console.log("save", file); } else console.log("save failed", file); }
    else if (op === "shot") { const { data } = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(OUT, arg), Buffer.from(data, "base64")); console.log("shot", arg); }
  }
} finally { ws?.close(); chrome.kill("SIGKILL"); }
