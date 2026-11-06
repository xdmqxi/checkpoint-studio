import { Compositor, type LiveText } from "./compositor";
type Options = {
  sourceId: string;
  mic: boolean;
  quality: number;
  fps: number;
  text: () => LiveText;
  onElapsed: (n: number) => void;
  onEnded: () => void;
};
export class RecordingSession {
  private streams: MediaStream[] = [];
  private recorders: MediaRecorder[] = [];
  private buffers: Record<string, Blob[]> = {};
  private finished: Promise<void>[] = [];
  private compositor?: Compositor;
  private timer?: ReturnType<typeof setInterval>;
  private started = 0;
  private pauseStarted: number | null = null;
  private pauseTotal = 0;
  private stoppedAt: number | null = null;
  private keys: string[] = [];
  constructor(private options: Options) {}
  now() {
    const end = this.stoppedAt ?? this.pauseStarted ?? performance.now();
    return this.started
      ? Math.max(0, (end - this.started - this.pauseTotal) / 1000)
      : 0;
  }
  async start() {
    try {
      const o = this.options;
      const source = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: o.sourceId,
            maxWidth: Math.round((o.quality * 16) / 9),
            maxHeight: o.quality,
            maxFrameRate: o.fps,
          },
        } as any,
      });
      this.streams.push(source);
      this.compositor = new Compositor(source, o.fps, o.text);
      const video = await this.compositor.start();
      const tracks = [{ key: "video", stream: video }];
      if (o.mic) {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.streams.push(mic);
        tracks.push({ key: "mic", stream: mic });
      }
      for (const { key, stream } of tracks) {
        this.keys.push(key);
        this.buffers[key] = [];
        const recorder = new MediaRecorder(stream, {
          mimeType:
            key === "video"
              ? "video/webm;codecs=vp9"
              : "audio/webm;codecs=opus",
          videoBitsPerSecond: o.quality >= 2160 ? 24000000 : 10000000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size) this.buffers[key].push(e.data);
        };
        this.finished.push(
          new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
          }),
        );
        recorder.onerror = () => o.onEnded();
        this.recorders.push(recorder);
      }
      this.started = performance.now();
      this.recorders.forEach((r) => r.start(1000));
      this.timer = setInterval(() => o.onElapsed(this.now()), 100);
      source.getVideoTracks()[0].onended = () => {
        if (this.stoppedAt === null) o.onEnded();
      };
    } catch (e) {
      this.cleanup();
      throw e;
    }
  }
  pause() {
    if (this.pauseStarted !== null) return;
    this.pauseStarted = performance.now();
    this.recorders.forEach((r) => r.pause());
    this.options.onElapsed(this.now());
  }
  resume() {
    if (this.pauseStarted === null) return;
    this.pauseTotal += performance.now() - this.pauseStarted;
    this.pauseStarted = null;
    this.recorders.forEach((r) => r.resume());
  }
  async stop() {
    const duration = this.now();
    this.stoppedAt = this.pauseStarted ?? performance.now();
    clearInterval(this.timer);
    this.recorders.forEach((r) => {
      if (r.state !== "inactive") r.stop();
    });
    await Promise.all(this.finished);
    const files = this.keys.map((key) => ({
      key,
      blob: new Blob(this.buffers[key], {
        type: key === "video" ? "video/webm" : "audio/webm",
      }),
    }));
    this.cleanup();
    return { duration, files };
  }
  private cleanup() {
    clearInterval(this.timer);
    this.compositor?.stop();
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  }
}
