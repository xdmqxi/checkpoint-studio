// Source-time ranges let live retakes keep every original frame without stopping capture.
export function rangeDuration(ranges) {
  return ranges.reduce((sum, r) => sum + r.out - r.in, 0);
}
export function trimRanges(ranges, length) {
  let remaining = Math.max(0, length);
  const result = [];
  for (const range of ranges) {
    const keep = Math.min(range.out - range.in, remaining);
    if (keep > 0.001) result.push({ in: range.in, out: range.in + keep });
    remaining -= keep;
    if (remaining <= 0) break;
  }
  return result;
}
export class LiveTimeline {
  constructor() {
    this.ranges = [];
    this.start = 0;
  }
  snapshot(now) {
    return [
      ...this.ranges,
      ...(now > this.start + 0.001 ? [{ in: this.start, out: now }] : []),
    ];
  }
  duration(now) {
    return rangeDuration(this.snapshot(now));
  }
  retake(now, keep) {
    this.ranges = trimRanges(this.snapshot(now), keep);
    this.start = now;
  }
}
