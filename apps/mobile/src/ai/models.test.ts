import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelManager, LOCAL_MODEL, type ModelRuntime } from './models';

function harness() {
  const files = new Map<string, {size:number; text?:string}>();
  const events: string[] = [];
  let headSize:number = LOCAL_MODEL.size;
  let digest:string = LOCAL_MODEL.sha256;
  let free = LOCAL_MODEL.size * 3;
  const context = {
    gpu: false, reasonNoGPU:'CPU',
    release: async () => {events.push('release');},
    stopCompletion: async () => {events.push('stop');},
    getFormattedChat: async () => ({prompt:'chat'}),
    tokenize: async () => ({tokens:[1,2,3]}),
    completion: async () => ({text:'{"sections":[],"insufficientEvidence":true}', content:'', interrupted:false, truncated:false, context_full:false}),
  };
  const runtime: ModelRuntime = {
    platform:'android', physicalDevice:true, totalMemory:8*1024**3,
    root:'file:///private/models/',
    info:async (uri) => files.has(uri) ? {exists:true,size:files.get(uri)!.size} : {exists:false,size:0},
    mkdir:async () => {},
    read:async uri => files.get(uri)!.text!,
    write:async (uri,text) => {files.set(uri,{size:text.length,text});},
    move:async (from,to) => {files.set(to,files.get(from)!);files.delete(from);},
    delete:async uri => {files.delete(uri);},
    storage:async () => ({free,total:LOCAL_MODEL.size*4}),
    head:async () => ({status:200,size:headSize}),
    hash:async () => {events.push('hash');return digest;},
    init:async params => {events.push(`init:${params.n_gpu_layers}`);return context;},
    listen:() => () => {},
    createDownload:(url,uri,progress,resumeData) => ({
      start:async () => {events.push(resumeData ? 'resume':'download'); files.set(uri,{size:LOCAL_MODEL.size});progress(LOCAL_MODEL.size,LOCAL_MODEL.size);return {status:200};},
      pause:async () => ({resumeData:'native-token'}),
    }),
  };
  return {files,events,runtime,context, manager:new ModelManager(async()=>runtime),setHead:(n:number)=>{headSize=n;},setDigest:(s:string)=>{digest=s;},setFree:(n:number)=>{free=n;}};
}

test('download preflights size and space, hashes before promotion, loads native Android CPU and releases', async () => {
  const h=harness();
  await h.manager.download();
  assert.equal(h.manager.getState().status,'ready');
  assert.equal(h.manager.getState().progress,1);
  assert.deepEqual(h.events,['download','hash']);
  assert.ok(h.files.has(h.runtime.root+'model.gguf'));
  assert.ok(!h.files.has(h.runtime.root+'model.part'));
  await h.manager.load();
  assert.equal(h.manager.getState().status,'loaded');
  assert.ok(h.events.includes('init:0'));
  await h.manager.unload();
  assert.equal(h.events.at(-1),'release');
  await h.manager.remove();
  assert.equal(h.manager.getState().status,'absent');
});
test('pause persists native state across managers and safely resumes a rejected paused transfer', async () => {
  const h=harness();
  let settle:((value:{status:number}|undefined)=>void)|null=null;
  let fail:((error:Error)=>void)|null=null;
  let started:()=>void=()=>{};
  const startEvent=new Promise<void>(r=>{started=r;});
  const original=h.runtime.createDownload;
  h.runtime.createDownload=(_url,_uri,progress)=>({
    start:()=>new Promise((resolve,reject)=>{settle=resolve;fail=reject;progress(100,LOCAL_MODEL.size);started();}),
    pause:async()=>{fail!(new Error('Native transfer paused'));return {resumeData:'native-token'};},
  });
  const downloading=h.manager.download();
  await startEvent;
  await h.manager.pause();
  await downloading;
  assert.equal(h.manager.getState().status,'paused');
  assert.ok(h.files.has(h.runtime.root+'resume.json'));
  h.runtime.createDownload=original;
  const restarted=new ModelManager(async()=>h.runtime);
  await restarted.initialize();
  assert.equal(restarted.getState().status,'paused');
  await restarted.download();
  assert.ok(h.events.includes('resume'));
  assert.equal(restarted.getState().status,'ready');
  void settle;
});

test('iOS attempts Metal then reports a CPU fallback when Metal initialization rejects',async()=>{
  const h=harness();h.runtime.platform='ios';
  h.runtime.init=async params=>{h.events.push(`init:${params.n_gpu_layers}`);if(params.n_gpu_layers)throw new Error('Metal unavailable');return h.context;};
  await h.manager.download();await h.manager.load();
  assert.deepEqual(h.events.filter(x=>x.startsWith('init')),['init:99','init:0']);
  assert.match(h.manager.getState().warning??'',/Metal/i);
  assert.match(h.manager.getState().acceleration??'',/CPU/);
});

test('restart rehashes installed bytes and corrupt files can never load',async()=>{
  const h=harness();await h.manager.download();
  h.setDigest('f'.repeat(64));
  const restarted=new ModelManager(async()=>h.runtime);
  await assert.rejects(restarted.initialize(),/checksum/);
  assert.ok(!h.files.has(h.runtime.root+'model.gguf'));
  assert.ok(!h.events.some(x=>x.startsWith('init')));
});
test('unsupported devices and very low RAM fail without invoking native inference',async()=>{
  const h=harness();h.runtime.platform='web';
  await assert.rejects(h.manager.download(),/supported physical/);
  const low=harness();low.runtime.totalMemory=2*1024**3;
  await low.manager.download();await assert.rejects(low.manager.load(),/RAM/);
  assert.ok(!low.events.some(x=>x.startsWith('init')));
});
test('completion excludes load/unload/remove, background stops then awaits completion before release',async()=>{
  const h=harness();await h.manager.download();await h.manager.load();
  let started:()=>void=()=>{};const event=new Promise<void>(r=>{started=r;});
  let done:(()=>void)|null=null;
  h.context.completion=async()=>{started();await new Promise<void>(r=>{done=r;});return {text:'{}',content:'',interrupted:true,truncated:false,context_full:false};};
  h.context.stopCompletion=async()=>{h.events.push('stop');done?.();};
  const generating=h.manager.complete({messages:[{role:'user',content:'question'}]});
  void generating.catch(()=>{});
  await event;
  for(const action of [h.manager.load,h.manager.unload,h.manager.remove])await assert.rejects(action(),/busy/);
  await h.manager.handleAppState('background');
  await assert.rejects(generating,/cancelled/);
  assert.equal(h.manager.getState().status,'ready');
  assert.ok(h.events.indexOf('stop')<h.events.indexOf('release'));
  assert.equal(h.manager.getState().busy,false);
});
test('abort signals stop native completion and oversized contexts fail before native inference',async()=>{
  const h=harness();await h.manager.download();await h.manager.load();
  let started:()=>void=()=>{};const event=new Promise<void>(r=>{started=r;});
  let done:(()=>void)|null=null;
  h.context.completion=async()=>{started();await new Promise<void>(r=>{done=r;});return {text:'{}',content:'',interrupted:true,truncated:false,context_full:false};};
  h.context.stopCompletion=async()=>{h.events.push('stop');done?.();};
  const controller=new AbortController();
  const generating=h.manager.complete({messages:[{role:'user',content:'question'}]},controller.signal);
  void generating.catch(()=>{});await event;controller.abort();await assert.rejects(generating,/cancelled/);
  assert.ok(h.events.includes('stop'));assert.equal(h.manager.getState().busy,false);
  h.context.tokenize=async()=>({tokens:Array.from({length:4096},()=>1)});
  await assert.rejects(h.manager.complete({messages:[{role:'user',content:'large'}]}),/context capacity/);
});

test('background cleanup still releases context after native stop reports an error',async()=>{
  const h=harness();await h.manager.download();await h.manager.load();
  h.context.stopCompletion=async()=>{throw new Error('stop failed');};
  await assert.rejects(h.manager.handleAppState('background'),/stop failed/);
  assert.equal(h.events.at(-1),'release');
  assert.equal(h.manager.getState().status,'ready');
});

test('dispose always removes lifecycle subscriptions even when native cleanup fails',async()=>{
  const h=harness();h.runtime.listen=()=>()=>{h.events.push('unlisten');};
  await h.manager.download();await h.manager.load();
  h.context.stopCompletion=async()=>{throw new Error('stop failed');};
  await assert.rejects(h.manager.dispose(),/stop failed/);
  assert.equal(h.events.at(-1),'unlisten');
});

test('state subscribers cannot reenter before the operation lock is installed',async()=>{
  const h=harness();await h.manager.download();
  let attempted=false;let reentry:Promise<void>|null=null;
  const unsubscribe=h.manager.subscribe(state=>{
    if(state.busy&&!attempted){attempted=true;reentry=h.manager.remove();void reentry.catch(()=>{});}
  });
  await h.manager.load();
  assert.ok(reentry);await assert.rejects(reentry,/busy/);
  assert.equal(h.manager.getState().status,'loaded');unsubscribe();
});

test('untrusted remote size, insufficient disk and corrupt hash never produce a ready file', async () => {
  for(const kind of ['head','space','hash']) {
    const h=harness();
    if(kind==='head')h.setHead(1);
    if(kind==='space')h.setFree(0);
    if(kind==='hash')h.setDigest('0'.repeat(64));
    await assert.rejects(h.manager.download());
    assert.equal(h.manager.getState().status,'error');
    assert.ok(!h.files.has(h.runtime.root+'model.gguf'));
    assert.ok(!h.events.some(x=>x.startsWith('init')));
  }
});
