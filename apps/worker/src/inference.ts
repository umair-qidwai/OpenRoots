import { LIMITS, ProtocolError, parseAnswer, type AIAnswer, type SourcePassage } from '@openroots/shared';
import { HTTPError, RequestScope, safeError, errorBody } from './runtime';

function invalid(): never { throw new HTTPError(502, 'INVALID_MODEL_OUTPUT', 'The model returned an invalid or ungrounded answer. Retry or switch to Local AI.', undefined, true); }
function object(value: unknown): Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
  return value as Record<string, any>;
}
function content(value: unknown): string {
  const result = object(value);
  if (result.error || result.success === false) throw safeError(result.error ?? result.errors?.[0] ?? result);
  if (result.choices?.some((c: any) => c.finish_reason === 'length' || c.finish_reason === 'content_filter') || result.finish_reason === 'length') invalid();
  const text = result.response ?? result.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.length > LIMITS.answerChars) invalid();
  return text;
}
export function validateResult(value: unknown, passages: SourcePassage[], model: string): AIAnswer {
  try { return parseAnswer(content(value), passages, 'cloud', model); }
  catch (error) { if (error instanceof ProtocolError) invalid(); throw error; }
}
export function isStream(value: unknown): value is ReadableStream<Uint8Array> {
  return value !== null && typeof value === 'object' && typeof (value as ReadableStream).getReader === 'function';
}

/** Supports Workers AI response chunks and OpenAI-compatible delta chunks. */
async function consume(stream: ReadableStream<Uint8Array>, scope: RequestScope, progress: (chars: number) => void): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let result = ''; let bytes = 0; let complete = false; let nextProgress = 0;
  const onAbort = () => { void reader.cancel(scope.signal.reason).catch(() => {}); };
  scope.signal.addEventListener('abort', onAbort, { once: true });
  const frame = (input: string) => {
    const lines = input.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
    if (!lines.length) return;
    const data = lines.join('\n');
    if (data.trim() === '[DONE]') { complete = true; return; }
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { invalid(); }
    const item = object(parsed);
    if (item.error || item.success === false) throw safeError(item.error ?? item.errors?.[0] ?? item);
    const choice = item.choices?.[0];
    if (choice?.finish_reason === 'length' || choice?.finish_reason === 'content_filter' || item.finish_reason === 'length') invalid();
    if (choice?.finish_reason === 'stop' || item.finish_reason === 'stop') complete = true;
    const token = item.response ?? choice?.delta?.content ?? '';
    if (typeof token !== 'string') invalid();
    result += token;
    if (result.length > LIMITS.answerChars) invalid();
    if (result.length >= nextProgress) { progress(result.length); nextProgress = result.length + 256; }
  };
  try {
    while (true) {
      const { value, done } = await scope.guard(reader.read());
      scope.check();
      if (done) { buffer += decoder.decode(); break; }
      bytes += value.byteLength;
      if (bytes > 262144) invalid();
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let index: number;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, index); buffer = buffer.slice(index + 2); frame(event);
        if (event.includes('data: [DONE]')) { complete = true; return result; }
      }
      if (buffer.length > 65536) invalid();
    }
    if (buffer.trim()) frame(buffer);
    if (!complete) invalid();
    return result;
  } finally {
    scope.signal.removeEventListener('abort', onAbort);
    void reader.cancel().catch(() => {}); reader.releaseLock();
  }
}
export async function readResult(value: unknown, scope: RequestScope, passages: SourcePassage[], model: string): Promise<AIAnswer> {
  if (!isStream(value)) return validateResult(value, passages, model);
  try { return parseAnswer(await consume(value, scope, () => {}), passages, 'cloud', model); }
  catch (error) { if (error instanceof ProtocolError) invalid(); throw error; }
}

/** Progress contains counts only. Unvalidated source claims never reach the client. */
export function streamAnswer(value: unknown, scope: RequestScope, passages: SourcePassage[], model: string): Response {
  let canceled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => { if (!canceled) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      emit('progress', { receivedChars: 0 });
      void (async () => {
        try {
          let answer: AIAnswer;
          if (isStream(value)) {
            const raw = await consume(value, scope, chars => emit('progress', { receivedChars: chars }));
            try { answer = parseAnswer(raw, passages, 'cloud', model); } catch { invalid(); }
          } else answer = validateResult(value, passages, model);
          scope.check(); emit('answer', answer); emit('done', {});
        } catch (error) { emit('error', errorBody(safeError(error))); }
        finally { scope.close(); if (!canceled) controller.close(); }
      })();
    },
    cancel() { canceled = true; scope.abort(); scope.close(); if (isStream(value) && !value.locked) void value.cancel().catch(() => {}); },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
