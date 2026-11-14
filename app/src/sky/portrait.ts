import * as THREE from "three";

/** What the object might look like, drawn from what was measured: an illustration, never an image.
 * - kind: what the measurements say it is;
 * - temperature (K): from the fitted spectral type, sets the colour;
 * - methane (0–1): depth of the methane dip, sets the banding and the violet cast;
 * - brightness (0–1): the flux at the current date or colour, relative to its maximum. */
export type PortraitLook = { kind: "dwarf" | "star" | "unknown"; temperature: number; methane: number; brightness: number; seed: number };

const VERT = /* glsl */ `varying vec3 vN; varying vec3 vP; void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
  varying vec3 vN; varying vec3 vP;
  uniform float uTime, uTemp, uMethane, uBright, uSeed, uStar, uFade, uUnknown;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
  void main() {
    vec3 n = normalize(vN);
    float mu = max(0.0, n.z);
    // Rotate the surface pattern, not the lighting.
    float a = uTime * 0.07; vec3 p = vec3(vP.x * cos(a) - vP.z * sin(a), vP.y, vP.x * sin(a) + vP.z * cos(a)) + uSeed;
    vec3 colour;
    if (uStar > 0.5) {
      // A cool star: granulation and a few dark spots, limb-darkened.
      float g = fbm(p * 7.0 + uTime * 0.03), spots = smoothstep(0.62, 0.7, fbm(p * 2.2 + 11.0));
      vec3 base = mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.78, 0.5), clamp((uTemp - 2600.0) / 2400.0, 0.0, 1.0));
      colour = base * (0.72 + 0.5 * g) * (1.0 - 0.55 * spots) * (0.45 + 0.75 * pow(mu, 0.6)) * 1.25;
    } else {
      // A brown dwarf: hot ones glow dull magenta, cold ones fade to violet-brown; methane deepens the bands.
      float t = clamp((uTemp - 350.0) / 950.0, 0.0, 1.0);
      vec3 warm = vec3(0.82, 0.34, 0.36), cold = vec3(0.26, 0.15, 0.36);
      vec3 base = mix(cold, warm, t);
      float lat = p.y + 0.10 * fbm(p * 3.0 + vec3(0.0, 0.0, uTime * 0.02));
      float bands = 0.5 + 0.5 * sin(lat * 13.0 + 3.0 * fbm(vec3(p.x * 1.5, lat * 5.0, p.z * 1.5)));
      float storms = smoothstep(0.58, 0.72, fbm(p * 4.0 + 5.0));
      vec3 dark = base * mix(0.75, 0.32, uMethane) * vec3(0.9, 0.85, 1.12);
      colour = mix(dark, base * 1.18, bands);
      colour = mix(colour, base * 1.5 + vec3(0.08, 0.03, 0.0), storms * 0.35 * (1.0 - uMethane * 0.5));
      colour *= 0.35 + 0.85 * pow(mu, 0.75);
      colour += base * 0.22 * t;   // self-glow of the warmer dwarfs
    }
    if (uUnknown > 0.5) {
      // Nothing measured says what this is: a plain grey body, on purpose.
      colour = vec3(0.34, 0.38, 0.45) * (0.8 + 0.35 * fbm(p * 3.0)) * (0.25 + 0.8 * pow(mu, 0.8));
    }
    float rim = pow(1.0 - mu, 3.0);
    vec3 rimTint = uUnknown > 0.5 ? vec3(0.4, 0.5, 0.65) : uStar > 0.5 ? vec3(1.0, 0.5, 0.25) : mix(vec3(0.45, 0.3, 0.75), vec3(0.9, 0.45, 0.5), clamp((uTemp - 350.0) / 950.0, 0.0, 1.0));
    colour += rimTint * rim * 0.55;
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
  private uniforms = { uTime: { value: 0 }, uTemp: { value: 800 }, uMethane: { value: 0.8 }, uBright: { value: 1 }, uSeed: { value: 0 }, uStar: { value: 0 }, uFade: { value: 1 }, uUnknown: { value: 0 } };
  private glowUniforms = { uColour: { value: new THREE.Color(0.6, 0.3, 0.5) }, uPower: { value: 0.5 }, uFade: { value: 1 } };
  private target: PortraitLook | null = null;
  private bright = 1;
  active = false;

  constructor() {
    this.camera.position.set(0, 0, 5.2);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true }));
    this.ball.rotation.z = 0.22;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: this.glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.position.z = -1.2;
    this.scene.add(this.glow, this.ball);
  }

  set(look: PortraitLook | null) {
    this.target = look; this.active = Boolean(look);
    if (!look) return;
    this.uniforms.uTemp.value = look.temperature; this.uniforms.uMethane.value = look.methane; this.uniforms.uSeed.value = look.seed; this.uniforms.uStar.value = look.kind === "star" ? 1 : 0; this.uniforms.uUnknown.value = look.kind === "unknown" ? 1 : 0;
    const t = Math.max(0, Math.min(1, (look.temperature - 350) / 950));
    if (look.kind === "unknown") this.glowUniforms.uColour.value.setRGB(0.3, 0.38, 0.5); else if (look.kind === "star") this.glowUniforms.uColour.value.setRGB(1.0, 0.45, 0.2); else this.glowUniforms.uColour.value.setRGB(0.4 + 0.5 * t, 0.25 + 0.1 * t, 0.6 - 0.2 * t);
    this.glowUniforms.uPower.value = look.kind === "unknown" ? 0.18 : look.kind === "star" ? 0.9 : 0.25 + 0.4 * t;
  }

  render(renderer: THREE.WebGLRenderer, x: number, y: number, size: number, dt: number, fade: number) {
    if (!this.target) return;
    this.uniforms.uTime.value += dt;
    this.bright += (this.target.brightness - this.bright) * Math.min(1, dt * 5);
    this.uniforms.uBright.value = this.bright; this.uniforms.uFade.value = this.glowUniforms.uFade.value = Math.max(0, Math.min(1, fade));
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
