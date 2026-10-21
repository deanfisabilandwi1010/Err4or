/* ==========================================================================
   fluid.js — the pointer-painted mask behind every reveal.

   Two small half-float targets ping-pong. Each frame the previous mask is
   sampled through an FBM displacement (so the boundary crawls instead of
   sitting still), multiplied by a decay (so it heals), and a brush is added
   along the segment the pointer travelled this frame (so a fast flick leaves a
   continuous stroke, not dots). Brush strength follows pointer SPEED: a cursor
   that stops stops painting, and the hole closes behind it.
   ========================================================================== */

import * as THREE from 'three';

const NOISE = /* glsl */ `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0., a = .5;
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.03; a *= .5; }
    return v;
  }
`;
export { NOISE };

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D uPrev;
  uniform vec2 uMouse, uPrevMouse;
  uniform float uStrength, uRadius, uDecay, uTime, uAspect;
  varying vec2 vUv;
  ${NOISE}
  float seg(vec2 p, vec2 a, vec2 b){
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0., 1.);
    return length(pa - ba * h);
  }
  void main(){
    vec2 disp = vec2(fbm(vUv * 4. + uTime * .2), fbm(vUv * 4. + vec2(5.2, 1.3) - uTime * .2)) - .5;
    float prev = texture2D(uPrev, vUv + disp * .006).r * uDecay;
    vec2 asp = vec2(uAspect, 1.);
    float d = seg(vUv * asp, uPrevMouse * asp, uMouse * asp);
    d += (fbm(vUv * 10. + uTime * .6) - .5) * uRadius * .8;   // torn brush edge
    float brush = smoothstep(uRadius, uRadius * .15, d) * uStrength;
    float v = clamp(prev + brush, 0., 1.);
    gl_FragColor = vec4(v, v, v, 1.);
  }
`;

export class Fluid {
  constructor(renderer, { size = 256, radius = 0.12, decay = 0.965, gain = 1 } = {}) {
    this.renderer = renderer;
    this.radius = radius;
    this.decay = decay;
    this.gain = gain;
    this.enabled = true;
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.a = new THREE.WebGLRenderTarget(size, size, opts);
    this.b = new THREE.WebGLRenderTarget(size, size, opts);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: this.a.texture },
        uMouse: { value: new THREE.Vector2(-1, -1) },
        uPrevMouse: { value: new THREE.Vector2(-1, -1) },
        uStrength: { value: 0 },
        uRadius: { value: radius },
        uDecay: { value: decay },
        uTime: { value: 0 },
        uAspect: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mouse = new THREE.Vector2(-1, -1);
    this.prev = new THREE.Vector2(-1, -1);
    this.clear();
  }

  get texture() { return this.a.texture; }

  clear() {
    const r = this.renderer;
    const old = r.getRenderTarget();
    r.setClearColor(0x000000, 1);
    for (const t of [this.a, this.b]) { r.setRenderTarget(t); r.clear(); }
    r.setRenderTarget(old);
    r.setClearColor(0x000000, 0);
  }

  /* uv in 0..1 of the canvas, y up */
  setPointer(u, v) { this.mouse.set(u, v); }

  update(dt, t, aspect) {
    const u = this.mat.uniforms;
    const speed = this.prev.x < 0 ? 0 : this.mouse.distanceTo(this.prev) / Math.max(dt, 1e-3);
    u.uPrevMouse.value.copy(this.prev.x < 0 ? this.mouse : this.prev);
    u.uMouse.value.copy(this.mouse);
    u.uStrength.value = this.enabled ? Math.min(0.6, speed * 1.6) * this.gain : 0;
    u.uRadius.value = this.radius;
    u.uDecay.value = Math.pow(this.decay, dt * 60);
    u.uTime.value = t;
    u.uAspect.value = aspect;
    u.uPrev.value = this.a.texture;
    const r = this.renderer;
    const old = r.getRenderTarget();
    r.setRenderTarget(this.b);
    r.render(this.scene, this.camera);
    r.setRenderTarget(old);
    [this.a, this.b] = [this.b, this.a];
    this.prev.copy(this.mouse);
  }

  dispose() {
    this.a.dispose(); this.b.dispose(); this.mat.dispose();
  }
}
