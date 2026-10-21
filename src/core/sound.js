/* ==========================================================================
   sound.js — the background track. Lives with the chrome, so Barba's page
   swaps never interrupt it.

   Browsers refuse to autoplay audio, so the track waits for the visitor's
   first gesture (any click or key) and fades in from there. The bar carries
   a SOUND toggle; muting is remembered per browser.
   ========================================================================== */

import gsap from 'gsap';

const SRC = '/audio/on-tha-line.mp3';
const VOLUME = 0.35;
const KEY = 'sound-muted';

let audio;
let btn;
let muted = false;
let unlocked = false;

export function initSound(bar) {
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: default on */ }

  audio = new Audio(SRC);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0;

  btn = bar.querySelector('[data-sound]');
  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    setMuted(!muted);
  });
  render();

  const unlock = (e) => {
    if (e.target.closest?.('[data-sound]')) return; // the toggle handles itself
    unlocked = true;
    ['pointerdown', 'keydown'].forEach((t) => removeEventListener(t, unlock, true));
    if (!muted) fadeIn();
  };
  ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, unlock, true));

  // a hidden tab keeps its place in the song instead of playing to nobody
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else if (unlocked && !muted) fadeIn();
  });
}

function setMuted(next) {
  muted = next;
  unlocked = true;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* not remembered, still works */ }
  render();
  if (muted) fadeOut();
  else fadeIn();
}

function fadeIn() {
  gsap.killTweensOf(audio);
  audio.play().then(
    () => gsap.to(audio, { volume: VOLUME, duration: 1.6, ease: 'power1.out' }),
    () => {} // still blocked; the next gesture tries again
  );
}

function fadeOut() {
  gsap.killTweensOf(audio);
  gsap.to(audio, { volume: 0, duration: 0.6, ease: 'power1.in', onComplete: () => audio.pause() });
}

function render() {
  if (!btn) return;
  btn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  btn.setAttribute('aria-pressed', String(!muted));
  btn.classList.toggle('is-muted', muted);
}
