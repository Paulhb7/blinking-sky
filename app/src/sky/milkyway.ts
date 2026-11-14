import * as THREE from "three";

/** The Milky Way of the landing page: the structural model of Project Atlas (bar, four arms, Orion spur, bulge and
 * disk), sampled as stars and gas clouds. A schematic of our galaxy seen from outside, not a star-by-star map.
 * Scene units are kiloparsecs; y is the north galactic pole; the Sun sits at (-8.2, 0.02, 0). */

const DEG = Math.PI / 180;
export const MILKY_WAY = {
  r0: 8.2, z0: 0.02, diskRadius: 15.5, armStart: 4.6, pitch: 12 * DEG, barAngle: 207 * DEG, barHalfLength: 4.5,
  arms: [{ phase: 207 * DEG, weight: 0.32 }, { phase: 27 * DEG, weight: 0.32 }, { phase: 297 * DEG, weight: 0.18 }, { phase: 117 * DEG, weight: 0.18 }],
  spur: { phase: Math.PI, radius: 8.35, inner: 7.4, outer: 9.3 },
};
const K = Math.tan(MILKY_WAY.pitch);
const armAngle = (arm: { phase: number }, r: number) => arm.phase - Math.log(r / MILKY_WAY.armStart) / K;
const spurAngle = (r: number) => MILKY_WAY.spur.phase - Math.log(r / MILKY_WAY.spur.radius) / K;
const polar = (r: number, phi: number, y = 0): [number, number, number] => [r * Math.cos(phi), y, r * Math.sin(phi)];

function sample(starCount: number, cloudCount: number) {
  let seed = 20261114;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const sampleRadius = (min: number, max: number, scale: number) => min - scale * Math.log(1 - random() * (1 - Math.exp(-(max - min) / scale)));
  const pickArm = () => { let u = random(); for (const arm of MILKY_WAY.arms) { u -= arm.weight; if (u <= 0) return arm; } return MILKY_WAY.arms[0]; };
  const armPoint = (r: number, phi: number, width: number, height: number) => { const dr = gauss(), dphi = gauss(); return { p: polar(r + dr * width, phi + dphi * width / r, gauss() * height), off: Math.min(1, Math.hypot(dr, dphi) / 2.5) }; };
  const { barAngle, barHalfLength, armStart, diskRadius, spur } = MILKY_WAY, cb = Math.cos(barAngle), sb = Math.sin(barAngle);
  const stars = new Float32Array(starCount * 3), tint = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const u = random(); let p: [number, number, number], t: number;
    if (u < 0.07) { p = [gauss() * 0.7, gauss() * 0.45, gauss() * 0.7]; t = 0.9 + 0.1 * random(); }
    else if (u < 0.17) { const a = Math.max(-barHalfLength, Math.min(barHalfLength, gauss() * 2)), s = gauss() * 0.55; p = [a * cb - s * sb, gauss() * 0.25, a * sb + s * cb]; t = 0.85 + 0.15 * random(); }
    else if (u < 0.42) { const r = sampleRadius(1, diskRadius + 0.5, 3.5); p = polar(r, random() * Math.PI * 2, gauss() * (0.12 + 0.01 * r)); t = 0.55 + 0.4 * random(); }
    else if (u < 0.45) { const r = spur.inner + random() * (spur.outer - spur.inner), q = armPoint(r, spurAngle(r), 0.18, 0.08); p = q.p; t = 0.15 + 0.6 * q.off; }
    else { const r = sampleRadius(armStart, diskRadius, 4), q = armPoint(r, armAngle(pickArm(), r), 0.22 + 0.035 * r, 0.08 + 0.008 * r); p = q.p; t = 0.8 * q.off; }
    stars.set(p, i * 3); tint[i] = t;
  }
  const clouds = new Float32Array(cloudCount * 3), size = new Float32Array(cloudCount);
  for (let i = 0; i < cloudCount; i++) {
    let q, r;
    if (random() < 0.06) { r = spur.inner + random() * (spur.outer - spur.inner); q = armPoint(r, spurAngle(r), 0.15, 0.05); }
    else { r = sampleRadius(armStart, diskRadius, 5); q = armPoint(r, armAngle(pickArm(), r), 0.18 + 0.02 * r, 0.05); }
    clouds.set(q.p, i * 3); size[i] = (0.7 + 0.5 * random()) * (1 - r / diskRadius * 0.5);
  }
  return { stars, tint, clouds, size };
}

const VERT = /* glsl */ `
  attribute float aTint; uniform float uSize, uPx; varying float vTint; varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = uSize * aTint * uPx / max(0.01, -mv.z);
    gl_PointSize = max(1.4, px);
    vFade = min(1.0, px / 1.4);
    vTint = aTint;
  }`;
const STAR_FRAG = /* glsl */ `
  uniform vec3 uDense, uSparse; uniform float uBright, uFade; varying float vTint;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r); gl_FragColor = vec4(mix(uDense, uSparse, vTint) * a * a * uBright * uFade, 1.0); }`;
const STAR_VERT = VERT.replace("uSize * aTint", "uSize");
const CLOUD_FRAG = /* glsl */ `
  uniform vec3 uTint; uniform float uOpacity, uFade;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r); gl_FragColor = vec4(uTint * a * uOpacity * uFade, 1.0); }`;

export class MilkyWay {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 400);
  private disk = new THREE.Group();
  private starUniforms = { uSize: { value: 0.085 }, uPx: { value: 800 }, uDense: { value: new THREE.Color("#2885ff") }, uSparse: { value: new THREE.Color("#ffa27a") }, uBright: { value: 0.3 }, uFade: { value: 1 } };
  private cloudUniforms = { uSize: { value: 2.2 }, uPx: { value: 800 }, uTint: { value: new THREE.Color("#ffd0d6") }, uOpacity: { value: 0.026 }, uFade: { value: 1 } };
  private sun = new THREE.Vector3(-MILKY_WAY.r0, MILKY_WAY.z0, 0);
  private home = { position: new THREE.Vector3(9, 13, 25), target: new THREE.Vector3(5.5, 0, 0) };
  /** 0 on the landing page, 1 once the camera has reached the Sun. */
  dive = 0;

  constructor(starCount = 280000, cloudCount = 3600) {
    const data = sample(starCount, cloudCount);
    const stars = new THREE.BufferGeometry();
    stars.setAttribute("position", new THREE.BufferAttribute(data.stars, 3)); stars.setAttribute("aTint", new THREE.BufferAttribute(data.tint, 1));
    const starPoints = new THREE.Points(stars, new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: this.starUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    const clouds = new THREE.BufferGeometry();
    clouds.setAttribute("position", new THREE.BufferAttribute(data.clouds, 3)); clouds.setAttribute("aTint", new THREE.BufferAttribute(data.size, 1));
    const cloudPoints = new THREE.Points(clouds, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CLOUD_FRAG, uniforms: this.cloudUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    starPoints.frustumCulled = cloudPoints.frustumCulled = false;
    this.disk.add(cloudPoints, starPoints); this.scene.add(this.disk);
    this.disk.rotation.y = 2.6; // the Sun starts on the near right, clear of the text
    this.scene.background = new THREE.Color("#04070d");
  }

  /** World position of the Sun in the turning disk. */
  sunWorld() { return this.sun.clone().applyMatrix4(this.disk.matrixWorld); }

  update(dt: number, width: number, height: number) {
    // The disk turns toward +phi (clockwise seen from the north pole), far faster than the real 230 million years.
    this.disk.rotation.y -= dt * 0.03; this.disk.updateMatrixWorld();
    const e = this.dive * this.dive * (3 - 2 * this.dive), sun = this.sunWorld();
    this.camera.aspect = width / height;
    // On wide screens the galaxy sits to the right of the text.
    const shift = width > 900 ? -width * 0.2 * (1 - e) : 0;
    this.camera.setViewOffset(width, height, shift, 0, width, height);
    this.camera.position.lerpVectors(this.home.position, sun.clone().add(new THREE.Vector3(0.05, 0.12, 0.3)), e);
    this.camera.lookAt(new THREE.Vector3().lerpVectors(this.home.target, sun, e));
    this.camera.updateProjectionMatrix();
    const px = height / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.starUniforms.uPx.value = this.cloudUniforms.uPx.value = px;
    this.starUniforms.uFade.value = this.cloudUniforms.uFade.value = 1 - 0.85 * Math.max(0, (e - 0.7) / 0.3);
  }
}
