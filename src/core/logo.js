/* The mark. PLACEHOLDER — swap the paths for your own logo; every place that draws it
   (mobile gate, stamps, 404 fragments) reads these strings. */

export const LOGO_PARTS = [
  'M10 10h34v12H22v56h22v12H10z',   // left bracket
  'M90 10H56v12h22v56H56v12h34z',   // right bracket
  'M40 44h20v12H40z',               // the bar between them
];

export function logoSVG(cls = '') {
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${LOGO_PARTS.map(
    (d) => `<path d="${d}" fill="currentColor"/>`
  ).join('')}</svg>`;
}
