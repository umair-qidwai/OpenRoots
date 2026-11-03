import { buildMessages, parseAnswer, type AIProvider, type AIOptions, type AIAnswer, type SourcePassage } from '@openroots/shared';
import { modelManager, LOCAL_MODEL, type ModelManager } from './models';

// Constrain syntax natively, but still validate every reference with the same shared
// parser used by Cloud AI. JSON grammar alone is not evidence validation.
const answerSchema = {
  type:'object', additionalProperties:false, required:['sections','insufficientEvidence'],
  properties:{
    sections:{type:'array',items:{type:'object',additionalProperties:false,required:['title','text','citations'],properties:{title:{type:'string'},text:{type:'string'},citations:{type:'array',items:{type:'string'}}}}},
    insufficientEvidence:{type:'boolean'},
  },
};
export class LocalAIProvider implements AIProvider {
  private manager:Pick<ModelManager,'complete'>;
  constructor(manager:Pick<ModelManager,'complete'>=modelManager){this.manager=manager;}
  async generate(question:string,passages:SourcePassage[],options:AIOptions={}):Promise<AIAnswer> {
    if(options.model && options.model!==LOCAL_MODEL.id)throw new Error('Choose the installed local model; this provider never sends requests to Cloud AI');
    if(options.signal?.aborted)throw new Error('Local generation cancelled');
    const raw=await this.manager.complete({
      messages:buildMessages(question,passages,options),
      jinja:true, chat_template_kwargs:{enable_thinking:false},
      response_format:{type:'json_schema',json_schema:{strict:true,schema:answerSchema}},
      n_predict:options.mode==='detailed'?1152:768,
      temperature:0.2,top_p:0.9,top_k:20,
      stop:['<|im_end|>','<|endoftext|>'],
    },options.signal,options.onToken);
    return parseAnswer(raw,passages,'local',LOCAL_MODEL.id);
  }
}
