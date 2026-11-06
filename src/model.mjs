export const duration = (p) => p.clips.reduce((s, c) => s + c.out - c.in, 0);
export function retake(p, time) {
  let cursor = 0;
  const clips = [];
  for (const c of p.clips) {
    const end = cursor + c.out - c.in;
    if (cursor < time)
      clips.push({ ...c, out: c.in + Math.min(c.out - c.in, time - cursor) });
    cursor = end;
  }
  return { ...p, clips };
}
export function split(p, id, time) {
  return {
    ...p,
    clips: p.clips.flatMap((c) =>
      c.id !== id || time <= c.in || time >= c.out
        ? [c]
        : [
            { ...c, out: time },
            { ...c, id: crypto.randomUUID(), in: time },
          ],
    ),
  };
}
export function validate(p) {
  if (p.version !== 1) throw Error("Unsupported version");
  for (const c of p.clips)
    if (c.in < 0 || c.out <= c.in || !p.takes.some((t) => t.id === c.takeId))
      throw Error("Invalid clip");
  return true;
}
