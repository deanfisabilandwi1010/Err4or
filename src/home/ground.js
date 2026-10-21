/* ==========================================================================
   ground.js — one full-screen shader that is two things:

   1. THE TEAR (block 01 → 02, scrubbed by scroll). Multi-octave noise is added
      to the signed distance of a sweep BEFORE the threshold, so the boundary
      tears into shards instead of sliding. The mask is sampled three times at
      slightly different heights, one per channel, so the edge – and only the
      edge – fringes colour. A frost band of fine noise rides the boundary.
      Default style 'sparkle': ahead of the front, a field of round dots
      (pitch 9px, Ø6px) eats the outgoing black, and the brightest 0.5% carry a
      four-point flare.
   2. THE GROUND of block 02 wherever the tear has passed: paper with a
      dot-matrix terrain – dots whose radius follows a slow FBM heightmap, so it
      reads as fog or a topographic map made of halftone.

   Drawn on a canvas that sits ABOVE block 01 and BELOW block 02's content.
   ========================================================================== */

import * as THREE from 'three';
import { NOISE } from '../three/fluid.js';

export const GROUND_CONFIG = {
  paper: '#f2f2f2', dot: '#cfcfcf', pitch: 6, dotMax: 3, scale: 0.004, drift: 0.02,
  tearNoise: 0.12, aberration: 0.004, frost: 0.03, sparklePitch: 9, sparkleDot: 3,
};

const frag = /* glsl */ `
  precision highp float;
  uniform float uProgress, uFooter, uTime, uDpr, uPitch, uDotMax, uScale, uDrift, uTearNoise, uAb, uFrost, uSPitch, uSDot;
  uniform vec2 uRes;
  uniform vec3 uPaper, uDot;
  ${NOISE}

  float edgeDist(vec2 uv){
    float front = mix(-.3, 1.3, uProgress);
    float d = front - uv.y;
    d += (fbm(uv * vec2(6., 3.) + vec2(0., uTime * .1)) - .5) * uTearNoise * 2.;
    return d;
  }

  void main(){
    vec2 px = gl_FragCoord.xy / uDpr;
    vec2 res = uRes / uDpr;
    vec2 uv = px / res;

    // ---- ground: halftone terrain ----
    vec2 cell = floor(px / uPitch);
    vec2 c = (cell + .5) * uPitch;
    float h = fbm(c * uScale + vec2(uTime * uDrift, uTime * uDrift * .6));
    h = smoothstep(.35 - uFooter * .12, .8, h);
    float r = h * h * uDotMax * (1. + uFooter * .25);
    float dotA = 1. - smoothstep(r - .6, r + .6, length(px - c));
    // in the red room the dots go nearly black, so under the multiply they read as dark halftone clouds
    vec3 ground = mix(uPaper, mix(uDot, vec3(.08), uFooter), dotA);

    if (uProgress >= .999) { gl_FragColor = vec4(ground, 1.); return; }

    // ---- tear ----
    float dR = edgeDist(uv + vec2(0., uAb));
    float dG = edgeDist(uv);
    float dB = edgeDist(uv - vec2(0., uAb));
    vec3 m = vec3(step(0., dR), step(0., dG), step(0., dB));

    // sparkle dots ahead of the front
    vec2 sc = floor(px / uSPitch);
    vec2 scc = (sc + .5) * uSPitch;
    float sd = edgeDist(scc / res);
    float grow = smoothstep(-.14, 0., sd);
    float rnd = h21(sc);
    float dotR = uSDot * grow * step(.25, rnd + grow * .8);
    float dots = 1. - smoothstep(dotR - .5, dotR + .5, length(px - scc));
    // four-point flare on the brightest few riding the edge
    float flare = 0.;
    if (rnd > .995 && sd > -.07 && sd < .01) {
      vec2 q = abs(px - scc);
      flare = max(1. - smoothstep(0., 1., q.y) , 0.) * (1. - smoothstep(0., 14., q.x))
            + max(1. - smoothstep(0., 1., q.x) , 0.) * (1. - smoothstep(0., 14., q.y));
      flare = clamp(flare, 0., 1.);
    }

    float a = max(max(m.r, max(m.g, m.b)), max(dots, flare));
    // per-channel mask: where the three disagree (only ever at the edge) the paper fringes colour
    vec3 col = ground * m;
    col = max(col, vec3(dots) * mix(ground, vec3(1.), .6));
    // frost: crystalline crust on the boundary
    float band = exp(-pow(dG / uFrost, 2.));
    col = mix(col, vec3(.85, .9, 1.) * (.75 + .5 * vnoise(px * .6)), band * .5);
    col = max(col, vec3(flare));
    gl_FragColor = vec4(col * a, a);
  }
`;

export function createGround(canvas, overrides = {}) {
  const cfg = { ...GROUND_CONFIG, ...overrides };
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false });
  renderer.setClearColor(0x000000, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 }, uFooter: { value: 0 }, uTime: { value: 0 }, uDpr: { value: 1 }, uRes: { value: new THREE.Vector2() },
      uPaper: { value: new THREE.Color(cfg.paper) }, uDot: { value: new THREE.Color(cfg.dot) },
      uPitch: { value: cfg.pitch }, uDotMax: { value: cfg.dotMax }, uScale: { value: cfg.scale }, uDrift: { value: cfg.drift },
      uTearNoise: { value: cfg.tearNoise }, uAb: { value: cfg.aberration }, uFrost: { value: cfg.frost },
      uSPitch: { value: cfg.sparklePitch }, uSDot: { value: cfg.sparkleDot },
    },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    mat.uniforms.uDpr.value = dpr;
    mat.uniforms.uRes.value.set(innerWidth * dpr, innerHeight * dpr);
  };
  resize();
  addEventListener('resize', resize);
  let cleared = false;

  return {
    uniforms: mat.uniforms,
    update(t, progress, footer = 0) {
      if (progress <= 0) {
        if (!cleared) { renderer.clear(); cleared = true; }
        return;
      }
      cleared = false;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uProgress.value = progress;
      mat.uniforms.uFooter.value = footer;
      renderer.render(scene, camera);
    },
    dispose() {
      removeEventListener('resize', resize);
      mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
