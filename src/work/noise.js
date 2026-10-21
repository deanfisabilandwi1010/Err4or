/* Value noise, 3 octaves, for the CPU-side torn edges (work-page blobs). */

const P = new Uint8Array(512);
for (let i = 0; i < 256; i++) P[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [P[i], P[j]] = [P[j], P[i]];
}
for (let i = 0; i < 256; i++) P[i + 256] = P[i];

const h = (x, y) => P[P[x & 255] + (y & 255)] / 255;
const fade = (t) => t * t * (3 - 2 * t);

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function NOISE_JS(x, y) {
  return vnoise(x, y) * 0.5 + vnoise(x * 2.03, y * 2.03) * 0.25 + vnoise(x * 4.1, y * 4.1) * 0.25;
}
