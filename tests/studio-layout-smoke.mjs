import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  temp = await mkdtemp(path.join(os.tmpdir(), "checkpoint-layout-")),
  root = path.join(temp, "project");
await mkdir(path.join(root, "media"), { recursive: true });
await mkdir("test-results", { recursive: true });
for (const [file, args] of [
  [
    "video.mp4",
    [
      "-f",
      "lavfi",
      "-i",
      "color=blue:size=640x360:rate=30",
      "-t",
      "2",
      "-c:v",
      "libx264",
    ],
  ],
  [
    "music.wav",
    ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "2"],
  ],
]) {
  const result = spawnSync(
    require("ffmpeg-static"),
    ["-y", ...args, path.join(root, "media", file)],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
}
const packaged = process.argv.includes("--packaged");
const app = await electron.launch(
  packaged
    ? {
        executablePath: path.resolve(
          "release/mac-arm64/Checkpoint Studio.app/Contents/MacOS/Checkpoint Studio",
        ),
        args: ["--user-data-dir=" + path.join(temp, "profile")],
      }
    : {
        args: [".", "--user-data-dir=" + path.join(temp, "profile")],
        cwd: process.cwd(),
      },
);
const page = await app.firstWindow();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function fits(width, height, label) {
  if (process.env.CI) {
    // Hosted Mac displays may be physically smaller than the requested window.
    // Exercise the exact CSS viewport sizes independently of the host display.
    await page.setViewportSize({ width, height });
  } else {
    await app.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0].setContentSize(...size),
      [width, height],
    );
  }
  await page.waitForFunction(
    (size) => innerWidth === size[0] && innerHeight === size[1],
    [width, height],
  );
  const layout = await page.evaluate(() => {
    const rect = (s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    return {
      width: innerWidth,
      height: innerHeight,
      doc: document.scrollingElement.scrollHeight,
      body: document.body.scrollHeight,
      footer: rect(".editing-workspace footer"),
      last: rect(".timeline-video-lane"),
      tracks: rect(".timeline-scroll"),
      audioRows: [
        ...document.querySelectorAll("[data-audio-row], [data-source-row]"),
      ].map((el) => {
        const r = el.getBoundingClientRect();
        return { bottom: r.bottom, height: r.height };
      }),
      monitor: rect(".program-canvas"),
      tools: rect(".sequence-tools"),
    };
  });
  assert.ok(
    layout.doc <= layout.height + 1,
    `${label} ${width}x${height}: page must not scroll ${JSON.stringify(layout)}`,
  );
  assert.ok(
    layout.last.bottom <= layout.tracks.bottom + 1,
    `${label}: last lane is clipped ${JSON.stringify(layout)}`,
  );
  assert.ok(
    layout.last.bottom <= layout.footer.y + 1,
    `${label}: last lane must stay above footer`,
  );
  assert.ok(
    layout.last.height >= 26,
    `${label}: audio lanes must remain usable`,
  );
  assert.ok(
    layout.monitor.height >= 80,
    `${label}: preview must remain visible`,
  );
  assert.ok(
    layout.tools.right <= layout.width + 1,
    `${label}: tool row must fit horizontally`,
  );
  for (const row of layout.audioRows) {
    assert.ok(
      row.bottom <= layout.tracks.bottom + 1,
      `Audio row clipped: ${JSON.stringify(layout)}`,
    );
    assert.ok(row.height >= 20);
  }
  console.log(
    "Fits",
    label,
    width,
    height,
    "audio rows",
    layout.audioRows.length,
  );
}
try {
  await page.getByRole("button", { name: "Videoeditor", exact: true }).click();
  for (const size of [
    [1440, 900],
    [1200, 800],
    [1050, 740],
  ])
    await fits(...size, "empty");
  const p = {
    version: 1,
    name: "SAP – Schnittplatz",
    takes: [
      {
        id: "t",
        video: "media/video.mp4",
        mic: "media/music.wav",
        system: "media/music.wav",
        hasAudio: false,
        duration: 2,
      },
    ],
    clips: [{ id: "c", takeId: "t", in: 0, out: 2 }],
    audioTracks: [0, 1, 2].map((lane) => ({
      id: "a" + lane,
      path: "media/music.wav",
      name: "Musik " + lane,
      start: 0,
      in: 0,
      out: 2,
      duration: 2,
      volume: 1,
      lane,
      peaks: [0.2, 0.4, 0.8, 0.6, 0.9, 0.4, 0.2],
    })),
    checkpoints: Array.from({ length: 12 }, (_, i) => ({
      id: "m" + i,
      name: "Schritt " + (i + 1),
      time: i / 6,
    })),
    volume: { mic: 1, system: 1 },
  };
  const file = path.join(root, "project.checkpoint");
  await writeFile(file, JSON.stringify(p));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      filePaths: [file],
      canceled: false,
    });
  }, file);
  await page.getByRole("button", { name: "Übersicht", exact: true }).click();
  await page
    .getByRole("button", { name: "Projekt öffnen", exact: true })
    .click();
  await page.getByTestId("program-video").waitFor();
  assert.equal(await page.locator("[data-audio-row]").count(), 3);
  assert.equal(await page.locator("[data-source-row]").count(), 2);
  for (const size of [
    [1440, 900],
    [1200, 800],
    [1050, 740],
  ])
    await fits(...size, "populated");
  await page
    .getByRole("button", { name: "Audio-Clip Musik 0", exact: true })
    .click();
  await fits(1050, 740, "audio inspector");
  await fits(1440, 900, "final");
  await page.screenshot({ path: "test-results/studio-layout.png" });
  await page
    .getByRole("button", { name: "Mikrofon entfernen", exact: true })
    .click();
  assert.equal(await page.locator('[data-source-row="mic"]').count(), 0);
  await page
    .getByRole("button", { name: "Mikrofon wieder hinzufügen", exact: true })
    .click();
  assert.equal(await page.locator('[data-source-row="mic"]').count(), 1);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: `Audio-Clip Musik ${i}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Audio entfernen", exact: true })
      .click();
    assert.equal(await page.locator("[data-audio-row]").count(), 2 - i);
  }
  assert.equal(await page.locator("[data-source-row]").count(), 2);
  await page.locator(".timeline-video-clip").click();
  await page
    .getByRole("button", { name: "Löschen & nachrücken", exact: true })
    .click();
  assert.equal(await page.locator("[data-source-row]").count(), 0);
  await fits(1050, 740, "all audio removed");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: no page scrolling at supported window sizes; only populated audio rows remain visible and disappear when removed, with populated project and audio properties",
    { packaged },
  );
} catch (error) {
  await page.screenshot({ path: "test-results/studio-layout-failure.png" });
  throw error;
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.removeAllListeners("close")),
  );
  await app.close();
  await rm(temp, { recursive: true, force: true });
}
