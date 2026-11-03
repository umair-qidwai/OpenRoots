import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, link, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { createGunzip } from "node:zlib";
import path from "node:path";
async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
/** Atomically restore a pinned build asset; never silently replace another DB. */
export async function prepareDictionary({
  archivePath,
  targetPath,
  expectedSha256,
  expectedSize,
  compressedSha256,
}) {
  if (
    !/^[0-9a-f]{64}$/.test(expectedSha256) ||
    !/^[0-9a-f]{64}$/.test(compressedSha256) ||
    !Number.isSafeInteger(expectedSize) ||
    expectedSize <= 0
  )
    throw new Error("Invalid dictionary asset manifest");
  let existing;
  try {
    existing = await stat(targetPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    if (
      existing.size !== expectedSize ||
      (await digest(targetPath)) !== expectedSha256
    )
      throw new Error(
        "Existing dictionary does not match the pinned asset. Back it up/remove it before restoring the bundled dictionary.",
      );
    return "existing";
  }
  if ((await digest(archivePath)) !== compressedSha256)
    throw new Error("Compressed dictionary checksum mismatch");
  await mkdir(path.dirname(targetPath), { recursive: true });
  const partial = targetPath + ".part-" + randomUUID();
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    await pipeline(
      createReadStream(archivePath),
      createGunzip(),
      new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > expectedSize)
            return callback(
              new Error("Expanded dictionary exceeds recorded size"),
            );
          hash.update(chunk);
          callback(null, chunk);
        },
      }),
      createWriteStream(partial, { flags: "wx" }),
    );
    if (bytes !== expectedSize)
      throw new Error("Expanded dictionary size mismatch");
    if (hash.digest("hex") !== expectedSha256)
      throw new Error("Expanded dictionary checksum mismatch");
    await link(partial, targetPath);
    return "prepared";
  } finally {
    await rm(partial, { force: true });
  }
}
