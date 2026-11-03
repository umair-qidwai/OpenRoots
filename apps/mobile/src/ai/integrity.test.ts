import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyModelFile, validateResume } from './integrity';

const descriptor = { id: 'pinned', url: 'https://huggingface.co/a/resolve/rev/model.gguf', size: 42, sha256: 'a'.repeat(64) };
test('native digest is required and size mismatch never hashes or trusts a file', async () => {
  let hashes = 0;
  const hash = async () => { hashes++; return descriptor.sha256; };
  await assert.rejects(verifyModelFile('file:///model', 41, descriptor, hash), /size/i);
  assert.equal(hashes, 0);
  await verifyModelFile('file:///model', 42, descriptor, hash);
  await assert.rejects(verifyModelFile('file:///model', 42, descriptor, async () => 'b'.repeat(64)), /checksum/i);
});
test('resume metadata cannot redirect downloads or change the pinned artifact', () => {
  const saved = { version: 1, modelId: descriptor.id, sha256: descriptor.sha256, url: descriptor.url, fileUri: 'file:///private/model.part', resumeData: 'opaque', bytes: 20 };
  assert.equal(validateResume(saved, descriptor, saved.fileUri)?.resumeData, 'opaque');
  for (const patch of [{url:'https://evil.invalid'}, {fileUri:'file:///other'}, {sha256:'bad'}, {bytes:43}, {version:2}, {resumeData:32}]) {
    assert.equal(validateResume({...saved, ...patch}, descriptor, saved.fileUri), null);
  }
});
