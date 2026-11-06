import React, { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Square,
  Flag,
  RotateCcw,
  Type,
  GripVertical,
  X,
  ArrowUpRight,
  Bold,
  AlignLeft,
  AlignCenter,
} from "lucide-react";
import { defaultText, type LiveText } from "./compositor";
import "./floating.css";
declare global {
  interface Window {
    live: any;
  }
}
const fmt = (t: number) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
export function Floating({ kind }: { kind: string }) {
  const [state, setState] = useState<any>({
    status: "recording",
    elapsed: 0,
    checkpointCount: 0,
    text: defaultText,
  });
  const [text, setText] = useState<LiveText>(defaultText);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    document.documentElement.dataset.floating = kind;
    document.title =
      kind === "pill" ? "Checkpoint · Aufnahme" : "Checkpoint · Live-Text";
    const receive = (s: any) => {
      setState(s);
      const serialized = JSON.stringify(s.text);
      if (pending.current === null || pending.current === serialized) {
        pending.current = null;
        setText(s.text);
      }
    };
    window.live.get().then(receive);
    return window.live.onState(receive);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && kind === "text") window.live.action("textHide");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [kind]);
  useEffect(() => {
    if (kind !== "pill") return;
    const element = document.querySelector(".recording-pill");
    if (!element) return;
    let previous = "";
    const fit = () => {
      const bounds = element.getBoundingClientRect();
      const width = Math.ceil(bounds.width + 16),
        height = Math.ceil(bounds.height + 26),
        key = `${width}x${height}`;
      if (key !== previous) {
        previous = key;
        window.live.fit(width, height).catch(console.error);
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    return () => observer.disconnect();
  }, [kind]);
  const update = (patch: Partial<LiveText>) => {
    const next = { ...text, ...patch };
    pending.current = JSON.stringify(next);
    setText(next);
    window.live.text(next);
  };
  const action = (name: string) => window.live.action(name);
  if (kind === "pill")
    return (
      <div
        className={`recording-pill ${state.status === "paused" ? "is-paused" : "is-recording"}`}
      >
        <div className="pill-grip" title="Zum Verschieben ziehen">
          <GripVertical size={17} />
        </div>
        <div className="pill-clock">
          <span
            className={state.status === "paused" ? "paused-led" : "record-led"}
          />
          <strong>{fmt(state.elapsed)}</strong>
          <small>{state.status === "paused" ? "Pausiert" : "Aufnahme"}</small>
        </div>
        <div className="pill-divider" />
        <button
          title={
            state.status === "paused"
              ? "Aufnahme fortsetzen"
              : "Aufnahme pausieren"
          }
          aria-label={state.status === "paused" ? "Fortsetzen" : "Pausieren"}
          className="pill-tool pill-pause"
          onClick={() => action("pause")}
        >
          {state.status === "paused" ? <Play size={18} /> : <Pause size={18} />}
          <small>{state.status === "paused" ? "Weiter" : "Pause"}</small>
        </button>
        <button
          title="Checkpoint setzen – die Aufnahme läuft weiter"
          onClick={() => action("checkpoint")}
          className="pill-checkpoint"
        >
          <span className="pill-flag-icon">
            <Flag size={18} />
          </span>
          <span className="pill-checkpoint-copy">
            Checkpoint
            <small>
              {state.checkpointCount
                ? state.lastCheckpoint || "Schritt gesichert"
                : "Moment sichern"}
            </small>
          </span>
          <span className="pill-count" key={state.checkpointCount}>
            {state.checkpointCount || "+"}
          </span>
        </button>
        <button
          title="Zum letzten Checkpoint zurück – Original bleibt erhalten"
          aria-label="Zum Checkpoint zurück"
          className="pill-tool"
          disabled={!state.checkpointCount}
          onClick={() => action("retake")}
        >
          <RotateCcw size={18} />
          <small>Zurück</small>
        </button>
        <button
          title="Großes Textfeld ein-/ausblenden · Text wird mitaufgenommen"
          aria-label="Textfeld"
          className={`pill-tool ${state.text?.enabled ? "pill-text-active" : ""}`}
          onClick={() => action("textToggle")}
        >
          <Type size={19} />
          <small>Text</small>
        </button>
        <div className="pill-divider" />
        <button
          title="Aufnahme stoppen und speichern"
          aria-label="Stoppen"
          className="pill-tool pill-stop"
          onClick={() => action("stop")}
        >
          <Square size={13} fill="currentColor" />
          <small>Stop</small>
        </button>
        <button
          className="pill-main"
          title="Studio öffnen"
          aria-label="Studio öffnen"
          onClick={() => action("showMain")}
        >
          <ArrowUpRight size={17} />
        </button>
      </div>
    );
  return (
    <div
      className="live-text-window"
      style={{ background: text.background, color: text.color }}
    >
      <div className="text-window-top">
        <span>
          <Type size={15} /> LIVE-TEXT <i /> Wird direkt mitaufgenommen
        </span>
        <button
          aria-label="Textfeld schließen"
          title="Schließen · Escape"
          onClick={() => action("textHide")}
        >
          <X size={19} />
        </button>
      </div>
      <textarea
        autoFocus
        aria-label="Text für die Aufnahme"
        spellCheck={false}
        maxLength={20000}
        placeholder="Deine Erklärung, dein nächster Schritt …"
        value={text.text}
        onChange={(e) => update({ text: e.target.value })}
        style={{
          fontSize: `${text.fontSize / 11.52}vw`,
          fontWeight: text.bold ? 700 : 400,
          textAlign: text.align,
          color: text.color,
        }}
      />
      <div className="text-window-tools">
        <label>
          Schriftgröße
          <select
            aria-label="Schriftgröße"
            value={text.fontSize}
            onChange={(e) => update({ fontSize: +e.target.value })}
          >
            {[24, 32, 40, 48, 64, 80, 96, 120].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          aria-label="Fett"
          className={text.bold ? "chosen" : ""}
          onClick={() => update({ bold: !text.bold })}
        >
          <Bold size={17} />
        </button>
        <button
          aria-label="Linksbündig"
          className={text.align === "left" ? "chosen" : ""}
          onClick={() => update({ align: "left" })}
        >
          <AlignLeft size={17} />
        </button>
        <button
          aria-label="Zentriert"
          className={text.align === "center" ? "chosen" : ""}
          onClick={() => update({ align: "center" })}
        >
          <AlignCenter size={17} />
        </button>
        <label>
          Text
          <input
            aria-label="Textfarbe"
            type="color"
            value={text.color}
            onChange={(e) => update({ color: e.target.value })}
          />
        </label>
        <label>
          Fläche
          <input
            aria-label="Hintergrundfarbe"
            type="color"
            value={text.background}
            onChange={(e) => update({ background: e.target.value })}
          />
        </label>
        <span className="text-tools-note">
          Escape zum Ausblenden · Aufnahme läuft weiter
        </span>
      </div>
    </div>
  );
}
