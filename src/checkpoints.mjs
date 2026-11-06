import { duration } from "./model.mjs";
export function locateTime(project, time) {
  if (!project.clips.length) return null;
  const target = Math.max(0, Math.min(duration(project), time));
  let start = 0;
  for (let index = 0; index < project.clips.length; index++) {
    const clip = project.clips[index],
      end = start + clip.out - clip.in;
    if (target < end - 0.000001 || index === project.clips.length - 1)
      return {
        clip,
        index,
        start,
        sourceTime:
          clip.in + Math.max(0, Math.min(clip.out - clip.in, target - start)),
      };
    start = end;
  }
  return null;
}
export function timelineTime(project, clipId, sourceTime) {
  let start = 0;
  for (const clip of project.clips) {
    if (clip.id === clipId)
      return (
        start + Math.max(0, Math.min(clip.out - clip.in, sourceTime - clip.in))
      );
    start += clip.out - clip.in;
  }
  return 0;
}
function anchor(project, marker) {
  if (marker.takeId && Number.isFinite(marker.sourceTime)) return marker;
  if (marker.time < 0 || marker.time > duration(project) + 0.001) return marker;
  const found = locateTime(project, marker.time);
  return found
    ? {
        ...marker,
        takeId: found.clip.takeId,
        clipId: found.clip.id,
        sourceTime: found.sourceTime,
      }
    : marker;
}
export function resolveCheckpoint(project, marker) {
  if (marker.takeId && Number.isFinite(marker.sourceTime)) {
    let start = 0;
    const matches = [];
    for (const clip of project.clips) {
      if (
        clip.takeId === marker.takeId &&
        marker.sourceTime >= clip.in - 0.001 &&
        marker.sourceTime <= clip.out + 0.001
      )
        matches.push({
          clipId: clip.id,
          time:
            start +
            Math.max(
              0,
              Math.min(clip.out - clip.in, marker.sourceTime - clip.in),
            ),
        });
      start += clip.out - clip.in;
    }
    const found = matches.find((m) => m.clipId === marker.clipId) || matches[0];
    return { ...marker, ...found, available: !!found };
  }
  return {
    ...marker,
    available:
      project.clips.length > 0 &&
      marker.time >= 0 &&
      marker.time <= duration(project) + 0.001,
  };
}
export function reconcileCheckpoints(before, next) {
  return {
    ...next,
    checkpoints: next.checkpoints.map((marker) => {
      const old = before.checkpoints.find((m) => m.id === marker.id);
      const anchored = anchor(old ? before : next, {
        ...marker,
        ...(old?.takeId
          ? {
              takeId: old.takeId,
              clipId: old.clipId,
              sourceTime: old.sourceTime,
            }
          : {}),
      });
      const { available, ...resolved } = resolveCheckpoint(next, anchored);
      return resolved;
    }),
  };
}
export function checkpointMarkers(project) {
  return project.checkpoints
    .map((m) => resolveCheckpoint(project, m))
    .sort((a, b) => a.time - b.time);
}
