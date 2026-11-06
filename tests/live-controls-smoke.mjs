import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  temp = await mkdtemp(path.join(os.tmpdir(), "checkpoint-live-"));
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
const page = await app.firstWindow(),
  errors = [];
page.setDefaultTimeout(15000);
console.log("App started");
app.on("window", (w) => w.on("pageerror", (e) => errors.push(e.message)));
page.on("pageerror", (e) => errors.push(e.message));
async function floating(hash) {
  for (let i = 0; i < 100; i++) {
    const w = app.windows().find((w) => w.url().endsWith("#" + hash));
    if (w) {
      await w.waitForLoadState("domcontentloaded");
      return w;
    }
    await page.waitForTimeout(100);
  }
  throw Error("Missing floating window: " + hash);
}
try {
  await mkdir("test-results", { recursive: true });
  await app.evaluate(
    ({ dialog, BrowserWindow }, dir) => {
      dialog.showSaveDialog = async () => ({ filePath: dir, canceled: false });
      BrowserWindow.getAllWindows()[0].setTitle("Checkpoint Live Test");
    },
    path.join(temp, "project"),
  );
  await page.getByRole("button", { name: "Aufnahme", exact: true }).waitFor();
  await page.evaluate(() => (document.title = "Checkpoint Live Test"));
  console.log("Loading sources");
  await page.getByRole("button", { name: "Aufnahme", exact: true }).click();
  await page.getByRole("button", { name: "Quellen laden" }).click();
  await page
    .getByRole("button", { name: "Checkpoint Live Test", exact: true })
    .click();
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Aufnahme starten" }).click();
  await page
    .getByText("Aufnahme läuft", { exact: true })
    .waitFor({ timeout: 20000 });
  console.log("Recording started");
  const pill = await floating("pill");
  await pill.getByRole("button", { name: "Pausieren", exact: true }).waitFor();
  await pill.waitForFunction(() => {
    const p = document.querySelector(".recording-pill");
    return (
      p && Math.abs(innerWidth - p.getBoundingClientRect().width - 16) <= 1
    );
  });
  const fit = await pill.evaluate(() => {
    const root = document
        .querySelector(".recording-pill")
        .getBoundingClientRect(),
      last = document.querySelector(".pill-main").getBoundingClientRect();
    return {
      nativeWidth: innerWidth,
      contentWidth: root.width,
      emptyRight: root.right - last.right,
    };
  });
  assert.ok(
    fit.emptyRight <= 14,
    "Pill must end directly after the last control",
  );
  console.log("Content-fitted pill:", fit);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "Checkpoint Live Test")
      .minimize(),
  );
  await page.waitForTimeout(700);
  const before = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({
      title: w.getTitle(),
      top: w.isAlwaysOnTop(),
      visible: w.isVisible(),
      minimized: w.isMinimized(),
      bounds: w.getBounds(),
    })),
  );
  assert.ok(before.find((w) => w.title === "Checkpoint Live Test").minimized);
  assert.ok(before.find((w) => w.title === "Checkpoint · Aufnahme").top);
  assert.ok(before.find((w) => w.title === "Checkpoint · Aufnahme").visible);
  // Emulate the window manager lowering and hiding the pill. It must recover without focus.
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "Checkpoint · Aufnahme",
    );
    w.setAlwaysOnTop(false);
    w.hide();
  });
  await page.waitForTimeout(1100);
  const recovered = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "Checkpoint · Aufnahme",
    );
    return {
      top: w.isAlwaysOnTop(),
      visible: w.isVisible(),
      focused: w.isFocused(),
    };
  });
  assert.ok(
    recovered.top && recovered.visible,
    "Pill must recover its topmost and visible state",
  );
  assert.equal(
    recovered.focused,
    false,
    "Topmost enforcement must not steal keyboard focus",
  );
  await page.waitForTimeout(1000);
  await pill.getByRole("button", { name: "Pausieren", exact: true }).click();
  await pill.getByRole("button", { name: "Fortsetzen", exact: true }).waitFor();
  const paused = await pill.evaluate(() => window.live.get());
  await page.waitForTimeout(650);
  const still = await pill.evaluate(() => window.live.get());
  assert.ok(
    Math.abs(still.elapsed - paused.elapsed) < 0.05,
    "Pause must freeze recording clock",
  );
  await pill.locator(".pill-checkpoint").click();
  await pill.waitForFunction(
    async () => (await window.live.get()).checkpointCount === 1,
  );
  assert.equal((await pill.evaluate(() => window.live.get())).status, "paused");
  await pill.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await pill.getByRole("button", { name: "Pausieren", exact: true }).waitFor();
  await page.waitForTimeout(700);
  await pill
    .getByRole("button", { name: "Zum Checkpoint zurück", exact: true })
    .click();
  await page.waitForTimeout(200);
  await pill.getByRole("button", { name: "Textfeld", exact: true }).click();
  const text = await floating("text");
  const input = text.getByRole("textbox", { name: "Text für die Aufnahme" });
  await input.waitFor();
  const marker = "LIVE TEXT – direkt während der Aufnahme";
  await input.fill(marker);
  await text.getByRole("combobox", { name: "Schriftgröße" }).selectOption("64");
  await text.getByLabel("Hintergrundfarbe", { exact: true }).fill("#123456");
  await page.waitForTimeout(1400);
  await text.screenshot({ path: "test-results/live-text.png" });
  await pill.screenshot({ path: "test-results/live-pill.png" });
  const overlayWindows = await app.evaluate(({ BrowserWindow, screen }) => ({
    windows: BrowserWindow.getAllWindows().map((w) => ({
      title: w.getTitle(),
      top: w.isAlwaysOnTop(),
      visible: w.isVisible(),
      bounds: w.getBounds(),
    })),
    area: screen.getPrimaryDisplay().workArea,
  }));
  const textBounds = overlayWindows.windows.find(
    (w) => w.title === "Checkpoint · Live-Text",
  ).bounds;
  assert.ok(
    Math.abs(textBounds.width / overlayWindows.area.width - 0.8) < 0.02,
  );
  await input.press("Escape");
  await pill.waitForFunction(
    async () => !(await window.live.get()).text.enabled,
  );
  const closed = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "Checkpoint · Live-Text")
      .isVisible(),
  );
  assert.equal(closed, false);
  await page.waitForTimeout(400);
  await pill.getByRole("button", { name: "Stoppen", exact: true }).click();
  await page
    .locator(".media-bin .panel-caption")
    .waitFor({ timeout: 20000 });
  await page.waitForFunction(
    () => document.querySelector(".program-canvas video")?.readyState >= 2,
  );
  await page.getByRole("button",{name:"Timeline abspielen",exact:true}).click();
  await page.waitForTimeout(300);
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  assert.equal(
    await page
      .getByText("The element has no supported sources.", { exact: true })
      .count(),
    0,
  );
  const p = JSON.parse(
    await readFile(path.join(temp, "project/project.checkpoint"), "utf8"),
  );
  assert.equal(p.takes.length, 1, "Checkpoints must not end the active take");
  assert.equal(p.checkpoints.length, 1);
  assert.equal(p.clips.length, 2);
  assert.ok(
    p.clips[1].in > p.clips[0].out + 0.4,
    "Retake must skip the original wrong interval",
  );
  assert.ok(
    p.takes[0].duration > p.clips.reduce((s, c) => s + c.out - c.in, 0) + 0.4,
  );
  const lastText = p.takes[0].textEvents
    .filter(
      (e) =>
        e.text.enabled &&
        e.text.text === marker &&
        e.text.background === "#123456",
    )
    .at(-1);
  const hide = p.takes[0].textEvents.find(
    (e) => e.time > lastText.time && !e.text.enabled,
  );
  assert.ok(lastText && hide);
  const ffmpeg = require("ffmpeg-static");
  const at = (lastText.time + hide.time) / 2;
  const frame = spawnSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-ss",
      String(at),
      "-i",
      path.join(temp, "project", p.takes[0].video),
      "-frames:v",
      "1",
      "-vf",
      "scale=640:360",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ],
    { maxBuffer: 5 * 1024 * 1024 },
  );
  assert.equal(frame.status, 0, frame.stderr.toString());
  const pixels = frame.stdout;
  assert.equal(pixels.length, 640 * 360 * 3);
  let background = 0,
    white = 0;
  for (let y = 50; y < 300; y++)
    for (let x = 80; x < 550; x++) {
      const i = (y * 640 + x) * 3,
        r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2];
      if (
        Math.abs(r - 18) < 12 &&
        Math.abs(g - 52) < 12 &&
        Math.abs(b - 86) < 12
      )
        background++;
      if (r > 210 && g > 210 && b > 210) white++;
    }
  assert.ok(background > 50000, "Overlay background must be in recorded video");
  assert.ok(white > 200, "Actual text glyphs must be in recorded video");
  const saved = spawnSync(
    ffmpeg,
    [
      "-y",
      "-v",
      "error",
      "-ss",
      String(at),
      "-i",
      path.join(temp, "project", p.takes[0].video),
      "-frames:v",
      "1",
      path.resolve("test-results/live-text-recorded.png"),
    ],
    { encoding: "utf8" },
  );
  assert.equal(saved.status, 0, saved.stderr);
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ filePath: file, canceled: false });
    },
    path.join(temp, "live.mp4"),
  );
  await page.getByRole("button", { name: "MP4 exportieren" }).click();
  await page.getByRole("button", {name:"Export starten",exact:true}).click();
  await page
    .getByText("Export abgeschlossen:", { exact: false })
    .waitFor({ timeout: 60000 });
  const exported = spawnSync(
    ffmpeg,
    ["-v", "error", "-i", path.join(temp, "live.mp4"), "-f", "null", "-"],
    { encoding: "utf8" },
  );
  assert.equal(exported.status, 0, exported.stderr);
  assert.deepEqual(errors, []);
  const report = {
    packaged,
    duration: p.takes[0].duration,
    clips: p.clips,
    checkpoints: p.checkpoints,
    backgroundPixels: background,
    textPixels: white,
    windows: before,
    errors,
  };
  await writeFile(
    "test-results/live-controls" + (packaged ? "-packaged" : "") + ".json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS: persistent pill above minimized main window; pause/resume; live checkpoint; live retake; large live text; Escape; burned-in text pixels; actual MP4 export.",
    report,
  );
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.removeAllListeners("close")),
  );
  await app.close();
  await rm(temp, { recursive: true, force: true });
}
