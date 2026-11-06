const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { gunzipSync } = require("node:zlib");
const { Arch } = require("builder-util");
async function download(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw Error(`HTTP ${r.status}: ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
function verifyBinary(bytes, platform, arch) {
  if (platform === "win32") {
    if (bytes.toString("ascii", 0, 2) !== "MZ")
      throw Error("Windows FFmpeg must be a PE executable");
    const pe = bytes.readUInt32LE(0x3c);
    if (
      bytes.toString("ascii", pe, pe + 4) !== "PE\0\0" ||
      bytes.readUInt16LE(pe + 4) !== 0x8664 ||
      arch !== "x64"
    )
      throw Error("Expected Windows x64 PE binary");
  } else if (platform === "darwin") {
    if (bytes.readUInt32LE(0) !== 0xfeedfacf)
      throw Error("macOS FFmpeg must be Mach-O 64 bit");
    const expected = arch === "arm64" ? 0x0100000c : 0x01000007;
    if (bytes.readUInt32LE(4) !== expected)
      throw Error("FFmpeg architecture does not match app");
  } else throw Error(`Unsupported release platform ${platform}`);
}
module.exports = async function beforePack(context) {
  const platform = context.electronPlatformName,
    arch = Arch[context.arch];
  if (
    !["darwin", "win32"].includes(platform) ||
    !["x64", "arm64"].includes(arch) ||
    (platform === "win32" && arch !== "x64")
  )
    throw Error(`No verified FFmpeg release for ${platform}/${arch}`);
  const tag = require("ffmpeg-static/package.json")["ffmpeg-static"][
    "binary-release-tag"
  ];
  const target = path.join(
    context.packager.projectDir,
    "vendor",
    "ffmpeg",
    `${platform === "darwin" ? "mac" : "win"}-${arch}`,
  );
  await fs.mkdir(target, { recursive: true });
  const filename = platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    dest = path.join(target, filename),
    base = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}`;
  let bytes;
  try {
    bytes = await fs.readFile(dest);
    verifyBinary(bytes, platform, arch);
  } catch {
    if (platform === process.platform && arch === process.arch) {
      const installed = require("ffmpeg-static");
      bytes = await fs.readFile(installed);
      await fs.copyFile(installed + ".README", path.join(target, "README.txt"));
      await fs.copyFile(
        installed + ".LICENSE",
        path.join(target, "LICENSE.txt"),
      );
    } else {
      console.log(`Preparing FFmpeg ${tag} for ${platform}/${arch}`);
      bytes = gunzipSync(
        await download(`${base}/ffmpeg-${platform}-${arch}.gz`),
      );
      await fs.writeFile(
        path.join(target, "README.txt"),
        await download(`${base}/${platform}-${arch}.README`),
      );
      await fs.writeFile(
        path.join(target, "LICENSE.txt"),
        await download(`${base}/${platform}-${arch}.LICENSE`),
      );
    }
    verifyBinary(bytes, platform, arch);
    await fs.writeFile(dest, bytes, { mode: 0o755 });
  }
  const manifest = {
    platform,
    arch,
    release: tag,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    source: `${base}/ffmpeg-${platform}-${arch}.gz`,
  };
  await fs.writeFile(
    path.join(target, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    `Verified FFmpeg: ${platform}/${arch} (${manifest.sha256.slice(0, 12)})`,
  );
};
module.exports.verifyBinary = verifyBinary;
