import { maxExportBytes } from "./plan";

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let bit = 0; bit < 8; bit++)
    i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ b) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}
/** A bounded ZIP32 writer for small, fixed-name OOXML package parts; store method, no ZIP64. */
export function storeZip(
  files: ReadonlyArray<{ name: string; parts: string[] }>,
): ArrayBuffer[] {
  const locals: ArrayBuffer[] = [],
    central: ArrayBuffer[] = [];
  let offset = 0,
    centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.parts.join(""));
    const checksum = crc32(data);
    const local = new ArrayBuffer(30 + name.length),
      l = new DataView(local);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(12, 0x21, true);
    l.setUint32(14, checksum, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true);
    new Uint8Array(local).set(name, 30);
    const entry = new ArrayBuffer(46 + name.length),
      c = new DataView(entry);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, checksum, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    new Uint8Array(entry).set(name, 46);
    offset += local.byteLength + data.byteLength;
    centralSize += entry.byteLength;
    if (offset + centralSize + 22 > maxExportBytes)
      throw new Error("Spreadsheet exceeds the supported export size.");
    locals.push(local, data.buffer);
    central.push(entry);
  }
  const end = new ArrayBuffer(22),
    e = new DataView(end);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  return [...locals, ...central, end];
}
