/* ==========================================================================
   posters.js — PLACEHOLDER project images, drawn once into canvases.

   The work and gallery pages need pictures before the real ones exist. These
   are generated so the layout, the tint and the pixelate reveal can be judged
   on something with real light and dark in it. To use real photographs, set
   `src` on a project in content.js (e.g. '/work/night-shift.webp'); a poster is
   only drawn for entries without one.
   ========================================================================== */

const cache = new Map();

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function poster({ title = '', year = '', tone = '#e8271c', src } = {}, i = 0, w = 700, h = 900) {
  if (src) return src;
  const key = `${title}|${i}|${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const r = rand(i * 9973 + title.length * 31);

  // night photograph: dark gradient, one hard light source, a figure-sized shadow
  const bg = g.createLinearGradient(0, 0, w * r(), h);
  bg.addColorStop(0, '#050505');
  bg.addColorStop(1, '#1d1d1d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const lx = w * (0.2 + r() * 0.6);
  const ly = h * (0.15 + r() * 0.5);
  const light = g.createRadialGradient(lx, ly, 0, lx, ly, w * (0.4 + r() * 0.5));
  light.addColorStop(0, tone);
  light.addColorStop(0.35, tone + '55');
  light.addColorStop(1, 'transparent');
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.85)';
  for (let k = 0; k < 3; k++) {
    g.fillRect(w * r(), h * (0.4 + r() * 0.4), w * (0.05 + r() * 0.3), h);
  }
  // a doorway / window
  g.strokeStyle = 'rgba(255,255,255,.5)';
  g.lineWidth = 2;
  g.strokeRect(w * (0.1 + r() * 0.5), h * (0.1 + r() * 0.3), w * 0.25, h * 0.4);
  // grain
  const img = g.getImageData(0, 0, w, h);
  for (let p = 0; p < img.data.length; p += 4) {
    const n = (r() - 0.5) * 36;
    img.data[p] += n; img.data[p + 1] += n; img.data[p + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // caption
  g.fillStyle = '#fff';
  g.font = '500 54px Geist, sans-serif';
  g.fillText(title, 36, h - 70);
  g.font = '400 20px "Geist Mono", monospace';
  g.fillText(`${String(i + 1).padStart(2, '0')} // ${year}`, 38, h - 36);

  const url = c.toDataURL('image/webp', 0.86);
  cache.set(key, url);
  return url;
}
