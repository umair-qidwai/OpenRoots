import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/core/search";
test("mobile lookup uses the corpus hamza, Arabic marks and alif normalization", () => {
  assert.equal(normalize("أَؤْئِـى"), "اويي");
  assert.equal(normalize("نُور"), "نور");
});
