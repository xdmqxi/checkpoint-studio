export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function audioGain(track, time) {
  const length = track.out - track.in,
    relative = time - track.start;
  if (track.muted || relative < 0 || relative >= length) return 0;
  const fadeIn = Math.min(track.fadeIn || 0, length),
    fadeOut = Math.min(track.fadeOut || 0, length);
  return (
    clamp(track.volume ?? 1, 0, 1) *
    (fadeIn ? Math.min(1, relative / fadeIn) : 1) *
    (fadeOut ? Math.min(1, (length - relative) / fadeOut) : 1)
  );
}
export function splitAudio(track, time, id = crypto.randomUUID()) {
  const offset = time - track.start;
  if (offset <= 0.01 || offset >= track.out - track.in - 0.01) return [track];
  return [
    {
      ...track,
      out: track.in + offset,
      fadeOut: 0,
      fadeIn: Math.min(track.fadeIn || 0, offset),
    },
    {
      ...track,
      id,
      start: time,
      in: track.in + offset,
      fadeIn: 0,
      fadeOut: Math.min(track.fadeOut || 0, track.out - track.in - offset),
    },
  ];
}
export function trimAudio(track, edge, delta) {
  if (edge === "start") {
    const shift = clamp(
      delta,
      Math.max(-track.in, -track.start),
      track.out - track.in - 0.04,
    );
    return { ...track, start: track.start + shift, in: track.in + shift };
  }
  return {
    ...track,
    out: clamp(track.out + delta, track.in + 0.04, track.duration || track.out),
  };
}
export function snapTime(time, points, tolerance, enabled = true) {
  if (!enabled) return Math.max(0, time);
  const nearest = points.reduce(
    (best, p) => (Math.abs(p - time) < Math.abs(best - time) ? p : best),
    Infinity,
  );
  return Math.max(0, Math.abs(nearest - time) <= tolerance ? nearest : time);
}
export function peakPath(peaks, from = 0, to = 1) {
  if (!peaks?.length) return "";
  const start = Math.floor(from * peaks.length),
    end = Math.max(start + 1, Math.ceil(to * peaks.length));
  const values = peaks.slice(start, end);
  const top = values.map(
    (v, i) => `${(i / (values.length - 1 || 1)) * 100},${50 - v * 44}`,
  );
  const bottom = values
    .map((v, i) => `${(i / (values.length - 1 || 1)) * 100},${50 + v * 44}`)
    .reverse();
  return "M" + top.join(" L") + " L" + bottom.join(" L") + " Z";
}
