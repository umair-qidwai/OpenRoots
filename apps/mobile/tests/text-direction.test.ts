import { test } from "node:test";
import assert from "node:assert/strict";
import { readingDirection } from "../src/core/text-direction";
test("English lexicon prose with Arabic headwords uses LTR base direction", () =>
  assert.equal(
    readingDirection("صَبْرٌ Patience, or endurance; restraint of oneself."),
    "ltr",
  ));
test("Arabic passages with short English insertions retain RTL base direction", () =>
  assert.equal(
    readingDirection(
      "الصبر حبس النفس عن الجزع (patience) مع بيان معناه واستعماله.",
    ),
    "rtl",
  ));
