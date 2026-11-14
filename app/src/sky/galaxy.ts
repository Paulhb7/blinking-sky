import * as THREE from "three";
import { milkyWayDisk, GALACTIC_CENTRE } from "./milkyway";

/** One map: the Milky Way with the Sun at the origin (kiloparsecs, galactic axes of Project Atlas, y = north Galactic
 * pole). The schematic model gives the shape; 867,265 real stars sit at their measured positions around the Sun; the
 * SPHEREx fields are placed along their line of sight, at a measured, estimated or assumed distance. */

const DEG = Math.PI / 180;
const PC = 1e-3;         // kpc per parsec
const LY = 3.26156;      // light-years per parsec
export type GalaxyObject = {
  id: string; name: string; ra: number; dec: number; tone: "cand" | "known" | "off" | "queue";
  /** parsecs: nearest, best, farthest */
  distance: [number, number, number];
  /** measured: parallax; estimated: from fitted type and brightness; assumed: what it would be if it is a cold dwarf */
  basis: "measured" | "estimated" | "assumed";
};

/** Absolute W2 magnitude by spectral type. T4–T9 are replaced at load by the medians measured on the published SPHEREx
 * dwarfs that have a parallax (setRelation); Y0 and Y1 have too few of those and keep rough values from nearby Y dwarfs. */
const M_W2: Record<string, number> = { T4: 12.6, T5: 12.9, T6: 13.0, T7: 13.2, T8: 13.9, T9: 14.7, Y0: 15.0, Y1: 15.6 };
const ORDER = Object.keys(M_W2);
export function setRelation(table: Record<string, [number, number, number]>) { for (const k of ORDER) if (table[k]) M_W2[k] = table[k][0]; }
/** Distance (pc) from the WISE W2 magnitude and a spectral type: nearest, best and farthest for ±1 subtype. Null outside T4–Y1. */
export function photometricDistance(type: string | null | undefined, W2: number | null | undefined): [number, number, number] | null {
  const i = ORDER.indexOf(type ?? "");
  if (i < 0 || W2 === null || W2 === undefined || !Number.isFinite(W2)) return null;
  const d = (k: number) => 10 ** ((W2 - M_W2[ORDER[Math.max(0, Math.min(ORDER.length - 1, k))]]) / 5 + 1);
  const a = d(i + 1), b = d(i), c = d(i - 1);
  return [Math.min(a, b, c), b, Math.max(a, b, c)];
}
export type DwarfMeta = { count: number; total: number; measured: number; estimated: number; names: string[]; types: string[]; groups: string[]; absoluteW2: Record<string, [number, number, number]> };

// The published SPHEREx dwarfs: a dot each, coloured by the type SPHEREx gave it (M orange, L red, T magenta, Y violet).
const STAR_VERT = /* glsl */ `
  attribute float aType; attribute float aBasis; uniform float uScale, uSize; varying vec3 vTint; varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale;
    vec3 m = vec3(1.0, 0.66, 0.40), l = vec3(1.0, 0.36, 0.28), t = vec3(0.92, 0.36, 0.66), y = vec3(0.62, 0.45, 1.0);
    vTint = aType < 10.0 ? m : aType < 20.0 ? mix(m, l, clamp((aType - 9.0) / 3.0, 0.0, 1.0)) : aType < 30.0 ? mix(l, t, clamp((aType - 19.0) / 3.0, 0.0, 1.0)) : y;
    vAlpha = mix(1.0, 0.6, aBasis);   // estimated distances are drawn fainter than measured ones
  }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vTint; varying float vAlpha;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float core = smoothstep(0.45, 0.0, r), halo = pow(max(0.0, 1.0 - r), 2.2) * 0.5; gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.45) * (core + halo) * vAlpha, 1.0); }`;

type Travel = { f0: THREE.Vector3; f1: THREE.Vector3; d0: number; d1: number; t: number; duration: number; done?: () => void; yaw?: number; pitch?: number };

export class Galaxy {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 1e-6, 2000);
  readonly overlay = document.createElement("div");
  private disk = milkyWayDisk();
  private starUniforms = { uScale: { value: 1 }, uSize: { value: 3 } };
  private dwarfs: { position: Float32Array; meta: DwarfMeta; sky: Float32Array; distance: Float32Array; basis: Uint8Array; group: Uint8Array } | null = null;
  private framed = false;
  private rot = new THREE.Matrix3();
  private objects: GalaxyObject[] = [];
  private dots: { o: GalaxyObject; position: THREE.Vector3; el: HTMLButtonElement }[] = [];
  private lines: THREE.LineSegments | null = null;
  private labels: { position: THREE.Vector3; el: HTMLDivElement; reach: number }[] = [];
  private here: HTMLDivElement;
  private travel: Travel | null = null;
  focus = new THREE.Vector3(); yaw = 0.9; pitch = 0.5; distance = 34;
  /** Landing page: the galaxy sits right of the text and the view orbits slowly. */
  home = true;
  selected = "";
  /** True while the selected object's picture is on screen: its own dot would sit in the middle of it. */
  staged = false;
  onPick: (id: string) => void = () => {};
  /** Pointer over one of the listed objects (or off it). */
  onHover: (id: string | null, x: number, y: number) => void = () => {};

  constructor() {
    this.scene.background = new THREE.Color("#04070d");
    this.overlay.className = "near-overlay";
    this.scene.add(this.disk.group);
    this.here = this.label("galaxy-sun", "");
    this.here.innerHTML = "<i></i><span>You are here</span>";
    this.camera.up.set(0, 1, 0);
  }
  private label(cls: string, text: string) { const el = document.createElement("div"); el.className = cls; el.textContent = text; this.overlay.appendChild(el); return el; }
  /** Sky direction → galaxy frame. */
  direction(ra: number, dec: number) { return new THREE.Vector3(Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)).applyMatrix3(this.rot); }
  /** Galaxy-frame direction → right ascension and declination. */
  toSky(v: THREE.Vector3): [number, number] { const e = v.clone().normalize().applyMatrix3(this.rot.clone().transpose()); return [((Math.atan2(e.y, e.x) / DEG) % 360 + 360) % 360, Math.asin(Math.max(-1, Math.min(1, e.z))) / DEG]; }

  /** The rotation between sky and galaxy axes, distance rings, and a few named nearby stars as landmarks. */
  setFrame(meta: { equatorialToScene: number[][]; named: { name: string; p: [number, number, number]; d: number }[] }) {
    this.rot.set(...(meta.equatorialToScene.flat() as [number, number, number, number, number, number, number, number, number]));
    for (const ly of [25, 50, 100, 250, 1000]) {
      const r = ly / LY * PC, pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fc4e6, transparent: true, opacity: 0.16, depthTest: false })));
      this.labels.push({ position: new THREE.Vector3(r, 0, 0), el: this.label("near-ring", `${ly.toLocaleString("en-GB")} light-years`), reach: r });
    }
    const seen = new Set<string>(), marks: number[] = []; let count = 0;
    for (const s of meta.named) {
      const key = s.p.map((v) => v.toFixed(1)).join();
      if (seen.has(key) || count > 22) continue;
      seen.add(key); count++;
      const at = new THREE.Vector3(...s.p).applyMatrix3(this.rot).multiplyScalar(PC);
      marks.push(...at.toArray()); this.labels.push({ position: at, el: this.label("near-star", s.name), reach: -1 });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(marks, 3));
    const landmarks = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.8, depthTest: false }));
    landmarks.frustumCulled = false; landmarks.renderOrder = 2; this.scene.add(landmarks);
    this.framed = true;
    if (this.objects.length) this.setObjects(this.objects);
  }

  /** The published SPHEREx dwarfs: ra, dec (f32), distance pc (f32), type, group, basis (u8 each), one pad byte. */
  setDwarfs(buffer: ArrayBuffer, meta: DwarfMeta) {
    const view = new DataView(buffer), n = meta.count, position = new Float32Array(n * 3), type = new Float32Array(n), basis = new Float32Array(n);
    const sky = new Float32Array(n * 2), distance = new Float32Array(n), b8 = new Uint8Array(n), g8 = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      const ra = view.getFloat32(k * 16, true), dec = view.getFloat32(k * 16 + 4, true), d = view.getFloat32(k * 16 + 8, true);
      position.set(this.direction(ra, dec).multiplyScalar(d * PC).toArray(), k * 3);
      type[k] = view.getUint8(k * 16 + 12); g8[k] = view.getUint8(k * 16 + 13); b8[k] = basis[k] = view.getUint8(k * 16 + 14);
      sky[k * 2] = ra; sky[k * 2 + 1] = dec; distance[k] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3)); g.setAttribute("aType", new THREE.BufferAttribute(type, 1)); g.setAttribute("aBasis", new THREE.BufferAttribute(basis, 1));
    const points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: this.starUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    points.frustumCulled = false; points.renderOrder = 2; this.scene.add(points);
    this.dwarfs = { position, meta, sky, distance, basis: b8, group: g8 };
  }
  /** The published dwarf drawn nearest to a screen point, within a few pixels. */
  dwarfAt(x: number, y: number, width: number, height: number) {
    const d = this.dwarfs; if (!d) return null;
    const v = new THREE.Vector3(); let best = -1, bestD = 81;
    for (let k = 0; k < d.meta.count; k++) {
      v.set(d.position[k * 3], d.position[k * 3 + 1], d.position[k * 3 + 2]).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      const dx = (v.x + 1) / 2 * width - x, dy = (1 - v.y) / 2 * height - y, q = dx * dx + dy * dy;
      if (q < bestD) { bestD = q; best = k; }
    }
    return best < 0 ? null : { index: best, name: d.meta.names[best], type: d.meta.types[best], group: d.meta.groups[d.group[best]], ra: d.sky[best * 2], dec: d.sky[best * 2 + 1], distance: d.distance[best], measured: d.basis[best] === 0,
      position: new THREE.Vector3(d.position[best * 3], d.position[best * 3 + 1], d.position[best * 3 + 2]) };
  }

  setObjects(objects: GalaxyObject[]) {
    this.objects = objects;
    if (!this.framed) return;
    this.dots.forEach((d) => d.el.remove()); this.dots = [];
    if (this.lines) { this.scene.remove(this.lines); this.lines.geometry.dispose(); }
    const seg: number[] = [], col: number[] = [], amber = new THREE.Color("#f6cf8d"), cyan = new THREE.Color("#a5f3fc"), grey = new THREE.Color("#8a94a0");
    for (const o of objects) {
      const dir = this.direction(o.ra, o.dec), c = o.tone === "cand" || o.tone === "queue" ? amber : o.tone === "off" ? grey : cyan, k = o.basis === "assumed" ? 0.35 : 1;
      // The distance is a span along the line of sight, not a point.
      if (o.distance[0] !== o.distance[2] && o.basis !== "assumed") { seg.push(...dir.clone().multiplyScalar(o.distance[0] * PC).toArray(), ...dir.clone().multiplyScalar(o.distance[2] * PC).toArray()); col.push(c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k); }
      const el = document.createElement("button"); el.type = "button"; el.className = `near-object ${o.tone} ${o.basis}`; el.innerHTML = "<i></i><span></span>";
      (el.lastChild as HTMLElement).textContent = o.name;
      el.setAttribute("aria-label", `${o.name}, about ${Math.round(o.distance[1] * LY)} light-years, ${o.basis} distance`); el.title = `${Math.round(o.distance[1] * LY)} light-years · ${o.basis} distance`;
      el.onclick = () => this.onPick(o.id);
      el.onpointerenter = (e) => this.onHover(o.id, e.clientX, e.clientY); el.onpointerleave = () => this.onHover(null, 0, 0);
      this.overlay.appendChild(el); this.dots.push({ o, position: dir.multiplyScalar(o.distance[1] * PC), el });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthTest: false }));
    this.lines.renderOrder = 3; this.scene.add(this.lines);
  }
  positionOf(id: string) { return this.dots.find((d) => d.o.id === id)?.position ?? null; }

  rotate(dx: number, dy: number) { this.travel = null; this.yaw -= dx * 0.005; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.005)); }
  zoom(factor: number) { this.travel = null; this.distance = Math.max(4e-4, Math.min(90, this.distance * factor)); }
  /** Glide the focus and the zoom together; distances are interpolated in log so six orders of magnitude feel even. */
  go(focus: THREE.Vector3, distance: number, seconds: number, done?: () => void, from?: THREE.Vector3) {
    this.travel = { f0: this.focus.clone(), f1: focus.clone(), d0: this.distance, d1: distance, t: 0, duration: seconds, done };
    // `from`: where the camera should end up relative to the focus (unit vector), e.g. on the Sun's side of an object.
    if (from) { this.travel.yaw = Math.atan2(from.z, from.x); this.travel.pitch = Math.asin(Math.max(-1, Math.min(1, from.y))); }
  }
  get travelling() { return this.travel !== null; }
  /** Direction the camera looks along. */
  forward() { return this.camera.getWorldDirection(new THREE.Vector3()); }

  update(dt: number, width: number, height: number, dragging: boolean, pixelRatio: number) {
    if (this.travel) {
      const tr = this.travel; tr.t = Math.min(1, tr.t + dt / tr.duration);
      const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - Math.pow(-2 * tr.t + 2, 3) / 2;
      // Zooming in: move the focus early, then close in. Zooming out: pull back first.
      const inward = tr.d1 < tr.d0, ef = inward ? Math.min(1, e * 1.6) : Math.max(0, (e - 0.35) / 0.65), ed = inward ? Math.max(0, (e - 0.15) / 0.85) : Math.min(1, e * 1.5);
      this.focus.lerpVectors(tr.f0, tr.f1, ef);
      this.distance = Math.exp(Math.log(tr.d0) + (Math.log(tr.d1) - Math.log(tr.d0)) * ed);
      if (tr.yaw !== undefined && tr.pitch !== undefined) { const k = Math.min(1, dt * 2.6); this.yaw += Math.atan2(Math.sin(tr.yaw - this.yaw), Math.cos(tr.yaw - this.yaw)) * k; this.pitch += (tr.pitch - this.pitch) * k; }
      if (tr.t >= 1) { this.travel = null; tr.done?.(); }
    } else if (!dragging && (this.home || this.distance > 2)) this.yaw += dt * (this.home ? 0.03 : 0.012);
    const p = new THREE.Vector3(Math.cos(this.pitch) * Math.cos(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch) * Math.sin(this.yaw)).multiplyScalar(this.distance).add(this.focus);
    this.camera.aspect = width / height; this.camera.near = Math.max(1e-6, this.distance * 0.02); this.camera.far = Math.max(200, this.distance * 40);
    const shift = this.home && width > 900 ? -width * 0.2 : 0;
    if (shift) this.camera.setViewOffset(width, height, shift, 0, width, height); else this.camera.clearViewOffset();
    this.camera.position.copy(p); this.camera.lookAt(this.focus); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    const fromSun = p.length();
    // Dots stay a readable size at every zoom; the model dims once the camera is inside the disk, among the dwarfs.
    this.starUniforms.uScale.value = pixelRatio; this.starUniforms.uSize.value = fromSun > 2 ? 2.4 : fromSun > 0.3 ? 4 : 6.5;
    this.disk.update(height / (2 * Math.tan(this.camera.fov * DEG / 2)), THREE.MathUtils.lerp(0.12, 1, THREE.MathUtils.smoothstep(fromSun, 0.4, 4)));
    const place = (v: THREE.Vector3, el: HTMLElement, show: boolean) => {
      const q = v.clone().project(this.camera), on = show && q.z < 1 && q.z > -1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05;
      el.style.display = on ? "" : "none";
      if (on) el.style.transform = `translate(${(q.x + 1) / 2 * width}px, ${(1 - q.y) / 2 * height}px)`;
    };
    place(new THREE.Vector3(0, 0, 0), this.here, fromSun > 0.25);
    this.here.classList.toggle("quiet", fromSun < 2);
    const local = fromSun < 0.45;
    for (const d of this.dots) {
      const own = d.o.id === this.selected;
      place(d.position, d.el, local && !(own && this.staged) && (d.o.basis !== "assumed" || fromSun < 0.16 || own));
      d.el.classList.toggle("on", own); d.el.classList.toggle("named", (fromSun < 0.08 && d.o.basis !== "assumed") || own);
    }
    for (const l of this.labels) place(l.position, l.el, l.reach > 0 ? fromSun > l.reach * 0.7 && fromSun < l.reach * 9 : fromSun < 0.04);
  }
}
export { GALACTIC_CENTRE };
