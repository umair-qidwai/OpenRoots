import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  stat,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { prepareDictionary } from "../scripts/dictionary-assets.mjs";
const sha = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
async function fixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "openroots-assets-test-"),
  );
  const bytes = Buffer.from("Explicit test fixture, not dictionary content.");
  const packed = gzipSync(bytes);
  const archivePath = path.join(directory, "source.gz");
  await writeFile(archivePath, packed);
  return {
    directory,
    bytes,
    options: {
      archivePath,
      targetPath: path.join(directory, "dictionary.db"),
      expectedSha256: sha(bytes),
      expectedSize: bytes.length,
      compressedSha256: sha(packed),
    },
  };
}
test("asset setup unpacks and verifies bytes, then preserves an existing verified DB", async () => {
  const f = await fixture();
  try {
    assert.equal(await prepareDictionary(f.options), "prepared");
    assert.deepEqual(await readFile(f.options.targetPath), f.bytes);
    const before = (await stat(f.options.targetPath)).mtimeMs;
    assert.equal(await prepareDictionary(f.options), "existing");
    assert.equal((await stat(f.options.targetPath)).mtimeMs, before);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});
test("a bad compressed checksum never creates the target", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      prepareDictionary({ ...f.options, compressedSha256: "0".repeat(64) }),
      /checksum/i,
    );
    assert.deepEqual(await readdir(f.directory), ["source.gz"]);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});
test("a bad expanded checksum removes partial files", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      prepareDictionary({ ...f.options, expectedSha256: "0".repeat(64) }),
      /checksum/i,
    );
    assert.deepEqual(await readdir(f.directory), ["source.gz"]);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});
test("expansion beyond the recorded size is rejected without publishing a target", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      prepareDictionary({ ...f.options, expectedSize: f.bytes.length - 1 }),
      /size/i,
    );
    assert.deepEqual(await readdir(f.directory), ["source.gz"]);
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});
test("setup refuses to silently overwrite an existing different DB", async () => {
  const f = await fixture();
  try {
    await writeFile(f.options.targetPath, "different data");
    await assert.rejects(prepareDictionary(f.options), /existing/i);
    assert.equal(
      await readFile(f.options.targetPath, "utf8"),
      "different data",
    );
  } finally {
    await rm(f.directory, { recursive: true, force: true });
  }
});
