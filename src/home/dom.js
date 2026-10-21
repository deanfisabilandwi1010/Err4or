/* ==========================================================================
   dom.js — the home page's markup, written from content.js so the HTML file
   stays a skeleton and every word lives in one place.
   ========================================================================== */

import { OWNER, ROLES, STATUS, AWARDS, CASE_TITLE, CASE_LINES, BLOCK2, FOOTER } from '../content.js';
import { logoSVG } from '../core/logo.js';
import { navHTML } from '../core/chrome.js';

const FIG_PATH = 'M9 0a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4 10h10l2 12h-3l-1 18h-3l-.5-12h-1L8 40H5L4 22H1z';

export function buildHome(root) {
  const $ = (s) => root.querySelector(s);

  // ---- case file: ONE line per row, strictly alternating left / right of the figure.
  // home/index.js places each row beside the figure's silhouette every frame. ----
  $('[data-copy-title]').textContent = CASE_TITLE;
  $('[data-copy-lines]').innerHTML = CASE_LINES.map((t, i) => `<p class="line ${i % 2 ? 'is-r' : 'is-l'}"><span>${t}</span></p>`).join('');

  // ---- HUD ----
  const marquee = ROLES.map((r) => `<span>${r}</span><i>//</i>`).join('');
  const awards = AWARDS.map(
    (a) => `
      <div class="hud__award">
        <p class="hud__award-name">${a.project}</p>
        <ul>${a.items.map((it) => `<li><span>${it}</span><b>X1</b></li>`).join('')}
          <li class="is-total"><span>[${a.items.length}]</span><b>IN TOTAL</b></li></ul>
      </div>`
  ).join('');
  $('[data-hud]').innerHTML = `
    <div class="hud__panel hud__tl">
      <div class="hud__map" data-map>
        <svg class="hud__fig" viewBox="0 0 18 40"><path d="${FIG_PATH}" fill="currentColor"/></svg>
        <i class="hud__sq" data-sq></i>
      </div>
      <div class="hud__xy"><span data-x>X 000</span><span data-y>Y 000</span></div>
      <div class="hud__status">
        <p>${STATUS[0]}<br />${STATUS[3]}</p>
        <p class="r">${STATUS[1]}<br />${STATUS[2]}</p>
      </div>
    </div>
    <p class="hud__coord hud__coord--l">//${OWNER.lat}</p>
    <p class="hud__coord hud__coord--r">${OWNER.long}//</p>
    <div class="hud__panel hud__bl">
      <div class="hud__status">
        <p>${STATUS[0]}<br />${STATUS[4]}</p>
        <p class="r">${STATUS[1]}<br />${STATUS[2]}</p>
      </div>
      <div class="hud__proto">
        <p><span>PROTOCOL</span><span>WARNING</span></p>
        <p><span>00039</span><span>NOT FOUND</span></p>
        <p><span>${OWNER.year}</span><span>// ETERNITY</span></p>
      </div>
      <div class="hud__progress"><span>000</span><i><b data-progress></b></i><span data-progress-n>000</span></div>
    </div>
    <div class="hud__panel hud__tr">
      <div class="hud__marquee"><div>${marquee}${marquee}</div></div>
      <div class="hud__awards">${awards}</div>
    </div>
    <p class="hud__br">SCROLL OR DRAG // HOVER TO SEE THROUGH</p>`;

  // ---- block 02 ----
  $('[data-numeral]').innerHTML = [...BLOCK2.numeral].map((c) => `<span>${c}</span>`).join('');
  const col = (cls, n) => `<div class="words__col ${cls}">${Array.from({ length: n }, () => BLOCK2.words.map((w) => `<p>${w}</p>`).join('')).join('')}</div>`;
  $('[data-words]').innerHTML = col('', 3) + col('is-mirror', 3) + col('is-flip', 3);
  $('[data-b2-meta]').innerHTML = `
    <div class="b2__meta-tl"><p>${OWNER.role}</p><p>${OWNER.disciplines.join('<br />')}</p></div>
    <p class="b2__meta-tr">${BLOCK2.labels[0]}</p>
    <p class="b2__meta-bl">${BLOCK2.labels[1]}</p>
    <p class="b2__meta-br">${BLOCK2.labels[2]} // ${OWNER.city}</p>`;
  $('[data-stamps]').innerHTML = `<i class="stamp stamp--a">${logoSVG()}</i><i class="stamp stamp--b">${logoSVG()}</i><i class="bracket bracket--a"></i><i class="bracket bracket--b"></i>`;

  // ---- footer: headline, a black band with an eye-shaped WINDOW cut through it (the red
  // room and the head show through), two black bars, then the notes ----
  const notes = FOOTER.notes.map((n, i) => `<li><b>${i + 1}</b><p>${n.join('<br />')}</p></li>`).join('');
  $('[data-ftr]').innerHTML = `
    <h2 class="ftr__head">${FOOTER.headline.map((l) => `<span class="ftr__line"><span>${l}</span></span>`).join('')}</h2>
    <div class="ftr__band" data-band>
      <svg class="ftr__eye" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
        <defs><mask id="ftr-eye-hole" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="200">
          <rect width="1000" height="200" fill="#fff" />
          <ellipse data-hole cx="500" cy="100" rx="492" ry="38" fill="#000" />
        </mask></defs>
        <rect width="1000" height="200" fill="#0a0a0a" mask="url(#ftr-eye-hole)" />
      </svg>
      <i class="sq sq--tl"></i><i class="sq sq--bl"></i><i class="sq sq--tr"></i>
      <nav class="ftr__nav">${navHTML().replace('>ERROR <', '>404 <')}</nav>
      <a class="ftr__err" href="/404.html">ERROR PAGE <span>+</span></a>
    </div>
    <div class="ftr__lower" data-ftr-lower>
      <div class="ftr__bars">
        <a href="${OWNER.linkedin}" target="_blank" rel="noopener">LINKEDIN</a>
        <a href="${OWNER.contactHref}">${OWNER.contactLabel}</a>
      </div>
      <div class="ftr__cols">
        <div class="ftr__quote"><span>//</span><p>${FOOTER.quote.join('<br />')}</p></div>
        <ol class="ftr__notes">${notes}</ol>
        <p class="ftr__loc">${OWNER.city}</p>
      </div>
      <p class="ftr__rights">©${OWNER.year} ${FOOTER.rights}</p>
    </div>`;
}
