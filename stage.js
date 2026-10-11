// Fixed background: a flowing noise-gradient shader tinted per chapter.
// It renders at reduced resolution, caps its frame rate on phones, and steps
// down to the static CSS gradient if the device can't keep up.
import * as THREE from 'three';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 899px), (max-aspect-ratio: 1/1)').matches;
const canvas = document.getElementById('stage');
const root = document.documentElement;
let hasGL = false;
try { hasGL = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}
const lowPower = (navigator.hardwareConcurrency || 4) <= 2 || navigator.connection?.saveData;

const ACCENT = ['#FF4F9A', '#FF4F9A', '#FFC21A', '#C9A86A', '#5B7CFF', '#3DDC97', '#FF4F9A'];
const SECOND = ['#5B7CFF', '#5B7CFF', '#FF4F9A', '#7A4CFF', '#3DDC97', '#5B7CFF', '#FFC21A'];

function init() {
  const FRAG = /* glsl */`
  precision mediump float;
  uniform float uT; uniform vec2 uRes; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg; uniform float uDark; uniform vec2 uMouse;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= .5; } return v; }
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p = uv * vec2(uRes.x/uRes.y, 1.) * 1.7;
    vec2 q = vec2(fbm(p + uT*.04), fbm(p - uT*.03 + 4.2));
    float n = fbm(p + 1.6*q + vec2(uT*.02, -uT*.015));
    float blob = smoothstep(.48, .9, n);
    vec3 glow = mix(uA, uB, smoothstep(.25, .75, q.x));
    float m = smoothstep(.55, 0., distance(uv, uMouse)) * .35;
    float strength = mix(.5, .26, uDark);
    vec3 col = mix(uBg, glow, clamp(blob*strength + m*strength, 0., 1.));
    col *= mix(1., .78 + .22*smoothstep(1.25, .25, length(uv - .5)), uDark);
    gl_FragColor = vec4(col, 1.);
  }`;

  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  let scale = small ? .5 : .6;               // the background is soft, so a fraction of full resolution is plenty
  root.classList.add('gl');

  const U = {
    uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uDark: { value: 1 }, uMouse: { value: new THREE.Vector2(.7, .6) },
    uA: { value: new THREE.Color(ACCENT[0]) }, uB: { value: new THREE.Color(SECOND[0]) }, uBg: { value: new THREE.Color('#050507') }
  };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: FRAG
  })));
  const mouseT = new THREE.Vector2(.7, .6);
  addEventListener('pointermove', e => mouseT.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight), { passive: true });
  const cA = new THREE.Color(ACCENT[0]), cB = new THREE.Color(SECOND[0]);
  const setCh = ch => { cA.set(ACCENT[ch] || ACCENT[0]); cB.set(SECOND[ch] || SECOND[0]); };
  addEventListener('chapter', e => setCh(e.detail));
  setCh(window.__chapter || 0);

  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * scale);
    renderer.setSize(innerWidth, innerHeight, false);
    U.uRes.value.copy(renderer.getDrawingBufferSize(new THREE.Vector2()));
  }
  addEventListener('resize', resize); resize();

  const bgDark = new THREE.Color('#050507'), bgLight = new THREE.Color('#ECE8F4');
  const frameGap = small ? 1000 / 30 : 0;
  let running = true, last = performance.now(), lastDraw = 0, t = 0, slow = 0, frames = 0;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(loop); } });

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (now - lastDraw < frameGap) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now; lastDraw = now;
    // watch the frame time; if the device struggles, halve the resolution, then give up gracefully
    if (++frames > 30) { slow = dt > .045 ? slow + 1 : Math.max(0, slow - 1); }
    if (slow > 40) {
      if (scale > .3) { scale /= 2; resize(); slow = 0; }
      else { running = false; root.classList.remove('gl'); canvas.remove(); return; }
    }
    if (!reduce) t += dt;
    U.uT.value = t;
    const dark = root.dataset.theme !== 'light';
    U.uDark.value += ((dark ? 1 : 0) - U.uDark.value) * .08;
    U.uBg.value.lerpColors(bgLight, bgDark, U.uDark.value);
    U.uA.value.lerp(cA, .04); U.uB.value.lerp(cB, .04);
    U.uMouse.value.lerp(mouseT, .05);
    renderer.render(scene, cam);
  }
  requestAnimationFrame(loop);
}

if (hasGL && !lowPower) try { init(); } catch (e) { console.warn('background disabled', e); }
