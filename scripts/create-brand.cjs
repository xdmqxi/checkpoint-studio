// Render our existing vector flag mark locally, without remote assets.
const { Resvg } = require("@resvg/resvg-js");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0070f2"/><stop offset="1" stop-color="#003b80"/></linearGradient><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#e0f0ff"/></linearGradient></defs><rect x="16" y="16" width="992" height="992" rx="230" fill="url(#bg)"/><rect x="38" y="38" width="948" height="948" rx="212" fill="none" stroke="#ffffff" stroke-opacity=".1" stroke-width="3"/><rect x="198" y="198" width="628" height="628" rx="170" fill="url(#g)"/><path d="M381 699V342M382 350c86-65 166 66 270-2v224c-104 68-184-65-270 2" fill="none" stroke="#0070f2" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function render(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();
}
async function main() {
  try {
    await fs.mkdir("build/icons.iconset", { recursive: true });
    const png = render(icon, 1024);
    await fs.writeFile("build/icon.png", png);

    for (const size of [16, 32, 128, 256, 512])
      for (const scale of [1, 2])
        await fs.writeFile(
          `build/icons.iconset/icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`,
          render(icon, size * scale),
        );
    const small = render(icon, 256),
      header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(small.length, 14);
    header.writeUInt32LE(22, 18);
    await fs.writeFile("build/icon.ico", Buffer.concat([header, small]));
    if (process.platform === "darwin") {
      const result = spawnSync(
        "iconutil",
        ["-c", "icns", "build/icons.iconset", "-o", "build/icon.icns"],
        { encoding: "utf8" },
      );
      if (result.status !== 0) throw Error(result.stderr);
    }
    const background = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><radialGradient id="r"><stop stop-color="#203e5c"/><stop offset="1" stop-color="#121e2b"/></radialGradient></defs><rect width="640" height="420" fill="url(#r)"/><rect x="16" y="16" width="608" height="388" rx="20" fill="none" stroke="#0070f2" stroke-opacity=".15"/><rect x="77" y="251" width="186" height="40" rx="12" fill="#dbeafa"/><rect x="377" y="251" width="186" height="40" rx="12" fill="#dbeafa"/><g fill="#f5f6f7" font-family="-apple-system,BlinkMacSystemFont,sans-serif" text-anchor="middle"><text x="320" y="66" font-size="26" font-weight="600">Checkpoint Studio</text><text x="320" y="94" font-size="12" fill="#a9bed2">SAP-Wissen. Einfach erklärt.</text><path d="M290 204h60m-14-14 14 14-14 14" fill="none" stroke="#0070f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="320" y="343" font-size="12" fill="#dbeafa">Zum Installieren in den Programme-Ordner ziehen.</text><text x="320" y="371" font-size="10" fill="#a9bed2">SAP WORKFLOWS  ·  LOKAL  ·  CHECKPOINT STUDIO</text></g></svg>`;
    await fs.writeFile("build/dmg-background.png", render(background, 640));
    console.log("App icons and DMG artwork created.");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}
main();
