/* ==========================================================================
   scanMaterial.js — the one shader every scanned mesh is drawn with.

   Six meshes use it (body, skeleton, mask, bust, skull, the mask's outline) and
   they differ only in uniforms. The important ones:

     uTone / uFlatten   lighting strength, and how far it is flattened toward
                        uFlatLevel. Block 02's head runs tone .05 + flatten 1 ON
                        PURPOSE: the light is turned right down and the flatten
                        carries it back to a pure white silhouette.
     uTint / uShade     the lit colour and the shadow colour; uDuo blends the
                        light ramp from one to the other (0 = tint only).
     uDots              an RGB sub-pixel mask, one dot per CSS pixel, so the
                        surface reads as a screen photographed up close.
     uIri / uScan       optional rainbow bands, and the 3px scanlines.
     uLo / uHi          the REVEAL BAND. Each layer is only drawn where the
                        fluid mask value rv is in [uLo, uHi). Body [−1,.45),
                        skeleton [.45,9): hovering wipes one into the other.
                        The head stacks three: mask, face, skull.
     uSolid             flat colour override (the outline hull).

   DISCARD, NEVER ALPHA 0: a transparent fragment still writes depth, so an
   invisible outer layer would punch a hole in the inner one.
   ========================================================================== */

import * as THREE from 'three';

const vertex = /* glsl */ `
  uniform float uTime, uBreath, uBreathRate, uBreathPhase, uExtrude;
  varying vec3 vN;
  varying vec3 vV;
  void main(){
    vec3 p = position + normal * uExtrude;
    float side = step(0.0, p.x);   // the two halves breathe slightly out of step
    p.y += sin((uTime * uBreathRate + side * uBreathPhase) * 6.2831853) * uBreath * smoothstep(.3, .9, p.y);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime, uTone, uFlatten, uFlatLevel, uIri, uScan, uGrain, uSeed, uDuo, uDots;
  uniform float uFresnel, uFresnelPow, uUseReveal, uLo, uHi, uRevGlow, uInnerGlow, uDpr;
  uniform vec3 uTint, uShade, uRevTint;
  uniform vec4 uSolid;
  uniform vec2 uResolution;
  uniform sampler2D uReveal;
  varying vec3 vN;
  varying vec3 vV;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 hsv2rgb(vec3 c){
    vec4 K = vec4(1., 2./3., 1./3., 3.);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
  }

  void main(){
    float rv = 0.;
    if (uUseReveal > .5) {
      rv = texture2D(uReveal, gl_FragCoord.xy / uResolution).r;
      if (rv < uLo || rv >= uHi) discard;
    }
    if (uSolid.a > .5) { gl_FragColor = vec4(uSolid.rgb, 1.); return; }

    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vV);
    vec2 px = gl_FragCoord.xy / uDpr;          // CSS pixels, so bands keep their size on any screen

    float lam = max(dot(n, normalize(vec3(-.4, .7, .6))), 0.);
    float s = uTone * (.25 + .75 * lam);
    s = mix(s, uFlatLevel, clamp(uFlatten, 0., 1.));
    vec3 base = vec3(s) * mix(uTint, mix(uShade, uTint, lam), uDuo);

    vec3 iri = hsv2rgb(vec3(fract(px.y / 90. + n.y * .3 + uTime * .02), .72, 1.));
    base = mix(base, base * iri * 1.4, uIri);
    base *= 1. - uScan * step(2., mod(px.y, 3.));
    float k = mod(floor(px.x) + floor(px.y), 3.);   // offset per row: dots, not stripes
    vec3 dot3 = vec3(step(k, .5), step(.5, k) * step(k, 1.5), step(1.5, k));
    base = mix(base, base * dot3 * 2.8, uDots);

    float fres = pow(1. - clamp(dot(n, v), 0., 1.), uFresnelPow) * uFresnel;
    base += fres * uTint;
    base += base * uInnerGlow;

    if (uUseReveal > .5) {
      // the fringe: brightest exactly where the wipe is passing through a band edge
      float e = min(abs(rv - uLo), abs(rv - uHi));
      base += uRevTint * (1. - smoothstep(0., .07, e)) * uRevGlow;
    }

    vec2 sp = gl_FragCoord.xy + uSeed;
    base += (vec3(hash(sp), hash(sp + 17.3), hash(sp + 41.7)) - .5) * uGrain;
    gl_FragColor = vec4(clamp(base, 0., 1.), 1.);
  }
`;

const DEFAULTS = {
  uBreath: 0, uBreathRate: 0.19, uBreathPhase: 0.14, uExtrude: 0,
  uTone: 1, uFlatten: 0, uFlatLevel: 1, uIri: 0, uScan: 0, uGrain: 0.08, uSeed: 0, uDuo: 0, uDots: 0,
  uFresnel: 0, uFresnelPow: 2.5, uUseReveal: 1, uLo: -1, uHi: 9, uRevGlow: 0, uInnerGlow: 0,
  uTint: new THREE.Color(1, 1, 1), uShade: new THREE.Color(1, 1, 1), uRevTint: new THREE.Color(1, 1, 1), uSolid: new THREE.Vector4(0, 0, 0, 0),
};

/* `shared` carries the uniform OBJECTS every layer of a stage reads (time, the
   fluid texture, resolution, dpr) so updating them once updates all of them. */
export function createScanMaterial(shared, overrides = {}, { side = THREE.FrontSide } = {}) {
  const uniforms = { ...shared };
  for (const [k, v] of Object.entries({ ...DEFAULTS, ...overrides })) {
    uniforms[k] = { value: v && v.clone ? v.clone() : v };
  }
  uniforms.uSeed.value = Math.random() * 1000;
  return new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, side });
}
