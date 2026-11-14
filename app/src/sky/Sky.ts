import * as THREE from "three";
import { Galaxy, GALACTIC_CENTRE, type GalaxyObject, type Picked } from "./galaxy";
import { Portrait, type PortraitLook } from "./portrait";

/** The night sky of Blinking Sky: the real bright stars, an equatorial grid, markers, and archived frames placed where
 * they were taken. One WebGL renderer; the camera sits at the centre of the celestial sphere, north up. */

const DEG = Math.PI / 180;
const R = 100;
export const TELESCOPE_FOV = 0.092; // degrees: a 125″ frame fills a little over a third of the height
export const WIDE_FOV = 60;

export const direction = (ra: number, dec: number) => new THREE.Vector3(Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG));
const toRaDec = (v: THREE.Vector3): [number, number] => [((Math.atan2(v.y, v.x) / DEG) % 360 + 360) % 360, Math.asin(Math.max(-1, Math.min(1, v.z / v.length()))) / DEG];

export type Marker = { id: string; name: string; ra: number; dec: number; tone: "cand" | "known" | "off" | "queue" };
export type FrameSpec = { ra: number; dec: number; sizeArcsec: number; image: string | HTMLCanvasElement | null; label: string };
type Insets = { left: number; right: number };

const STAR_VERT = /* glsl */ `
  attribute float mag; attribute float ci;
  uniform float uLimit; uniform float uScale;
  varying vec3 vTint; varying float vAlpha;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float size = max(2.6, 26.0 - mag * 2.9);
    gl_PointSize = size * uScale;
    vAlpha = clamp(1.3 - mag * 0.11, 0.3, 1.0) * smoothstep(uLimit + 0.4, uLimit - 0.4, mag);
    vec3 blue = vec3(0.66, 0.78, 1.0), white = vec3(1.0, 0.98, 0.95), warm = vec3(1.0, 0.72, 0.52);
    vTint = ci < 0.5 ? mix(blue, white, clamp((ci + 0.2) / 0.7, 0.0, 1.0)) : mix(white, warm, clamp((ci - 0.5) / 1.1, 0.0, 1.0));
  }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vTint; varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.22, 0.0, r), halo = pow(max(0.0, 1.0 - r), 2.6) * 0.55;
    gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.8) * (core + halo) * vAlpha, 1.0);
  }`;
// Background: night gradient and a soft band along the real Galactic plane. The glow is an illustration, not a map.
const DOME_VERT = /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DOME_FRAG = /* glsl */ `
  varying vec3 vDir; uniform float uGlow;
  const vec3 NGP = vec3(-0.8676661, -0.1980764, 0.4559838); const vec3 GC = vec3(-0.0548755, -0.8734371, -0.4838350);
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main() {
    vec3 d = normalize(vDir);
    float b = asin(clamp(dot(d, NGP), -1.0, 1.0));
    float toCentre = 0.5 + 0.5 * dot(normalize(d - NGP * dot(d, NGP)), GC);
    float width = mix(0.10, 0.20, toCentre);
    float band = exp(-b * b / (width * width)) * mix(0.35, 1.0, toCentre * toCentre);
    float dust = smoothstep(0.35, 0.75, fbm(d * 9.0 + 3.0)) * exp(-b * b / 0.004);
    float cloud = 0.55 + 0.9 * fbm(d * 5.0);
    vec3 night = mix(vec3(0.016, 0.027, 0.051), vec3(0.035, 0.062, 0.110), 0.5 + 0.5 * d.z);
    vec3 glow = mix(vec3(0.20, 0.27, 0.42), vec3(0.46, 0.40, 0.36), toCentre) * band * cloud * (1.0 - 0.75 * dust);
    gl_FragColor = vec4(night + glow * 0.34 * uGlow, 1.0);
  }`;

export class Sky {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(WIDE_FOV, 1, 0.1, 1000);
  private stars: THREE.Points | null = null;
  private starMaterial: THREE.ShaderMaterial;
  private dome: THREE.Mesh;
  private frame: THREE.Mesh;
  private outline: THREE.LineLoop;
  private frameSpec: FrameSpec | null = null;
  private texture: THREE.Texture | null = null;
  private portrait = new Portrait();
  private look = { ra: 266, dec: -20, fov: WIDE_FOV };
  private flight: { from: THREE.Vector3; to: THREE.Vector3; fov0: number; fov1: number; t: number; duration: number } | null = null;
  private overlay: HTMLDivElement;
  private markerEls = new Map<string, HTMLButtonElement>();
  private markers: Marker[] = [];
  private selected = "";
  private frameLabel: HTMLDivElement;
  private portraitLabel: HTMLDivElement;
  private pixelBox: HTMLDivElement;
  private insets: Insets = { left: 0, right: 0 };
  private raf = 0;
  private last = performance.now();
  private drag: { x: number; y: number; moved: number } | null = null;
  private disposed = false;
  /** The map: the Milky Way with the Sun at the origin. The night sky is what you see once you have reached an object. */
  private galaxy = new Galaxy();
  private mode: "galaxy" | "sky" = "galaxy";
  onLevel: (level: "galaxy" | "sky") => void = () => {};
  /** True while the camera is on its way to an object: leaving the landing page must not redirect it to the Sun. */
  private bound = false;
  private stage!: HTMLDivElement;
  private stagePortrait!: HTMLDivElement;
  private staged = false;
  /** Pointer over something in the galaxy: a published dwarf, one of the listed objects, or nothing. */
  onHover: (what: Picked | { kind: "object"; id: string } | null, x: number, y: number) => void = () => {};
  /** Where the next flight should end when the target is not one of the listed objects (a clicked dwarf). */
  destination: THREE.Vector3 | null = null;
  onPick: (id: string) => void = () => {};
  onSkyClick: (ra: number, dec: number) => void = () => {};
  onMove: (ra: number, dec: number, fov: number) => void = () => {};

  private host: HTMLElement;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "sky-canvas";
    host.appendChild(this.canvas);
    this.camera.up.set(0, 0, 1);

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(R * 4, 48, 32), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false, uniforms: { uGlow: { value: 1 } } }));
    this.scene.add(this.dome);
    this.scene.add(this.buildGrid());
    this.starMaterial = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uLimit: { value: 6.5 }, uScale: { value: 1 } } });

    this.frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false }));
    this.frame.visible = false; this.frame.renderOrder = 5; this.frame.matrixAutoUpdate = false;
    const q = 0.5 + 0.022;
    this.outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-q, -q, 0), new THREE.Vector3(q, -q, 0), new THREE.Vector3(q, q, 0), new THREE.Vector3(-q, q, 0)]),
      new THREE.LineBasicMaterial({ color: 0xf6cf8d, transparent: true, opacity: 0.7, depthTest: false }));
    this.outline.renderOrder = 6; this.outline.matrixAutoUpdate = false; this.outline.visible = false;
    this.scene.add(this.frame, this.outline);

    this.overlay = document.createElement("div"); this.overlay.className = "sky-overlay"; host.appendChild(this.overlay);
    host.appendChild(this.galaxy.overlay); this.galaxy.onPick = (id) => this.onPick(id);
    this.galaxy.onHover = (id, x, y) => this.onHover(id ? { kind: "object", id } : null, x, y);
    // In the galaxy, the selected object's picture and its 3D view are shown side by side once the camera has arrived.
    this.stage = document.createElement("div"); this.stage.className = "sky-stage"; this.stage.style.display = "none";
    this.stage.innerHTML = `<div class="sky-stage-label"></div><img alt="" /><div class="sky-stage-wait">Reading exposures from NASA&rsquo;s archive…</div><div class="sky-stage-foot">Telescope image · north up, east left · 125″ across</div>`;
    this.stagePortrait = document.createElement("div"); this.stagePortrait.className = "sky-portrait-label"; this.stagePortrait.style.display = "none";
    host.append(this.stage, this.stagePortrait);
    this.overlay.style.display = "none";
    this.frameLabel = this.tag("sky-frame-label"); this.portraitLabel = this.tag("sky-portrait-label"); this.pixelBox = this.tag("sky-pixel");

    this.canvas.addEventListener("pointerdown", this.down); window.addEventListener("pointermove", this.move); window.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("wheel", this.wheel, { passive: false });
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tag(cls: string) { const el = document.createElement("div"); el.className = cls; el.style.display = "none"; this.overlay.appendChild(el); return el; }

  private buildGrid() {
    const points: THREE.Vector3[] = [], seg = (a: THREE.Vector3, b: THREE.Vector3) => points.push(a.clone().multiplyScalar(R * 1.5), b.clone().multiplyScalar(R * 1.5));
    for (let dec = -75; dec <= 75; dec += 15) for (let ra = 0; ra < 360; ra += 3) seg(direction(ra, dec), direction(ra + 3, dec));
    for (let ra = 0; ra < 360; ra += 15) for (let dec = -87; dec < 87; dec += 3) seg(direction(ra, dec), direction(ra, dec + 3));
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x9fc4e6, transparent: true, opacity: 0.07, depthTest: false }));
    grid.renderOrder = 1; return grid;
  }

  /** Bright-star catalog: x, y, z (equatorial unit vector), magnitude, B−V as float32. */
  setStars(buffer: ArrayBuffer) {
    const data = new Float32Array(buffer), n = data.length / 5, position = new Float32Array(n * 3), mag = new Float32Array(n), ci = new Float32Array(n);
    for (let i = 0; i < n; i++) { position.set([data[i * 5] * R, data[i * 5 + 1] * R, data[i * 5 + 2] * R], i * 3); mag[i] = data[i * 5 + 3]; ci[i] = data[i * 5 + 4]; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3)); geometry.setAttribute("mag", new THREE.BufferAttribute(mag, 1)); geometry.setAttribute("ci", new THREE.BufferAttribute(ci, 1));
    this.stars = new THREE.Points(geometry, this.starMaterial); this.stars.frustumCulled = false; this.stars.renderOrder = 2;
    this.scene.add(this.stars);
  }

  setMarkers(markers: Marker[]) {
    this.markers = markers;
    this.markerEls.forEach((el) => el.remove()); this.markerEls.clear();
    for (const m of markers) {
      const el = document.createElement("button"); el.type = "button"; el.className = `sky-marker ${m.tone}`; el.setAttribute("aria-label", m.name);
      el.innerHTML = `<i></i><span></span>`; (el.lastChild as HTMLElement).textContent = m.name;
      el.onclick = () => this.onPick(m.id);
      this.overlay.appendChild(el); this.markerEls.set(m.id, el);
    }
  }
  setSelected(id: string) { this.selected = id; }
  /** Space taken by the side panels, so the telescope frame and the portrait sit in the free area. */
  setInsets(insets: Insets) { this.insets = insets; }

  setFrame(spec: FrameSpec | null) {
    this.frameSpec = spec;
    if (!spec || !spec.image) { this.frame.visible = this.outline.visible = false; return; }
    const apply = (texture: THREE.Texture) => {
      texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.LinearFilter; texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false;
      const old = this.texture; this.texture = texture;
      (this.frame.material as THREE.MeshBasicMaterial).map = texture; (this.frame.material as THREE.MeshBasicMaterial).needsUpdate = true;
      old?.dispose(); this.frame.visible = this.outline.visible = true;
    };
    if (typeof spec.image === "string") new THREE.TextureLoader().load(spec.image, (t) => { if (this.frameSpec === spec) apply(t); else t.dispose(); });
    else { const t = new THREE.CanvasTexture(spec.image); apply(t); }
    // Plane on the sphere: +X west, +Y north, facing the observer, so the picture reads north up, east left.
    const n = direction(spec.ra, spec.dec), east = new THREE.Vector3(-Math.sin(spec.ra * DEG), Math.cos(spec.ra * DEG), 0), north = new THREE.Vector3().crossVectors(n, east);
    const size = 2 * Math.tan(spec.sizeArcsec / 7200 * DEG) * R;
    const matrix = new THREE.Matrix4().makeBasis(east.clone().multiplyScalar(-size), north.clone().multiplyScalar(size), n.clone().negate()).setPosition(n.multiplyScalar(R));
    this.frame.matrix.copy(matrix); this.outline.matrix.copy(matrix);
    this.frame.matrixWorldNeedsUpdate = this.outline.matrixWorldNeedsUpdate = true;
  }
  setPortrait(look: PortraitLook | null, caption = "") { this.portrait.set(look); this.portraitLabel.innerHTML = caption; }
  setFrameOpacity(v: number) { (this.frame.material as THREE.MeshBasicMaterial).opacity = v; }

  flyTo(ra: number, dec: number, fov = TELESCOPE_FOV, seconds = 2.4) {
    if (this.mode === "galaxy") {
      // Travel through the galaxy to the object and stop on the Sun's side of it: its picture and 3D view appear there.
      const dir = this.galaxy.direction(ra, dec), at = this.galaxy.positionOf(this.selected) ?? this.destination ?? dir.clone().multiplyScalar(0.002);
      // Stop close to a star, well back from a galaxy: a few parsecs, or a few hundred thousand light-years.
      const stop = Math.max(0.0035, at.length() * 0.0025); this.galaxy.arrival = stop;
      this.destination = null; this.galaxy.home = false; this.bound = true; this.staged = false;
      this.look = { ra, dec, fov };   // so that switching to the sky view lands on the same object
      this.galaxy.go(at, stop, 3.4, () => { this.bound = false; this.staged = true; }, dir.clone().negate());
      return;
    }
    const from = direction(this.look.ra, this.look.dec), to = direction(ra, dec);
    this.flight = { from, to, fov0: this.look.fov, fov1: fov, t: 0, duration: seconds * (0.6 + 0.4 * Math.min(1, from.angleTo(to) / 0.6)) + (Math.abs(Math.log(this.look.fov / fov)) > 0.1 ? 0.4 : 0) };
  }
  wide() { this.flight = { from: direction(this.look.ra, this.look.dec), to: direction(this.look.ra, this.look.dec), fov0: this.look.fov, fov1: WIDE_FOV, t: 0, duration: 1.4 }; }
  get view() { return { ...this.look }; }

  /** Landing page on: the whole galaxy, turning. Off: fly to the Sun's surroundings. */
  setHome(on: boolean) {
    this.galaxy.home = on;
    if (on) { this.bound = false; if (this.mode === "sky") this.setMode("galaxy"); this.galaxy.go(GALACTIC_CENTRE.clone().multiplyScalar(0.8), 34, 1.6); }
    else if (this.mode === "galaxy" && !this.bound) this.galaxy.go(new THREE.Vector3(), 0.11, 3.4);
  }
  private setMode(mode: "galaxy" | "sky") {
    this.mode = mode;
    this.galaxy.overlay.style.display = mode === "galaxy" ? "block" : "none";
    this.overlay.style.display = mode === "sky" ? "block" : "none";
    this.onLevel(mode);
  }
  get level() { return this.mode; }
  setGalaxyFrame(meta: Parameters<Galaxy["setFrame"]>[0]) { this.galaxy.setFrame(meta); }
  setDwarfs(buffer: ArrayBuffer, meta: Parameters<Galaxy["setDwarfs"]>[1]) { this.galaxy.setDwarfs(buffer, meta); }
  setGalaxies(buffer: ArrayBuffer, meta: Parameters<Galaxy["setGalaxies"]>[1]) { this.galaxy.setGalaxies(buffer, meta); }
  /** Called when a published SPHEREx dwarf is clicked in the galaxy. */
  onDwarf: (picked: Picked) => void = () => {};
  setObjects(objects: GalaxyObject[]) { this.galaxy.setObjects(objects); }
  /** Which layers of dots the guided introduction lets through (4: all). Also brings the view back around the Sun. */
  setReveal(step: number, recentre = false) { this.galaxy.reveal = step; if (recentre && this.mode === "galaxy" && !this.galaxy.home) { this.staged = false; this.galaxy.go(new THREE.Vector3(), step >= 2 ? 0.075 : 0.11, 1.6); } }
  /** The two views of the same thing: the galaxy map, or the night sky. Each keeps the selected object in front. */
  goLevel(level: "galaxy" | "sky") {
    if (level === this.mode) return;
    const spec = this.frameSpec;
    if (level === "galaxy") {
      this.flight = null; this.setMode("galaxy");
      if (spec && this.selected) this.flyTo(spec.ra, spec.dec, this.look.fov);
      else this.galaxy.go(new THREE.Vector3(), 0.11, 2.2);
    } else {
      this.staged = false;
      const [ra, dec] = spec ? [spec.ra, spec.dec] : this.galaxy.toSky(this.galaxy.forward());
      this.look = { ra, dec, fov: WIDE_FOV }; this.setMode("sky");
      if (spec) this.flyTo(ra, dec, TELESCOPE_FOV, 1.8);
    }
  }
  /** Where the next flight in the galaxy should end, for an object that is not among the listed dots. */
  aimAt(ra: number, dec: number, parsecs: number) { this.destination = this.galaxy.direction(ra, dec).multiplyScalar(parsecs * 1e-3); }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
  }
  private perPixel() { return this.look.fov / this.host.clientHeight; } // degrees per CSS pixel at the centre
  private down = (e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY, moved: 0 }; this.flight = null; this.canvas.setPointerCapture(e.pointerId); };
  private hoverAt = 0;
  private hovered = -1;
  private hover = (e: PointerEvent) => {
    // Over the galaxy, report the published dwarf under the pointer: the interface previews it, and it can be clicked.
    if (this.drag || this.mode !== "galaxy" || this.galaxy.home || e.target !== this.canvas) { if (this.hovered !== -1 && e.target === this.canvas) { this.hovered = -1; this.onHover(null, 0, 0); } this.canvas.style.cursor = ""; return; }
    const now = performance.now(); if (now - this.hoverAt < 60) return; this.hoverAt = now;
    const rect = this.canvas.getBoundingClientRect(), hit = this.galaxy.pick(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    this.canvas.style.cursor = hit ? "pointer" : "";
    if ((hit?.index ?? -1) === this.hovered) return;
    this.hovered = hit?.index ?? -1;
    this.onHover(hit, e.clientX, e.clientY);
  };
  private move = (e: PointerEvent) => {
    this.hover(e);
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y, k = this.perPixel();
    this.drag.moved += Math.abs(dx) + Math.abs(dy); this.drag.x = e.clientX; this.drag.y = e.clientY;
    if (this.mode === "galaxy") { if (!this.galaxy.home) this.galaxy.rotate(dx, dy); return; }
    this.look.dec = Math.max(-89.5, Math.min(89.5, this.look.dec + dy * k));
    this.look.ra = ((this.look.ra + dx * k / Math.max(0.05, Math.cos(this.look.dec * DEG))) % 360 + 360) % 360;
  };
  private up = (e: PointerEvent) => {
    if (!this.drag) return;
    const still = this.drag.moved < 4; this.drag = null;
    if (still && e.target === this.canvas && this.mode === "galaxy" && !this.galaxy.home) {
      const rect = this.canvas.getBoundingClientRect(), hit = this.galaxy.pick(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
      if (hit) { this.hovered = -1; this.onHover(null, 0, 0); this.onDwarf(hit); }
    }
    if (still && e.target === this.canvas && this.mode === "sky") { const p = this.unproject(e.clientX, e.clientY); if (p) this.onSkyClick(p[0], p[1]); }
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault(); this.flight = null;
    const factor = Math.exp(e.deltaY * 0.0016);
    if (this.mode === "galaxy") { if (!this.galaxy.home) { this.galaxy.zoom(factor); if (this.galaxy.distance > this.galaxy.arrival * 8) this.staged = false; } return; }
    this.look.fov = Math.max(0.03, Math.min(100, this.look.fov * factor));
  };
  private unproject(clientX: number, clientY: number): [number, number] | null {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5).unproject(this.camera);
    return toRaDec(v);
  }
  private project(v: THREE.Vector3, w: number, h: number) {
    const p = v.clone().multiplyScalar(R).project(this.camera);
    return p.z > 1 || p.z < -1 ? null : { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (this.flight) {
      const f = this.flight; f.t = Math.min(1, f.t + dt / f.duration);
      const ease = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      // Turn first, then zoom: a narrow field must not sweep across the sky.
      const zoomingIn = f.fov1 < f.fov0;
      const turn = ease(Math.min(1, f.t / (zoomingIn ? 0.6 : 1))), zoom = ease(zoomingIn ? Math.max(0, (f.t - 0.35) / 0.65) : Math.min(1, f.t / 0.7));
      const dir = f.from.angleTo(f.to) < 1e-9 ? f.to : new THREE.Vector3().copy(f.from).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(f.from, f.to).slerp(new THREE.Quaternion(), 1 - turn));
      [this.look.ra, this.look.dec] = toRaDec(dir);
      this.look.fov = Math.exp(Math.log(f.fov0) + (Math.log(f.fov1) - Math.log(f.fov0)) * zoom);
      if (f.t >= 1) this.flight = null;
    }
    if (this.mode === "galaxy") {
      const g = this.galaxy; g.selected = this.selected; g.staged = this.staged;
      g.update(dt, w, h, Boolean(this.drag), this.renderer.getPixelRatio());
      this.renderer.setViewport(0, 0, w, h); this.renderer.setScissorTest(false); this.renderer.clear();
      this.renderer.render(g.scene, g.camera);
      // The object's picture on the left of the free area, its 3D view on the right.
      const spec = this.frameSpec, image = spec && typeof spec.image === "string" ? spec.image : null, show = this.staged && Boolean(this.selected) && !g.home;
      const free = w - this.insets.left - this.insets.right, wide = w > 900, twin = this.portrait.active && wide, gap = 40;
      const size = Math.max(150, Math.min(380, h * 0.42, twin ? (free - gap - 40) / 2 : free - 40)), centre = this.insets.left + free / 2;
      const x0 = twin ? centre - size - gap / 2 : centre - size / 2, y0 = h / 2 - size / 2;
      this.stage.style.display = show ? "block" : "none";
      this.galaxy.overlay.style.visibility = show ? "hidden" : "visible";   // labels and dots would sit on the picture
      this.stagePortrait.style.display = show && twin ? "block" : "none";
      if (show) {
        const img = this.stage.children[1] as HTMLImageElement, wait = this.stage.children[2] as HTMLElement;
        img.style.display = image ? "block" : "none"; wait.style.display = image ? "none" : "grid";
        if (image && img.getAttribute("src") !== image) img.src = image;
        img.style.opacity = String((this.frame.material as THREE.MeshBasicMaterial).opacity);
        (this.stage.firstChild as HTMLElement).textContent = spec?.label ?? "";
        if (spec) (this.stage.lastChild as HTMLElement).textContent = `Telescope image · north up, east left · ${spec.sizeArcsec >= 180 ? (spec.sizeArcsec / 60).toFixed(1) + "′" : Math.round(spec.sizeArcsec) + "″"} across`;
        this.stage.style.transform = `translate(${x0}px, ${y0}px)`; this.stage.style.width = `${size}px`;
        if (twin) {
          const px = x0 + size + gap;
          this.stagePortrait.innerHTML = this.portraitLabel.innerHTML; this.stagePortrait.style.left = `${px}px`; this.stagePortrait.style.top = `${y0 - 46}px`; this.stagePortrait.style.width = `${size}px`;
          this.portrait.render(this.renderer, px, h - (y0 + size), size, dt, 1);
        }
      }
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    this.stage.style.display = "none"; this.stagePortrait.style.display = "none";
    // At telescope zoom the frame moves left of the free area and the portrait takes the right.
    const tele = THREE.MathUtils.smoothstep(Math.log(0.6 / this.look.fov), 0, Math.log(0.6 / 0.2));
    const hasPortrait = this.portrait.active && this.frameSpec !== null;
    const spec = this.frameSpec, pxPerDeg = h / (2 * Math.tan(this.look.fov / 2 * DEG)) * DEG;
    const framePx = spec ? spec.sizeArcsec / 3600 * pxPerDeg : 0, gap = 44;
    const freeCentre = (this.insets.left + (w - this.insets.right)) / 2;
    const want = hasPortrait && w > 900 ? freeCentre - (Math.min(framePx, 420) + gap) / 2 : freeCentre;
    const shift = (w / 2 - want) * tele;
    this.camera.fov = this.look.fov; this.camera.setViewOffset(w, h, shift, 0, w, h);
    this.camera.position.set(0, 0, 0); this.camera.lookAt(direction(this.look.ra, this.look.dec)); this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this.starMaterial.uniforms.uLimit.value = Math.min(8.8, 6.3 + Math.max(0, Math.log2(WIDE_FOV / this.look.fov)) * 0.7);
    this.starMaterial.uniforms.uScale.value = this.renderer.getPixelRatio();
    (this.dome.material as THREE.ShaderMaterial).uniforms.uGlow.value = 1 - 0.75 * tele;
    this.renderer.setViewport(0, 0, w, h); this.renderer.setScissorTest(false); this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Overlays.
    const centre = spec ? this.project(direction(spec.ra, spec.dec), w, h) : null;
    const showFrame = Boolean(spec && centre && this.frame.visible && framePx > 40);
    this.frameLabel.style.display = showFrame ? "block" : "none";
    if (showFrame && centre && spec) { this.frameLabel.textContent = spec.label; this.frameLabel.style.left = `${centre.x - framePx / 2}px`; this.frameLabel.style.top = `${centre.y - framePx / 2 - 30}px`; }
    const native = 6.15 / 3600 * pxPerDeg;
    this.pixelBox.style.display = showFrame && native > 12 ? "block" : "none";
    if (centre) { this.pixelBox.style.left = `${centre.x}px`; this.pixelBox.style.top = `${centre.y}px`; this.pixelBox.style.width = this.pixelBox.style.height = `${native}px`; }
    const slot = Math.min(framePx, 420);
    const showPortrait = Boolean(hasPortrait && showFrame && centre && tele > 0.6 && w > 900);
    this.portraitLabel.style.display = showPortrait ? "block" : "none";
    if (showPortrait && centre) {
      const x = centre.x + framePx / 2 + gap, y = centre.y - slot / 2;
      this.portraitLabel.style.left = `${x}px`; this.portraitLabel.style.top = `${y - 46}px`; this.portraitLabel.style.width = `${slot}px`;
      this.portrait.render(this.renderer, x, h - (y + slot), slot, dt, (tele - 0.6) / 0.4);
    }
    for (const m of this.markers) {
      const el = this.markerEls.get(m.id)!, p = this.project(direction(m.ra, m.dec), w, h), own = m.id === this.selected;
      const inFrame = showFrame && centre && p && Math.abs(p.x - centre.x) < framePx / 2 + 8 && Math.abs(p.y - centre.y) < framePx / 2 + 8; // the picture speaks for itself
      const show = p && p.x > -20 && p.y > -20 && p.x < w + 20 && p.y < h + 20 && !inFrame && (m.tone !== "queue" || this.look.fov < 45 || own);
      el.style.display = show ? "flex" : "none";
      if (show && p) { el.style.transform = `translate(${p.x}px, ${p.y}px)`; el.classList.toggle("on", own); el.classList.toggle("named", own || (this.look.fov < 25 && m.tone !== "queue")); }
    }
    this.onMove(this.look.ra, this.look.dec, this.look.fov);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** A still of the portrait slot, for the candidate sheet. */
  snapshot(): string { return this.canvas.toDataURL("image/png"); }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.move); window.removeEventListener("pointerup", this.up);
    this.renderer.dispose(); this.canvas.remove(); this.overlay.remove(); this.galaxy.overlay.remove(); this.stage.remove(); this.stagePortrait.remove();
  }
}
