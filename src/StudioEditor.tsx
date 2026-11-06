import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Copy,
  Trash2,
  Plus,
  Download,
  RotateCcw,
  RotateCw,
  Flag,
  Film,
  Music2,
  Volume2,
  VolumeX,
  Search,
  MousePointer2,
  Magnet,
  Keyboard,
  FolderOpen,
} from "lucide-react";
import type { Project, Clip, AudioTrack } from "./project";
import { duration, split } from "./model.mjs";
import { locateTime, timelineTime } from "./checkpoints.mjs";
import { audioGain, clamp, splitAudio, peakPath } from "./editor-model.mjs";
import { EditorTimeline, timeLabel } from "./EditorTimeline";
import "./studio-editor.css";
type Props = {
  project: Project;
  selected: string;
  onSelected: (id: string) => void;
  onSourceTime: (time: number) => void;
  onChange: (p: Project) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImportAudio: () => void;
  onImportVideo: () => void;
  onExport: (options: any) => void;
  onError: (e: any) => void;
};
const timecode = (time: number) => {
  const f = Math.round(Math.max(0, time) * 30);
  return [
    Math.floor(f / 108000),
    Math.floor(f / 1800) % 60,
    Math.floor(f / 30) % 60,
    f % 30,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};
function useMedia(paths: string[], onError: (e: any) => void) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useRef<Record<string, string>>({});
  const signature = [...new Set(paths.filter(Boolean))].sort().join("|");
  useEffect(() => {
    let alive = true;
    for (const path of signature.split("|").filter(Boolean))
      if (!cache.current[path])
        window.studio
          .read(path)
          .then((bytes: any) => {
            if (!alive) return;
            const type = path.endsWith(".webm")
              ? "video/webm"
              : path.endsWith(".wav")
                ? "audio/wav"
                : path.endsWith(".mp4")
                  ? "video/mp4"
                  : "";
            const url = URL.createObjectURL(new Blob([bytes], { type }));
            cache.current[path] = url;
            setUrls({ ...cache.current });
          })
          .catch(onError);
    return () => {
      alive = false;
    };
  }, [signature]);
  useEffect(
    () => () => {
      Object.values(cache.current).forEach(URL.revokeObjectURL);
      cache.current = {};
    },
    [],
  );
  return urls;
}
export function StudioEditor(props: Props) {
  const {
    project: p,
    onChange: change,
    onSelected,
    onSourceTime,
    onError,
  } = props;
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [audioId, setAudioId] = useState(""),
    [search, setSearch] = useState(""),
    [snap, setSnap] = useState(true),
    [tool, setTool] = useState<"select" | "razor">("select"),
    [help, setHelp] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [height, setHeight] = useState(1080),
    [fps, setFps] = useState(30),
    [quality, setQuality] = useState("standard"),
    [progress, setProgress] = useState(0),
    [audition, setAudition] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    mic = useRef<HTMLAudioElement>(null),
    system = useRef<HTMLAudioElement>(null),
    audios = useRef(new Map<string, HTMLAudioElement>()),
    auditionAudio = useRef<HTMLAudioElement>(null);
  const intent = useRef(false),
    current = useRef(props),
    cursor = useRef(0),
    pending = useRef<{
      time: number;
      sourceTime: number;
      clipId: string;
    } | null>(null),
    loaded = useRef(""),
    advanceLock = useRef(false),
    tickRef = useRef<() => void>(() => {});
  current.current = props;
  const selected = p.clips.find((c) => c.id === props.selected) || p.clips[0],
    take = p.takes.find((t) => t.id === selected?.takeId),
    audio = (p.audioTracks || []).find((t) => t.id === audioId),
    total = duration(p);
  const urls = useMedia(
    [
      ...(take ? [take.video, take.mic || "", take.system || ""] : []),
      ...(p.audioTracks || []).map((t) => t.path),
      ...(p.audioLibrary || p.audioTracks || [])
        .filter((t) => t.id === audition)
        .map((t) => t.path),
    ],
    onError,
  );
  const assets = p.audioLibrary || p.audioTracks || [];
  const [embeddedAudio, setEmbeddedAudio] = useState<Record<string, boolean>>(
    {},
  );
  const audioProbes = useRef(new Map<string, Promise<boolean>>());
  const usedTakes = p.takes.filter((t) =>
    p.clips.some((c) => c.takeId === t.id),
  );
  const probeKey = usedTakes
    .map((t) => [t.id, t.video, t.hasAudio, t.mic, t.system].join(":"))
    .sort()
    .join("|");
  useEffect(() => {
    let alive = true;
    Promise.all(
      usedTakes.map(async (take) => {
        if (take.hasAudio !== undefined)
          return [take.id, take.hasAudio] as const;
        if (take.mic || take.system) return [take.id, false] as const;
        if (!audioProbes.current.has(take.video))
          audioProbes.current.set(
            take.video,
            window.studio.hasAudio(take.video),
          );
        return [take.id, await audioProbes.current.get(take.video)] as const;
      }),
    )
      .then((entries) => {
        if (alive)
          setEmbeddedAudio(
            Object.fromEntries(entries) as Record<string, boolean>,
          );
      })
      .catch(onError);
    return () => {
      alive = false;
    };
  }, [probeKey]);
  const availableSources = [
    ...(usedTakes.some((t) => t.mic) ? [{ id: "mic", name: "Mikrofon" }] : []),
    ...(usedTakes.some((t) => t.system || t.hasAudio || embeddedAudio[t.id])
      ? [{ id: "system", name: "PC / Videoton" }]
      : []),
  ];
  const sourceRows = availableSources.filter(
    (row) => !p.disabledAudioSources?.includes(row.id),
  );
  function sourceDisabled(id: string) {
    return current.current.project.disabledAudioSources?.includes(id);
  }

  const knownAudio = useRef(new Set((p.audioTracks || []).map((t) => t.id)));
  useEffect(() => {
    const tracks = p.audioTracks || [],
      added = tracks.filter((t) => !knownAudio.current.has(t.id));
    if (added.length) setAudioId(added.at(-1)!.id);
    knownAudio.current = new Set(tracks.map((t) => t.id));
  }, [p.audioTracks]);
  useEffect(() => {
    if (selected && selected.id !== props.selected) onSelected(selected.id);
  }, [props.selected, p.clips]);
  useEffect(() => {
    return window.studio.onExportProgress?.((v: number) => setProgress(v));
  }, []);
  useEffect(() => {
    if (!audio && audioId) setAudioId("");
  }, [audioId, p.audioTracks]);
  function pause() {
    intent.current = false;
    setPlaying(false);
    video.current?.pause();
    mic.current?.pause();
    system.current?.pause();
    audios.current.forEach((a) => a.pause());
  }
  function playElement(element: HTMLMediaElement | null) {
    if (element?.src && element.paused)
      element.play().catch((e) => {
        if (e.name !== "AbortError") {
          onError(e);
          pause();
        }
      });
  }
  function syncAudio(
    at: number,
    sourceTime: number,
    clip: Clip,
    play: boolean,
    force = false,
  ) {
    const project = current.current.project,
      gain = clip.muted ? 0 : (clip.volume ?? 1);
    for (const [element, volume] of [
      [mic.current, sourceDisabled("mic") ? 0 : project.volume.mic],
      [system.current, sourceDisabled("system") ? 0 : project.volume.system],
    ] as const) {
      if (!element?.getAttribute("src")) continue;
      element.volume = clamp(volume * gain, 0, 1);
      if (
        element.readyState >= 1 &&
        (force || Math.abs(element.currentTime - sourceTime) > 0.1)
      )
        element.currentTime = sourceTime;
      if (play) playElement(element);
      else element.pause();
    }
    if (video.current)
      video.current.volume = clamp(
        (sourceDisabled("system") ? 0 : project.volume.system) * gain,
        0,
        1,
      );
    for (const track of project.audioTracks || []) {
      const element = audios.current.get(track.id);
      if (!element) continue;
      const gain = audioGain(track, at);
      element.volume = gain;
      if (
        !play ||
        at < track.start ||
        at >= track.start + track.out - track.in
      ) {
        element.pause();
        continue;
      }
      const target = track.in + at - track.start;
      if (
        element.readyState >= 1 &&
        (force || Math.abs(element.currentTime - target) > 0.1)
      )
        element.currentTime = target;
      playElement(element);
    }
  }
  function seek(at: number, resume = false) {
    const project = current.current.project,
      found = locateTime(project, at);
    if (!found) {
      pause();
      return;
    }
    const nextTime = clamp(at, 0, duration(project));
    intent.current = resume;
    setPlaying(resume);
    cursor.current = nextTime;
    setTime(nextTime);
    onSourceTime(found.sourceTime);
    pending.current = {
      time: nextTime,
      sourceTime: found.sourceTime,
      clipId: found.clip.id,
    };
    const switching = current.current.selected !== found.clip.id;
    if (switching) onSelected(found.clip.id);
    const element = video.current;
    if (
      element &&
      loaded.current === found.clip.takeId &&
      element.readyState >= 1
    ) {
      element.currentTime = found.sourceTime;
      if (!switching) pending.current = null;
      advanceLock.current = false;
      syncAudio(nextTime, found.sourceTime, found.clip, resume, true);
      if (resume) playElement(element);
      else element.pause();
    } else {
      mic.current?.pause();
      system.current?.pause();
      audios.current.forEach((a) => a.pause());
    }
  }
  function ready() {
    const element = video.current,
      project = current.current.project,
      clip =
        project.clips.find((c) => c.id === current.current.selected) ||
        project.clips[0];
    if (!element || !clip) return;
    loaded.current = clip.takeId;
    const target =
      pending.current?.clipId === clip.id
        ? pending.current.sourceTime
        : clip.in;
    element.currentTime = target;
    cursor.current = timelineTime(project, clip.id, target);
    setTime(cursor.current);
    onSourceTime(target);
    pending.current = null;
    advanceLock.current = false;
    syncAudio(cursor.current, target, clip, intent.current, true);
    if (intent.current) playElement(element);
  }
  useEffect(() => {
    if (video.current?.readyState && loaded.current === take?.id) ready();
  }, [props.selected, urls[take?.video || ""]]);
  useEffect(() => {
    const element = video.current;
    if (
      selected &&
      element?.readyState &&
      loaded.current === selected.takeId &&
      !intent.current
    ) {
      const source = clamp(element.currentTime, selected.in, selected.out);
      element.currentTime = source;
      cursor.current = timelineTime(p, selected.id, source);
      setTime(cursor.current);
      onSourceTime(source);
    }
  }, [selected?.in, selected?.out]);
  function advance() {
    if (!intent.current || advanceLock.current) return;
    const project = current.current.project,
      index = project.clips.findIndex((c) => c.id === current.current.selected),
      clip = project.clips[index];
    if (!clip) return;
    const end = timelineTime(project, clip.id, clip.out);
    if (index < project.clips.length - 1) {
      advanceLock.current = true;
      seek(end + 0.00001, true);
    } else {
      pause();
      cursor.current = duration(project);
      setTime(cursor.current);
      onSourceTime(clip.out);
      if (video.current) video.current.currentTime = clip.out;
    }
  }
  tickRef.current = () => {
    const element = video.current,
      project = current.current.project,
      clip = project.clips.find((c) => c.id === current.current.selected);
    if (
      !intent.current ||
      !element ||
      !clip ||
      loaded.current !== clip.takeId ||
      pending.current
    )
      return;
    const at = timelineTime(project, clip.id, element.currentTime);
    cursor.current = at;
    setTime(at);
    onSourceTime(element.currentTime);
    syncAudio(at, element.currentTime, clip, true);
    if (element.currentTime >= clip.out - 0.012) advance();
  };
  useEffect(() => {
    let frame: number;
    const tick = () => {
      tickRef.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(
    () => () => {
      intent.current = false;
      audios.current.forEach((a) => a.pause());
    },
    [],
  );
  useEffect(() => {
    if (!p.clips.length) {
      pause();
      setTime(0);
      cursor.current = 0;
    } else if (cursor.current > total) seek(total);
  }, [p.clips]);
  useEffect(() => {
    if (selected)
      syncAudio(
        cursor.current,
        video.current?.currentTime || selected.in,
        selected,
        intent.current,
        true,
      );
  }, [
    p.volume,
    p.audioTracks,
    p.disabledAudioSources,
    selected?.volume,
    selected?.muted,
  ]);
  useEffect(() => {
    if (
      selected &&
      video.current?.readyState &&
      loaded.current === selected.takeId &&
      !intent.current
    ) {
      const source = clamp(
        video.current.currentTime,
        selected.in,
        selected.out,
      );
      cursor.current = timelineTime(p, selected.id, source);
      setTime(cursor.current);
      onSourceTime(source);
    }
  }, [p.clips]);
  function toggle() {
    if (intent.current) pause();
    else {
      auditionAudio.current?.pause();
      setAudition("");
      seek(cursor.current >= total - 0.015 ? 0 : cursor.current, true);
    }
  }
  function edit(n: Project) {
    pause();
    change(n);
  }
  function patchAudio(patch: Partial<AudioTrack>) {
    if (audio)
      edit({
        ...p,
        audioTracks: (p.audioTracks || []).map((t) =>
          t.id === audio.id ? { ...t, ...patch } : t,
        ),
      });
  }
  function patchVideo(patch: Partial<Clip>) {
    if (selected)
      edit({
        ...p,
        clips: p.clips.map((c) =>
          c.id === selected.id ? { ...c, ...patch } : c,
        ),
      });
  }
  function cut() {
    pause();
    if (audio) {
      edit({
        ...p,
        audioTracks: (p.audioTracks || []).flatMap((t) =>
          t.id === audio.id ? splitAudio(t, cursor.current) : [t],
        ),
      });
    } else if (selected)
      edit(split(p, selected.id, video.current?.currentTime ?? selected.in));
  }
  function remove() {
    if (audio) {
      edit({
        ...p,
        audioTracks: (p.audioTracks || []).filter((t) => t.id !== audio.id),
      });
      setAudioId("");
    } else if (selected) {
      const index = p.clips.findIndex((c) => c.id === selected.id),
        clips = p.clips.filter((c) => c.id !== selected.id);
      edit({ ...p, clips });
      onSelected(clips[Math.min(index, clips.length - 1)]?.id || "");
    }
  }
  function duplicate() {
    if (audio) {
      const id = crypto.randomUUID();
      edit({
        ...p,
        audioTracks: [
          ...(p.audioTracks || []),
          { ...audio, id, start: audio.start + audio.out - audio.in },
        ],
      });
      setAudioId(id);
    } else if (selected) {
      edit({
        ...p,
        clips: p.clips.flatMap((c) =>
          c.id === selected.id ? [c, { ...c, id: crypto.randomUUID() }] : [c],
        ),
      });
    }
  }
  function marker() {
    const found = locateTime(p, cursor.current);
    if (!found) return;
    edit({
      ...p,
      checkpoints: [
        ...p.checkpoints,
        {
          id: crypto.randomUUID(),
          name: `Schritt ${p.checkpoints.length + 1}`,
          time: cursor.current,
          takeId: found.clip.takeId,
          clipId: found.clip.id,
          sourceTime: found.sourceTime,
        },
      ],
    });
  }
  const actions = useRef({ toggle, cut, remove, duplicate, marker, seek });
  actions.current = { toggle, cut, remove, duplicate, marker, seek };
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
        exportOpen ||
        document.querySelector(".busy-overlay")
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        pause();
        e.shiftKey ? current.current.onRedo() : current.current.onUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        actions.current.cut();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        pause();
        current.current.onRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        actions.current.duplicate();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === " ") {
        e.preventDefault();
        actions.current.toggle();
      } else if (e.key.toLowerCase() === "c") setTool("razor");
      else if (e.key.toLowerCase() === "v") setTool("select");
      else if (e.key.toLowerCase() === "s") setSnap((s) => !s);
      else if (e.key.toLowerCase() === "m") actions.current.marker();
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.current.remove();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        actions.current.seek(
          cursor.current +
            (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : 1 / 30),
        );
      } else if (e.key === "Home") {
        e.preventDefault();
        actions.current.seek(0);
      } else if (e.key === "End") {
        e.preventDefault();
        actions.current.seek(duration(current.current.project));
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [exportOpen]);
  const addAsset = (asset: AudioTrack, start: number, lane: number) => {
    const id = crypto.randomUUID();
    edit({
      ...p,
      audioTracks: [
        ...(p.audioTracks || []),
        {
          ...asset,
          id,
          assetId: asset.assetId || asset.id,
          start,
          lane,
          in: 0,
          out: asset.duration || asset.out,
          fadeIn: 0,
          fadeOut: 0,
          muted: false,
        },
      ],
    });
    setAudioId(id);
  };
  const videoLabel =
    take?.name || `Take ${p.takes.findIndex((t) => t.id === take?.id) + 1}`;
  return (
    <section
      className="studio-editor"
      aria-label="Schnittarbeitsplatz"
      style={
        {
          "--audio-count": sourceRows.length + (p.audioTracks || []).length,
        } as React.CSSProperties
      }
    >
      <div className="studio-top">
        <div>
          <span className="eyebrow">SAP ENABLEMENT / SCHNITT</span>
          <h1>{p.name}</h1>
        </div>
        <div className="buttons">
          <button
            onClick={() => {
              pause();
              props.onImportVideo();
            }}
          >
            <Plus size={15} /> Video importieren
          </button>
          <button
            onClick={() => {
              pause();
              props.onImportAudio();
            }}
          >
            <Music2 size={15} /> Audio importieren
          </button>
          <button
            className="primary"
            disabled={!p.clips.length}
            onClick={() => {
              pause();
              setProgress(0);
              setExportOpen(true);
            }}
          >
            <Download size={15} /> MP4 exportieren
          </button>
        </div>
      </div>
      <div className="studio-panels">
        <div className="studio-panel media-bin">
          <div className="panel-caption">
            <FolderOpen size={14} /> Projektmedien{" "}
            <span>{p.takes.length + assets.length}</span>
          </div>
          <div className="media-search">
            <Search size={14} />
            <input
              aria-label="Medien suchen"
              placeholder="Medien suchen …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="media-bin-list">
            {p.takes
              .filter((t, i) =>
                (t.name || `Take ${i + 1}`)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((t) => (
                <button
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("take", t.id)}
                  className={
                    "media-item " +
                    (take?.id === t.id && !audio ? "active" : "")
                  }
                  onClick={() => {
                    setAudioId("");
                    const clip = p.clips.find((c) => c.takeId === t.id);
                    if (clip) {
                      onSelected(clip.id);
                      seek(timelineTime(p, clip.id, clip.in));
                    } else {
                      const id = crypto.randomUUID();
                      edit({
                        ...p,
                        clips: [
                          ...p.clips,
                          { id, takeId: t.id, in: 0, out: t.duration },
                        ],
                      });
                      onSelected(id);
                    }
                  }}
                >
                  <span className="media-icon">
                    <Film size={22} />
                  </span>
                  <span>
                    <strong>
                      {t.name || `Take ${p.takes.indexOf(t) + 1}`}
                    </strong>
                    <small>{timeLabel(t.duration)} · Video</small>
                  </span>
                </button>
              ))}
            {assets
              .filter((t) =>
                t.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((t) => (
                <div
                  className="media-item audio-asset"
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("asset", t.id)}
                >
                  <span className="media-icon audio">
                    <Music2 size={20} />
                  </span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>{timeLabel(t.duration || t.out)} · Audio</small>
                  </span>
                  <button
                    aria-label={`Audio ${t.name} vorhören`}
                    title="Original vorhören"
                    onClick={() => {
                      pause();
                      setAudition((a) => (a === t.id ? "" : t.id));
                    }}
                  >
                    {audition === t.id ? (
                      <Pause size={12} />
                    ) : (
                      <Play size={12} />
                    )}
                  </button>
                  <button
                    aria-label={`Audio ${t.name} hinzufügen`}
                    title="Am Abspielkopf hinzufügen"
                    onClick={() => addAsset(t, cursor.current, 0)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ))}
            {!p.takes.length && !assets.length && (
              <div className="media-empty">
                <Film size={30} />
                <p>Aufnehmen oder Medien importieren</p>
                <small>
                  Originale bleiben erhalten. Medien in die Timeline ziehen.
                </small>
              </div>
            )}
          </div>
          <div className="bin-footer">
            Video und Audio aus den Projektmedien hinzufügen
          </div>
        </div>
        <div className="studio-panel program-monitor">
          <div className="panel-caption">
            Programm <span>{p.name}</span>
            <span className="monitor-format">16:9 · 30 fps Vorschau</span>
          </div>
          <div className="program-canvas">
            {take && urls[take.video] ? (
              <video
                key={take.id}
                data-testid="program-video"
                data-take-id={take.id}
                ref={video}
                src={urls[take.video]}
                muted={!!(take.mic || take.system)}
                onLoadedMetadata={ready}
                onEnded={advance}
                onError={() =>
                  onError(
                    Error("Die Videovorschau konnte nicht geladen werden."),
                  )
                }
                onClick={toggle}
              />
            ) : (
              <div className="monitor-empty">
                <Film size={38} />
                <h3>Deine Geschichte beginnt hier.</h3>
                <p>Wähle einen Clip oder starte eine Aufnahme.</p>
              </div>
            )}
          </div>
          <div className="monitor-transport">
            <output aria-label="Abspielzeit">{timecode(time)}</output>
            <div>
              <button aria-label="Zum Anfang" onClick={() => seek(0)}>
                <SkipBack size={15} />
              </button>
              <button
                className="transport-play"
                aria-label={playing ? "Pause" : "Timeline abspielen"}
                disabled={!p.clips.length}
                onClick={toggle}
              >
                {playing ? <Pause size={19} /> : <Play size={19} />}
              </button>
              <button aria-label="Zum Ende" onClick={() => seek(total)}>
                <SkipForward size={15} />
              </button>
            </div>
            <span>{timecode(total)}</span>
          </div>
        </div>
        <div className="studio-panel inspector">
          <div className="panel-caption">
            Eigenschaften <span>{audio ? "Audio" : "Video"}</span>
          </div>
          {audio ? (
            <>
              <div className="inspector-title">
                <Music2 size={16} />
                {audio.name}
              </div>
              <label>
                Position (Sekunden)
                <input
                  aria-label={`Position ${audio.name}`}
                  type="number"
                  min="0"
                  step=".01"
                  value={Number(audio.start.toFixed(3))}
                  onChange={(e) =>
                    patchAudio({ start: Math.max(0, +e.target.value) })
                  }
                />
              </label>
              <div className="inspector-pair">
                <label>
                  Quell-Start
                  <input
                    aria-label="Audio Start"
                    type="number"
                    min="0"
                    max={audio.out - 0.04}
                    step=".01"
                    value={Number(audio.in.toFixed(3))}
                    onChange={(e) => {
                      if (
                        +e.target.value >= 0 &&
                        +e.target.value < audio.out - 0.01
                      )
                        patchAudio({ in: +e.target.value });
                    }}
                  />
                </label>
                <label>
                  Quell-Ende
                  <input
                    aria-label="Audio Ende"
                    type="number"
                    min={audio.in + 0.04}
                    max={audio.duration || audio.out}
                    step=".01"
                    value={Number(audio.out.toFixed(3))}
                    onChange={(e) => {
                      if (
                        +e.target.value > audio.in + 0.01 &&
                        +e.target.value <= (audio.duration || audio.out)
                      )
                        patchAudio({ out: +e.target.value });
                    }}
                  />
                </label>
              </div>
              <label>
                Lautstärke {Math.round(audio.volume * 100)} %
                <input
                  aria-label={`Lautstärke ${audio.name}`}
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={audio.volume}
                  onChange={(e) => patchAudio({ volume: +e.target.value })}
                />
              </label>
              <div className="inspector-pair">
                <label>
                  Einblenden (s)
                  <input
                    aria-label="Audio einblenden"
                    type="number"
                    min="0"
                    max={audio.out - audio.in}
                    step=".1"
                    value={audio.fadeIn || 0}
                    onChange={(e) =>
                      patchAudio({
                        fadeIn: clamp(+e.target.value, 0, audio.out - audio.in),
                      })
                    }
                  />
                </label>
                <label>
                  Ausblenden (s)
                  <input
                    aria-label="Audio ausblenden"
                    type="number"
                    min="0"
                    max={audio.out - audio.in}
                    step=".1"
                    value={audio.fadeOut || 0}
                    onChange={(e) =>
                      patchAudio({
                        fadeOut: clamp(
                          +e.target.value,
                          0,
                          audio.out - audio.in,
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <button
                className={audio.muted ? "active" : ""}
                onClick={() => patchAudio({ muted: !audio.muted })}
              >
                {audio.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}{" "}
                {audio.muted ? "Ton einschalten" : "Stummschalten"}
              </button>
            </>
          ) : selected ? (
            <>
              <div className="inspector-title">
                <Film size={16} />
                {videoLabel}
              </div>
              <p className="inspector-hint">
                Clip auf V1 · {timeLabel(selected.out - selected.in)}
                <br />
                Start und Ende unten kürzen oder die Clipkanten ziehen.
              </p>
              <label>
                Clip-Lautstärke {Math.round((selected.volume ?? 1) * 100)} %
                <input
                  aria-label="Clip Lautstärke"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={selected.volume ?? 1}
                  onChange={(e) => patchVideo({ volume: +e.target.value })}
                />
              </label>
              <button onClick={() => patchVideo({ muted: !selected.muted })}>
                {selected.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}{" "}
                {selected.muted ? "Clip-Ton einschalten" : "Clip stummschalten"}
              </button>
            </>
          ) : (
            <p>Clip auswählen, um ihn zu bearbeiten.</p>
          )}
          {availableSources.length > 0 && (
            <div className="mixer-title">Aufnahmemixer</div>
          )}
          {availableSources
            .filter((row) => p.disabledAudioSources?.includes(row.id))
            .map((row) => (
              <button
                key={row.id}
                onClick={() =>
                  edit({
                    ...p,
                    disabledAudioSources: (p.disabledAudioSources || []).filter(
                      (id) => id !== row.id,
                    ),
                  })
                }
              >
                <Plus size={12} />
                {row.name} wieder hinzufügen
              </button>
            ))}
          {(["mic", "system"] as const)
            .filter((key) => sourceRows.some((row) => row.id === key))
            .map((key) => (
              <label key={key}>
                {key === "mic" ? "Mikrofon" : "System / Video"} ·{" "}
                {Math.round(p.volume[key] * 100)} %
                <input
                  aria-label={
                    key === "mic" ? "Mikrofon Lautstärke" : "System Lautstärke"
                  }
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={p.volume[key]}
                  onChange={(e) =>
                    edit({
                      ...p,
                      volume: { ...p.volume, [key]: +e.target.value },
                    })
                  }
                />
              </label>
            ))}
        </div>
      </div>
      <div className="studio-panel sequence-panel">
        <div className="panel-caption">
          <Film size={14} /> Sequenz{" "}
          <span>
            {p.clips.length} Clips · {(p.audioTracks || []).length} Audio-Clips
          </span>
          <div className="sequence-history">
            <button
              aria-label="Rückgängig"
              disabled={!props.canUndo}
              onClick={() => {
                pause();
                props.onUndo();
              }}
            >
              <RotateCcw size={14} />
            </button>
            <button
              aria-label="Wiederholen"
              disabled={!props.canRedo}
              onClick={() => {
                pause();
                props.onRedo();
              }}
            >
              <RotateCw size={14} />
            </button>
            <button onClick={marker}>
              <Flag size={14} /> Checkpoint
            </button>
            <button aria-label="Tastenkürzel" onClick={() => setHelp(!help)}>
              <Keyboard size={14} />
            </button>
          </div>
        </div>
        <div
          className="sequence-tools"
          role="toolbar"
          aria-label="Schnittwerkzeuge"
        >
          <div className="tool-switch">
            <button
              aria-label="Auswahlwerkzeug"
              title="Auswahl (V)"
              className={tool === "select" ? "active" : ""}
              onClick={() => setTool("select")}
            >
              <MousePointer2 size={16} />
            </button>
            <button
              aria-label="Rasierklingenwerkzeug"
              title="Rasierklinge (C): Clip an angeklickter Stelle teilen"
              className={tool === "razor" ? "active" : ""}
              onClick={() => setTool("razor")}
            >
              <Scissors size={16} />
            </button>
            <button
              aria-label="Einrasten"
              title="Einrasten (S)"
              className={snap ? "active" : ""}
              onClick={() => setSnap(!snap)}
            >
              <Magnet size={16} />
            </button>
          </div>
          <div className="tool-trim">
            <label>
              Start (Sekunden)
              <input
                aria-label="Start (Sekunden)"
                type="number"
                min="0"
                step=".01"
                disabled={!selected || !!audio}
                value={selected ? Number(selected.in.toFixed(3)) : ""}
                onChange={(e) => {
                  if (
                    selected &&
                    +e.target.value >= 0 &&
                    +e.target.value < selected.out
                  )
                    patchVideo({ in: +e.target.value });
                }}
              />
            </label>
            <label>
              Ende (Sekunden)
              <input
                aria-label="Ende (Sekunden)"
                type="number"
                min={selected?.in}
                max={take?.duration}
                step=".01"
                disabled={!selected || !!audio}
                value={selected ? Number(selected.out.toFixed(3)) : ""}
                onChange={(e) => {
                  if (
                    selected &&
                    take &&
                    +e.target.value > selected.in &&
                    +e.target.value <= take.duration
                  )
                    patchVideo({ out: +e.target.value });
                }}
              />
            </label>
          </div>
          <button
            aria-label="Clip am Abspielkopf schneiden"
            onClick={cut}
            disabled={!selected && !audio}
          >
            <Scissors size={14} /> Teilen
          </button>
          <button onClick={duplicate} disabled={!selected && !audio}>
            <Copy size={14} /> Duplizieren
          </button>
          <button
            className="delete-tool"
            onClick={remove}
            disabled={!selected && !audio}
          >
            <Trash2 size={14} />{" "}
            {audio ? "Audio entfernen" : "Löschen & nachrücken"}
          </button>
          <span className="selection-label">
            {audio ? audio.name : videoLabel}
          </span>
        </div>
        {help && (
          <div className="keyboard-help">
            Leertaste: Wiedergabe · C: Rasierklinge · V: Auswahl · S: Einrasten
            · M: Checkpoint · ←/→: 1 Frame · Umschalt+←/→: 1 s · Entf: Löschen ·
            ⌘/Strg+Z: Rückgängig · ⌘/Strg+D: Duplizieren · ⌘/Strg+K: Teilen
          </div>
        )}
        <EditorTimeline
          project={p}
          selected={selected?.id || ""}
          selectedAudio={audioId}
          playhead={time}
          tool={tool}
          snap={snap}
          onSeek={(at) => seek(at)}
          onSelect={(id) => {
            setAudioId("");
            const c = p.clips.find((c) => c.id === id);
            if (c) seek(timelineTime(p, id, c.in));
          }}
          onMove={(id, index) => {
            const clip = p.clips.find((c) => c.id === id);
            if (!clip) return;
            const clips = p.clips.filter((c) => c.id !== id);
            clips.splice(index, 0, clip);
            edit({ ...p, clips });
          }}
          onRename={(id, name) =>
            edit({
              ...p,
              checkpoints: p.checkpoints.map((c) =>
                c.id === id ? { ...c, name } : c,
              ),
            })
          }
          onRemove={(id) =>
            edit({
              ...p,
              checkpoints: p.checkpoints.filter((c) => c.id !== id),
            })
          }
          sourceRows={sourceRows}
          embeddedAudio={embeddedAudio}
          onRemoveSource={(id) =>
            edit({
              ...p,
              disabledAudioSources: [...(p.disabledAudioSources || []), id],
            })
          }
          onAudioSelect={setAudioId}
          onAudioChange={(next) =>
            edit({
              ...p,
              audioTracks: (p.audioTracks || []).map((t) =>
                t.id === next.id ? next : t,
              ),
            })
          }
          onVideoTrim={(id, range) =>
            edit({
              ...p,
              clips: p.clips.map((c) => (c.id === id ? { ...c, ...range } : c)),
            })
          }
          onRazor={(id, at, isAudio) => {
            if (isAudio) {
              const track = (p.audioTracks || []).find((t) => t.id === id);
              if (track) {
                edit({
                  ...p,
                  audioTracks: (p.audioTracks || []).flatMap((t) =>
                    t.id === id ? splitAudio(t, at) : [t],
                  ),
                });
                setAudioId(id);
              }
            } else {
              const c = p.clips.find((c) => c.id === id);
              if (c) edit(split(p, id, c.in + at - timelineTime(p, id, c.in)));
            }
          }}
          onDropAsset={(id, at, lane) => {
            const asset = assets.find((a) => a.id === id);
            if (asset) addAsset(asset, at, lane);
          }}
          onDropTake={(id, index) => {
            const t = p.takes.find((t) => t.id === id);
            if (t) {
              const clips = [...p.clips];
              clips.splice(index, 0, {
                id: crypto.randomUUID(),
                takeId: id,
                in: 0,
                out: t.duration,
              });
              edit({ ...p, clips });
            }
          }}
        />
        <div className="sequence-footer">
          <span>Nur vorhandene Audioquellen werden angezeigt</span>
          <span>
            Audio bleibt beim Videoschnitt an seiner Zeitposition · Ende:{" "}
            {timeLabel(total)}
          </span>
        </div>
      </div>
      <audio ref={mic} src={take?.mic ? urls[take.mic] : undefined} />
      <audio ref={system} src={take?.system ? urls[take.system] : undefined} />
      {(p.audioTracks || []).map((t) => (
        <audio
          key={t.id}
          data-audio-id={t.id}
          data-testid="imported-audio"
          ref={(el) => {
            if (el) audios.current.set(t.id, el);
            else audios.current.delete(t.id);
          }}
          src={urls[t.path]}
          onLoadedMetadata={() => {
            const clip = current.current.project.clips.find(
              (c) => c.id === current.current.selected,
            );
            if (clip)
              syncAudio(
                cursor.current,
                video.current?.currentTime || clip.in,
                clip,
                intent.current,
                true,
              );
          }}
        />
      ))}
      {audition && (
        <audio
          ref={auditionAudio}
          autoPlay
          src={urls[assets.find((a) => a.id === audition)?.path || ""]}
          onEnded={() => setAudition("")}
        />
      )}
      {exportOpen && (
        <div className="export-dialog" role="dialog" aria-label="MP4 Export">
          <div className="studio-panel">
            <h2>Video exportieren</h2>
            <p>
              Die gesamte Sequenz mit Aufnahmeton und allen aktiven Audiospuren.
            </p>
            <label>
              Auflösung
              <select
                aria-label="Export Auflösung"
                value={height}
                onChange={(e) => setHeight(+e.target.value)}
              >
                <option value={1080}>Full HD · 1920 × 1080</option>
                <option value={720}>HD · 1280 × 720</option>
              </select>
            </label>
            <label>
              Bildrate
              <select
                aria-label="Export Bildrate"
                value={fps}
                onChange={(e) => setFps(+e.target.value)}
              >
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </label>
            <label>
              Qualität
              <select
                aria-label="Export Qualität"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                <option value="standard">Standard · kleinere Datei</option>
                <option value="high">Hoch · mehr Details</option>
              </select>
            </label>
            <div className="buttons">
              <button onClick={() => setExportOpen(false)}>Abbrechen</button>
              <button
                className="primary"
                onClick={() => {
                  setExportOpen(false);
                  props.onExport({ height, fps, quality });
                }}
              >
                Export starten
              </button>
            </div>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {progress > 0 ? `Export ${progress} Prozent` : ""}
      </span>
    </section>
  );
}
