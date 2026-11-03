import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { DictionaryRepository } from "../src/core/repository";
const db = new DatabaseSync(
  path.resolve(import.meta.dirname, "../assets/dictionaries/openroots.db"),
  { readOnly: true },
);
const repo = new DictionaryRepository(
  {
    getAllAsync: async <T>(
      sql: string,
      params: (string | number | null)[] = [],
    ) => {
      assert.ok(
        !sql.includes("passages_fts"),
        "web must not use unavailable FTS5",
      );
      return db.prepare(sql).all(...params) as T[];
    },
    getFirstAsync: async <T>(
      sql: string,
      params: (string | number | null)[] = [],
    ) => (db.prepare(sql).get(...params) as T) ?? null,
  },
  { useFTS: false },
);
test("web fallback reads real dictionary entries without an FTS-enabled wasm build", async () => {
  assert.ok((await repo.search("خشية")).length);
  assert.ok((await repo.retrieve("خوف")).length);
});
