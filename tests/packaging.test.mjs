import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { verifyBinary } = require("../scripts/before-pack.cjs");
test("release gate rejects a macOS binary in a Windows package", () => {
  const mac = Buffer.alloc(128);
  mac.writeUInt32LE(0xfeedfacf, 0);
  mac.writeUInt32LE(0x0100000c, 4);
  assert.doesNotThrow(() => verifyBinary(mac, "darwin", "arm64"));
  assert.throws(() => verifyBinary(mac, "win32", "x64"), /PE/);
  assert.throws(() => verifyBinary(mac, "darwin", "x64"), /architecture/);
});
test("release gate checks Windows PE machine type", () => {
  const win = Buffer.alloc(256);
  win.write("MZ");
  win.writeUInt32LE(128, 0x3c);
  win.write("PE\0\0", 128);
  win.writeUInt16LE(0x8664, 132);
  assert.doesNotThrow(() => verifyBinary(win, "win32", "x64"));
  win.writeUInt16LE(0xaa64, 132);
  assert.throws(() => verifyBinary(win, "win32", "x64"), /x64/);
});
