/* ==========================================================================
   assets.js — fetch the GLBs with real byte progress, then turn each into ONE
   position-only BufferGeometry with derived normals.

   WHY POSITION ONLY. The scans come out of an image-to-3D model; whatever
   materials, UVs or normals ride along are not ours to trust, and the look is
   built from derived normals alone (see scanMaterial.js). Dropping everything
   else also means every mesh has the same attribute set, which is what
   mergeGeometries needs.

   WHY DEQUANTISE FIRST. gltf-transform's optimize step stores positions as
   normalised int16 with the scale in the node matrix. Baking the node matrix
   into an int16 attribute would overflow it, so positions are copied out to
   float32 before anything is applied to them.
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ASSETS = {
  body: '/assets/figure_body.glb',
  skeleton: '/assets/figure_skeleton.glb',
  bust: '/assets/head_bust.glb',
  mask: '/assets/head_mask.glb',
  skull: '/assets/skull.glb',
};

const buffers = new Map();
const geometries = new Map();

export async function preload(urls, onProgress = () => {}) {
  const size = urls.map(() => 1);
  const got = urls.map(() => 0);
  const report = () => onProgress(got.reduce((a, b) => a + b, 0) / size.reduce((a, b) => a + b, 0));
  await Promise.all(
    urls.map(async (url, i) => {
      if (buffers.has(url)) { got[i] = size[i]; report(); return; }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      size[i] = Number(res.headers.get('content-length')) || 500_000;
      const reader = res.body.getReader();
      const chunks = [];
      let n = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        n += value.length;
        got[i] = Math.min(n, size[i]);
        report();
      }
      const buf = new Uint8Array(n);
      let o = 0;
      for (const c of chunks) { buf.set(c, o); o += c.length; }
      buffers.set(url, buf.buffer);
      size[i] = got[i] = n;
      report();
    })
  );
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export async function loadGeometry(url) {
  if (geometries.has(url)) return geometries.get(url);
  if (!buffers.has(url)) await preload([url]);
  const gltf = await loader.parseAsync(buffers.get(url).slice(0), '');
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry.attributes.position;
    const pos = new Float32Array(src.count * 3);
    for (let i = 0; i < src.count; i++) {
      pos[i * 3] = src.getX(i);
      pos[i * 3 + 1] = src.getY(i);
      pos[i * 3 + 2] = src.getZ(i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (o.geometry.index) g.setIndex(Array.from(o.geometry.index.array));
    g.applyMatrix4(o.matrixWorld);
    parts.push(g);
  });
  if (!parts.length) throw new Error(`${url}: no meshes`);
  const allIndexed = parts.every((g) => g.index);
  const geo = parts.length === 1 ? parts[0] : mergeGeometries(allIndexed ? parts : parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  geo.computeVertexNormals();
  geometries.set(url, geo);
  return geo;
}

/* bbox → height 1, feet (min y) at 0, centred in X/Z. Returned as a matrix so
   a family of meshes (body + skeleton, bust + mask + skull) can share ONE. */
export function normaliseMatrix(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const h = b.max.y - b.min.y || 1;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  return new THREE.Matrix4().makeScale(1 / h, 1 / h, 1 / h).multiply(new THREE.Matrix4().makeTranslation(-cx, -b.min.y, -cz));
}
