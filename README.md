# Scrap — portfolio "case file"

Situs portofolio eksperimental: ruang hitam dengan scan 3D kamu dan efek x-ray, ruang putih dengan kepala 3D,
dan ruang merah di footer. Ada juga halaman Work (grid tak terbatas), Gallery (koridor foto 3D), dan 404.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # hasil di dist/
```

Paling bagus dilihat di desktop (lebar ≥ 1024 px). Di HP yang muncul layar merah "best viewed with a desktop".

## Yang perlu kamu ganti

| Apa | Di mana |
|---|---|
| Nama, role, kota, koordinat, email, LinkedIn | `src/content.js` → `OWNER` |
| Teks case file (±60 baris) | `src/content.js` → `CASE_LINES` |
| Proyek & log error HUD | `src/content.js` → `PROJECTS`, `SYSLOG` |
| Foto proyek asli | taruh WebP di `public/work/`, isi `src: '/work/nama.webp'` per proyek |
| Logo | `src/core/logo.js` (path SVG) dan `public/favicon.svg` |
| Judul halaman | `<title>` di keempat file HTML |

Semua teks sekarang **placeholder**.

## Model 3D (`public/assets/`)

| File | Dipakai |
|---|---|
| `figure_body.glb` | figur di ruang hitam |
| `figure_skeleton.glb` | x-ray (sementara, pose belum persis sama) |
| `head_bust.glb`, `head_mask.glb`, `skull.glb` | kepala di ruang putih: topeng → wajah → tengkorak |

Versi detail penuh ada di `models-source/`. Untuk mengganti model: kompres dulu, lalu timpa file di `public/assets/`:

```bash
npx @gltf-transform/cli optimize input.glb public/assets/figure_skeleton.glb --compress meshopt
```

## Menyetel tampilan

Saat `npm run dev`, ada panel **TUNE** di kanan bawah halaman Index (iri, scan, grain, fresnel x-ray,
ukuran kuas, batas topeng/wajah/tengkorak). Setelah pas, salin angkanya ke objek `CONFIG` di
`src/home/figure.js`, `src/home/head.js`, atau `src/home/ground.js`.

## Struktur

```
src/core/     loop (satu rAF), travel (scroll buatan), transisi Barba, chrome (grain, bar), logo, poster placeholder
src/three/    muat GLB, shader scan, mask fluid (x-ray), stage three.js
src/home/     loader, figur, kepala, tear+terrain, DOM, orkestrasi 4 fase scroll
src/work/     grid tak terbatas, blob, lightbox pixelate
src/gallery/  path / tunnel / wheel / sphere (CSS 3D)
src/error/    halaman 404
```

Font: Geist dan Geist Mono dari Google Fonts. Jika punya lisensi PP Supply Sans/Mono, cukup tambahkan
`@font-face`-nya karena sudah jadi pilihan pertama di `--font-main` / `--font-mono`.
