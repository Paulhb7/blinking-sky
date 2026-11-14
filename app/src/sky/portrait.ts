import * as THREE from "three";
import { milkyWayDisk } from "./milkyway";

/** What the object might look like, drawn from what was measured: an illustration, never an image.
 * - kind: what the measurements say it is;
 * - temperature (K): from the fitted spectral type, sets the colour;
 * - methane (0–1): depth of the methane dip, sets the banding and the violet cast;
 * - brightness (0–1): the flux at the current date or colour, relative to its maximum. */
export type PortraitLook = { kind: "dwarf" | "star" | "unknown" | "galaxy" | "rock" | "comet"; temperature: number; methane: number; brightness: number; seed: number };

const NOISE = /* glsl */ `
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
  vec3 turned(vec3 v, float a) { return vec3(v.x * cos(a) - v.z * sin(a), v.y, v.x * sin(a) + v.z * cos(a)); }`;
const VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vP; varying vec3 vView;
  uniform float uTime, uSeed, uRock;
  ${NOISE}
  vec3 lumpy(vec3 v) { vec3 q = turned(v, uTime * 0.16) + uSeed; return v * (0.84 + 0.66 * (fbm(q * 1.1) - 0.5) + 0.16 * (fbm(q * 3.4) - 0.5)); }
  void main() {
    vec3 pos = position, nrm = normal;
    if (uRock > 0.5) {
      // A small body is not round: the sphere is pushed in and out by a few large lumps, turning with the body.
      vec3 up = abs(normal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 t1 = normalize(cross(normal, up)), t2 = cross(normal, t1);
      vec3 a = normalize(position + t1 * 0.02), b = normalize(position + t2 * 0.02);
      pos = lumpy(position); nrm = normalize(cross(lumpy(a) - pos, lumpy(b) - pos));
    }
    vN = normalize(normalMatrix * nrm); vP = position;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0); vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  varying vec3 vN; varying vec3 vP; varying vec3 vView;
  uniform float uTime, uTemp, uMethane, uBright, uSeed, uStar, uFade, uUnknown, uRock;
  ${NOISE}
  void main() {
    vec3 n = normalize(vN);
    float mu = max(0.0, n.z);
    vec3 light = normalize(vec3(-0.55, 0.45, 0.7));
    if (uRock > 0.5) {
      // Rock: the true slope of the lumpy surface, one hard light, no atmosphere. The shape is invented.
      vec3 q = turned(vP, uTime * 0.16) + uSeed;
      // Fine relief: the slope of a small-scale height field tilts the normal.
      float e = 0.012, h0 = fbm(q * 7.0), hx = fbm((q + vec3(e, 0.0, 0.0)) * 7.0), hy = fbm((q + vec3(0.0, e, 0.0)) * 7.0);
      vec3 face = normalize(n - 1.1 * vec3(hx - h0, hy - h0, 0.0) / e * 0.06);
      float grain = fbm(q * 14.0), patches = fbm(q * 2.3 + 7.0);
      float pits = smoothstep(0.36, 0.22, noise(q * 6.5 + 3.0));
      vec3 rock = mix(vec3(0.30, 0.275, 0.25), vec3(0.58, 0.54, 0.49), patches) * (0.8 + 0.4 * grain) * (1.0 - 0.4 * pits);
      float lit = max(0.0, dot(face, light));
      vec3 c = rock * (0.03 + 1.3 * pow(lit, 0.9));
      gl_FragColor = vec4(c * (0.35 + 0.65 * uBright), uFade);
      return;
    }
    // Rotate the surface pattern, not the lighting.
    vec3 p = turned(vP, uTime * 0.07) + uSeed;
    vec3 colour;
    if (uStar > 0.5) {
      // A cool star: granulation and a few dark spots, limb-darkened.
      float g = fbm(p * 7.0 + uTime * 0.03), spots = smoothstep(0.62, 0.7, fbm(p * 2.2 + 11.0));
      vec3 base = mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.78, 0.5), clamp((uTemp - 2600.0) / 2400.0, 0.0, 1.0));
      colour = base * (0.72 + 0.5 * g) * (1.0 - 0.55 * spots) * (0.45 + 0.75 * pow(mu, 0.6)) * 1.25;
    } else {
      // A brown dwarf, drawn like a giant planet seen in its own glow: winds stretch the clouds into belts and zones,
      // with eddies between them. Warm ones are salmon and magenta, cold ones deep violet; methane darkens the belts.
      float t = clamp((uTemp - 350.0) / 950.0, 0.0, 1.0);
      vec3 base = t > 0.5 ? mix(vec3(0.86, 0.32, 0.62), vec3(1.0, 0.52, 0.38), (t - 0.5) * 2.0) : mix(vec3(0.44, 0.25, 0.78), vec3(0.86, 0.32, 0.62), t * 2.0);
      float lat = p.y;
      vec3 w = vec3(p.x * 1.3, lat * 2.6, p.z * 1.3);
      float swirl = fbm(w + vec3(0.0, 0.0, uTime * 0.015));                     // slow wandering of the belts
      float eddy = fbm(vec3(p.x * 5.0, lat * 15.0, p.z * 5.0) + swirl * 2.0);   // fine structure, stretched east–west
      float flow = lat * 8.5 + 2.2 * (swirl - 0.5) + 0.9 * (eddy - 0.5);
      float belts = 0.5 + 0.5 * sin(flow);
      belts = mix(belts, 0.5 + 0.5 * sin(flow * 2.3 + 1.7), 0.32);
      belts = smoothstep(0.18, 0.82, belts + 0.35 * (eddy - 0.5));
      vec3 belt = base * mix(0.68, 0.42, uMethane) * vec3(0.80, 0.78, 1.20);    // dark belts, bluer
      vec3 zone = base * 1.30 + vec3(0.14, 0.10, 0.08);                         // bright zones, creamier
      colour = mix(belt, zone, belts);
      // A few oval storms riding the belts.
      vec3 sp = vec3(p.x * 2.4, lat * 6.0, p.z * 2.4) + 4.0;
      float storm = smoothstep(0.70, 0.80, fbm(sp)) * (1.0 - uMethane * 0.4);
      colour = mix(colour, zone * 1.25 + vec3(0.06, 0.02, 0.0), storm * 0.7);
      colour *= 1.0 - 0.35 * smoothstep(0.55, 1.0, abs(lat));                   // darker poles
      // Light: it glows by itself, so the night side is never black; a soft day side gives it volume.
      float day = smoothstep(-0.35, 0.85, dot(n, light));
      colour *= mix(0.34, 1.18, day) * (0.6 + 0.4 * pow(mu, 0.5));
      colour += base * (0.05 + 0.16 * t) * (1.0 - day);
    }
    if (uUnknown > 0.5) {
      // Nothing measured says what this is: a plain grey body, on purpose.
      colour = vec3(0.34, 0.38, 0.45) * (0.8 + 0.35 * fbm(p * 3.0)) * (0.25 + 0.8 * pow(mu, 0.8));
    }
    float rim = pow(1.0 - mu, 3.0);
    vec3 rimTint = uUnknown > 0.5 ? vec3(0.4, 0.5, 0.65) : uStar > 0.5 ? vec3(1.0, 0.5, 0.25) : mix(vec3(0.50, 0.34, 0.95), vec3(1.0, 0.55, 0.55), clamp((uTemp - 350.0) / 950.0, 0.0, 1.0));
    colour += rimTint * rim * (uStar > 0.5 || uUnknown > 0.5 ? 0.55 : 0.75 * smoothstep(-0.6, 0.6, dot(n, light)));
    gl_FragColor = vec4(colour * (0.35 + 0.65 * uBright), uFade);
  }`;
const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv; uniform vec3 uColour; uniform float uPower, uFade;
  void main() { float r = length(vUv - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - r), 2.4) * uPower; gl_FragColor = vec4(uColour * g, g * uFade); }`;
const GLOW_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class Portrait {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private ball: THREE.Mesh;
  private glow: THREE.Mesh;
  private uniforms = { uTime: { value: 0 }, uTemp: { value: 800 }, uMethane: { value: 0.8 }, uBright: { value: 1 }, uSeed: { value: 0 }, uStar: { value: 0 }, uFade: { value: 1 }, uUnknown: { value: 0 }, uRock: { value: 0 } };
  private glowUniforms = { uColour: { value: new THREE.Color(0.6, 0.3, 0.5) }, uPower: { value: 0.5 }, uFade: { value: 1 } };
  private target: PortraitLook | null = null;
  /** A spiral galaxy, for objects that are galaxies: the same schematic model as the map, small and tilted. */
  private spiral = milkyWayDisk(26000, 300, 1.0);
  private tilt = new THREE.Group();
  private bright = 1;
  active = false;

  constructor() {
    this.camera.position.set(0, 0, 5.2);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true }));
    this.ball.rotation.z = 0.22;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: this.glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.position.z = -1.2;
    this.scene.add(this.glow, this.ball);
    this.spiral.group.position.set(0, 0, 0); this.spiral.group.scale.setScalar(0.085); this.tilt.add(this.spiral.group); this.tilt.rotation.set(1.05, 0, 0.35); this.tilt.visible = false; this.scene.add(this.tilt);
  }

  set(look: PortraitLook | null) {
    this.target = look; this.active = Boolean(look);
    if (!look) return;
    const galaxy = look.kind === "galaxy"; this.tilt.visible = galaxy; this.ball.visible = this.glow.visible = !galaxy;
    this.uniforms.uTemp.value = look.temperature; this.uniforms.uMethane.value = look.methane; this.uniforms.uSeed.value = look.seed; this.uniforms.uStar.value = look.kind === "star" ? 1 : 0; this.uniforms.uUnknown.value = look.kind === "unknown" ? 1 : 0; const small = look.kind === "rock" || look.kind === "comet"; this.uniforms.uRock.value = small ? 1 : 0;
    const t = Math.max(0, Math.min(1, (look.temperature - 350) / 950));
    if (look.kind === "comet") this.glowUniforms.uColour.value.setRGB(0.55, 0.95, 0.85); else if (look.kind === "rock") this.glowUniforms.uColour.value.setRGB(0.3, 0.3, 0.3); else if (look.kind === "unknown") this.glowUniforms.uColour.value.setRGB(0.3, 0.38, 0.5); else if (look.kind === "star") this.glowUniforms.uColour.value.setRGB(1.0, 0.45, 0.2); else this.glowUniforms.uColour.value.setRGB(0.4 + 0.5 * t, 0.25 + 0.1 * t, 0.6 - 0.2 * t);
    this.glowUniforms.uPower.value = look.kind === "comet" ? 1.5 : look.kind === "rock" ? 0.0 : look.kind === "unknown" ? 0.18 : look.kind === "star" ? 0.9 : 0.25 + 0.4 * t;
  }

  render(renderer: THREE.WebGLRenderer, x: number, y: number, size: number, dt: number, fade: number) {
    if (!this.target) return;
    this.uniforms.uTime.value += dt;
    this.bright += (this.target.brightness - this.bright) * Math.min(1, dt * 5);
    this.uniforms.uBright.value = this.bright; this.uniforms.uFade.value = this.glowUniforms.uFade.value = Math.max(0, Math.min(1, fade));
    if (this.target.kind === "galaxy") { this.spiral.group.rotation.y -= dt * 0.12; this.spiral.update(size * renderer.getPixelRatio() / (2 * Math.tan(15 * Math.PI / 180)), 1.0 * Math.max(0, Math.min(1, fade)), dt); }
    renderer.clearDepth();
    renderer.setViewport(x, y, size, size); renderer.setScissor(x, y, size, size); renderer.setScissorTest(true);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
  }
}

/** Effective temperature (K) for a fitted spectral type, a rounded reading of published type–temperature relations. */
export function temperatureOf(type: string | null | undefined): number {
  const m = /([MLTY])\s*(\d+(?:\.\d+)?)/.exec(type ?? "");
  if (!m) return 800;
  const n = Number(m[2]);
  if (m[1] === "M") return 3800 - n * 150;
  if (m[1] === "L") return 2200 - n * 90;
  if (m[1] === "T") return n <= 4 ? 1300 - n * 25 : 1200 - (n - 4) * 150;
  return Math.max(300, 450 - n * 60);
}
