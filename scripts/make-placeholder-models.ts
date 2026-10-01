// Writes 10 placeholder Lingo models (coloured cube + two eyes) to assets/models/lingo-<year>.glb.
// Real models replace these files 1:1 (same names). Run: npx tsx scripts/make-placeholder-models.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LINGOS, lingoId } from "./lingos";

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/models");

type Vec3 = [number, number, number];

/** Axis-aligned box: 24 vertices (flat normals per face), 36 indices. */
function box(center: Vec3, size: Vec3) {
  const [cx, cy, cz] = center;
  const [hx, hy, hz] = size.map((s) => s / 2) as Vec3;
  const faces: Array<{ n: Vec3; corners: Vec3[] }> = [
    { n: [1, 0, 0], corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
    { n: [-1, 0, 0], corners: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
    { n: [0, 1, 0], corners: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
    { n: [0, -1, 0], corners: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
    { n: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  faces.forEach(({ n, corners }, f) => {
    for (const [x, y, z] of corners) {
      positions.push(cx + x * hx, cy + y * hy, cz + z * hz);
      normals.push(...n);
    }
    const o = f * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { positions, normals, indices };
}

const hexToRgb = (hex: string) =>
  [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2); // sRGB → linear

function glb(name: string, color: string): Buffer {
  // +Z faces the camera when the model sits on a MindAR anchor.
  const parts = [
    { mesh: box([0, 0, 0], [1, 1, 1]), material: 0 },
    { mesh: box([-0.22, 0.15, 0.5], [0.2, 0.24, 0.04]), material: 1 },
    { mesh: box([0.22, 0.15, 0.5], [0.2, 0.24, 0.04]), material: 1 },
    { mesh: box([-0.22, 0.12, 0.53], [0.08, 0.1, 0.02]), material: 2 },
    { mesh: box([0.22, 0.12, 0.53], [0.08, 0.1, 0.02]), material: 2 },
  ];

  const chunks: Buffer[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  let offset = 0;
  const push = (buf: Buffer, target: number) => {
    chunks.push(buf);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length;
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
    return bufferViews.length - 1;
  };

  const primitives = parts.map(({ mesh, material }) => {
    const pos = Buffer.from(new Float32Array(mesh.positions).buffer);
    const nor = Buffer.from(new Float32Array(mesh.normals).buffer);
    const idx = Buffer.from(new Uint16Array(mesh.indices).buffer);
    const xs = mesh.positions.filter((_, i) => i % 3 === 0);
    const ys = mesh.positions.filter((_, i) => i % 3 === 1);
    const zs = mesh.positions.filter((_, i) => i % 3 === 2);
    accessors.push({
      bufferView: push(pos, 34962),
      componentType: 5126,
      count: mesh.positions.length / 3,
      type: "VEC3",
      min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    });
    const POSITION = accessors.length - 1;
    accessors.push({ bufferView: push(nor, 34962), componentType: 5126, count: mesh.normals.length / 3, type: "VEC3" });
    const NORMAL = accessors.length - 1;
    accessors.push({ bufferView: push(idx, 34963), componentType: 5123, count: mesh.indices.length, type: "SCALAR" });
    return { attributes: { POSITION, NORMAL }, indices: accessors.length - 1, material };
  });

  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: "2.0", generator: "decade-hunt placeholder" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives }],
    materials: [
      { name: "body", pbrMetallicRoughness: { baseColorFactor: [...hexToRgb(color), 1], metallicFactor: 0, roughnessFactor: 0.55 } },
      { name: "eyeWhite", pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.4 } },
      { name: "pupil", pbrMetallicRoughness: { baseColorFactor: [0.02, 0.02, 0.02, 1], metallicFactor: 0, roughnessFactor: 0.3 } },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews,
    accessors,
  };

  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const chunkHeader = (len: number, type: string) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.write(type, 4, "ascii");
    return b;
  };
  return Buffer.concat([header, chunkHeader(jsonBuf.length, "JSON"), jsonBuf, chunkHeader(bin.length, "BIN\0"), bin]);
}

mkdirSync(outDir, { recursive: true });
for (const [name, year, , color] of LINGOS) {
  const file = resolve(outDir, `${lingoId(year)}.glb`);
  const data = glb(name, color);
  writeFileSync(file, data);
  console.log(`${lingoId(year)}.glb  ${name}  ${color}  ${data.length} bytes`);
}
