import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf: Buffer): number {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

function createPng(width: number, height: number, renderPixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(height * (width * 4 + 1));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = renderPixel(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Generate AniList Relation Tree icon with 3 connected nodes
export function generateIcon(size: number): Buffer {
  const radius = size * 0.44;
  const cx = size / 2;
  const cy = size / 2;

  // Nodes in relative coordinates (0..1)
  const nodes = [
    { x: 0.25, y: 0.50, r: 0.14, color: [2, 169, 255] },     // Root (AniList Blue)
    { x: 0.72, y: 0.28, r: 0.12, color: [245, 158, 11] },   // Branch 1 (Amber)
    { x: 0.72, y: 0.72, r: 0.12, color: [16, 185, 129] },   // Branch 2 (Emerald)
  ];

  const edges = [
    { from: 0, to: 1 },
    { from: 0, to: 2 }
  ];

  function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  return createPng(size, size, (x, y) => {
    const nx = x / size;
    const ny = y / size;

    // Background: dark rounded icon with subtle border
    const dCenter = Math.hypot(x - cx, y - cy);
    if (dCenter > radius) {
      return [0, 0, 0, 0]; // Transparent outside
    }

    // Check if inside a node
    for (const node of nodes) {
      const dNode = Math.hypot(nx - node.x, ny - node.y);
      if (dNode < node.r) {
        // Node center
        return [node.color[0], node.color[1], node.color[2], 255];
      }
      if (dNode < node.r + 0.03) {
        // Subtle node halo
        return [node.color[0], node.color[1], node.color[2], 180];
      }
    }

    // Check edges
    for (const edge of edges) {
      const n1 = nodes[edge.from];
      const n2 = nodes[edge.to];
      const dEdge = distToSegment(nx, ny, n1.x, n1.y, n2.x, n2.y);
      if (dEdge < (size <= 16 ? 0.08 : 0.045)) {
        return [148, 163, 184, 230]; // Slate line
      }
    }

    // Dark background inside rounded area
    // Subtle border
    if (dCenter > radius - 1.2) {
      return [38, 44, 56, 255];
    }
    return [15, 18, 26, 255]; // Deep dark blue-gray
  });
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const iconBuf = generateIcon(size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), iconBuf);
  console.log(`Generated icon-${size}.png (${iconBuf.length} bytes)`);
});
