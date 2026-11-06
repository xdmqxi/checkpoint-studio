import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const dir = await mkdtemp(path.join(os.tmpdir(), "checkpoint-record-"));
const packaged = process.argv.includes("--packaged");
const app = await electron.launch(packaged ? {executablePath:path.resolve("release/mac-arm64/Checkpoint Studio.app/Contents/MacOS/Checkpoint Studio"),args:[]} : { args: ["."], cwd: process.cwd() });
const page = await app.firstWindow();
try {
  await app.evaluate(
    ({ dialog }, dir) => {
      dialog.showSaveDialog = async () => ({ filePath: dir, canceled: false });
    },
    path.join(dir, "project"),
  );
  await page.getByRole("button", { name: "Aufnahme", exact: true }).click();
  await page.getByRole("button", { name: "Quellen laden" }).click();
  const source = page.getByRole("button", {
    name: "Checkpoint Studio",
    exact: true,
  });
  await source.waitFor();
  await source.click();
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Aufnahme starten" }).click();
  await page
    .getByText("Aufnahme läuft", { exact: true })
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stoppen", exact: true }).click();
  await page.locator(".media-bin .panel-caption").waitFor();
  await page.waitForTimeout(1000);
  const file = path.join(dir, "project/project.checkpoint");
  const p = JSON.parse(await readFile(file, "utf8"));
  assert.equal(p.takes.length, 1);
  assert.ok(p.takes[0].duration >= 1);
  assert.ok(
    (await stat(path.join(dir, "project", p.takes[0].video))).size > 1000,
  );
  await page.getByRole("button", { name: "Checkpoint", exact: true }).click();
  await page.waitForTimeout(800);
  const p2 = JSON.parse(await readFile(file, "utf8"));
  assert.equal(p2.checkpoints.length, 1);
  await page.screenshot({ path: "test-results/real-recording.png" });
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ filePath: file, canceled: false });
    },
    path.join(dir, "real-export.mp4"),
  );
  await page.getByRole("button", { name: "MP4 exportieren" }).click();
  await page.getByRole("button", {name:"Export starten",exact:true}).click();
  await page
    .getByText("Export abgeschlossen:", { exact: false })
    .waitFor({ timeout: 30000 });
  assert.ok((await stat(path.join(dir, "real-export.mp4"))).size > 1000);
  const binary = require("ffmpeg-static");
  const decode = spawnSync(
    binary,
    ["-i", path.join(dir, "project", p.takes[0].video), "-f", "null", "-"],
    { encoding: "utf8" },
  );
  assert.equal(decode.status, 0, decode.stderr);
  console.log(
    "Real app-window capture, stop, project save, checkpoint, UI-triggered MP4 export and FFmpeg decode passed.",
    {
      duration: p.takes[0].duration,
      bytes: (await stat(path.join(dir, "project", p.takes[0].video))).size,
    },
  );
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.removeAllListeners("close")),
  );
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
