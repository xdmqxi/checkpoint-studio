import { wrapText } from "./text-layout.mjs";
export type LiveText = {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  background: string;
  bold: boolean;
  align: "left" | "center";
};
export const defaultText: LiveText = {
  enabled: false,
  text: "",
  fontSize: 48,
  color: "#ffffff",
  background: "#182019",
  bold: false,
  align: "left",
};
export class Compositor {
  video = document.createElement("video");
  canvas = document.createElement("canvas");
  stream!: MediaStream;
  timer?: ReturnType<typeof setInterval>;
  constructor(
    private source: MediaStream,
    private fps: number,
    private text: () => LiveText,
  ) {}
  async start() {
    this.video.muted = true;
    this.video.srcObject = this.source;
    await this.video.play();
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.draw();
    this.stream = this.canvas.captureStream(0);
    const track =
      this.stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    this.timer = setInterval(() => {
      this.draw();
      track.requestFrame();
    }, 1000 / this.fps);
    track.requestFrame();
    return this.stream;
  }
  draw() {
    const ctx = this.canvas.getContext("2d")!;
    const { width: w, height: h } = this.canvas;
    ctx.drawImage(this.video, 0, 0, w, h);
    const text = this.text();
    if (!text.enabled || !text.text) return;
    // Same relative card geometry on every source, including a single captured window.
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 0, w, h);
    const x = w * 0.1,
      y = h * 0.1,
      cw = w * 0.8,
      ch = h * 0.8,
      pad = w * 0.035;
    ctx.fillStyle = text.background;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, w * 0.015);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + pad, y + pad, cw - pad * 2, ch - pad * 2);
    ctx.clip();
    const size = (text.fontSize * w) / 1440;
    ctx.font = `${text.bold ? "700" : "400"} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = text.color;
    ctx.textBaseline = "top";
    ctx.textAlign = text.align;
    const maxWidth = cw - pad * 2,
      lineHeight = size * 1.45;
    const lines = wrapText(
      text.text,
      maxWidth,
      (line: string) => ctx.measureText(line).width,
    );
    lines.forEach((line, i) =>
      ctx.fillText(
        line,
        text.align === "center" ? w / 2 : x + pad,
        y + pad + i * lineHeight,
      ),
    );
    ctx.restore();
  }
  stop() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.pause();
    this.video.srcObject = null;
  }
}
