import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapText } from "../src/text-layout.mjs";
const width = (s) => s.length;
test("live text wraps at word boundaries, including explicit paragraphs", () => {
  assert.deepEqual(wrapText("Ein Text mit\n\nAbsatz", 8, width), [
    "Ein Text",
    "mit",
    "",
    "Absatz",
  ]);
});
test("long words wrap without losing characters", () => {
  assert.deepEqual(wrapText("123456789", 4, width), ["1234", "5678", "9"]);
});
