import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Video,
  Scissors,
  Settings,
  Plus,
  FolderOpen,
  Flag,
  Mic,
  Monitor,
  Square,
  Pause,
  Play,
  RotateCcw,
  Download,
  Trash2,
  ChevronRight,
  Film,
  Volume2,
  Check,
  Command,
  Type,
} from "lucide-react";
import { duration, retake } from "./model.mjs";
import "./style.css";
import {
  locateTime,
  timelineTime,
  reconcileCheckpoints,
} from "./checkpoints.mjs";
import { Floating } from "./Floating";
import { RecordingSession } from "./recording";
import { defaultText, type LiveText } from "./compositor";
import { LiveTimeline } from "./live-model.mjs";
declare global {
  interface Window {
    studio: any;
  }
}
import type { Take, Project, AudioTrack } from "./project";
import { StudioEditor } from "./StudioEditor";
const empty = (): Project => ({
  version: 1,
  name: "Mein Tutorial",
  takes: [],
  clips: [],
  checkpoints: [],
  volume: { mic: 1, system: 1 },
});
const fmt = (t: number) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
function App() {
  const [page, setPage] = useState("dashboard"),
    [p, setP] = useState<Project>(empty),
    [root, setRoot] = useState(""),
    [sources, setSources] = useState<any[]>([]),
    [source, setSource] = useState(""),
    [mic, setMic] = useState(true),
    [system, setSystem] = useState(false),
    [fps, setFps] = useState(30),
    [quality, setQuality] = useState(1080),
    [status, setStatus] = useState("idle"),
    [elapsed, setElapsed] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [work, setWork] = useState("Medien werden verarbeitet …"),
    [exportProgress, setExportProgress] = useState(0),
    [selected, setSelected] = useState(""),
    [playhead, setPlayhead] = useState(0),
    [theme, setTheme] = useState(localStorage.sapAppearance || "dark"),
    [liveText, setLiveText] = useState<LiveText>(defaultText);
  const active = useRef<{
      id: string;
      recording: RecordingSession;
      timeline: LiveTimeline;
      textEvents: { time: number; text: LiveText }[];
    } | null>(null),
    textRef = useRef(liveText),
    commands = useRef<(c: any) => void>(() => {}),
    clock = useRef(0),
    history = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    project = useRef(p),
    statusRef = useRef(status);
  textRef.current = liveText;
  project.current = p;
  statusRef.current = status;
  const notice = (e: any) => setMessage(e?.message || String(e));
  const change = (n: Project) => {
    history.current.push(project.current);
    future.current = [];
    const normalized = reconcileCheckpoints(project.current, n);
    project.current = normalized;
    setP(normalized);
  };
  const clip = p.clips.find((c) => c.id === selected);
  const take = p.takes.find((t) => t.id === clip?.takeId);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.sapAppearance = theme;
  }, [theme]);
  useEffect(() => {
    if (root) {
      const t = setTimeout(() => window.studio.save(p).catch(notice), 500);
      return () => clearTimeout(t);
    }
  }, [p, root]);
  useEffect(
    () =>
      window.studio.onExportProgress?.((value: number) =>
        setExportProgress(value),
      ),
    [],
  );
  async function importAudio() {
    try {
      if (!root && !(await create())) return;
      setBusy(true);
      setWork("Audio wird importiert und vorbereitet …");
      setExportProgress(0);
      for (const file of await window.studio.importMedia("audio")) {
        const bytes = await window.studio.read(file.path);
        const context = new AudioContext();
        let decoded: AudioBuffer;
        try {
          decoded = await context.decodeAudioData(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ),
          );
        } finally {
          await context.close();
        }
        const length = decoded.duration;
        if (!Number.isFinite(length) || length <= 0)
          throw Error("Unbekannte Audiodauer");
        const channel = decoded.getChannelData(0),
          peaks: number[] = [];
        for (let i = 0; i < 200; i++) {
          const from = Math.floor((i * channel.length) / 200),
            to = Math.floor(((i + 1) * channel.length) / 200);
          let peak = 0;
          for (let j = from; j < to; j++)
            peak = Math.max(peak, Math.abs(channel[j]));
          peaks.push(peak);
        }
        const max = Math.max(...peaks, 0.001);
        const normalized = peaks.map((v) => v / max);
        const old = project.current,
          id = crypto.randomUUID();
        const start = timelineTime(old, selected, playhead);
        const tracks = old.audioTracks || [];
        const lane =
          [0, 1, 2].find(
            (lane) =>
              !tracks.some(
                (t) =>
                  (t.lane || 0) === lane &&
                  t.start < start + length &&
                  t.start + t.out - t.in > start,
              ),
          ) ?? 0;
        const track: AudioTrack = {
          ...file,
          id,
          assetId: id,
          start,
          in: 0,
          out: length,
          duration: length,
          volume: 1,
          lane,
          fadeIn: 0,
          fadeOut: 0,
          peaks: normalized,
        };
        change({
          ...old,
          audioTracks: [...tracks, track],
          audioLibrary: [...(old.audioLibrary || tracks), track],
        });
      }
      setPage("editor");
    } catch (e) {
      notice(e);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (status !== "idle") return false;
    if (root) await window.studio.save(project.current);
    const r = await window.studio.create();
    if (!r) return false;
    setRoot(r);
    const next = empty();
    project.current = next;
    setP(next);
    setSelected("");
    setPlayhead(0);
    history.current = [];
    future.current = [];
    return true;
  }
  async function open() {
    if (status !== "idle") return;
    try {
      if (root) await window.studio.save(project.current);
      const r = await window.studio.open();
      if (r) {
        const next = reconcileCheckpoints(r.project, r.project);
        if (!next.audioLibrary)
          next.audioLibrary = (next.audioTracks || [])
            .filter(
              (t: AudioTrack, i: number, a: AudioTrack[]) =>
                a.findIndex((x) => x.path === t.path) === i,
            )
            .map((t: AudioTrack) => ({
              ...t,
              in: 0,
              out: t.duration || t.out,
              duration: t.duration || t.out,
              assetId: t.assetId || t.id,
            }));
        project.current = next;
        setP(next);
        setPlayhead(next.clips[0]?.in || 0);
        setRoot(r.root);
        setSelected(r.project.clips[0]?.id || "");
        history.current = [];
        future.current = [];
        setPage("editor");
      }
    } catch (e) {
      notice(e);
    }
  }
  async function loadSources() {
    try {
      setSources(await window.studio.sources());
    } catch (e) {
      notice(e);
    }
  }
  function updateText(next: LiveText) {
    textRef.current = next;
    setLiveText(next);
    const current = active.current;
    if (current)
      current.textEvents.push({
        time: current.recording.now(),
        text: { ...next },
      });
  }
  async function start() {
    if (active.current || statusRef.current !== "idle") return;
    try {
      if (!source) throw Error("Bitte zuerst eine Aufnahmequelle auswählen.");
      if (!root && !(await create())) return;
      setBusy(true);
      statusRef.current = "starting";
      const recording = new RecordingSession({
        sourceId: source,
        mic,
        quality,
        fps,
        text: () => textRef.current,
        onElapsed: (n) => {
          clock.current = n;
          setElapsed(n);
        },
        onEnded: () => commands.current({ action: "stop" }),
      });
      active.current = {
        id: crypto.randomUUID(),
        recording,
        timeline: new LiveTimeline(),
        textEvents: [{ time: 0, text: { ...textRef.current } }],
      };
      await recording.start();
      clock.current = 0;
      setElapsed(0);
      statusRef.current = "recording";
      setStatus("recording");
      setMessage(
        "Die schwebende Pille bleibt über deinen Fenstern. Checkpoints und Text sind während der Aufnahme verfügbar.",
      );
    } catch (e) {
      active.current = null;
      statusRef.current = "idle";
      setStatus("idle");
      notice(e);
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    const current = active.current;
    if (!current || !["recording", "paused"].includes(statusRef.current))
      return;
    const end = current.recording.now();
    const ranges = current.timeline.snapshot(end);
    setWork("Aufnahme wird gespeichert …");
    setExportProgress(0);
    statusRef.current = "saving";
    setStatus("idle");
    setBusy(true);
    try {
      const result = await current.recording.stop();
      const t: Take = {
        id: current.id,
        video: "",
        duration: result.duration,
        textEvents: current.textEvents,
      };
      for (const { key, blob } of result.files) {
        const path = `media/${t.id}-${key}.webm`;
        await window.studio.write(path, await blob.arrayBuffer());
        (t as any)[key] = path;
      }
      const clips = ranges
        .map((r) => ({
          id: crypto.randomUUID(),
          takeId: t.id,
          in: r.in,
          out: Math.min(r.out, t.duration),
        }))
        .filter((c) => c.out > c.in + 0.001);
      const old = project.current;
      const next = {
        ...old,
        takes: [...old.takes, t],
        clips: [...old.clips, ...clips],
      };
      change(next);
      await window.studio.save(next);
      setSelected(clips[0]?.id || "");
      setPage("editor");
      setMessage(
        "Aufnahme gespeichert – Live-Text ist im Video enthalten. Verworfene Abschnitte bleiben im Original-Take erhalten.",
      );
    } catch (e) {
      notice(e);
    } finally {
      active.current = null;
      statusRef.current = "idle";
      setBusy(false);
      updateText({ ...textRef.current, enabled: false });
    }
  }
  function pause() {
    const current = active.current;
    if (!current) return;
    if (statusRef.current === "recording") {
      current.recording.pause();
      statusRef.current = "paused";
      setStatus("paused");
    } else if (statusRef.current === "paused") {
      current.recording.resume();
      statusRef.current = "recording";
      setStatus("recording");
    }
  }
  function checkpoint() {
    const current = active.current,
      old = project.current;
    const sourceNow = current?.recording.now() ?? 0;
    const time = current
      ? duration(old) + current.timeline.duration(sourceNow)
      : page === "editor" && clip
        ? timelineTime(old, clip.id, playhead)
        : duration(old);
    const sourcePosition = current
      ? { takeId: current.id, sourceTime: sourceNow }
      : page === "editor" && clip
        ? {
            takeId: clip.takeId,
            clipId: clip.id,
            sourceTime: playhead,
          }
        : {};
    change({
      ...old,
      checkpoints: [
        ...old.checkpoints,
        {
          id: crypto.randomUUID(),
          name: `Schritt ${old.checkpoints.length + 1}`,
          time,
          ...sourcePosition,
        },
      ],
    });
    setMessage(
      `Checkpoint bei ${fmt(time)} gesetzt. ${current ? "Die Aufnahme läuft weiter." : ""}`,
    );
  }
  function restore(time: number) {
    const old = project.current,
      current = active.current;
    if (current) {
      const now = current.recording.now();
      current.timeline.retake(now, Math.max(0, time - duration(old)));
      change({
        ...retake(old, time),
        checkpoints: old.checkpoints.filter((c) => c.time <= time + 0.001),
      });
      setElapsed(now);
      setMessage(
        "Zurück am Checkpoint. Erkläre direkt weiter – das Original bleibt erhalten.",
      );
    } else {
      change({
        ...retake(old, time),
        checkpoints: old.checkpoints.filter((c) => c.time <= time + 0.001),
      });
      setPage("recorder");
      setMessage(
        "Timeline zurückgesetzt. Starte einen neuen Take; das Original bleibt erhalten.",
      );
    }
  }
  commands.current = (c: any) => {
    if (c.action === "pause") pause();
    if (c.action === "stop") void stop();
    if (c.action === "checkpoint") checkpoint();
    if (c.action === "retake") {
      const list = project.current.checkpoints;
      if (list.length) restore(list[list.length - 1].time);
    }
    if (c.action === "textToggle")
      updateText({ ...textRef.current, enabled: !textRef.current.enabled });
    if (c.action === "textHide")
      updateText({ ...textRef.current, enabled: false });
    if (c.action === "textChange") updateText(c.text);
  };
  useEffect(
    () => window.live.onCommand((command: any) => commands.current(command)),
    [],
  );
  useEffect(() => {
    window.live
      .publish({
        status: ["recording", "paused"].includes(status) ? status : "idle",
        elapsed:
          duration(p) +
          (active.current ? active.current.timeline.duration(elapsed) : 0),
        checkpointCount: p.checkpoints.length,
        lastCheckpoint: p.checkpoints.at(-1)?.name,
        text: liveText,
      })
      .catch(notice);
  }, [status, elapsed, p.checkpoints, liveText]);
  async function importMedia() {
    try {
      if (!root && !(await create())) return;
      setBusy(true);
      setWork("Video wird importiert und vorbereitet …");
      setExportProgress(0);
      for (const file of await window.studio.importMedia("video")) {
        const bytes = await window.studio.read(file.path),
          url = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
        const video = document.createElement("video");
        let length: number;
        try {
          length = await new Promise<number>((resolve, reject) => {
            video.onloadedmetadata = () => resolve(video.duration);
            video.onerror = () =>
              reject(Error("Video konnte nicht geladen werden."));
            video.src = url;
          });
        } finally {
          video.removeAttribute("src");
          video.load();
          URL.revokeObjectURL(url);
        }
        if (!Number.isFinite(length) || length <= 0)
          throw Error("Unbekannte Videodauer");
        const old = project.current,
          id = crypto.randomUUID(),
          clipId = crypto.randomUUID();
        change({
          ...old,
          takes: [
            ...old.takes,
            {
              id,
              video: file.path,
              name: file.name,
              duration: length,
              hasAudio: file.hasAudio,
            },
          ],
          clips: [...old.clips, { id: clipId, takeId: id, in: 0, out: length }],
        });
        if (!old.clips.length) {
          setSelected(clipId);
          setPlayhead(0);
        }
      }
      setPage("editor");
    } catch (e) {
      notice(e);
    } finally {
      setBusy(false);
    }
  }
  function undo() {
    const prev = history.current.pop();
    if (prev) {
      future.current.push(p);
      project.current = prev;
      setP(prev);
    }
  }
  function redo() {
    const n = future.current.pop();
    if (n) {
      history.current.push(p);
      project.current = n;
      setP(n);
    }
  }
  async function exportVideo(options?: any) {
    setWork("Video wird exportiert …");
    setExportProgress(0);
    setBusy(true);
    try {
      const file = await window.studio.exportVideo(project.current, options);
      if (file) setMessage("Export abgeschlossen: " + file);
    } catch (e) {
      notice(e);
    } finally {
      setBusy(false);
    }
  }
  const nav = [
    ["dashboard", LayoutDashboard, "Übersicht"],
    ["recorder", Video, "Aufnahme"],
    ["editor", Scissors, "Videoeditor"],
    ["settings", Settings, "Einstellungen"],
  ] as const;
  return (
    <div className={"app " + (page === "editor" ? "editing-workspace" : "")}>
      {busy && (
        <div className="busy-overlay">
          <div className="panel">
            {work}
            <p>Bitte das Projekt geöffnet lassen.</p>
            {exportProgress > 0 && (
              <>
                <progress max="100" value={exportProgress} />
                <p>{exportProgress} %</p>
              </>
            )}
          </div>
        </div>
      )}
      <aside>
        <div className="brand">
          <div className="logo">
            <Flag size={23} />
          </div>
          checkpoint<span>SAP ENABLEMENT</span>
        </div>
        <div className="workspace">ARBEITSBEREICH</div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button
              title={label}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
              key={id}
            >
              <Icon size={19} />
              {label}
              {id === "recorder" && status !== "idle" && <i className="dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebottom">
          <div className="local">
            <span className="green" /> Lokal. Privat. Dein Projekt.
          </div>
          <small>Checkpoint Studio · 0.6.1</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            Workspace <ChevronRight size={14} />{" "}
            {nav.find((n) => n[0] === page)?.[2]}
          </div>
          <span className="badge">SAP WORKFLOWS</span>
        </header>
        {message && (
          <div className="notice" onClick={() => setMessage("")}>
            {message}
            <span>×</span>
          </div>
        )}
        {page === "dashboard" && (
          <section>
            <div className="eyebrow">WISSEN TEILEN · PROZESSE ERKLÄREN</div>
            <h1>SAP-Wissen. Einfach erklärt.</h1>
            <p className="sub">
              SAP-Abläufe aufnehmen, Schritte markieren und verständliche
              Schulungsvideos erstellen.
            </p>
            <div className="hero">
              <div>
                <div className="pill">
                  <Flag size={14} /> VOM PROZESS ZUM SCHULUNGSVIDEO
                </div>
                <h2>
                  Jeden SAP-Prozess
                  <br />
                  Schritt für Schritt erklären.
                </h2>
                <p>
                  Mit Checkpoints gliederst du jeden Arbeitsschritt.
                  <br />
                  Deine Originalaufnahmen bleiben immer erhalten.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setPage("recorder");
                    loadSources();
                  }}
                >
                  <Plus size={18} /> Neue Aufnahme
                </button>
                <button className="ghost" onClick={open}>
                  <FolderOpen size={17} /> Projekt öffnen
                </button>
              </div>
              <div className="heroart">
                <div className="mockwindow">
                  <div className="mockdots">
                    ● ● ● <span>SAP · Prozessdokumentation</span>
                  </div>
                  <div className="mockcode">
                    <b>01</b> Transaktion öffnen.
                    <br />
                    <b>02</b> Schritt für Schritt.
                    <br />
                    <b>03</b> Ergebnis nachvollziehbar zeigen.
                  </div>
                  <div className="mockcontrol">
                    <span className="dot" /> {fmt(duration(p))}
                    <span />
                    <Flag size={18} />
                    <Check size={18} />
                  </div>
                </div>
                <div className="checkpointtag">
                  <span className="green" /> Prozessschritt gesichert. Weiter
                  geht’s.
                </div>
              </div>
            </div>
            <div className="sectiontitle">
              <h3>Dein Arbeitsbereich</h3>
              <span>Alles lokal gespeichert</span>
            </div>
            <div className="cards">
              <button className="card" onClick={open}>
                <FolderOpen />
                <h3>Projekt öffnen</h3>
                <p>
                  Nahtlos dort weitermachen,
                  <br />
                  wo du aufgehört hast.
                </p>
                <ChevronRight />
              </button>
              <button className="card" onClick={() => setPage("editor")}>
                <Scissors />
                <h3>Zum Videoeditor</h3>
                <p>
                  Takes auswählen, Clips schneiden
                  <br />
                  und dein Video exportieren.
                </p>
                <ChevronRight />
              </button>
              <button className="card" onClick={() => setPage("recorder")}>
                <Flag />
                <h3>Smart Retake</h3>
                <p>
                  Neue Takes anhängen.
                  <br />
                  Originale sicher behalten.
                </p>
                <ChevronRight />
              </button>
            </div>
            <div className="sectiontitle">
              <h3>Aktuelles Projekt</h3>
              <button className="text" onClick={() => window.studio.reveal()}>
                Ordner anzeigen ↗
              </button>
            </div>
            <div className="projectrow">
              <div className="projecticon">
                <Film />
              </div>
              <div>
                <strong>
                  {root ? p.name : "Bereit für dein erstes Projekt"}
                </strong>
                <p>
                  {root ||
                    "Erstelle eine Aufnahme oder öffne ein bestehendes Projekt."}
                </p>
              </div>
              <span>{p.takes.length} Takes</span>
              <span>{fmt(duration(p))}</span>
              <button onClick={() => setPage("editor")}>
                Öffnen <ChevronRight size={15} />
              </button>
            </div>
          </section>
        )}
        {page === "recorder" && (
          <section>
            <div className="eyebrow">DEIN AUFNAHMESTUDIO</div>
            <h1>Zeig, wie es geht.</h1>
            <p className="sub">Wähle eine Quelle. Mikrofon an. Und los.</p>
            <div className="recordgrid">
              <div className="panel">
                <div className="sectiontitle">
                  <h3>
                    <Monitor size={18} /> Aufnahmequelle
                  </h3>
                  <button onClick={loadSources}>Quellen laden</button>
                </div>
                <div className="sources">
                  {sources.length === 0 ? (
                    <div className="empty">
                      <Monitor size={42} />
                      <p>Bildschirme und Fenster laden</p>
                      <small>
                        macOS fragt eventuell nach Bildschirmaufnahme-Zugriff.
                      </small>
                    </div>
                  ) : (
                    sources.map((s) => (
                      <button
                        disabled={status !== "idle"}
                        className={
                          "source " + (source === s.id ? "chosen" : "")
                        }
                        onClick={() => setSource(s.id)}
                        key={s.id}
                      >
                        <img src={s.thumbnail} />
                        <span>{s.name}</span>
                        {source === s.id && <Check size={16} />}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="panel">
                <h3>Aufnahmeeinstellungen</h3>
                <label>
                  Auflösung
                  <select
                    disabled={status !== "idle"}
                    value={quality}
                    onChange={(e) => setQuality(+e.target.value)}
                  >
                    {[720, 1080, 1440, 2160].map((v) => (
                      <option key={v} value={v}>
                        {v === 2160 ? "4K" : v + "p"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Bildrate
                  <select
                    disabled={status !== "idle"}
                    value={fps}
                    onChange={(e) => setFps(+e.target.value)}
                  >
                    {[24, 30, 60].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="toggle">
                  <Mic size={18} /> Mikrofon separat
                  <input
                    disabled={status !== "idle"}
                    type="checkbox"
                    checked={mic}
                    onChange={(e) => setMic(e.target.checked)}
                  />
                </label>
                <label className="toggle muted">
                  <Volume2 size={18} /> Systemaudio{" "}
                  <span className="badge">NOCH OFFEN</span>
                </label>
                <p className="hint">
                  Video und Mikrofon werden getrennt gespeichert. Die gewählte
                  Auflösung ist eine Obergrenze der Quelle.
                </p>
                <div className="recordclock">
                  <span className={status === "recording" ? "dot" : ""} />
                  {fmt(elapsed)}
                  <small>
                    {status === "idle"
                      ? "Bereit zur Aufnahme"
                      : status === "paused"
                        ? "Pausiert"
                        : "Aufnahme läuft"}
                  </small>
                </div>
                <div className="buttons">
                  {status === "idle" ? (
                    <button className="primary" disabled={busy} onClick={start}>
                      <Video size={18} /> Aufnahme starten
                    </button>
                  ) : (
                    <>
                      <button
                        aria-label={
                          status === "paused" ? "Fortsetzen" : "Pausieren"
                        }
                        onClick={pause}
                      >
                        {status === "paused" ? (
                          <Play size={16} />
                        ) : (
                          <Pause size={16} />
                        )}
                      </button>
                      <button className="danger" onClick={stop}>
                        <Square size={16} /> Stoppen
                      </button>
                      <button onClick={checkpoint}>
                        <Flag size={16} /> Checkpoint setzen
                      </button>
                      <button
                        onClick={() =>
                          commands.current({ action: "textToggle" })
                        }
                      >
                        <Type size={17} /> Textfeld
                      </button>
                      <button
                        disabled={!p.checkpoints.length}
                        onClick={() => commands.current({ action: "retake" })}
                      >
                        <RotateCcw size={17} /> Zurück
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="sectiontitle">
              <h3>Checkpoints</h3>
              <button onClick={checkpoint}>
                <Plus size={16} /> Checkpoint setzen
              </button>
            </div>
            <p className="hint">
              Checkpoints werden live gesetzt, ohne die Aufnahme zu
              unterbrechen. Ein Rücksprung verändert nur die Schnittfolge,
              niemals deinen Computer.
            </p>
            {p.checkpoints.map((c) => (
              <div className="projectrow" key={c.id}>
                <Flag />
                <input
                  value={c.name}
                  onChange={(e) =>
                    change({
                      ...p,
                      checkpoints: p.checkpoints.map((x) =>
                        x.id === c.id ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
                <span>{fmt(c.time)}</span>
                <button onClick={() => restore(c.time)}>
                  <RotateCcw size={16} /> Neu aufnehmen
                </button>
              </div>
            ))}
          </section>
        )}
        {page === "editor" && (
          <StudioEditor
            key={root}
            project={p}
            selected={selected}
            onSelected={setSelected}
            onSourceTime={setPlayhead}
            onChange={change}
            onUndo={undo}
            onRedo={redo}
            canUndo={history.current.length > 0}
            canRedo={future.current.length > 0}
            onImportAudio={importAudio}
            onImportVideo={importMedia}
            onExport={exportVideo}
            onError={notice}
          />
        )}
        {page === "settings" && (
          <section>
            <div className="eyebrow">SO WIE DU ARBEITEST</div>
            <h1>Dein Studio. Deine Regeln.</h1>
            <div className="panel settings">
              <h3>Erscheinungsbild</h3>
              <label>
                Farbschema
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="dark">Dunkel</option>
                  <option value="light">Hell</option>
                </select>
              </label>
              <h3>Projektspeicherung</h3>
              <p>
                Änderungen werden nach 500 ms automatisch gespeichert.
                Projektordner enthalten die Projektdatei und relative
                Medienpfade. Zum Übertragen den gesamten Ordner kopieren.
              </p>
              <button onClick={create}>
                <Plus size={16} /> Neues Projekt
              </button>
              <h3>Version 0.6.0 · Implementierungsstand</h3>
              <p>
                Verfügbar: Bildschirm-/Fensteraufnahme, Mikrofon als eigene
                Datei, schwebende Steuerpille, Live-Textfeld, Pause,
                Live-Checkpoints, wiederherstellbare Retakes, Clip-Schnitt,
                Umsortieren, Undo/Redo und echter FFmpeg-MP4-Export.
              </p>
              <p>
                Noch offen: Systemaudio, globale Hotkeys, Tastatur-Overlays,
                Webcam, Effekte, Untertitel, KI und Wiederherstellung laufender
                Aufnahmen nach Absturz. Windows muss separat gebaut und getestet
                werden.
              </p>
              <p>
                FFmpeg enthält GPL-Komponenten (libx264). Beachte vor einer
                Weitergabe THIRD_PARTY.md.
              </p>
            </div>
          </section>
        )}
        <footer>
          <span className="green" />
          {root ? "Automatische Speicherung aktiv" : "Kein Projekt geöffnet"}
          <span />
          {status !== "idle"
            ? "Aufnahme aktiv"
            : "Prozesswissen sicher auf deinem Gerät."}
        </footer>
      </main>
    </div>
  );
}
const floatingKind = location.hash.slice(1);
if (["pill", "text"].includes(floatingKind))
  document.documentElement.dataset.floating = floatingKind;
createRoot(document.getElementById("root")!).render(
  ["pill", "text"].includes(floatingKind) ? (
    <Floating kind={floatingKind} />
  ) : (
    <App />
  ),
);
