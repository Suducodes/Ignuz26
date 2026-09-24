// One-off: shrink the 7.5 MB anatomical heart into a web asset.
// Keeps geometry + base colour + normal map (the halftone shader reads both),
// drops the metal/rough map and the unused UV sets, then meshopt-compresses.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [src, dst] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(src);
for (const mat of doc.getRoot().listMaterials()) {
  mat.setMetallicRoughnessTexture(null);
  mat.setMetallicFactor(0).setRoughnessFactor(0.7);
}
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const sem of ['TEXCOORD_1', 'TEXCOORD_2', 'TANGENT']) prim.setAttribute(sem, null);
  }
}
await doc.transform(
  prune(), dedup(), weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(dst, doc);
