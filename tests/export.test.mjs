import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm, stat, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url),
  Module = require("node:module"),
  handlers = {};
let answers = [];
const electron = {
  app: {
    whenReady: () => ({ then: () => {} }),
    on: () => {},
    getPath: () => os.tmpdir(),
  },
  ipcMain: { handle: (k, f) => (handlers[k] = f) },
  dialog: {
    showSaveDialog: async () => ({
      filePath: answers.shift(),
      canceled: false,
    }),
    showOpenDialog: async () => ({
      filePaths: [answers.shift()],
      canceled: false,
    }),
  },
};
const original = Module._load;
Module._load = function (name, ...args) {
  return name === "electron" ? electron : original.call(this, name, ...args);
};
require("../electron/main.cjs");
Module._load = original;
const ffmpeg = require("ffmpeg-static");
function run(args) {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stderr;
}
test("real export: two source offsets, separate mic, concatenation and portable reopen", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "checkpoint-test-"));
  try {
    const root = path.join(dir, "Projekt mit Leerzeichen und 'Apostroph' Ä");
    answers.push(root);
    await handlers.create();
    run([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=30",
      "-t",
      "2",
      "-c:v",
      "libvpx-vp9",
      path.join(root, "media/a.webm"),
    ]);
    run([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "2",
      "-c:a",
      "libopus",
      path.join(root, "media/m.webm"),
    ]);
    const p = {
      version: 1,
      name: "Test",
      takes: [
        { id: "a", video: "media/a.webm", mic: "media/m.webm", duration: 2 },
      ],
      clips: [
        { id: "1", takeId: "a", in: 0.25, out: 1 },
        { id: "2", takeId: "a", in: 1, out: 1.75 },
      ],
      audioTracks: [
        {
          id: "music",
          path: "media/m.webm",
          name: "Musik",
          start: 0.4,
          in: 0,
          out: 1,
          volume: 0.3,
          fadeIn: 0.25,
          fadeOut: 0.25,
        },
      ],
      checkpoints: [],
      volume: { mic: 0, system: 1 },
    };
    await handlers.save(null, p);
    assert.equal(
      JSON.parse(await readFile(path.join(root, "project.checkpoint"), "utf8"))
        .clips.length,
      2,
    );
    await assert.rejects(() => handlers.read(null, "../escape"), /Invalid/);
    const output = path.join(dir, "output.mp4");
    answers.push(output);
    assert.equal(await handlers.exportVideo(null, p), output);
    assert.ok((await stat(output)).size > 10000);
    const info = run(["-i", output, "-f", "null", "-"]);
    assert.match(info, /Video: h264/);
    assert.match(info, /Audio: aac/);
    assert.match(info, /1920x1080/);
    assert.match(info, /Duration: 00:00:01\.5/);
    function energy(start) {
      const decoded = spawnSync(ffmpeg, [
        "-ss",
        String(start),
        "-i",
        output,
        "-t",
        "0.15",
        "-f",
        "s16le",
        "-ac",
        "1",
        "-ar",
        "8000",
        "pipe:1",
      ]);
      assert.equal(decoded.status, 0);
      let sum = 0;
      for (let i = 0; i < decoded.stdout.length; i += 2)
        sum += Math.abs(decoded.stdout.readInt16LE(i));
      return sum / (decoded.stdout.length / 2);
    }
    assert.ok(
      energy(0.05) < 5,
      "Imported audio must not play before its timeline position",
    );
    assert.ok(
      energy(0.5) > 100,
      "Imported audio must be audible in exported MP4",
    );
    assert.ok(
      energy(1.0) > 100,
      "Imported audio must continue across the video cut",
    );
    assert.ok(
      energy(0.41) < energy(0.75) * 0.8,
      "Fade-in must be audible in exported samples",
    );
    assert.ok(
      energy(1.3) < energy(0.9) * 0.8,
      "Fade-out must continue correctly across the video cut",
    );
    answers.push(path.join(root, "project.checkpoint"));
    assert.deepEqual((await handlers.open()).project, p);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("real imports: AIFF normalized to WAV, MKV normalized to MP4, embedded audio retained in 720p60 export", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "checkpoint-import-"));
  try {
    const root = path.join(dir, "project");
    answers.push(root);
    await handlers.create();
    const audio = path.join(dir, "Sprache Ä.aiff");
    run([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:sample_rate=44100",
      "-t",
      "0.6",
      audio,
    ]);
    answers.push(audio);
    const [asset] = await handlers.importMedia(null, "audio");
    assert.ok(asset.path.endsWith(".wav"));
    assert.equal(
      (await handlers.read(null, asset.path)).subarray(0, 4).toString(),
      "82,73,70,70",
    );
    assert.equal(
      (await readFile(path.join(root, asset.sourcePath))).compare(
        await readFile(audio),
      ),
      0,
    );
    const video = path.join(dir, "Video mit Ton.mkv");
    run([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=blue:size=320x180:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "0.6",
      "-c:v",
      "libx264",
      "-c:a",
      "pcm_s16le",
      video,
    ]);
    answers.push(video);
    const [media] = await handlers.importMedia(null, "video");
    assert.ok(media.path.endsWith(".mp4"));
    assert.equal(media.hasAudio, true);
    assert.equal(await handlers.hasAudio(null, media.path), true);
    assert.match(
      run(["-i", path.join(root, media.path), "-f", "null", "-"]),
      /Audio: aac/,
    );
    const p = {
      version: 1,
      name: "Importtest",
      takes: [{ id: "t", video: media.path, duration: 0.6 }],
      clips: [{ id: "c", takeId: "t", in: 0, out: 0.5 }],
      audioTracks: [],
      checkpoints: [],
      volume: { mic: 1, system: 1 },
    };
    const output = path.join(dir, "out.mp4");
    answers.push(output);
    await handlers.exportVideo(null, p, { height: 720, fps: 60 });
    const info = run(["-i", output, "-f", "null", "-"]);
    assert.match(info, /1280x720/);
    assert.match(info, /60 fps/);
    assert.match(info, /Audio: aac/);
    const samples = spawnSync(ffmpeg, [
      "-i",
      output,
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "8000",
      "pipe:1",
    ]).stdout;
    let peak = 0;
    for (let i = 0; i < samples.length; i += 2)
      peak = Math.max(peak, Math.abs(samples.readInt16LE(i)));
    assert.ok(peak > 1000, "Embedded video sound must remain audible");
    const mutedOutput = path.join(dir, "source-removed.mp4");
    answers.push(mutedOutput);
    await handlers.exportVideo(
      null,
      { ...p, disabledAudioSources: ["system"] },
      { height: 720 },
    );
    const mutedSamples = spawnSync(ffmpeg, [
      "-i",
      mutedOutput,
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "8000",
      "pipe:1",
    ]).stdout;
    let mutedPeak = 0;
    for (let i = 0; i < mutedSamples.length; i += 2)
      mutedPeak = Math.max(mutedPeak, Math.abs(mutedSamples.readInt16LE(i)));
    assert.ok(
      mutedPeak < 5,
      "Removed PC/video audio source must be silent in export",
    );
    const invalid = path.join(dir, "broken.mp3");
    await writeFile(invalid, "This is not audio");
    answers.push(invalid);
    await assert.rejects(
      () => handlers.importMedia(null, "audio"),
      /Import fehlgeschlagen/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
