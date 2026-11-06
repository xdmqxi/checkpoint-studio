const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  dialog,
  shell,
  session,
} = require("electron");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
let win, root;
function inside(rel) {
  if (!root) throw Error("Open a project first");
  const p = path.resolve(root, rel);
  if (!p.startsWith(root + path.sep)) throw Error("Invalid project path");
  return p;
}
let saveQueue = Promise.resolve();
function save(p) {
  if (!root) return Promise.reject(Error("No project"));
  const folder = root,
    content = JSON.stringify(p, null, 2);
  const job = saveQueue
    .catch(() => {})
    .then(async () => {
      await fs.writeFile(path.join(folder, "project.tmp"), content);
      await fs.rename(
        path.join(folder, "project.tmp"),
        path.join(folder, "project.checkpoint"),
      );
    });
  saveQueue = job;
  return job;
}

function run(args, inspect = false) {
  return new Promise((resolve, reject) => {
    const binary = app.isPackaged
      ? path.join(
          process.resourcesPath,
          "ffmpeg",
          process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
        )
      : require("ffmpeg-static");
    let log = "";
    const child = spawn(binary, args);
    child.stderr.on("data", (d) => (log = (log + d).slice(-6000)));
    child.on("error", reject);
    child.on("close", (c) =>
      inspect
        ? resolve(/Stream[^\n]*Audio:/.test(log))
        : c === 0
          ? resolve()
          : reject(Error(log)),
    );
  });
}
ipcMain.handle("sources", async () => {
  const s = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 300, height: 180 },
  });
  return s.map((x) => ({
    id: x.id,
    name: x.name,
    thumbnail: x.thumbnail.toDataURL(),
  }));
});
ipcMain.handle("create", async () => {
  const d = await dialog.showSaveDialog(win, {
    title: "Projektordner erstellen",
    defaultPath: path.join(
      app.getPath("documents"),
      "Mein Tutorial.checkpoint-project",
    ),
  });
  if (d.canceled) return null;
  root = d.filePath;
  await fs.mkdir(path.join(root, "media"), { recursive: true });
  return root;
});
ipcMain.handle("open", async () => {
  const d = await dialog.showOpenDialog(win, {
    filters: [{ name: "Checkpoint Projekt", extensions: ["checkpoint"] }],
    properties: ["openFile"],
  });
  if (d.canceled) return null;
  const file = d.filePaths[0];
  const project = JSON.parse(await fs.readFile(file, "utf8"));
  if (
    project.version !== 1 ||
    !Array.isArray(project.clips) ||
    !Array.isArray(project.takes)
  )
    throw Error("Unsupported project");
  root = path.dirname(file);
  return { root, project };
});
ipcMain.handle("save", (_, p) => save(p));
ipcMain.handle("write", async (_, rel, data) => {
  const p = inside(rel);
  await fs.writeFile(p, Buffer.from(data));
  return rel;
});
ipcMain.handle(
  "read",
  async (_, rel) => new Uint8Array(await fs.readFile(inside(rel))),
);
ipcMain.handle("hasAudio", (_, rel) => run(["-i", inside(rel)], true));
ipcMain.handle("importMedia", async (_, kind) => {
  if (!root) throw Error("Bitte zuerst ein Projekt erstellen oder öffnen.");
  const audio = kind === "audio";
  const d = await dialog.showOpenDialog(win, {
    title: audio ? "Audio importieren" : "Video importieren",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: audio ? "Audio" : "Video",
        extensions: audio
          ? [
              "wav",
              "mp3",
              "m4a",
              "flac",
              "ogg",
              "aac",
              "aiff",
              "aif",
              "wma",
              "opus",
            ]
          : ["mp4", "mov", "webm", "mkv", "avi", "m4v"],
      },
    ],
  });
  if (d.canceled) return [];
  const result = [];
  for (const file of d.filePaths) {
    const id = randomUUID(),
      sourcePath = "media/" + id + "-original" + path.extname(file);
    const rel = "media/" + id + (audio ? ".wav" : ".mp4");
    try {
      await fs.copyFile(file, inside(sourcePath));
      await run(
        audio
          ? [
              "-y",
              "-i",
              inside(sourcePath),
              "-vn",
              "-c:a",
              "pcm_s16le",
              "-ar",
              "48000",
              "-ac",
              "2",
              inside(rel),
            ]
          : [
              "-y",
              "-i",
              inside(sourcePath),
              "-map",
              "0:v:0",
              "-map",
              "0:a:0?",
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "20",
              "-pix_fmt",
              "yuv420p",
              "-vf",
              "scale=trunc(iw/2)*2:trunc(ih/2)*2",
              "-c:a",
              "aac",
              "-ar",
              "48000",
              "-ac",
              "2",
              "-movflags",
              "+faststart",
              inside(rel),
            ],
      );
      result.push({
        path: rel,
        sourcePath,
        name: path.basename(file),
        hasAudio: audio || (await run(["-i", inside(rel)], true)),
      });
    } catch (error) {
      await fs.rm(inside(rel), { force: true });
      await fs.rm(inside(sourcePath), { force: true });
      throw Error(
        `Import fehlgeschlagen: ${path.basename(file)}. ${error.message}`,
      );
    }
  }
  return result;
});
ipcMain.handle("reveal", () => root && shell.openPath(root));
ipcMain.handle("exportVideo", async (_, project, options = {}) => {
  if (!project.clips.length) throw Error("Timeline empty");
  const d = await dialog.showSaveDialog(win, {
    defaultPath: project.name + ".mp4",
    filters: [{ name: "MP4", extensions: ["mp4"] }],
  });
  if (d.canceled) return null;
  const height = options.height === 720 ? 720 : 1080,
    width = height === 720 ? 1280 : 1920;
  const fps = options.fps === 60 ? 60 : 30;
  const crf = options.quality === "high" ? "18" : "22";
  const temp = await fs.mkdtemp(path.join(root, "export-work-"));
  await fs.mkdir(temp, { recursive: true });
  try {
    const files = [];
    let timelineOffset = 0;
    const sourceAudio = new Map();
    for (let i = 0; i < project.clips.length; i++) {
      const c = project.clips[i],
        take = project.takes.find((t) => t.id === c.takeId);
      if (!take) throw Error("Missing take");
      const out = path.join(temp, `part-${i}.mp4`);
      const args = [
        "-y",
        "-ss",
        String(c.in),
        "-t",
        String(c.out - c.in),
        "-i",
        inside(take.video),
      ];
      const audio = [];
      const clipGain = c.muted ? 0 : Math.max(0, Math.min(1, c.volume ?? 1));
      if (!take.system && !take.mic) {
        if (!sourceAudio.has(take.video))
          sourceAudio.set(
            take.video,
            await run(["-i", inside(take.video)], true),
          );
        if (sourceAudio.get(take.video))
          audio.push(
            `[0:a]volume=${(project.disabledAudioSources?.includes("system") ? 0 : project.volume.system) * clipGain}`,
          );
      }
      let idx = 1;
      for (const a of ["system", "mic"])
        if (take[a]) {
          args.push(
            "-ss",
            String(c.in),
            "-t",
            String(c.out - c.in),
            "-i",
            inside(take[a]),
          );
          audio.push(
            `[${idx++}:a]volume=${(project.disabledAudioSources?.includes(a) ? 0 : project.volume[a]) * clipGain}`,
          );
        }
      // Every segment has an audio stream of exactly its video length.
      args.push(
        "-f",
        "lavfi",
        "-t",
        String(c.out - c.in),
        "-i",
        "anullsrc=r=48000:cl=stereo",
      );
      audio.push(`[${idx++}:a]anull`);
      if (audio.length) {
        args.push(
          "-filter_complex",
          audio.map((a, j) => a + `[a${j}]`).join(";") +
            ";" +
            audio.map((_, j) => `[a${j}]`).join("") +
            `amix=inputs=${audio.length}:normalize=0,apad,atrim=duration=${c.out - c.in}[mix]`,
          "-map",
          "0:v",
          "-map",
          "[mix]",
          "-c:a",
          "aac",
        );
      } else args.push("-map", "0:v", "-map", "0:a?", "-c:a", "aac");
      args.push(
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
        "-r",
        String(fps),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-ar",
        "48000",
        "-ac",
        "2",
        out,
      );
      await run(args);
      files.push(out);
      win?.webContents.send(
        "export:progress",
        Math.round(((i + 1) / project.clips.length) * 85),
      );
      timelineOffset += c.out - c.in;
    }
    const list = path.join(temp, "concat.txt");
    await fs.writeFile(
      list,
      files.map((f) => `file '${path.basename(f)}'`).join("\n"),
    );
    await run([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      path.join(temp, "sequence.mp4"),
    ]);
    const tracks = (project.audioTracks || []).filter(
      (t) => !t.muted && t.start < timelineOffset && t.out > t.in,
    );
    if (tracks.length) {
      const args = ["-y", "-i", path.join(temp, "sequence.mp4")];
      const filters = ["[0:a]anull[original]"],
        labels = ["[original]"];
      for (const [i, track] of tracks.entries()) {
        const length = track.out - track.in;
        args.push(
          "-ss",
          String(track.in),
          "-t",
          String(length),
          "-i",
          inside(track.path),
        );
        let filter = `[${i + 1}:a]asetpts=PTS-STARTPTS,volume=${Math.max(0, Math.min(1, track.volume ?? 1))}`;
        if (track.fadeIn > 0)
          filter += `,afade=t=in:st=0:d=${Math.min(length, track.fadeIn)}`;
        if (track.fadeOut > 0) {
          const fade = Math.min(length, track.fadeOut);
          filter += `,afade=t=out:st=${length - fade}:d=${fade}`;
        }
        filter += `,adelay=${Math.round(Math.max(0, track.start) * 1000)}:all=1[a${i}]`;
        filters.push(filter);
        labels.push(`[a${i}]`);
      }
      filters.push(
        labels.join("") +
          `amix=inputs=${labels.length}:normalize=0,alimiter=limit=0.95:level=0:latency=1,apad,atrim=duration=${timelineOffset}[mix]`,
      );
      args.push(
        "-filter_complex",
        filters.join(";"),
        "-map",
        "0:v:0",
        "-map",
        "[mix]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-t",
        String(timelineOffset),
        "-movflags",
        "+faststart",
        d.filePath,
      );
      await run(args);
    } else await fs.copyFile(path.join(temp, "sequence.mp4"), d.filePath);
    win?.webContents.send("export:progress", 100);
    return d.filePath;
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, p, cb) =>
    cb(wc === win?.webContents && ["media", "display-capture"].includes(p)),
  );
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1050,
    minHeight: 740,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon.png")
      : path.join(__dirname, "../build/icon.png"),
    backgroundColor: "#121e2b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  require("./floating.cjs")(win);
  win.on("close", (e) => {
    const result = dialog.showMessageBoxSync(win, {
      type: "question",
      buttons: ["Weiterarbeiten", "Beenden"],
      defaultId: 0,
      cancelId: 0,
      message: "Checkpoint Studio beenden?",
      detail:
        "Beende zuerst laufende Aufnahmen. Bereits gespeicherte Takes bleiben im Projektordner erhalten.",
    });
    if (result === 0) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
