import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAIProvider } from './local';
import { LOCAL_MODEL } from './models';
import type { SourcePassage } from '@openroots/shared';

const passage:SourcePassage={id:'p1',entryId:'e1',bookId:'b1',bookTitle:'Book',author:'Author',headword:'علم',root:'علم',text:'النص',sourceUrl:'https://example.org',license:'CC0',locator:null};
test('local provider calls native completion and validates citations with shared parser',async()=>{
  let calls=0;
  const provider=new LocalAIProvider({complete:async params=>{calls++;assert.ok(params.messages?.some(x=>typeof x.content==='string'&&x.content.includes('p1')));return JSON.stringify({sections:[{title:'Meaning',text:'Supported',citations:['p1']}],insufficientEvidence:false});}});
  const answer=await provider.generate('Explain علم',[passage]);
  assert.equal(calls,1);assert.equal(answer.provider,'local');assert.equal(answer.model,LOCAL_MODEL.id);
  assert.deepEqual(answer.sections[0]?.citations,['p1']);
});
test('local provider rejects fabricated references rather than returning a fallback answer',async()=>{
  const provider=new LocalAIProvider({complete:async()=>JSON.stringify({sections:[{title:'Bad',text:'Invented',citations:['unknown']}],insufficientEvidence:false})});
  await assert.rejects(provider.generate('Explain علم',[passage]));
});
test('native failures and unsupported model selection are truthful; no cloud fallback',async()=>{
  const provider=new LocalAIProvider({complete:async()=>{throw new Error('Native load failed');}});
  await assert.rejects(provider.generate('Explain',[passage]),/Native load failed/);
  await assert.rejects(provider.generate('Explain',[passage],{model:'cloud-model'}),/installed local model/i);
});
