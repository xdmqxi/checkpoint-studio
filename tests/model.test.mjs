import { test } from "node:test";
import assert from "node:assert/strict";
import { retake, split, duration, validate } from "../src/model.mjs";
const fixture = () => ({
  version: 1,
  takes: [
    { id: "a", video: "media/a.webm" },
    { id: "b", video: "media/b.webm" },
  ],
  clips: [
    { id: "1", takeId: "a", in: 2, out: 12 },
    { id: "2", takeId: "b", in: 0, out: 20 },
  ],
});
test("retake trims timeline at exact checkpoint and preserves originals", () => {
  const p = fixture(),
    n = retake(p, 15);
  assert.equal(duration(n), 15);
  assert.equal(n.clips[1].out, 5);
  assert.equal(p.clips[1].out, 20);
  assert.deepEqual(n.takes, p.takes);
});
test("retake to beginning keeps all original takes", () => {
  const n = retake(fixture(), 0);
  assert.equal(n.clips.length, 0);
  assert.equal(n.takes.length, 2);
});
test("split preserves source offsets and duration", () => {
  const p = fixture(),
    n = split(p, "1", 7);
  assert.equal(n.clips.length, 3);
  assert.equal(n.clips[1].in, 7);
  assert.equal(n.clips[0].out, 7);
  assert.equal(duration(n), duration(p));
  assert.ok(validate(n));
});
test("split rejects boundaries without adding zero-length clips", () => {
  assert.equal(split(fixture(), "1", 2).clips.length, 2);
  assert.equal(split(fixture(), "1", 12).clips.length, 2);
});
test("portable JSON retains media paths and rejects missing takes", () => {
  const p = JSON.parse(JSON.stringify(fixture()));
  assert.ok(validate(p));
  p.clips[0].takeId = "missing";
  assert.throws(() => validate(p));
});
