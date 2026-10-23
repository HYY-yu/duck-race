// Offline sample-only reduction. Preserve the paid source and its vertex colors.
// Uses the meshoptimizer already present in node_modules; adds no dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { MeshoptSimplifier } from 'meshoptimizer';
import { BufferGeometry, BufferAttribute } from 'three';

const folder = new URL('../assets/generated/duck-base-sam-v1/', import.meta.url);
const raw = await readFile(new URL('raw/1.glb', folder));
const jsonSize = raw.readUInt32LE(12);
const source = JSON.parse(raw.subarray(20, 20 + jsonSize).toString());
const binary = raw.subarray(28 + jsonSize);
const primitive = source.meshes[0].primitives[0];
// This script deliberately accepts only the inspected SAM sample layout.
if (source.meshes.length !== 1 || source.meshes[0].primitives.length !== 1 || primitive.mode !== 4) {
  throw new Error('Unexpected SAM layout; inspect before reducing.');
}
function accessor(index, Type) {
  const a = source.accessors[index], view = source.bufferViews[a.bufferView];
  if (view.byteStride) throw new Error('Interleaved data unsupported in this sample script');
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const copy = Uint8Array.from(binary.subarray(start, start + a.count * width * Type.BYTES_PER_ELEMENT));
  return new Type(copy.buffer);
}
const indices = accessor(primitive.indices, Uint32Array);
const positions = accessor(primitive.attributes.POSITION, Float32Array);
const colors = accessor(primitive.attributes.COLOR_0, Uint8Array);
const rgb = new Float32Array(colors.length / 4 * 3);
for (let i = 0; i < colors.length / 4; i++) for (let k = 0; k < 3; k++) rgb[i * 3 + k] = colors[i * 4 + k] / 255;
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
// Give eye/bill color boundaries enough weight to survive aggressive reduction.
const [reduced, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, rgb, 3, [1, 1, 1], null, 4000 * 3, 1);
const remap = new Map();
for (const index of reduced) if (!remap.has(index)) remap.set(index, remap.size);
const p = new Float32Array(remap.size * 3), c = new Uint8Array(remap.size * 4);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const [old, next] of remap) {
  p.set(positions.subarray(old * 3, old * 3 + 3), next * 3);
  c.set(colors.subarray(old * 4, old * 4 + 4), next * 4);
  for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[next * 3 + k]); max[k] = Math.max(max[k], p[next * 3 + k]); }
}
const Index = remap.size < 65536 ? Uint16Array : Uint32Array;
const idx = Index.from(reduced, index => remap.get(index));
const geometry = new BufferGeometry();
geometry.setAttribute('position', new BufferAttribute(p, 3));
geometry.setIndex(new BufferAttribute(idx, 1));
geometry.computeVertexNormals();
const normals = geometry.getAttribute('normal').array;
const chunks = [idx, p, c, normals].map(a => Buffer.from(a.buffer));
let length = 0;
const views = chunks.map((b, i) => {
  const view = { buffer: 0, byteOffset: length, byteLength: b.length, target: i === 0 ? 34963 : 34962 };
  length += (b.length + 3) & ~3;
  return view;
});
const bin = Buffer.alloc(length);
chunks.forEach((b, i) => b.copy(bin, views[i].byteOffset));
const gltf = {
  asset: { version: '2.0', generator: 'duck-sam-sample / meshoptimizer 0.22.0' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'DuckBase_SAM_LOD0_Sample', mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 1, COLOR_0: 2, NORMAL: 3 }, indices: 0, mode: 4, material: 0 }] }],
  materials: [{ name: 'Duck_VertexColor', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.65 } }],
  buffers: [{ byteLength: bin.length }], bufferViews: views,
  accessors: [
    { bufferView: 0, componentType: Index === Uint16Array ? 5123 : 5125, count: idx.length, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count: remap.size, type: 'VEC3', min, max },
    { bufferView: 2, componentType: 5121, normalized: true, count: remap.size, type: 'VEC4' },
    { bufferView: 3, componentType: 5126, count: remap.size, type: 'VEC3' },
  ],
};
const jsonText = Buffer.from(JSON.stringify(gltf));
const json = Buffer.alloc((jsonText.length + 3) & ~3, 32); jsonText.copy(json);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, json, binHeader, bin]);
await writeFile(new URL('duck-base-4k.glb', folder), output);
const stats = {
  raw: { bytes: raw.length, triangles: indices.length / 3, vertices: positions.length / 3, textures: 0 },
  reduced: { bytes: output.length, triangles: idx.length / 3, vertices: remap.size, textures: 0, simplifierError: error },
  note: 'Sample only; vertex colors, no UV textures, rig or animation. Source coordinate system retained. Reduced GLB includes smooth vertex normals.',
};
await writeFile(new URL('stats.json', folder), JSON.stringify(stats, null, 2) + '\n');
console.info('[duck-sam-sample] Reduction complete', stats);
