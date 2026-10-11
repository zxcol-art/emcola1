// Research: 3D nesting dolls that act out the two paragraphs beside them.
// 1) the music label stands alone, 2) the microenvironment doll closes around it
// (competitors and Chartmetric appear), 3) the macroenvironment doll closes around
// everything (Suno orbits it). Closed shells turn see-through so the story stays visible.
import * as THREE from 'three';

const slide = document.querySelector('.doll');
const stage = slide.querySelector('.doll-stage');
const canvas = stage.querySelector('canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 899px), (max-aspect-ratio: 1/1)').matches;
let ok = false;
try { ok = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}

const VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform sampler2D map; uniform vec3 rim; uniform float uT; uniform float uGlow; uniform float uOpacity;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 base = texture2D(map, vUv).rgb;
  vec3 n = normalize(vN);
  float fres = pow(1. - abs(dot(n, normalize(vV))), 2.4);
  if (!gl_FrontFacing) { gl_FragColor = vec4(base * .3 + rim * .1, uOpacity); return; }
  float d = max(dot(n, normalize(vec3(.45, .75, .55))), 0.);
  float toon = d > .62 ? 1. : d > .28 ? .8 : .58;                       // painted, cel-shaded look
  float sheen = smoothstep(.985, 1., sin(vUv.y * 22. - uT * 1.6 + vUv.x * 6.2832) * .5 + .5) * .35;
  vec3 col = base * toon + rim * fres * (.55 + uGlow) + sheen;
  // when a shell turns see-through, its rim glows like glass
  gl_FragColor = vec4(col, mix(fres * .9 + .12, 1., uOpacity));
}`;

const PROFILE = [[0,0],[.5,0],[.57,.05],[.62,.2],[.61,.38],[.54,.55],[.46,.66],[.43,.72],[.46,.84],[.45,.98],[.39,1.1],[.27,1.2],[.12,1.26],[0,1.28]];
const SPLIT = .66;
function halves() {
  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  const bottom = pts.filter(p => p.y <= SPLIT), top = pts.filter(p => p.y >= SPLIT);
  bottom.push(new THREE.Vector2(.43, SPLIT + .015));
  return [new THREE.LatheGeometry(bottom, 64), new THREE.LatheGeometry(top, 64)];
}

function paint(kind, color, word) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 1024, y = Math.random() * 512, r = 6 + Math.random() * 8;
    g.fillStyle = 'rgba(255,255,255,.22)';
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .55, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,220,120,.6)'; g.beginPath(); g.arc(x, y, r * .45, 0, 7); g.fill();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'bottom') {
    g.fillStyle = '#FFF4E2'; g.beginPath(); g.ellipse(512, 210, 175, 210, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 8; g.stroke();
    if (word) { g.fillStyle = color; g.font = `850 ${word.length > 5 ? 74 : 92}px Anybody, sans-serif`; g.fillText(word, 512, 205); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 470, 1024, 42);
  } else {
    g.fillStyle = '#F7DCC6'; g.beginPath(); g.ellipse(512, 250, 150, 125, 0, 0, 7); g.fill();
    g.fillStyle = '#2a1b14'; g.beginPath(); g.ellipse(512, 160, 150, 52, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#1b1210';
    [452, 572].forEach(x => { g.beginPath(); g.ellipse(x, 252, 14, 20, 0, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(255,90,120,.55)';
    [430, 594].forEach(x => { g.beginPath(); g.arc(x, 300, 26, 0, 7); g.fill(); });
    g.strokeStyle = '#b3304f'; g.lineWidth = 7; g.beginPath(); g.arc(512, 300, 26, .15 * Math.PI, .85 * Math.PI); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  return t;
}

function init() {
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  const [gBottom, gTop] = halves();

  function doll(color, rim, word, s, order) {
    const mk = kind => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
      uniforms: { map: { value: paint(kind, color, word) }, rim: { value: new THREE.Color(rim) }, uT: { value: 0 }, uGlow: { value: 0 }, uOpacity: { value: 1 } }
    });
    const grp = new THREE.Group();
    const bottom = new THREE.Mesh(gBottom, mk('bottom')), top = new THREE.Mesh(gTop, mk('top'));
    bottom.rotation.y = top.rotation.y = Math.PI;       // painted front toward the camera
    bottom.renderOrder = top.renderOrder = order;
    grp.add(bottom, top); grp.scale.setScalar(s); scene.add(grp);
    const set = (op, glow, t) => [bottom, top].forEach(m => {
      m.material.uniforms.uOpacity.value = op; m.material.uniforms.uGlow.value = glow; m.material.uniforms.uT.value = t;
      m.material.depthWrite = op > .99; m.visible = op > .01;
    });
    return { grp, bottom, top, set };
  }
  const label = doll('#F2B40C', '#fff0a8', 'LABEL', .46, 0);
  const micro = doll('#E8327E', '#ffa6cb', 'MICRO', .74, 2);
  const macro = doll('#3F63F5', '#9fb4ff', 'MACRO', 1.02, 3);
  const rivals = [-1, 1].map(side => { const d = doll('#7d829c', '#c9cde0', '', .3, 1); d.side = side; return d; });

  // logos that appear in the story: Chartmetric (microenvironment) and Suno (macroenvironment)
  const loader = new THREE.TextureLoader();
  const plane = (url, w, h) => {
    const m = new THREE.MeshBasicMaterial({ map: loader.load(url), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.renderOrder = 5; scene.add(mesh); return mesh;
  };
  const chart = plane('assets/cm-wordmark-white.svg', 1.3, 1.3 * 194 / 1075);
  const suno = new THREE.Mesh(new THREE.CircleGeometry(.3, 48), new THREE.MeshBasicMaterial({ map: loader.load('assets/suno.png'), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  suno.renderOrder = 6; scene.add(suno);

  let p = 0, shown = 0;
  slide.addEventListener('dwell', e => { p = e.detail; });
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  let t = 0, last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!slide.classList.contains('vis')) return;
    if (!reduce) t += dt;
    shown += (p - shown) * (reduce ? 1 : .09);
    const x = shown;
    const e1 = ss(.22, .42, x), e2 = ss(.58, .8, x);           // micro closes, then macro closes
    const glass1 = ss(.42, .52, x), glass2 = ss(.8, .9, x);    // then each turns see-through

    label.grp.rotation.y = Math.sin(t * .7) * .25;
    label.set(1, .45, t);

    // microenvironment: the bottom slides in from the left, the top drops on
    micro.bottom.position.x = lerp(-2.2, 0, e1); micro.top.position.y = lerp(1.6, 0, e1); micro.top.rotation.z = lerp(.6, 0, e1);
    micro.grp.rotation.y = Math.sin(t * .5 + 1) * .12;
    micro.set(e1 < .01 ? 0 : lerp(1, .32, glass1), .2, t);

    // macroenvironment: the bottom slides in from the right, the top drops on
    macro.bottom.position.x = lerp(2.6, 0, e2); macro.top.position.y = lerp(1.9, 0, e2); macro.top.rotation.z = lerp(-.6, 0, e2);
    macro.grp.rotation.y = Math.sin(t * .4 + 2) * .1;
    macro.set(e2 < .01 ? 0 : lerp(1, .26, glass2), .15, t);

    // competitors of the act, in a similar genre, sit beside the microenvironment
    const rivalsOn = ss(.3, .45, x) * (1 - ss(.56, .66, x));
    rivals.forEach((d, i) => {
      d.grp.position.set(d.side * 1.05, Math.abs(Math.sin(t * 2 + i)) * .05, -.1);
      d.grp.rotation.y = Math.sin(t + i) * .3;
      d.set(rivalsOn, .1, t);
    });
    chart.material.opacity = rivalsOn; chart.visible = rivalsOn > .01;
    chart.position.set(0, 1.25 + Math.sin(t * 1.4) * .04, .1);
    chart.lookAt(camera.position);

    // Suno, a technological factor, orbits the macroenvironment
    const sunoOn = ss(.7, .85, x);
    suno.material.opacity = sunoOn; suno.visible = sunoOn > .01;
    const a = t * .8;
    suno.position.set(Math.cos(a) * 1.3, .75 + Math.sin(a * 1.3) * .15, Math.sin(a) * .7);
    suno.lookAt(camera.position);

    const z = lerp(lerp(3.1, 4.6, e1), 6.4, e2), ty = lerp(lerp(.32, .45, e1), .62, e2);
    camera.position.set(0, ty + .55, z); camera.lookAt(0, ty, 0);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
  stage.classList.add('gl-doll');   // the static fallback shows until the scene is up
}

// the fallback text stays neutral while loading; it only says so once we know the scene can't run
const failed = () => { stage.querySelector('.doll-fallback p').textContent = 'Label, microenvironment, macroenvironment: the 3D nesting dolls could not load here.'; };
if (ok) document.fonts.load('800 60px Anybody').catch(() => {}).then(init).catch(e => { console.warn('dolls disabled', e); failed(); });
else failed();
