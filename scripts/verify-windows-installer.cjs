const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { verifyBinary } = require("./before-pack.cjs");
const { createHash } = require("node:crypto");
async function main() {
  const archive = process.argv[2],
    seven = process.argv[3];
  if (!archive || !seven)
    throw Error(
      "Usage: node scripts/verify-windows-installer.cjs INSTALLER SEVEN_ZIP",
    );
  const temp = await fs.mkdtemp(
    path.join(os.tmpdir(), "checkpoint-installer-"),
  );
  const run = (args) => {
    const p = spawnSync(seven, args, {
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    if (p.status !== 0) throw Error(p.stderr || p.stdout);
    return p.stdout;
  };
  try {
    run(["e", "-y", archive, "$PLUGINSDIR/app-64.7z", "-o" + temp]);
    const payload = path.join(temp, "app-64.7z");
    run([
      "x",
      "-y",
      payload,
      "resources/ffmpeg/*",
      "resources/app.asar",
      "Checkpoint Studio.exe",
      "-o" + path.join(temp, "unpacked"),
    ]);
    const root = path.join(temp, "unpacked");
    verifyBinary(
      await fs.readFile(path.join(root, "Checkpoint Studio.exe")),
      "win32",
      "x64",
    );
    const binary = await fs.readFile(
      path.join(root, "resources/ffmpeg/ffmpeg.exe"),
    );
    verifyBinary(binary, "win32", "x64");
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(root, "resources/ffmpeg/manifest.json"),
        "utf8",
      ),
    );
    if (manifest.sha256 !== createHash("sha256").update(binary).digest("hex"))
      throw Error("Installed FFmpeg checksum mismatch");
    const asar = require("@electron/asar");
    const pkg = JSON.parse(
      asar
        .extractFile(path.join(root, "resources/app.asar"), "package.json")
        .toString(),
    );
    if (pkg.version !== require("../package.json").version) throw Error("Wrong app version");
    const main = asar
      .extractFile(path.join(root, "resources/app.asar"), "electron/main.cjs")
      .toString();
    if (!main.includes("process.resourcesPath") || !main.includes("ffmpeg.exe"))
      throw Error("Missing packaged Windows export path");
    console.log(
      JSON.stringify(
        {
          installer: archive,
          version: pkg.version,
          payload: "Windows x64",
          ffmpeg: manifest,
          validation:
            "Extracted actual NSIS payload. Both app and FFmpeg are x64 PE executables. Runtime execution on Windows remains untested.",
        },
        null,
        2,
      ),
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
