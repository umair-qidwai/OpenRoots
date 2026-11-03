import { test } from "node:test";
import assert from "node:assert/strict";
import { transliterationCandidates } from "../src/core/transliteration";
test("transliteration maps spelling aliases, never an inferred root", () => {
  assert.deepEqual(transliterationCandidates("istighfār"), ["استغفار"]);
  assert.deepEqual(transliterationCandidates("khawf"), ["خوف"]);
  assert.deepEqual(transliterationCandidates("ṣabr"), ["صبر"]);
});
test("unsupported transliteration and English queries remain unchanged rather than guessing morphology", () => {
  assert.deepEqual(transliterationCandidates("forgiveness"), []);
  assert.deepEqual(transliterationCandidates("unlisted-form"), []);
  assert.deepEqual(transliterationCandidates("كتب"), []);
});
