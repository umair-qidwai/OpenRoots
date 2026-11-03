import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath, URL} from 'node:url';
const moduleRoot=new URL('../../plugins/openroots-integrity/',import.meta.url);
test('autolinked integrity module declares both native platforms and bounded streaming reads',()=>{
  const config=JSON.parse(readFileSync(new URL('expo-module.config.json',moduleRoot),'utf8'));
  assert.deepEqual(config.apple.modules,['OpenRootsIntegrityModule']);
  assert.deepEqual(config.android.modules,['expo.modules.openrootsintegrity.OpenRootsIntegrityModule']);
  const swift=readFileSync(new URL('ios/OpenRootsIntegrityModule.swift',moduleRoot),'utf8');
  const kotlin=readFileSync(new URL('android/src/main/java/expo/modules/openrootsintegrity/OpenRootsIntegrityModule.kt',moduleRoot),'utf8');
  assert.match(swift,/InputStream/);assert.match(swift,/hasher\.update/);
  assert.doesNotMatch(swift,/contentsOf(File|URL)|Data\(contentsOf/);
  assert.match(kotlin,/input\.read\(buffer\)/);assert.match(kotlin,/digest\.update/);
  assert.match(kotlin,/canonicalFile/);assert.match(swift,/resolvingSymlinksInPath/);
  assert.ok(fileURLToPath(moduleRoot).endsWith('plugins/openroots-integrity/'));
});
