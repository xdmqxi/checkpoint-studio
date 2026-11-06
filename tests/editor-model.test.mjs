import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioGain,
  splitAudio,
  trimAudio,
  snapTime,
} from "../src/editor-model.mjs";
const track = () => ({
  id: "a",
  start: 2,
  in: 1,
  out: 5,
  duration: 10,
  volume: 0.8,
  fadeIn: 1,
  fadeOut: 1,
});
test("audio envelope respects timeline position, fades, mute and source trim", () => {
  const t = track();
  assert.equal(audioGain(t, 1), 0);
  assert.equal(audioGain(t, 2), 0);
  assert.equal(audioGain(t, 2.5), 0.4);
  assert.equal(audioGain(t, 4), 0.8);
  assert.equal(audioGain(t, 5.5), 0.4);
  assert.equal(audioGain(t, 6), 0);
  assert.equal(audioGain({ ...t, muted: true }, 4), 0);
});
test("splitting audio keeps timeline positions and exact source continuity without changing original", () => {
  const t = track(),
    [a, b] = splitAudio(t, 4, "b");
  assert.equal(a.out, 3);
  assert.equal(b.in, 3);
  assert.equal(b.start, 4);
  assert.equal(a.out - a.in + b.out - b.in, 4);
  assert.equal(a.fadeOut, 0);
  assert.equal(b.fadeIn, 0);
  assert.equal(t.out, 5);
  assert.equal(splitAudio(t, 2).length, 1);
});
test("audio edge trims clamp source and timeline boundaries", () => {
  const t = track();
  assert.deepEqual(trimAudio(t, "start", 1), { ...t, start: 3, in: 2 });
  const left = trimAudio(t, "start", -8);
  assert.equal(left.start, 1);
  assert.equal(left.in, 0);
  assert.equal(trimAudio(t, "end", 20).out, 10);
  assert.ok(trimAudio(t, "end", -20).out > t.in);
});
test("snapping uses nearest visible edit point and can be bypassed", () => {
  assert.equal(snapTime(2.05, [0, 2, 4], 0.1), 2);
  assert.equal(snapTime(2.3, [0, 2, 4], 0.1), 2.3);
  assert.equal(snapTime(2.05, [2], 0.1, false), 2.05);
  assert.equal(snapTime(-2, [], 0.1), 0);
});
