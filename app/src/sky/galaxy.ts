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
  /** What a look at it concluded, when someone has looked: found fading in methane, flagged by eye only, or set aside. */
  state?: "found" | "flagged" | "dismissed";
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
  attribute float aType; attribute float aBasis; uniform float uScale, uSize, uFar; varying vec3 vTint; varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale;
    vec3 m = vec3(1.0, 0.66, 0.40), l = vec3(1.0, 0.36, 0.28), t = vec3(0.92, 0.36, 0.66), y = vec3(0.62, 0.45, 1.0);
    vTint = aType < 10.0 ? m : aType < 20.0 ? mix(m, l, clamp((aType - 9.0) / 3.0, 0.0, 1.0)) : aType < 30.0 ? mix(l, t, clamp((aType - 19.0) / 3.0, 0.0, 1.0)) : y;
    vAlpha = mix(1.0, 0.6, aBasis) * uFar;   // estimated distances are drawn fainter than measured ones
  }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vTint; varying float vAlpha;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float core = smoothstep(0.45, 0.0, r), halo = pow(max(0.0, 1.0 - r), 2.2) * 0.5; gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.45) * (core + halo) * vAlpha, 1.0); }`;

const GAL_VERT = /* glsl */ `
  attribute float aK; uniform float uScale, uAlpha; varying float vAlpha;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(7.5 - aK * 0.42, 2.0, 5.5) * uScale;   // brighter galaxies drawn larger
    vAlpha = clamp(1.6 - aK * 0.1, 0.35, 1.0) * uAlpha;
  }`;
const GAL_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.8); gl_FragColor = vec4(vec3(0.86, 0.9, 1.0) * a * vAlpha, 1.0); }`;
/** One astronomical unit, in kiloparsecs: the Solar System is nine orders of magnitude smaller than the galaxy map. */
export const AU = 4.84813681e-9;
const OBLIQUITY = 23.4392911 * DEG;
export type SolarBody = { id: string; des: string; name: string; kind: "asteroid" | "trojan" | "comet" | "centaur" | "near-Earth"; v: number | null; rh: number | null; ra: number; dec: number; moved: number; hours: number; mjd: number; /** heliocentric, equatorial, au, at the date of its SPHEREx visit */ p: [number, number, number] };
export type Planet = { id: string; name: string; epochJd: number; e: number; i: number; node: number; peri: number; meanAnomaly: number; meanMotion: number; a: number };
/** Heliocentric place of a planet from its orbital elements (two-body motion), equatorial axes, au. `anomaly`: eccentric anomaly to trace the orbit instead. */
function planetAt(el: Planet, jd: number, anomaly?: number): [number, number, number] {
  let E = anomaly ?? 0;
  if (anomaly === undefined) { const M = ((el.meanAnomaly + el.meanMotion * (jd - el.epochJd)) % 360) * DEG; E = M; for (let k = 0; k < 12; k++) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E)); }
  const x = el.a * (Math.cos(E) - el.e), y = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const w = el.peri * DEG, O = el.node * DEG, i = el.i * DEG, cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const X = (cw * cO - sw * sO * ci) * x + (-sw * cO - cw * sO * ci) * y, Y = (cw * sO + sw * cO * ci) * x + (-sw * sO + cw * cO * ci) * y, Z = sw * si * x + cw * si * y;
  return [X, Y * Math.cos(OBLIQUITY) - Z * Math.sin(OBLIQUITY), Y * Math.sin(OBLIQUITY) + Z * Math.cos(OBLIQUITY)];
}
const BODY_VERT = /* glsl */ `
  attribute float aKind; uniform float uScale, uAlpha; varying vec3 vTint;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (aKind > 1.5 ? 5.5 : 3.6) * uScale;
    vTint = (aKind < 0.5 ? vec3(0.45, 0.78, 0.9) : aKind < 1.5 ? vec3(0.42, 0.56, 1.0) : aKind < 2.5 ? vec3(0.9, 1.0, 1.0) : aKind < 3.5 ? vec3(0.72, 0.58, 1.0) : vec3(0.6, 1.0, 0.95)) * uAlpha;
  }`;
const BODY_FRAG = /* glsl */ `
  varying vec3 vTint;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float core = smoothstep(0.6, 0.0, r), halo = pow(max(0.0, 1.0 - r), 2.0) * 0.45; gl_FragColor = vec4(vTint * (core + halo), 1.0); }`;
const KINDS = ["asteroid", "trojan", "comet", "centaur", "near-Earth"];
export type Picked = { kind: "dwarf" | "galaxy" | "body"; id?: string; index: number; name: string; type: string; group: string; ra: number; dec: number; /** parsecs */ distance: number; measured: boolean; position: THREE.Vector3 };

type Travel = { f0: THREE.Vector3; f1: THREE.Vector3; d0: number; d1: number; t: number; duration: number; done?: () => void; yaw?: number; pitch?: number };

export class Galaxy {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 1e-6, 2000);
  readonly overlay = document.createElement("div");
  private disk = milkyWayDisk();
  private starUniforms = { uScale: { value: 1 }, uSize: { value: 3 }, uFar: { value: 1 } };
  private dwarfs: { position: Float32Array; meta: DwarfMeta; sky: Float32Array; distance: Float32Array; basis: Uint8Array; group: Uint8Array } | null = null;
  private framed = false;
  private galUniforms = { uScale: { value: 1 }, uAlpha: { value: 0 } };
  private galaxies: { position: Float32Array; names: string[]; count: number } | null = null;
  private solarUniforms = { uScale: { value: 1 }, uAlpha: { value: 0 } };
  private solar: { position: Float32Array; bodies: SolarBody[]; planets: { el: Planet; at: THREE.Vector3; tag: HTMLDivElement }[]; orbits: THREE.LineBasicMaterial[]; sun: HTMLDivElement } | null = null;
  private pendingSolar: { planets: Planet[]; bodies: SolarBody[] } | null = null;
  /** True when the view is at the scale of the Solar System: planets and small bodies show, the stellar dots step back. */
  solarOn = false;
  /** Camera distance at which the selected object's picture was put on screen. */
  arrival = 0.0035;
  private rot = new THREE.Matrix3();
  private objects: GalaxyObject[] = [];
  private dots: { o: GalaxyObject; position: THREE.Vector3; el: HTMLButtonElement }[] = [];
  private lines: THREE.LineSegments | null = null;
  private rings: THREE.Line[] = [];
  private labels: { position: THREE.Vector3; el: HTMLDivElement; reach: number }[] = [];
  private here: HTMLDivElement;
  private travel: Travel | null = null;
  focus = new THREE.Vector3(); yaw = 0.9; pitch = 0.62; distance = 34;
  /** Landing page: the galaxy sits right of the text and the view orbits slowly. */
  home = true;
  selected = "";
  /** Guided introduction: 1 shows only what is published, 2 adds the unchecked sources, 3 and more everything. */
  set reveal(step: number) { this.overlay.dataset.reveal = String(step); }
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
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fc4e6, transparent: true, opacity: 0.16, depthTest: false })); this.rings.push(ring); this.scene.add(ring);
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
    if (this.pendingSolar) { this.setSolar(this.pendingSolar); this.pendingSolar = null; }
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
  /** Galaxies with a measured redshift: x, y, z (kpc), K magnitude as float32. */
  setGalaxies(buffer: ArrayBuffer, meta: { count: number; names: string[] }) {
    const data = new Float32Array(buffer), n = meta.count, position = new Float32Array(n * 3), k = new Float32Array(n);
    for (let i = 0; i < n; i++) { position.set([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]], i * 3); k[i] = Number.isFinite(data[i * 4 + 3]) ? data[i * 4 + 3] : 11.5; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(position, 3)); g.setAttribute("aK", new THREE.BufferAttribute(k, 1));
    const points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, uniforms: this.galUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    points.frustumCulled = false; points.renderOrder = 1; this.scene.add(points);
    this.galaxies = { position, names: meta.names, count: n };
  }
  /** Heliocentric equatorial au → the map's axes, kiloparsecs. */
  fromAu(p: [number, number, number]) { return new THREE.Vector3(...p).applyMatrix3(this.rot).multiplyScalar(AU); }
  /** The Solar System: the planets on their orbits, and every small body that has a SPHEREx visit, where it was that day. */
  setSolar(data: { planets: Planet[]; bodies: SolarBody[] }) {
    if (!this.framed) { this.pendingSolar = data; return; }
    if (this.solar) return;
    const n = data.bodies.length, position = new Float32Array(n * 3), kind = new Float32Array(n);
    data.bodies.forEach((b, k) => { position.set(this.fromAu(b.p).toArray(), k * 3); kind[k] = Math.max(0, KINDS.indexOf(b.kind)); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(position, 3)); g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    const points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms: this.solarUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    points.frustumCulled = false; points.renderOrder = 4; this.scene.add(points);
    const orbits: THREE.LineBasicMaterial[] = [], planets = data.planets.map((el) => {
      const pts: THREE.Vector3[] = []; for (let k = 0; k < 360; k++) pts.push(this.fromAu(planetAt(el, 0, k * DEG)));
      const material = new THREE.LineBasicMaterial({ color: el.id === "earth" ? 0x9df6ff : 0x5ef2ff, transparent: true, opacity: 0, depthTest: false }); orbits.push(material);
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), material); line.frustumCulled = false; line.renderOrder = 3; this.scene.add(line);
      const tag = this.label(`solar-planet ${el.id}`, ""); tag.innerHTML = "<i></i><span></span>"; (tag.lastChild as HTMLElement).textContent = el.name;
      return { el, at: new THREE.Vector3(), tag };
    });
    const sun = this.label("solar-sun", ""); sun.innerHTML = "<i></i><span>Sun</span>";
    this.solar = { position, bodies: data.bodies, planets, orbits, sun };
    this.setSolarDate(null);
  }
  /** The planets at a date (Julian day), or today: when a body is open, the map shows the day SPHEREx saw it. */
  setSolarDate(jd: number | null) { const day = jd ?? Date.now() / 86400000 + 2440587.5; for (const p of this.solar?.planets ?? []) p.at.copy(this.fromAu(planetAt(p.el, day))); }
  /** A view from above the plane of the planets, a little tilted. */
  eclipticView() { return this.fromAu([0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)]).normalize().multiplyScalar(0.8).add(this.fromAu([1, 0, 0]).normalize().multiplyScalar(0.6)).normalize(); }
  bodyPosition(id: string) { const s = this.solar, k = s ? s.bodies.findIndex((b) => b.id === id) : -1; return s && k >= 0 ? new THREE.Vector3(s.position[k * 3], s.position[k * 3 + 1], s.position[k * 3 + 2]) : null; }
  private bodyAt(x: number, y: number, width: number, height: number): Picked | null {
    const s = this.solar; if (!s) return null;
    const v = new THREE.Vector3(); let best = -1, bestD = 100;
    for (let k = 0; k < s.bodies.length; k++) {
      v.set(s.position[k * 3], s.position[k * 3 + 1], s.position[k * 3 + 2]).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      const dx = (v.x + 1) / 2 * width - x, dy = (1 - v.y) / 2 * height - y, q = dx * dx + dy * dy;
      if (q < bestD) { bestD = q; best = k; }
    }
    if (best < 0) return null;
    const b = s.bodies[best];
    return { kind: "body", id: b.id, index: best, name: b.name, type: b.kind, group: "Solar System", ra: b.ra, dec: b.dec, distance: 0, measured: true, position: new THREE.Vector3(s.position[best * 3], s.position[best * 3 + 1], s.position[best * 3 + 2]) };
  }

  /** What is drawn nearest to a screen point, within a few pixels: a published dwarf near the Sun, a galaxy from outside. */
  pick(x: number, y: number, width: number, height: number): Picked | null {
    const outside = this.camera.position.length() > 150, g = this.galaxies;
    if (this.solarOn) return this.bodyAt(x, y, width, height);
    if (!outside) { const d = this.dwarfAt(x, y, width, height); return d && { kind: "dwarf", ...d }; }
    if (!g) return null;
    const v = new THREE.Vector3(); let best = -1, bestD = 64;
    for (let k = 0; k < g.count; k++) {
      v.set(g.position[k * 3], g.position[k * 3 + 1], g.position[k * 3 + 2]).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      const dx = (v.x + 1) / 2 * width - x, dy = (1 - v.y) / 2 * height - y, q = dx * dx + dy * dy;
      if (q < bestD) { bestD = q; best = k; }
    }
    if (best < 0) return null;
    const position = new THREE.Vector3(g.position[best * 3], g.position[best * 3 + 1], g.position[best * 3 + 2]), [ra, dec] = this.toSky(position);
    return { kind: "galaxy", index: best, name: g.names[best] || `2MRS galaxy ${best}`, type: "galaxy", group: "2MASS Redshift Survey", ra, dec, distance: position.length() * 1000, measured: true, position };
  }
  /** A galaxy of the catalog by name, as if it had been clicked. */
  galaxyNamed(name: string): Picked | null {
    const g = this.galaxies, k = g ? g.names.indexOf(name) : -1;
    if (!g || k < 0) return null;
    const position = new THREE.Vector3(g.position[k * 3], g.position[k * 3 + 1], g.position[k * 3 + 2]), [ra, dec] = this.toSky(position);
    return { kind: "galaxy", index: k, name, type: "galaxy", group: "2MASS Redshift Survey", ra, dec, distance: position.length() * 1000, measured: true, position };
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
    const seg: number[] = [], col: number[] = [], amber = new THREE.Color("#ffb454"), cyan = new THREE.Color("#5ef2ff"), grey = new THREE.Color("#8a94a0");
    for (const o of objects) {
      const dir = this.direction(o.ra, o.dec), c = o.tone === "cand" || o.tone === "queue" ? amber : o.tone === "off" ? grey : cyan, k = o.basis === "assumed" ? 0.35 : 1;
      // The distance is a span along the line of sight, not a point.
      if (o.distance[0] !== o.distance[2] && o.basis !== "assumed") { seg.push(...dir.clone().multiplyScalar(o.distance[0] * PC).toArray(), ...dir.clone().multiplyScalar(o.distance[2] * PC).toArray()); col.push(c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k); }
      const el = document.createElement("button"); el.type = "button"; el.className = `near-object ${o.tone} ${o.basis} ${o.state ?? ""}`; el.innerHTML = "<i></i><span></span>";
      (el.lastChild as HTMLElement).textContent = o.name;
      el.setAttribute("aria-label", `${o.name}, about ${Math.round(o.distance[1] * LY)} light-years, ${o.basis} distance`); el.title = `${Math.round(o.distance[1] * LY)} light-years · ${o.basis} distance`;
      el.onclick = () => this.onPick(o.id);
      el.onpointerenter = (e) => this.onHover(o.id, e.clientX, e.clientY); el.onpointerleave = () => this.onHover(null, 0, 0);
      el.style.setProperty("--d", `${(Math.random() * 1.4).toFixed(2)}s`);   // suspects appear one after another when revealed
      this.overlay.appendChild(el); this.dots.push({ o, position: dir.multiplyScalar(o.distance[1] * PC), el });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthTest: false }));
    this.lines.renderOrder = 3; this.scene.add(this.lines);
  }
  positionOf(id: string) { return this.dots.find((d) => d.o.id === id)?.position ?? null; }

  rotate(dx: number, dy: number) { this.travel = null; this.yaw -= dx * 0.005; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.005)); }
  zoom(factor: number) { this.travel = null; this.distance = Math.max(this.focus.length() < 1e-5 ? 1.5 * AU : 4e-4, Math.min(9e5, this.distance * factor)); }
  /** Glide the focus and the zoom together; distances are interpolated in log so six orders of magnitude feel even. */
  go(focus: THREE.Vector3, distance: number, seconds: number, done?: () => void, from?: THREE.Vector3) {
    this.travel = { f0: this.focus.clone(), f1: focus.clone(), d0: this.distance, d1: distance, t: 0, duration: seconds, done };
    // `from`: where the camera should end up relative to the focus (unit vector), e.g. on the Sun's side of an object.
    if (from) { this.travel.yaw = Math.atan2(from.z, from.x); this.travel.pitch = Math.asin(Math.max(-1, Math.min(1, from.y))); }
  }
  /** A direction that looks down on the disc from its north side, keeping the current turn around it. */
  fromAbove(pitch = 0.62) { return new THREE.Vector3(Math.cos(pitch) * Math.cos(this.yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(this.yaw)); }
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
    } else if (!dragging && (this.home || (this.distance > 2 && this.distance < 150))) this.yaw += dt * (this.home ? 0.03 : 0.012);
    const p = new THREE.Vector3(Math.cos(this.pitch) * Math.cos(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch) * Math.sin(this.yaw)).multiplyScalar(this.distance).add(this.focus);
    this.camera.aspect = width / height; this.camera.near = this.distance * 0.02; this.camera.far = 5e6;   // the farthest galaxies are 700 megaparsecs away
    const shift = this.home && width > 900 ? -width * 0.2 : 0;
    if (shift) this.camera.setViewOffset(width, height, shift, 0, width, height); else this.camera.clearViewOffset();
    this.camera.position.copy(p); this.camera.lookAt(this.focus); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    const fromSun = p.length();
    const place = (v: THREE.Vector3, el: HTMLElement, show: boolean) => {
      const q = v.clone().project(this.camera), on = show && q.z < 1 && q.z > -1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05;
      el.style.display = on ? "" : "none";
      if (on) el.style.transform = `translate(${(q.x + 1) / 2 * width}px, ${(1 - q.y) / 2 * height}px)`;
    };
    // Dots stay a readable size at every zoom; the model dims once the camera is inside the disk, among the dwarfs.
    this.starUniforms.uScale.value = pixelRatio; this.starUniforms.uSize.value = fromSun > 2 ? 2.4 : fromSun > 0.3 ? 4 : 6.5;
    // Seen from outside the galaxy, the 15,739 dwarfs would pile up on one pixel: they fade out with distance.
    this.starUniforms.uFar.value = 1 - 0.985 * THREE.MathUtils.smoothstep(fromSun, 1.5, 12);
    // From far outside, our galaxy shrinks to a few pixels: its light is turned down so it does not burn out.
    this.disk.update(pixelRatio * height / (2 * Math.tan(this.camera.fov * DEG / 2)), THREE.MathUtils.lerp(0.12, 1, THREE.MathUtils.smoothstep(fromSun, 0.4, 4)) * Math.min(1, Math.pow(260 / Math.max(260, fromSun), 1.7) + 0.004), dt);
    this.galUniforms.uScale.value = pixelRatio; this.galUniforms.uAlpha.value = THREE.MathUtils.smoothstep(fromSun, 60, 600);
    (this.here.lastChild as HTMLElement).textContent = fromSun > 150 ? "Milky Way · you are here" : "You are here";
    place(new THREE.Vector3(0, 0, 0), this.here, fromSun > 0.25);
    this.here.classList.toggle("quiet", fromSun < 2);
    // At the scale of the planets the stellar dots would only be directions in the sky: they step back.
    const solarOn = this.solarOn = fromSun < 6e-6 && Boolean(this.solar), near = this.distance / AU;
    this.solarUniforms.uScale.value = pixelRatio; this.solarUniforms.uAlpha.value = 1 - THREE.MathUtils.smoothstep(fromSun, 1.2e-6, 6e-6);
    if (this.solar) {
      this.solar.orbits.forEach((m, k) => { m.opacity = this.solarUniforms.uAlpha.value * (this.solar!.planets[k].el.id === "earth" ? 0.85 : 0.38); });
      place(new THREE.Vector3(0, 0, 0), this.solar.sun, solarOn && !this.staged);
      for (const p of this.solar.planets) { place(p.at, p.tag, solarOn && !this.staged); p.tag.classList.toggle("named", p.el.id === "earth" || near < p.el.a * 14); }
    }
    for (const ring of this.rings) ring.visible = !solarOn;   // seen from the Sun they would be lines across the screen
    if (this.lines) this.lines.visible = !solarOn;
    const local = fromSun < 0.45 && !solarOn;
    for (const d of this.dots) {
      const own = d.o.id === this.selected;
      place(d.position, d.el, local && !(own && this.staged) && (d.o.basis !== "assumed" || fromSun < 0.16 || own));
      d.el.classList.toggle("on", own); d.el.classList.toggle("named", (fromSun < 0.08 && d.o.basis !== "assumed") || own);
    }
    for (const l of this.labels) place(l.position, l.el, l.reach > 0 ? fromSun > l.reach * 0.7 && fromSun < l.reach * 9 : fromSun < 0.04 && !solarOn);
  }
}
export { GALACTIC_CENTRE };
