import * as THREE from "three";

/** The shape of the Milky Way: the structural model of Project Atlas (bar, four arms, Orion spur, bulge and
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

// Rendering as in the H.Atlas landing galaxy (h-suite, components/Galaxy3D.tsx): each star its own size, young arm
// stars larger, old bulge and disk stars warm white and small, a slow twinkle, soft gas, one glow at the core. Blue here, violet there.
const STAR_VERT = /* glsl */ `
  attribute float aTint; attribute float aSeed; uniform float uTime, uPx, uSprite; varying vec3 vC; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vC = mix(vec3(0.16, 0.52, 1.0), vec3(1.0, 0.93, 0.9), aTint);   // young arm stars blue, old stars warm white
    vA = (0.5 + 0.2 * sin(uTime * (0.8 + aSeed) + aSeed * 50.0)) * (1.0 - 0.3 * aTint);
    // The model stands for stars too far to be measured: it fades out close to the camera.
    vA *= smoothstep(0.5, 3.0, -mv.z);
    gl_PointSize = clamp((0.07 + 0.09 * (1.0 - aTint) * aSeed) * uSprite * uPx / max(0.01, -mv.z), 1.5, 48.0);
    gl_Position = projectionMatrix * mv;
  }`;
const DISC = /* glsl */ `float disc() { float d = length(gl_PointCoord - 0.5) * 2.0; return d < 0.35 ? mix(1.0, 0.5, d / 0.35) : max(0.0, mix(0.5, 0.0, (d - 0.35) / 0.65)); }`;
const STAR_FRAG = /* glsl */ `
  uniform float uBright; varying vec3 vC; varying float vA; ${DISC}
  void main() { float t = disc() * vA * uBright; gl_FragColor = vec4(vC * t, t); }`;
const CLOUD_VERT = /* glsl */ `
  attribute float aTint; uniform float uPx, uSprite; varying float vFade;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vFade = smoothstep(0.5, 3.0, -mv.z); gl_PointSize = clamp(aTint * 2.2 * uSprite * uPx / max(0.01, -mv.z), 1.0, 240.0); gl_Position = projectionMatrix * mv; }`;
const CLOUD_FRAG = /* glsl */ `
  uniform float uOpacity; varying float vFade; ${DISC}
  void main() { float t = disc() * uOpacity * vFade; gl_FragColor = vec4(vec3(0.34, 0.56, 1.0) * t, t); }`;

/** Position of the Galactic centre when the Sun is the origin. */
export const GALACTIC_CENTRE = new THREE.Vector3(MILKY_WAY.r0, -MILKY_WAY.z0, 0);

/** The model as two point clouds and a core glow, placed so that the Sun is at the origin. `update` takes device pixels per unit angle. */
export function milkyWayDisk(starCount = 300000, cloudCount = 2600, sprite = 1) {
  const data = sample(starCount, cloudCount), density = Math.min(1, 160000 / starCount) * 0.45 + 0.55;
  const starUniforms = { uTime: { value: 0 }, uPx: { value: 800 }, uSprite: { value: sprite }, uBright: { value: density } };
  const cloudUniforms = { uPx: { value: 800 }, uSprite: { value: sprite }, uOpacity: { value: 0.045 } };
  const seed = new Float32Array(starCount); for (let i = 0; i < starCount; i++) seed[i] = ((i * 2654435761) >>> 0) / 4294967296;
  const stars = new THREE.BufferGeometry();
  stars.setAttribute("position", new THREE.BufferAttribute(data.stars, 3)); stars.setAttribute("aTint", new THREE.BufferAttribute(data.tint, 1)); stars.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const starPoints = new THREE.Points(stars, new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: starUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  const clouds = new THREE.BufferGeometry();
  clouds.setAttribute("position", new THREE.BufferAttribute(data.clouds, 3)); clouds.setAttribute("aTint", new THREE.BufferAttribute(data.size, 1));
  const cloudPoints = new THREE.Points(clouds, new THREE.ShaderMaterial({ vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, uniforms: cloudUniforms, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  starPoints.frustumCulled = cloudPoints.frustumCulled = false;
  // A soft glow at the core.
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!, g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), color: 0xe6f0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  core.scale.set(7, 7, 1);
  const group = new THREE.Group(); group.add(cloudPoints, starPoints, core); group.position.copy(GALACTIC_CENTRE);
  return { group, update: (px: number, brightness = 1, dt = 0) => {
    starUniforms.uPx.value = cloudUniforms.uPx.value = px; starUniforms.uTime.value += dt;
    starUniforms.uBright.value = density * brightness; cloudUniforms.uOpacity.value = 0.045 * brightness; core.material.opacity = 0.55 * Math.min(1, brightness);
  } };
}
