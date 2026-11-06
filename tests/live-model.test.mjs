import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveTimeline, rangeDuration, trimRanges } from "../src/live-model.mjs";
test("live checkpoint timeline advances without ending the source recording", () => {
  const t = new LiveTimeline();
  assert.equal(t.duration(5), 5);
  assert.equal(t.duration(8), 8);
  assert.deepEqual(t.snapshot(8), [{ in: 0, out: 8 }]);
});
test("live retake omits the mistake and keeps new source offsets synchronized", () => {
  const t = new LiveTimeline();
  t.retake(10, 4);
  assert.deepEqual(t.snapshot(13), [
    { in: 0, out: 4 },
    { in: 10, out: 13 },
  ]);
  assert.equal(t.duration(13), 7);
});
test("repeated live retakes cross prior source gaps precisely", () => {
  const t = new LiveTimeline();
  t.retake(10, 4);
  t.retake(15, 6);
  assert.deepEqual(t.snapshot(18), [
    { in: 0, out: 4 },
    { in: 10, out: 12 },
    { in: 15, out: 18 },
  ]);
  assert.equal(t.duration(18), 9);
});
test("live retake to start preserves only the new explanation", () => {
  const t = new LiveTimeline();
  t.retake(20, 0);
  assert.deepEqual(t.snapshot(25), [{ in: 20, out: 25 }]);
});
test("paused checkpoint produces no zero-duration clip", () => {
  const t = new LiveTimeline();
  t.retake(5, 3);
  assert.deepEqual(t.snapshot(5), [{ in: 0, out: 3 }]);
  assert.equal(rangeDuration(trimRanges([{ in: 7, out: 12 }], 2)), 2);
});
