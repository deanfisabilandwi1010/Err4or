/* ==========================================================================
   loop.js — the one requestAnimationFrame on the site.

   Every module subscribes here instead of running its own rAF, so there is
   exactly one frame callback per page and DORMANCY is one switch: when the tab
   is hidden nothing runs at all, and on return dt restarts from zero instead of
   delivering one enormous step that would fling every eased value.
   ========================================================================== */

const subs = new Set();
let last = performance.now();
let running = !document.hidden;

export function onFrame(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!running) return;
  const dt = Math.min((now - last) / 1000, 1 / 20); // a dropped frame is not a reason to teleport
  last = now;
  const t = now / 1000;
  for (const fn of subs) fn(dt, t);
}
requestAnimationFrame(tick);

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  last = performance.now();
});

/* Frame-rate independent ease toward a target: the k that 1-exp(-dt*k) uses. */
export const damp = (current, target, k, dt) => current + (target - current) * (1 - Math.exp(-dt * k));
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ramp = (v, a, b) => clamp((v - a) / (b - a));
export const lerp = (a, b, t) => a + (b - a) * t;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
