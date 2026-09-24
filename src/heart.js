import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, AmbientLight, DirectionalLight,
  WebGLRenderTarget, Mesh, ShaderMaterial, PlaneGeometry, Box3, Vector3, Group, Vector2,
  LinearFilter, NoToneMapping, DoubleSide,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pulse, onFrame, STILL } from './pulse.js';
import { tokenRGB } from './ink.js';

// The anatomical heart is lit normally into an offscreen target, then screened
// like a three-colour riso print on cobalt stock: a white plate for the light
// (15°), a cyan plate for the mid-tones (75°) and a navy key plate for shadow
// (45°). Dot area is proportional to tone, so vessels read as dense ink.

const halftoneFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uCell;
  uniform float uGrow;
  uniform vec3 uLight;
  uniform vec3 uMid;
  uniform vec3 uDark;
  varying vec2 vUv;

  vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  float tone(vec4 s) {
    float L = mix(max(s.r, max(s.g, s.b)), dot(s.rgb, vec3(0.299, 0.587, 0.114)), 0.35);
    return 1.0 - clamp((L - 0.03) / 0.42, 0.0, 1.0);   // 1 = darkest
  }

  // coverage of one screen; plate 0 = light, 1 = mid, 2 = dark
  float screen(vec2 frag, float ang, int plate) {
    vec2 p = rot(frag, ang);
    vec2 ci = floor(p / uCell);
    float cov = 0.0;
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 cell = ci + vec2(float(dx), float(dy));
        vec2 c = (cell + 0.5) * uCell;
        vec4 s = texture2D(tScene, rot(c, -ang) / uRes);
        float t = tone(s);
        float a;
        if (plate == 0) a = s.a * (0.06 + 0.86 * pow(1.0 - t, 1.25));
        else if (plate == 1) a = s.a * smoothstep(0.22, 0.5, t) * (1.0 - smoothstep(0.62, 0.9, t)) * 0.5;
        else a = s.a * smoothstep(0.5, 1.0, t) * 0.88;
        float g = clamp(uGrow * 1.7 - hash(cell + float(plate) * 17.0) * 0.7, 0.0, 1.0);
        float r = uCell * sqrt(a / 3.14159) * g;
        float d = length(p - c);
        // fade the AA edge out for vanishing dots, or empty cells leave a speck
        cov = max(cov, (1.0 - smoothstep(r - 0.7, r + 0.7, d)) * smoothstep(0.0, 0.8, r));
      }
    }
    return cov;
  }

  void main() {
    vec2 frag = vUv * uRes;
    float kL = screen(frag + vec2(0.6, -0.4), 0.2618, 0);
    float kM = screen(frag + vec2(-0.5, 0.3), 1.309, 1);
    float kD = screen(frag, 0.7854, 2);
    // premultiplied "over", light → mid → dark
    vec3 col = uLight * kL;
    float a = kL;
    col = uMid * kM + col * (1.0 - kM);  a = kM + a * (1.0 - kM);
    col = uDark * kD + col * (1.0 - kD); a = kD + a * (1.0 - kD);
    gl_FragColor = vec4(col, a);
  }
`;

const passVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function plateColor(el, name, fallback) {
  const [r, g, b] = tokenRGB(el, name, fallback);
  return [r / 255, g / 255, b / 255];
}

export function initHeart(root, { reduced, modelUrl }) {
  const canvas = root.querySelector('canvas');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('no-gl');
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NoToneMapping;

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.1, 100);
  scene.add(new AmbientLight(0xffffff, 0.75));
  const key = new DirectionalLight(0xffffff, 3.6); key.position.set(-1.8, 2.2, 3.8); scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.7); fill.position.set(2.5, -1.2, 2); scene.add(fill);
  const rim = new DirectionalLight(0xffffff, 2.2); rim.position.set(1.5, 1.8, -3.5); scene.add(rim);

  const pivot = new Group();
  scene.add(pivot);

  const target = new WebGLRenderTarget(2, 2, { minFilter: LinearFilter, magFilter: LinearFilter });
  const post = new ShaderMaterial({
    vertexShader: passVert,
    fragmentShader: halftoneFrag,
    uniforms: {
      tScene: { value: target.texture },
      uRes: { value: new Vector2(2, 2) },
      uCell: { value: 8 },
      uGrow: { value: 0 },
      uLight: { value: new Vector3(...plateColor(root, '--heart-light', '#f4f7ff')) },
      uMid: { value: new Vector3(...plateColor(root, '--heart-mid', '#62d6ff')) },
      uDark: { value: new Vector3(...plateColor(root, '--heart-dark', '#081338')) },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new Scene();
  postScene.add(new Mesh(new PlaneGeometry(2, 2), post));
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let W = 1, H = 1, dpr = 1, ready = false, visible = true;
  let grow = STILL ? 1 : 0, t = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let baseScale = 1;

  function resize() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, W < 560 ? 1.75 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    target.setSize(Math.round(W * dpr), Math.round(H * dpr));
    post.uniforms.uRes.value.set(Math.round(W * dpr), Math.round(H * dpr));
    // ~7 css px screen on desktop, a touch finer on phones
    post.uniforms.uCell.value = (W < 480 ? 5.5 : 7) * dpr;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (reduced && ready) render();
  }

  function render() {
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(postScene, postCam);
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(modelUrl, (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.material.side = DoubleSide;
        o.material.roughness = 0.55;
        o.material.metalness = 0;
        if (o.material.normalScale) o.material.normalScale.setScalar(1.4);
      }
    });
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    model.position.sub(center);
    const s = 2 / Math.max(size.x, size.y, size.z);
    const inner = new Group();
    inner.add(model);
    inner.scale.setScalar(s);
    pivot.add(inner);
    // frame the bounding sphere with a little room for the beat
    const radius = 0.5 * Math.hypot(size.x, size.y, size.z) * s;
    camera.position.set(0, 0, (radius * 0.9) / Math.sin((camera.fov * Math.PI) / 360));
    camera.lookAt(0, 0, 0);
    baseScale = 1;
    ready = true;
    root.classList.add('is-ready');
    resize();
    if (STILL) post.uniforms.uGrow.value = 1;
    if (import.meta.env.DEV) root._debug = { render, renderer, pivot, post };
    if (reduced) { grow = 1; post.uniforms.uGrow.value = 1; pivot.rotation.set(0.05, -0.35, 0); render(); }
  }, undefined, () => root.classList.add('no-gl'));

  new ResizeObserver(resize).observe(root);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(root);

  if (reduced) return;

  window.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    pointer.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
    pointer.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
  }, { passive: true });
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pulse.excite(true); });
  root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pulse.excite(false); });
  // click / tap = defibrillate
  root.addEventListener('click', () => pulse.shock());
  const hero = root.closest('.hero');
  pulse.onShock(() => {
    for (const el of [root, hero]) {
      el.classList.remove('is-shock');
      void el.offsetWidth;          // restart the CSS animations
      el.classList.add('is-shock');
    }
    clearTimeout(root._shockT);
    root._shockT = setTimeout(() => { root.classList.remove('is-shock'); hero.classList.remove('is-shock'); }, 1200);
  });

  onFrame((dt) => {
    if (!ready || !visible || document.hidden) return;
    t += dt;
    if (grow < 1) { grow = Math.min(1, grow + dt / 1.8); post.uniforms.uGrow.value = 1 - (1 - grow) ** 3; }
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    const beat = pulse.beat;
    // a shock jolts the whole muscle, then it hangs still until rhythm returns
    const since = pulse.since;
    const jolt = since < 0.6 ? Math.exp(-since * 9) : 0;
    pivot.scale.setScalar(baseScale * (1 + beat * 0.045 + jolt * 0.1));
    pivot.rotation.y = -0.35 + Math.sin(t * 0.22) * 0.45 + pointer.x * 0.5;
    pivot.rotation.x = 0.05 + pointer.y * 0.22 + Math.sin(since * 70) * 0.05 * jolt;
    pivot.rotation.z = Math.sin(t * 0.17) * 0.04 + Math.sin(since * 90) * 0.07 * jolt;
    render();
  });
}
