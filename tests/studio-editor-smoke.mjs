import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ffmpeg = require("ffmpeg-static"),
  temp = await mkdtemp(path.join(os.tmpdir(), "checkpoint-studio-")),
  root = path.join(temp, "Projekt Ä");
await mkdir(path.join(root, "media"), { recursive: true });
await mkdir("test-results", { recursive: true });
const run = (args) => {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r;
};
for (const [name, color] of [
  ["a", "blue"],
  ["b", "red"],
])
  run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:size=640x360:rate=30`,
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    path.join(root, `media/${name}.mp4`),
  ]);
const music = path.join(temp, "Musik Ä.aiff");
run([
  "-y",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=880:sample_rate=44100",
  "-t",
  "3",
  music,
]);
const fixture = {
  version: 1,
  name: "SAP · Prozessschulung",
  takes: [
    { id: "a", name: "SAP Auftrag.mp4", video: "media/a.mp4", duration: 3 },
    { id: "b", name: "SAP Auswertung.mp4", video: "media/b.mp4", duration: 3 },
  ],
  clips: [
    { id: "c1", takeId: "a", in: 0.2, out: 1.4 },
    { id: "c2", takeId: "b", in: 0.4, out: 1.6 },
  ],
  checkpoints: [],
  volume: { mic: 0, system: 0 },
};
const file = path.join(root, "project.checkpoint");
await writeFile(file, JSON.stringify(fixture));
const packaged = process.argv.includes("--packaged");
const app = await electron.launch(
  packaged
    ? {
        executablePath:
          process.env.CHECKPOINT_APP_PATH ||
          path.resolve(
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
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = async () => {
  await page.waitForTimeout(650);
  return JSON.parse(await readFile(file, "utf8"));
};
try {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      filePaths: [file],
      canceled: false,
    });
  }, file);
  await page
    .getByRole("button", { name: "Projekt öffnen", exact: true })
    .click();
  await page.getByTestId("program-video").waitFor();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      filePaths: [file],
      canceled: false,
    });
  }, music);
  await page
    .getByRole("button", { name: "Audio importieren", exact: true })
    .click();
  await page.getByLabel("Position Musik Ä.aiff", { exact: true }).waitFor();
  let p = await saved();
  assert.equal(p.audioTracks.length, 1);
  assert.ok(p.audioTracks[0].peaks.length === 200);
  assert.ok(p.audioTracks[0].path.endsWith(".wav"));
  assert.equal(
    (await readFile(path.join(root, p.audioTracks[0].path)))
      .subarray(0, 4)
      .toString(),
    "RIFF",
  );
  assert.ok(
    (await page.locator(".audio-waveform path").getAttribute("d")).length > 50,
  );
  await page.getByLabel("Position Musik Ä.aiff", { exact: true }).fill("0.2");
  await page.getByLabel("Audio einblenden", { exact: true }).fill("0.5");
  await page.getByLabel("Audio ausblenden", { exact: true }).fill("0.5");
  await page.getByLabel("Audio Ende", { exact: true }).fill("2");
  await page.getByLabel("Audiospur", { exact: true }).selectOption("1");
  assert.equal(
    await page.locator('[data-lane="1"] .timeline-music-clip').count(),
    1,
  );
  // Preview must actually advance across a different source and continue imported sound.
  await page.getByRole("button", { name: "Zum Anfang", exact: true }).click();
  await page
    .getByRole("button", { name: "Timeline abspielen", exact: true })
    .click();
  await page.waitForFunction(() => {
    const a = document.querySelector('[data-testid="imported-audio"]');
    return a && !a.paused && a.currentTime > 0.1 && a.volume > 0.05;
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="program-video"]')
        ?.getAttribute("data-take-id") === "b",
  );
  await page.waitForFunction(() => {
    const v = document.querySelector('[data-testid="program-video"]'),
      a = document.querySelector('[data-testid="imported-audio"]');
    return v && !v.paused && v.currentTime > 0.5 && a && !a.paused;
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.equal(
    await page.getByTestId("imported-audio").evaluate((a) => a.paused),
    true,
  );
  // Split the selected audio at a real timeline position, duplicate, delete and undo.
  const ruler = page.getByLabel("Zeitleiste", { exact: true }),
    box = await ruler.boundingBox();
  await ruler.click({ position: { x: box.width * 0.42, y: 12 } });
  await page
    .getByRole("button", { name: "Clip am Abspielkopf schneiden", exact: true })
    .click();
  assert.equal(await page.locator(".timeline-music-clip").count(), 2);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal(await page.locator(".timeline-music-clip").count(), 1);
  // Drag music to another lane and time, then trim the right edge.
  const audioClip = page.getByRole("button", {
    name: "Audio-Clip Musik Ä.aiff",
    exact: true,
  });
  await audioClip.scrollIntoViewIfNeeded();
  let b = await audioClip.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 30);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + 94, { steps: 8 });
  await page.mouse.up();
  p = await saved();
  assert.equal(p.audioTracks[0].lane, 2);
  assert.ok(p.audioTracks[0].start > 0.2);
  b = await audioClip.boundingBox();
  await page.mouse.move(b.x + b.width - 3, b.y + 40);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 45, b.y + 40, { steps: 8 });
  await page.mouse.up();
  p = await saved();
  assert.ok(p.audioTracks[0].out < 2);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  // Mute must silence preview, unmute restores it; source-library asset survives timeline deletion.
  await page
    .getByRole("button", { name: "Stummschalten", exact: true })
    .click();
  await page.getByRole("button", { name: "Zum Anfang", exact: true }).click();
  await page
    .getByRole("button", { name: "Timeline abspielen", exact: true })
    .click();
  await page.waitForTimeout(600);
  assert.equal(
    await page.getByTestId("imported-audio").evaluate((a) => a.volume),
    0,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "Ton einschalten", exact: true })
    .click();
  await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
  assert.equal(await page.locator(".timeline-music-clip").count(), 2);
  await page
    .getByRole("button", { name: "Audio entfernen", exact: true })
    .click();
  assert.equal(await page.locator(".timeline-music-clip").count(), 1);
  await page
    .getByRole("button", { name: "Audio Musik Ä.aiff hinzufügen", exact: true })
    .click();
  assert.equal(await page.locator(".timeline-music-clip").count(), 2);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  // Razor cuts a video at clicked source time; keyboard undo preserves duration.
  await page
    .getByRole("button", { name: "Rasierklingenwerkzeug", exact: true })
    .click();
  const clip = page.locator(".timeline-video-clip").first(),
    cb = await clip.boundingBox();
  await clip.click({ position: { x: cb.width * 0.5, y: 25 } });
  assert.equal(await page.locator(".timeline-video-clip").count(), 3);
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+z" : "Control+z",
  );
  assert.equal(await page.locator(".timeline-video-clip").count(), 2);
  await page
    .getByRole("button", { name: "Auswahlwerkzeug", exact: true })
    .click();
  // Real video reordering and edge trim, with non-destructive undo.
  const clips=page.locator('.timeline-video-clip');
  await clips.first().dragTo(clips.nth(1));
  p=await saved();assert.equal(p.clips[0].id,'c2');assert.equal(p.audioTracks[0].start,.2);
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();
  const firstClip=clips.first();await firstClip.scrollIntoViewIfNeeded();const vb=await firstClip.boundingBox();
  await page.mouse.move(vb.x+vb.width-3,vb.y+40);await page.mouse.down();await page.mouse.move(vb.x+vb.width-35,vb.y+40,{steps:6});await page.mouse.up();
  p=await saved();assert.ok(p.clips[0].out<1.4);
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();
  await page.screenshot({
    path: "test-results/studio-editor.png",
    fullPage: true,
  });
  // Trigger the actual export dialog and verify the produced MP4 preset and audible imported music.
  const output = path.join(temp, "SAP Schulung.mp4");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ filePath: file, canceled: false });
  }, output);
  await page
    .getByRole("button", { name: "MP4 exportieren", exact: true })
    .click();
  await page.getByLabel("Export Auflösung").selectOption("720");
  await page
    .getByRole("button", { name: "Export starten", exact: true })
    .click();
  await page.getByText(/Export abgeschlossen:/).waitFor({ timeout: 60000 });
  assert.ok((await stat(output)).size > 1000);
  const info = run(["-i", output, "-f", "null", "-"]).stderr;
  assert.match(info, /1280x720/);
  assert.match(info, /Audio: aac/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: normalized AIFF import, waveform, fades, multitrack drag/trim, cross-source playback with real audio, mute, split/undo, library reuse, razor, keyboard undo, 720p UI export",
    { packaged },
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/studio-editor-failure.png",
    fullPage: true,
  });
  console.log(await page.locator("body").innerText());
  throw error;
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.removeAllListeners("close")),
  );
  await app.close();
  await rm(temp, { recursive: true, force: true });
}
