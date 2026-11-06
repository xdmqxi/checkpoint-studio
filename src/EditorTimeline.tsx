import React, { useEffect, useRef, useState } from "react";
import {
  Flag,
  Video,
  Mic,
  Volume2,
  X,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  MapPin,
  Music2,
  VolumeX,
} from "lucide-react";
import { duration } from "./model.mjs";
import { checkpointMarkers } from "./checkpoints.mjs";
import "./timeline.css";
import { clamp, snapTime, trimAudio, peakPath } from "./editor-model.mjs";
import type { AudioTrack } from "./project";
export const timeLabel = (t: number) => {
  const safe = Math.round(Math.max(0, t) * 10) / 10;
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toFixed(1).padStart(4, "0")}`;
};
type Props = {
  project: any;
  selected: string;
  playhead: number;
  onSeek: (time: number) => void;
  onSelect: (id: string) => void;
  onMove: (id: string, index: number) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  selectedAudio: string;
  tool: "select" | "razor";
  snap: boolean;
  onAudioSelect: (id: string) => void;
  onAudioChange: (track: AudioTrack) => void;
  onVideoTrim: (id: string, range: { in: number; out: number }) => void;
  onRazor: (id: string, time: number, audio: boolean) => void;
  onDropAsset: (id: string, time: number, lane: number) => void;
  onDropTake: (id: string, index: number) => void;
  sourceRows: { id: string; name: string }[];
  embeddedAudio: Record<string, boolean>;
  onRemoveSource: (id: string) => void;
};
export function EditorTimeline({
  project: p,
  selected,
  playhead,
  onSeek,
  onSelect,
  onMove,
  onRename,
  onRemove,
  selectedAudio,
  tool,
  snap,
  onAudioSelect,
  onAudioChange,
  onVideoTrim,
  onRazor,
  onDropAsset,
  onDropTake,
  sourceRows,
  embeddedAudio,
  onRemoveSource,
}: Props) {
  const [dragAudio, setDragAudio] = useState<AudioTrack | null>(null);
  const [dragVideo, setDragVideo] = useState<any>(null);
  const dragging = useRef(false);
  const [zoom, setZoom] = useState(1),
    [availableWidth, setAvailableWidth] = useState(750);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new ResizeObserver((entries) =>
      setAvailableWidth(entries[0].contentRect.width),
    );
    if (viewport.current) obs.observe(viewport.current);
    return () => obs.disconnect();
  }, []);
  const total = Math.max(
      duration(p),
      ...(p.audioTracks || []).map((t: AudioTrack) => t.start + t.out - t.in),
    ),
    markers: { id: string; name: string; time: number; available: boolean }[] =
      checkpointMarkers(p),
    visible = markers.filter((m) => m.available),
    width = Math.max(480, availableWidth - 112) * zoom,
    pps = width / (total || 1);
  const step =
    [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].find(
      (n) => n * pps >= 75,
    ) || 3600;
  const ticks = Array.from(
    { length: Math.floor(total / step) + 1 },
    (_, i) => i * step,
  );
  const current = visible.filter((m) => m.time <= playhead + 0.05).at(-1);
  function position(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(
      Math.max(
        0,
        Math.min(total, ((e.clientX - rect.left) / rect.width) * total),
      ),
    );
  }
  let offset = 0;
  const clips = p.clips.map((c: any) => {
    const start = offset;
    offset += c.out - c.in;
    return { ...c, start };
  });
  const points = [
    0,
    playhead,
    ...clips.flatMap((c: any) => [c.start, c.start + c.out - c.in]),
    ...visible.map((m) => m.time),
  ];
  function editAudio(
    e: React.PointerEvent,
    track: AudioTrack,
    edge: "move" | "start" | "end",
  ) {
    if (tool === "razor") return;
    e.preventDefault();
    e.stopPropagation();
    onAudioSelect(track.id);
    const x = e.clientX,
      y = e.clientY;
    let latest = track;
    dragging.current = false;
    const move = (event: PointerEvent) => {
      const delta = (event.clientX - x) / pps;
      dragging.current =
        Math.abs(event.clientX - x) > 3 || Math.abs(event.clientY - y) > 3;
      if (edge === "move")
        latest = {
          ...track,
          start: snapTime(
            track.start + delta,
            points,
            8 / pps,
            snap && !event.altKey,
          ),
        };
      else latest = trimAudio(track, edge, delta);
      setDragAudio(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragAudio(null);
      if (dragging.current) onAudioChange(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }
  function trimVideo(e: React.PointerEvent, c: any, edge: "start" | "end") {
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    let latest = c;
    dragging.current = false;
    const source = p.takes.find((t: any) => t.id === c.takeId);
    const move = (event: PointerEvent) => {
      const delta = (event.clientX - x) / pps;
      dragging.current = Math.abs(event.clientX - x) > 3;
      latest =
        edge === "start"
          ? { ...c, in: clamp(c.in + delta, 0, c.out - 0.04) }
          : { ...c, out: clamp(c.out + delta, c.in + 0.04, source.duration) };
      setDragVideo(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragVideo(null);
      if (dragging.current)
        onVideoTrim(c.id, { in: latest.in, out: latest.out });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }
  return (
    <div className="timeline-overview" data-tool={tool}>
      <div className="timeline-toolbar">
        <span>
          <MapPin size={14} />
          {markers.length} Checkpoints{" "}
          <span className="timeline-current">
            · {timeLabel(playhead)} / {timeLabel(total)}
          </span>
        </span>
        <div className="timeline-zoom">
          <button
            title="Timeline verkleinern"
            aria-label="Timeline verkleinern"
            disabled={zoom <= 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.5))}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)} %</span>
          <button
            title="Timeline vergrößern"
            aria-label="Timeline vergrößern"
            disabled={zoom >= 6}
            onClick={() => setZoom(Math.min(6, zoom + 0.5))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="timeline-scroll" ref={viewport}>
        <div
          className="timeline-grid"
          style={
            {
              width: width + 112,
              "--audio-row-count":
                sourceRows.length + (p.audioTracks || []).length,
            } as React.CSSProperties
          }
        >
          <div className="timeline-labels">
            <span>Zeit</span>
            <span>
              <Flag size={15} />
              Checkpoints
            </span>
            <span>
              <Video size={15} />
              Video
            </span>
            {sourceRows.map((row) => (
              <span className="source-track-label" key={row.id}>
                {row.id === "mic" ? <Mic size={13} /> : <Volume2 size={13} />}
                <span>{row.name}</span>
                <button
                  aria-label={`${row.name} entfernen`}
                  title="Audiospur aus der Sequenz entfernen"
                  onClick={() => onRemoveSource(row.id)}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {(p.audioTracks || []).map((t: AudioTrack) => (
              <span className="extra-track-label" key={t.id} title={t.name}>
                <Music2 size={13} />
                <span>{t.name}</span>
              </span>
            ))}
          </div>
          <div className="timeline-lanes" style={{ width }}>
            <div
              className="time-ruler"
              aria-label="Zeitleiste"
              onClick={position}
            >
              {ticks.map((t) => (
                <span className="time-tick" key={t} style={{ left: t * pps }}>
                  {timeLabel(t)}
                </span>
              ))}
            </div>
            <div
              className="checkpoint-lane"
              aria-label="Checkpoint-Spur"
              onClick={position}
            >
              {visible.map((m, i) => (
                <button
                  className={
                    "checkpoint-marker " +
                    (current?.id === m.id ? "current" : "")
                  }
                  data-marker-id={m.id}
                  key={m.id}
                  style={{
                    left: Math.min(width - 8, m.time * pps),
                    top: 1 + (i % 2) * 14,
                  }}
                  title={`${m.name} · ${timeLabel(m.time)} – Zur Stelle springen`}
                  aria-label={`Checkpoint ${m.name} bei ${timeLabel(m.time)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(m.time);
                  }}
                >
                  <Flag size={15} fill="currentColor" />
                  <span
                    style={{
                      maxWidth: Math.max(
                        0,
                        Math.min(
                          140,
                          ((visible[i + 2]?.time ?? total) - m.time) * pps - 20,
                        ),
                      ),
                    }}
                  >
                    {m.name}
                  </span>
                </button>
              ))}
              {!visible.length && (
                <span className="no-checkpoints">
                  Checkpoint am Abspielkopf hinzufügen
                </span>
              )}
            </div>
            <div
              className="timeline-video-lane"
              onClick={position}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("take");
                if (id) onDropTake(id, clips.length);
                else {
                  const clip = e.dataTransfer.getData("clip");
                  if (clip) onMove(clip, clips.length - 1);
                }
              }}
            >
              {clips.map((c: any) => (
                <button
                  draggable
                  key={c.id}
                  className={
                    "timeline-video-clip " +
                    (selected === c.id && !selectedAudio ? "selected" : "")
                  }
                  style={{
                    left: c.start * pps,
                    width: Math.max(
                      2,
                      (dragVideo?.id === c.id
                        ? dragVideo.out - dragVideo.in
                        : c.out - c.in) * pps,
                    ),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragging.current) {
                      dragging.current = false;
                      return;
                    }
                    if (tool === "razor") {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onRazor(
                        c.id,
                        c.start + (e.clientX - rect.left) / pps,
                        false,
                      );
                    } else onSelect(c.id);
                  }}
                  title={`Take ${p.takes.findIndex((t: any) => t.id === c.takeId) + 1} · ${timeLabel(c.start)} bis ${timeLabel(c.start + c.out - c.in)}`}
                  onDragStart={(e) => {
                    dragging.current = false;
                    e.dataTransfer.setData("clip", c.id);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const take = e.dataTransfer.getData("take");
                    if (take) {
                      onDropTake(
                        take,
                        clips.findIndex((x: any) => x.id === c.id),
                      );
                      return;
                    }
                    onMove(
                      e.dataTransfer.getData("clip"),
                      clips.findIndex((x: any) => x.id === c.id),
                    );
                  }}
                >
                  <span
                    className="trim-handle start"
                    title="Clipanfang kürzen"
                    onPointerDown={(e) => trimVideo(e, c, "start")}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Video size={14} />
                  <span>
                    Take {p.takes.findIndex((t: any) => t.id === c.takeId) + 1}
                  </span>
                  <small>{timeLabel(c.out - c.in)}</small>
                  <span
                    className="trim-handle end"
                    title="Clipende kürzen"
                    onPointerDown={(e) => trimVideo(e, c, "end")}
                    onClick={(e) => e.stopPropagation()}
                  />
                </button>
              ))}
            </div>
            {sourceRows.map((row) => (
              <div
                className="timeline-audio-lane"
                key={row.id}
                aria-label={`Audiospur ${row.name}`}
                data-source-row={row.id}
              >
                {clips
                  .filter((c: any) => {
                    const take = p.takes.find((t: any) => t.id === c.takeId);
                    return row.id === "mic"
                      ? !!take?.mic
                      : !!(
                          take?.system ||
                          take?.hasAudio ||
                          embeddedAudio[take?.id]
                        );
                  })
                  .map((c: any) => (
                    <div
                      className="timeline-audio-clip"
                      key={c.id}
                      style={{
                        left: c.start * pps,
                        width: Math.max(2, (c.out - c.in) * pps),
                      }}
                    >
                      {row.id === "mic" ? (
                        <Mic size={12} />
                      ) : (
                        <Volume2 size={12} />
                      )}{" "}
                      {row.name}
                    </div>
                  ))}
              </div>
            ))}
            {(p.audioTracks || []).map(
              (original: AudioTrack, index: number) => {
                const lane = index;
                const track =
                  dragAudio?.id === original.id ? dragAudio : original;
                return (
                  <div
                    className="extra-audio-lane"
                    key={original.id}
                    data-lane={lane}
                    data-audio-row={original.id}
                    aria-label={`Audiospur ${original.name}`}
                    onClick={position}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("asset");
                      if (id) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onDropAsset(
                          id,
                          snapTime(
                            (e.clientX - rect.left) / pps,
                            points,
                            8 / pps,
                            snap,
                          ),
                          lane,
                        );
                      }
                    }}
                  >
                    {[track].map((t: AudioTrack) => (
                      <button
                        key={t.id}
                        className={
                          "timeline-music-clip " +
                          (selectedAudio === t.id ? "selected " : "") +
                          (t.muted ? "muted" : "")
                        }
                        aria-label={`Audio-Clip ${t.name}`}
                        style={{
                          left: t.start * pps,
                          width: Math.max(3, (t.out - t.in) * pps),
                        }}
                        onPointerDown={(e) => editAudio(e, t, "move")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dragging.current) {
                            dragging.current = false;
                            return;
                          }
                          if (tool === "razor") {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            onRazor(
                              t.id,
                              t.start + (e.clientX - rect.left) / pps,
                              true,
                            );
                          } else onAudioSelect(t.id);
                        }}
                      >
                        <span
                          className="trim-handle start"
                          title="Audioanfang kürzen"
                          onPointerDown={(e) => editAudio(e, t, "start")}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="audio-clip-name">
                          {t.muted ? (
                            <VolumeX size={11} />
                          ) : (
                            <Music2 size={11} />
                          )}{" "}
                          {t.name}
                        </span>
                        <svg
                          className="audio-waveform"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-label="Audio-Wellenform"
                        >
                          <path
                            d={peakPath(
                              t.peaks,
                              t.in / (t.duration || t.out),
                              t.out / (t.duration || t.out),
                            )}
                          />
                        </svg>
                        {!!t.fadeIn && (
                          <span
                            className="fade-guide fade-in"
                            style={{
                              width: Math.min(t.fadeIn, t.out - t.in) * pps,
                            }}
                          />
                        )}
                        {!!t.fadeOut && (
                          <span
                            className="fade-guide fade-out"
                            style={{
                              width: Math.min(t.fadeOut, t.out - t.in) * pps,
                            }}
                          />
                        )}
                        <span
                          className="trim-handle end"
                          title="Audioende kürzen"
                          onPointerDown={(e) => editAudio(e, t, "end")}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </button>
                    ))}
                  </div>
                );
              },
            )}
            <div
              className="timeline-playhead"
              style={{ left: Math.min(width, playhead * pps) }}
            >
              <span />
            </div>
          </div>
        </div>
      </div>
      <div className="checkpoint-overview">
        <div className="checkpoint-heading">
          <h3>
            <Flag size={16} />
            Deine Checkpoints
          </h3>
          <span>
            Markierung oder Pfeil anklicken, um zur Stelle zu springen
          </span>
        </div>
        {markers.length ? (
          <div className="checkpoint-cards">
            {markers.map((m, i) => (
              <div
                className={
                  "checkpoint-card " +
                  (current?.id === m.id ? "current" : "") +
                  (!m.available ? " missing" : "")
                }
                key={m.id}
              >
                <button
                  className="checkpoint-jump"
                  disabled={!m.available}
                  aria-label={`Zu ${m.name} springen`}
                  onClick={() => onSeek(m.time)}
                  title={
                    m.available
                      ? "In der Vorschau öffnen"
                      : "Der ursprüngliche Bereich ist nicht mehr in der Timeline"
                  }
                >
                  <Flag size={16} />
                  <span>{String(i + 1).padStart(2, "0")}</span>
                </button>
                <div className="checkpoint-details">
                  <input
                    aria-label={`Checkpoint ${i + 1} umbenennen`}
                    value={m.name}
                    onChange={(e) => onRename(m.id, e.target.value)}
                  />
                  <small>
                    {timeLabel(m.time)}
                    {!m.available
                      ? " · Abschnitt entfernt"
                      : current?.id === m.id
                        ? " · Aktueller Abschnitt"
                        : ""}
                  </small>
                </div>
                <button
                  className="checkpoint-go"
                  title="Zur Stelle springen"
                  aria-label={`Vorschau ${m.name}`}
                  disabled={!m.available}
                  onClick={() => onSeek(m.time)}
                >
                  <ArrowRight size={16} />
                </button>
                <button
                  className="checkpoint-delete"
                  title="Nur die Markierung entfernen"
                  aria-label={`Checkpoint ${m.name} entfernen`}
                  onClick={() => onRemove(m.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-checkpoint-list">
            Noch keine Checkpoints. Setze während der Aufnahme einen Marker oder
            füge hier einen am Abspielkopf hinzu.
          </p>
        )}
      </div>
    </div>
  );
}
