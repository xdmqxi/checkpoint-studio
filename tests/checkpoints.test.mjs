import { test } from "node:test";
import assert from "node:assert/strict";
import {
  locateTime,
  timelineTime,
  reconcileCheckpoints,
  checkpointMarkers,
} from "../src/checkpoints.mjs";
const fixture = () => ({
  clips: [
    { id: "a", takeId: "take-a", in: 2, out: 8 },
    { id: "b", takeId: "take-b", in: 10, out: 16 },
  ],
  checkpoints: [{ id: "one", name: "Schritt", time: 8 }],
  takes: [],
});
test("seeking resolves a global timeline position to the correct source time", () => {
  const p = fixture();
  assert.equal(locateTime(p, 8).sourceTime, 12);
  assert.equal(locateTime(p, 8).clip.id, "b");
  assert.equal(timelineTime(p, "b", 12), 8);
  assert.equal(locateTime(p, 6).sourceTime, 10);
});
test("legacy checkpoint migrates without moving, then follows clip reordering", () => {
  const p = fixture(),
    anchored = reconcileCheckpoints(p, p);
  assert.equal(anchored.checkpoints[0].sourceTime, 12);
  const moved = reconcileCheckpoints(anchored, {
    ...anchored,
    clips: [anchored.clips[1], anchored.clips[0]],
  });
  assert.equal(moved.checkpoints[0].time, 2);
  assert.ok(checkpointMarkers(moved)[0].available);
});
test("ripple trimming earlier clips updates later checkpoint positions", () => {
  const p = fixture(),
    n = reconcileCheckpoints(p, {
      ...p,
      clips: [{ ...p.clips[0], in: 4 }, p.clips[1]],
    });
  assert.equal(n.checkpoints[0].time, 6);
});
test("checkpoint in removed source region stays visible as unavailable", () => {
  const p = fixture(),
    n = reconcileCheckpoints(p, {
      ...p,
      clips: [p.clips[0], { ...p.clips[1], in: 13 }],
    });
  assert.equal(checkpointMarkers(n)[0].available, false);
  assert.equal(n.checkpoints.length, 1);
});
test("split source ranges and retake gaps use edited timeline times", () => {
  const p = {
    clips: [
      { id: "x", takeId: "a", in: 0, out: 4 },
      { id: "y", takeId: "a", in: 10, out: 15 },
    ],
    checkpoints: [
      { id: "m", name: "Neu", time: 0, takeId: "a", sourceTime: 12 },
    ],
  };
  assert.equal(checkpointMarkers(p)[0].time, 6);
});
test("duplicating a clip keeps checkpoint attached to its original clip", () => {
  const p = fixture(),
    anchored = reconcileCheckpoints(p, p),
    copy = { ...p.clips[1], id: "copy" };
  const n = reconcileCheckpoints(anchored, {
    ...anchored,
    clips: [copy, ...p.clips],
  });
  assert.equal(n.checkpoints[0].time, 14);
});
