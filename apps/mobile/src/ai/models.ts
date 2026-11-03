import type { CompletionParams, ContextParams } from 'llama.rn';
import { nativeSHA256, validateResume, verifyModelFile, type ResumeRecord } from './integrity';

export const LOCAL_MODEL = Object.freeze({
  id: 'qwen3-4b-q4-k-m', name: 'Qwen3 4B · Q4_K_M',
  revision: '2f3b082b1356a6123f7ed71e65aea340da25d53c',
  url: 'https://huggingface.co/ggml-org/Qwen3-4B-GGUF/resolve/2f3b082b1356a6123f7ed71e65aea340da25d53c/Qwen3-4B-Q4_K_M.gguf',
  sha256: 'ab27b9bfa375a178d6cba48f3ad892b94b7739659dcc7aae8058ce0ffed6b328',
  size: 2497280640, license: 'Apache-2.0',
});
export type ModelState = {
  status: 'absent'|'downloading'|'paused'|'verifying'|'ready'|'loading'|'loaded'|'error';
  progress: number; error: string|null; bytesDownloaded: number; totalBytes: number;
  warning: string|null; acceleration: string|null; busy: boolean;
};
type ChatMessage = {role:string; content?:string};
export interface LocalContext {
  gpu: boolean; reasonNoGPU: string;
  release(): Promise<void>;
  stopCompletion(): Promise<void>;
  getFormattedChat(messages:ChatMessage[], template?:string|null, params?:{jinja?:boolean;chat_template_kwargs?:Record<string,boolean>}): Promise<{prompt:string}>;
  tokenize(text:string): Promise<{tokens:number[]}>;
  completion(params:CompletionParams, callback?:(data:{token:string})=>void):Promise<{text:string; content?:string; interrupted?:boolean; truncated?:boolean; context_full?:boolean}>;
}
interface Transfer { start():Promise<{status:number}|undefined>; pause():Promise<{resumeData?:string}> }
/** Narrow native seam: only this interface is replaced in behavior tests. */
export interface ModelRuntime {
  platform:string; physicalDevice:boolean; totalMemory:number|null; root:string;
  info(uri:string):Promise<{exists:boolean;size:number}>;
  mkdir(uri:string):Promise<void>; read(uri:string):Promise<string>; write(uri:string,text:string):Promise<void>;
  move(from:string,to:string):Promise<void>; delete(uri:string):Promise<void>;
  storage():Promise<{free:number;total:number}>; head(url:string):Promise<{status:number;size:number}>;
  hash(uri:string):Promise<string>; init(params:ContextParams):Promise<LocalContext>;
  listen(listener:(state:string)=>void):()=>void;
  createDownload(url:string,uri:string,progress:(bytes:number,total:number)=>void,resumeData?:string):Transfer;
}
const message = (e:unknown) => e instanceof Error ? e.message : String(e);
const abortError = () => new Error('Local generation cancelled');

async function nativeRuntime():Promise<ModelRuntime> {
  const [{Platform,AppState},fs,device] = await Promise.all([import('react-native'),import('expo-file-system/legacy'),import('expo-device')]);
  if (!['ios','android'].includes(Platform.OS) || !device.isDevice || !fs.documentDirectory) throw new Error('Local AI requires a physical iOS/Android device and a native development build (not Expo Go or web)');
  return {
    platform:Platform.OS, physicalDevice:device.isDevice, totalMemory:device.totalMemory,
    root:fs.documentDirectory+'local-ai/',
    info:async uri=>{const s=await fs.getInfoAsync(uri);return {exists:s.exists,size:s.exists?s.size:0};},
    mkdir:uri=>fs.makeDirectoryAsync(uri,{intermediates:true}),
    read:uri=>fs.readAsStringAsync(uri), write:(uri,text)=>fs.writeAsStringAsync(uri,text),
    move:(from,to)=>fs.moveAsync({from,to}), delete:uri=>fs.deleteAsync(uri,{idempotent:true}),
    storage:async()=>({free:await fs.getFreeDiskStorageAsync(),total:await fs.getTotalDiskCapacityAsync()}),
    head:async url=>{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
      try {const r=await fetch(url,{method:'HEAD',signal:controller.signal});return {status:r.status,size:Number(r.headers.get('content-length'))};}
      finally {clearTimeout(timer);}
    },
    hash:nativeSHA256,
    init:async params=>{const {initLlama}=await import('llama.rn');return initLlama(params);},
    listen:listener=>{listener(AppState.currentState ?? 'unknown');const subscription=AppState.addEventListener('change',listener);return ()=>subscription.remove();},
    createDownload:(url,uri,progress,resumeData)=>{
      const task=fs.createDownloadResumable(url,uri,{sessionType:fs.FileSystemSessionType.FOREGROUND},p=>progress(p.totalBytesWritten,p.totalBytesExpectedToWrite),resumeData);
      return {start:()=>resumeData?task.resumeAsync():task.downloadAsync(),pause:()=>task.pauseAsync()};
    },
  };
}

export class ModelManager {
  private state:ModelState={status:'absent',progress:0,error:null,bytesDownloaded:0,totalBytes:LOCAL_MODEL.size,warning:null,acceleration:null,busy:false};
  private listeners=new Set<(state:ModelState)=>void>();
  private runtimePromise:Promise<ModelRuntime>|null=null;
  private initialized=false;
  private operation:Promise<unknown>|null=null;
  private transfer:Transfer|null=null;
  private context:LocalContext|null=null;
  private pauseRequested=false;
  private pausePromise:Promise<void>|null=null;
  private background=false;
  private lifecycle:Promise<void>=Promise.resolve();
  private unlisten:(()=>void)|null=null;
  constructor(private runtimeFactory:()=>Promise<ModelRuntime>=nativeRuntime) {}
  getState=():ModelState=>({...this.state});
  subscribe=(listener:(state:ModelState)=>void):(()=>void)=>{
    this.listeners.add(listener);
    // Initialize disk state even when the user only opens settings; no model network call.
    if(!this.operation && !this.initialized)void this.initialize().catch(()=>{});
    return ()=>{this.listeners.delete(listener);};
  };
  private update(patch:Partial<ModelState>) {
    this.state={...this.state,...patch};
    for(const listener of this.listeners){try{listener(this.getState());}catch{/* a UI listener cannot break native cleanup */}}
  }
  private async runtime() {
    if(!this.runtimePromise)this.runtimePromise=this.runtimeFactory().then(r=>{
      if(!['ios','android'].includes(r.platform)||!r.physicalDevice)throw new Error('Local AI requires a supported physical iOS/Android device');
      this.unlisten=r.listen(s=>{void this.handleAppState(s).catch(e=>this.update({error:message(e)}));});
      return r;
    }).catch(e=>{this.runtimePromise=null;throw e;});
    return this.runtimePromise;
  }
  private async exclusive<T>(work:()=>Promise<T>):Promise<T> {
    if(this.operation)throw new Error('Local AI is busy; wait for the current operation to finish');
    // Install the lock before emitting to subscribers, which may reenter the API.
    const job=Promise.resolve().then(work);this.operation=job;
    this.update({busy:true,error:null});
    try{return await job;}catch(e){this.update({status:this.context?'loaded':'error',error:message(e)});throw e;}
    finally{this.operation=null;this.update({busy:false});}
  }
  private paths(r:ModelRuntime){return {file:r.root+'model.gguf',part:r.root+'model.part',record:r.root+'resume.json',temp:r.root+'resume.tmp'};}
  private async readResume(r:ModelRuntime):Promise<ResumeRecord|null> {
    const p=this.paths(r);const info=await r.info(p.record);
    if(!info.exists || info.size>1024*1024)return null;
    try{return validateResume(JSON.parse(await r.read(p.record)),LOCAL_MODEL,p.part);}catch{return null;}
  }
  private async persist(r:ModelRuntime,record:ResumeRecord) {
    const p=this.paths(r);await r.write(p.temp,JSON.stringify(record));
    await r.delete(p.record);await r.move(p.temp,p.record);
  }
  private async verify(r:ModelRuntime,uri:string) {
    const info=await r.info(uri);
    if(!info.exists)throw new Error('Download the local model first');
    this.update({status:'verifying'});
    await verifyModelFile(uri,info.size,LOCAL_MODEL,r.hash);
  }
  private async restore(r:ModelRuntime) {
    if(this.initialized)return;
    await r.mkdir(r.root);const p=this.paths(r);
    await r.delete(p.temp);
    const file=await r.info(p.file);
    if(file.exists){
      try{await this.verify(r,p.file);this.update({status:'ready',progress:1,bytesDownloaded:LOCAL_MODEL.size});}
      catch(e){await r.delete(p.file);this.update({status:'absent',progress:0,bytesDownloaded:0});throw e;}
    }else{
      const record=await this.readResume(r);const part=await r.info(p.part);
      // iOS may put the resumable bytes in an OS-owned temporary file, not partUri.
      if(record)this.update({status:'paused',progress:record.bytes/LOCAL_MODEL.size,bytesDownloaded:record.bytes});
      else{if(part.exists)await r.delete(p.part);await r.delete(p.record);this.update({status:'absent',progress:0,bytesDownloaded:0});}
    }
    this.initialized=true;
  }
  initialize=()=>this.exclusive(async()=>{await this.restore(await this.runtime());});
  getStorage=async()=> (await this.runtime()).storage();

  download=()=>this.exclusive(async()=>{
    const r=await this.runtime();await this.restore(r);
    if(this.context)throw new Error('Unload the model before downloading');
    if(this.state.status==='ready')return;
    this.pauseRequested=false;this.pausePromise=null;
    const p=this.paths(r);const record=await this.readResume(r);
    this.update({status:'downloading'});
    const remote=await r.head(LOCAL_MODEL.url);
    if(remote.status!==200 || remote.size!==LOCAL_MODEL.size)throw new Error('Model preflight failed: trusted source size or HTTP status changed');
    const storage=await r.storage();
    // Reserve the full artifact even on resume: native implementations can recreate it.
    if(storage.free<LOCAL_MODEL.size+512*1024**2)throw new Error('Insufficient free storage: model plus 512 MiB headroom required');
    if(this.background || this.pauseRequested){this.update({status:record?'paused':'absent'});return;}
    this.transfer=r.createDownload(LOCAL_MODEL.url,p.part,(bytes,total)=>{
      if(total>0 && total!==LOCAL_MODEL.size)this.update({warning:'Server progress size differs; final size and SHA-256 will be verified'});
      const safe=Math.max(0,Math.min(LOCAL_MODEL.size,bytes));
      this.update({bytesDownloaded:safe,progress:safe/LOCAL_MODEL.size});
    },record?.resumeData);
    try{
      let result:{status:number}|undefined;
      try{result=await this.transfer.start();}
      catch(e){
        // Some native implementations reject the original transfer on pause.
        // Treat it as paused only after the opaque resume token is durable.
        if(!this.pausePromise)throw e;
        await this.pausePromise;
        if(!this.pauseRequested)throw e;
      }
      if(this.pausePromise)await this.pausePromise;
      if(this.pauseRequested){this.update({status:'paused'});return;}
      if(!result || ![200,206].includes(result.status))throw new Error(`Model transfer failed (HTTP ${result?.status??'cancelled'})`);
      try{await this.verify(r,p.part);}catch(e){await r.delete(p.part);await r.delete(p.record);throw e;}
      await r.delete(p.file);await r.move(p.part,p.file);await r.delete(p.record);
      this.update({status:'ready',progress:1,bytesDownloaded:LOCAL_MODEL.size,error:null});
    }catch(e){
      // A network interruption without an explicit native pause token is not resumable.
      // Leave part bytes untrusted; a later download safely starts fresh.
      if(!this.pauseRequested)await r.delete(p.record);
      throw e;
    }finally{this.transfer=null;this.pausePromise=null;}
  });
  pause=async()=>{
    if(this.state.status!=='downloading')return;
    this.pauseRequested=true;
    if(this.transfer && !this.pausePromise){
      const transfer=this.transfer;
      this.pausePromise=(async()=>{
        const saved=await transfer.pause();const r=await this.runtime();
        if(!saved.resumeData)throw new Error('Native downloader could not create resume state; retry the download');
        await this.persist(r,{version:1,modelId:LOCAL_MODEL.id,sha256:LOCAL_MODEL.sha256,url:LOCAL_MODEL.url,fileUri:this.paths(r).part,resumeData:saved.resumeData,bytes:this.state.bytesDownloaded});
      })();
    }
    if(this.pausePromise)await this.pausePromise;
    if(this.operation)await this.operation;
  };
  load=()=>this.exclusive(async()=>{
    const r=await this.runtime();await this.restore(r);
    if(this.context)return;
    if(this.background)throw new Error('Return to the foreground before loading local AI');
    if(r.totalMemory!==null && r.totalMemory<4*1024**3)throw new Error('This 4B model needs a device with at least 4 GiB total RAM; use a smaller model or Cloud AI');
    this.update({warning:r.totalMemory===null?'Available memory cannot be measured; model loading may fail':r.totalMemory<6*1024**3?'Low-memory device: close other apps; the OS may terminate inference':null});
    await this.verify(r,this.paths(r).file);
    this.update({status:'loading'});
    const params:ContextParams={model:this.paths(r).file,n_ctx:4096,n_batch:128,n_ubatch:128,n_parallel:1,n_threads:4,use_mmap:true,use_mlock:false,n_gpu_layers:r.platform==='ios'?99:0};
    let context:LocalContext;
    try{context=await r.init(params);}
    catch(e){
      if(r.platform!=='ios' || this.background)throw e;
      this.update({warning:`Metal initialization failed (${message(e)}); trying CPU`});
      context=await r.init({...params,n_gpu_layers:0});
    }
    if(this.background){await context.release();this.update({status:'ready'});throw new Error('Model load cancelled while app was backgrounded');}
    this.context=context;
    this.update({status:'loaded',acceleration:context.gpu?'Metal':`CPU${context.reasonNoGPU?`: ${context.reasonNoGPU}`:''}`,error:null});
  });
  unload=()=>this.exclusive(async()=>{
    if(this.context){await this.context.release();this.context=null;this.update({status:'ready',acceleration:null});}
  });
  remove=()=>this.exclusive(async()=>{
    const r=await this.runtime();
    if(this.context){await this.context.release();this.context=null;}
    for(const uri of Object.values(this.paths(r)))await r.delete(uri);
    this.initialized=true;
    this.update({status:'absent',progress:0,bytesDownloaded:0,acceleration:null,error:null});
  });
  /** The manager owns completion as well as files: no load/remove/unload can overlap. */
  complete=(params:CompletionParams, signal?:AbortSignal, onToken?:(token:string)=>void)=>this.exclusive(async()=>{
    if(this.background)throw new Error('Local AI is unavailable while the app is backgrounded');
    if(!this.context)throw new Error('Load the downloaded local model before asking a question');
    if(signal?.aborted)throw abortError();
    const context=this.context;
    let stopPromise:Promise<void>|null=null;
    const stop=()=>{stopPromise=context.stopCompletion();void stopPromise.catch(()=>{});};
    signal?.addEventListener('abort',stop,{once:true});
    try{
      const formatted=await context.getFormattedChat(params.messages as ChatMessage[],null,{jinja:true,chat_template_kwargs:{enable_thinking:false}});
      const {tokens}=await context.tokenize(formatted.prompt);
      if(tokens.length+(params.n_predict??768)+64>4096)throw new Error('Retrieved passages exceed local context capacity; select fewer/shorter passages');
      if(signal?.aborted || this.background)throw abortError();
      const result=await context.completion(params,data=>{if(!signal?.aborted && !this.background)onToken?.(data.token);});
      if(signal?.aborted || this.background || result.interrupted)throw abortError();
      if(result.truncated || result.context_full)throw new Error('Local model context was truncated; reduce the retrieved passages');
      return result.content || result.text;
    }finally{signal?.removeEventListener('abort',stop);if(stopPromise)await stopPromise;}
  });
  handleAppState=(state:string):Promise<void>=>{
    this.background=state!=='active';
    if(!this.background)return this.lifecycle;
    this.lifecycle=this.lifecycle.catch(()=>{}).then(async()=>{
      let cleanupError:unknown=null;
      try{if(this.transfer || this.state.status==='downloading')await this.pause();}catch(e){cleanupError=e;}
      try{if(this.context)await this.context.stopCompletion();}catch(e){cleanupError??=e;}
      // A failed native stop must never lead to releasing a still-running context.
      // Await settlement even on the error path, then attempt deterministic cleanup.
      if(this.operation)await this.operation.catch(()=>{});
      if(this.context)await this.unload();
      if(cleanupError)throw cleanupError;
    });
    return this.lifecycle;
  };
  /** Optional root cleanup; singleton normally lives for the application lifetime. */
  dispose=async()=>{
    try{await this.handleAppState('background');}
    finally{this.unlisten?.();this.unlisten=null;this.listeners.clear();}
  };
}
export const modelManager=new ModelManager();
