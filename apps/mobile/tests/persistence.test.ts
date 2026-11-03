import { test } from "node:test";
import assert from "node:assert/strict";
import { PersistentStore } from "../src/core/persistence.ts";
import { DatabaseSync } from "node:sqlite";
test("persistent mutations survive restart and concurrent edits do not lose settings", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE kv(value TEXT)");
  const io = {
    read: async () => {
      const r = db.prepare("SELECT value FROM kv").get() as
        { value: string } | undefined;
      return r?.value ?? null;
    },
    write: async (value: string) => {
      db.prepare("DELETE FROM kv").run();
      db.prepare("INSERT INTO kv VALUES(?)").run(value);
    },
  };
  const a = new PersistentStore(
    { font: 24, provider: "cloud", bookmarks: [] as string[] },
    io,
  );
  await a.initialize();
  await Promise.all([
    a.update((s) => ({ ...s, font: 28 })),
    a.update((s) => ({ ...s, provider: "local" })),
    a.update((s) => ({ ...s, bookmarks: ["real-source-id"] })),
  ]);
  const b = new PersistentStore(
    { font: 24, provider: "cloud", bookmarks: [] as string[] },
    io,
  );
  await b.initialize();
  assert.deepEqual(b.get(), {
    font: 28,
    provider: "local",
    bookmarks: ["real-source-id"],
  });
});
test("failed persistence does not publish unsaved changes", async () => {
  const store = new PersistentStore(
    { saved: false },
    {
      read: async () => null,
      write: async () => {
        throw new Error("disk full");
      },
    },
  );
  await store.initialize();
  await assert.rejects(
    store.update(() => ({ saved: true })),
    /disk full/,
  );
  assert.equal(store.get().saved, false);
});
