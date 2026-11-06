import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  temp = await mkdtemp(path.join(os.tmpdir(), "checkpoint-editor-")),
  projectDir = path.join(temp, "project");
await mkdir(path.join(projectDir, "media"), { recursive: true });
await mkdir("test-results", { recursive: true });
const video = path.join(projectDir, "media/test.mp4");
const generated = spawnSync(
  require("ffmpeg-static"),
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=30",
    "-t",
    "9",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    video,
  ],
  { encoding: "utf8" },
);
assert.equal(generated.status, 0, generated.stderr);
const fixture = {
  version: 1,
  name: "Tutorial · Checkpoint-Übersicht",
  takes: [
    { id: "take-a", video: "media/test.mp4", duration: 9 },
    { id: "take-b", video: "media/test.mp4", duration: 9 },
  ],
  clips: [
    { id: "a", takeId: "take-a", in: 2, out: 8 },
    { id: "b", takeId: "take-b", in: 1, out: 7 },
  ],
  checkpoints: [
    { id: "m1", name: "Projekt erstellen", time: 1 },
    { id: "m2", name: "Programm erklären", time: 5 },
    { id: "m3", name: "Ergebnis prüfen", time: 8 },
  ],
  volume: { mic: 1, system: 1 },
};
const file = path.join(projectDir, "project.checkpoint");
await writeFile(file, JSON.stringify(fixture));
const packaged = process.argv.includes("--packaged");
const app = await electron.launch(
  packaged
    ? {
        executablePath: process.env.CHECKPOINT_APP_PATH || path.resolve(
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
  await page.getByRole("heading", { name: "Deine Checkpoints" }).waitFor();
  const audioFile = path.join(temp, "Musik.wav");
  const audioResult = spawnSync(require("ffmpeg-static"), ["-y", "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000", "-t", "2", audioFile], {encoding:"utf8"});
  assert.equal(audioResult.status, 0, audioResult.stderr);
  await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({filePaths:[file], canceled:false}); }, audioFile);
  await page.getByRole("button", {name:"Audio importieren", exact:true}).click();
  await page.getByLabel("Position Musik.wav", {exact:true}).waitFor();
  await page.getByLabel("Position Musik.wav", {exact:true}).fill("0.5");
  await page.waitForTimeout(700);
  const savedAudio = JSON.parse(await readFile(file, "utf8")).audioTracks[0];
  assert.equal(savedAudio.start, 0.5);
  assert.ok(savedAudio.out > 1.9);
  assert.ok((await readFile(path.join(projectDir, savedAudio.path))).length > 1000);
  await page.locator('.sequence-panel').screenshot({path:'test-results/audio-import.png'});
  await page.getByRole("button", {name:"Audio entfernen", exact:true}).click();
  const tools=page.getByRole('toolbar',{name:'Schnittwerkzeuge',exact:true});
  assert.equal(await tools.getByRole('spinbutton').count(),2);
  assert.equal(await page.locator('.properties input[type="number"]').count(),0);
  assert.equal(await page.locator('.properties button').count(),0);
  assert.equal(await page.locator(".checkpoint-marker").count(), 3);
  assert.equal(await page.locator(".checkpoint-card").count(), 3);
  await page
    .getByRole("button", {
      name: "Checkpoint Ergebnis prüfen bei 00:08.0",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector(".program-canvas video").currentTime - 3) < 0.1,
  );
  assert.ok(
    (
      await page.locator(".timeline-video-clip.selected").getAttribute("title")
    ).includes("Take 2"),
  );
  await page.getByRole("button", { name: "Checkpoint", exact: true }).click();
  assert.equal(await page.locator(".checkpoint-card").count(), 4);
  await page.waitForTimeout(700);
  let saved = JSON.parse(await readFile(file, "utf8"));
  assert.ok(
    Math.abs(saved.checkpoints[3].time - 8) < 0.1,
    "Editor marker belongs at playhead, not project end",
  );
  await page
    .getByRole("button", {
      name: "Checkpoint Projekt erstellen bei 00:01.0",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector(".program-canvas video").currentTime - 3) < 0.1,
  );
  await page.getByLabel("Start (Sekunden)", { exact: true }).fill("3");
  await page.waitForTimeout(700);
  saved = JSON.parse(await readFile(file, "utf8"));
  assert.equal(saved.checkpoints.find((c) => c.id === "m3").time, 7);
  await page
    .getByLabel("Checkpoint 3 umbenennen", { exact: true })
    .fill("Einstellungen prüfen");
  await page.waitForTimeout(200);
  await page
    .getByRole("button", {
      name: "Zu Einstellungen prüfen springen",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector(".program-canvas video").currentTime - 3) < 0.1,
  );
  await page
    .getByRole("button", { name: "Timeline vergrößern", exact: true })
    .click();
  assert.equal(await page.locator(".timeline-zoom").innerText(), "150 %");
  await page
    .getByRole("button", { name: "Timeline verkleinern", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/editor-checkpoints.png",
    fullPage: true,
  });
  await page
    .locator(".sequence-panel")
    .screenshot({ path: "test-results/checkpoint-timeline.png" });
  await page
    .getByRole("button", {
      name: "Checkpoint Einstellungen prüfen entfernen",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(".checkpoint-card").count(), 3);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal(await page.locator(".checkpoint-card").count(), 4);
  // Precise seek through the ruler, including the second clip's non-zero source offset.
  const ruler = page.getByLabel("Zeitleiste", { exact: true }),
    box = await ruler.boundingBox();
  await ruler.click({ position: { x: box.width * 0.75, y: 15 } });
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector(".program-canvas video").currentTime - 4.25) <
      0.15,
  );
  await page.getByRole('button',{name:'Clip am Abspielkopf schneiden',exact:true}).click();
  assert.equal(await page.locator('.timeline-video-clip').count(),3);
  await ruler.click({position:{x:box.width*.85,y:15}});
  await page.waitForFunction(()=>Math.abs(document.querySelector('.program-canvas video').currentTime-5.35)<.15);
  await tools.getByRole('button',{name:'Duplizieren',exact:true}).click();
  assert.equal(await page.locator('.timeline-video-clip').count(),4);
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();
  assert.equal(await page.locator('.timeline-video-clip').count(),3);
  await tools.getByRole('button',{name:'Löschen & nachrücken',exact:true}).click();
  assert.equal(await page.locator('.timeline-video-clip').count(),2);
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();
  assert.equal(await page.locator('.timeline-video-clip').count(),3);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: legacy checkpoint loading; markers; cross-take seek; checkpoint at playhead; ripple updates; rename; zoom; delete/undo; ruler seek.",
    { packaged },
  );
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.removeAllListeners("close")),
  );
  await app.close();
  await rm(temp, { recursive: true, force: true });
}
