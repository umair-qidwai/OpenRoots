import { buildMessages, parseAnswer, validateAIInput, LIMITS, ProtocolError, type AIOptions, type SourcePassage } from '@openroots/shared';
import { HTTPError, RequestScope, safeError, errorBody } from './runtime';
import { isStream, readResult, streamAnswer } from './inference';
export { TIMEOUT_MS } from './runtime';

export const MODELS = ['@cf/qwen/qwen3-30b-a3b-fp8', '@cf/google/gemma-4-26b-a4b-it'] as const;
export interface Env {
  ACCESS_TOKEN?: string;
  AI: { run(model: string, input: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> };
  RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...headers, ...extra } });
}
async function authorized(request: Request, secret: string): Promise<boolean> {
  const received = request.headers.get('Authorization') ?? '';
  if (!/^Bearer [!-~]{32,256}$/.test(received)) return false;
  const encoder = new TextEncoder();
  const [expected, actual] = await Promise.all([secret, received.slice(7)].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  const a = new Uint8Array(expected); const b = new Uint8Array(actual);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
interface GenerateInput extends AIOptions { question: string; passages: SourcePassage[]; stream?: boolean }
async function readInput(request: Request, scope: RequestScope): Promise<GenerateInput> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) throw new HTTPError(415, 'CONTENT_TYPE', 'Send application/json.');
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMITS.bodyBytes)) throw new HTTPError(413, 'BODY_TOO_LARGE', 'The request body is too large.');
  if (!request.body) throw new HTTPError(400, 'INVALID_REQUEST', 'A JSON request body is required.');
  const reader = request.body.getReader();
  let complete = false;
  const onAbort = () => { void reader.cancel(scope.signal.reason).catch(() => {}); };
  scope.signal.addEventListener('abort', onAbort, { once: true });
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await scope.guard(reader.read()); scope.check();
      if (chunk.done) { complete = true; break; }
      bytes += chunk.value.byteLength;
      if (bytes > LIMITS.bodyBytes) throw new HTTPError(413, 'BODY_TOO_LARGE', 'The request body is too large.');
      chunks.push(chunk.value);
    }
  } finally { scope.signal.removeEventListener('abort', onAbort); if (!complete) void reader.cancel().catch(() => {}); reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)); }
  catch { throw new HTTPError(400, 'INVALID_REQUEST', 'The request must be valid UTF-8 JSON.'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HTTPError(400, 'INVALID_REQUEST', 'Invalid request object.');
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).some(k => !['question', 'passages', 'model', 'mode', 'task', 'history', 'stream'].includes(k))) throw new HTTPError(400, 'INVALID_REQUEST', 'Unexpected request field.');
  if (obj.stream !== undefined && typeof obj.stream !== 'boolean') throw new HTTPError(400, 'INVALID_REQUEST', 'Invalid stream flag.');
  try { validateAIInput(obj.question, obj.passages, obj as AIOptions); }
  catch (error) { if (error instanceof ProtocolError) throw new HTTPError(400, 'INVALID_REQUEST', error.message); throw error; }
  if (obj.model !== undefined && !MODELS.includes(obj.model as typeof MODELS[number])) throw new HTTPError(400, 'INVALID_REQUEST', 'Unsupported model.');
  return obj as unknown as GenerateInput;
}
async function run(env: Env, model: string, input: Record<string, unknown>, scope: RequestScope): Promise<unknown> {
  scope.check();
  const pending = env.AI.run(model, input, { signal: scope.signal });
  // If a binding ignores abort while awaiting headers, cancel any late stream as well.
  void pending.then(value => { if (scope.signal.aborted && isStream(value)) void value.cancel().catch(() => {}); }, () => {});
  return scope.guard(pending);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const scope = new RequestScope(request.signal);
    let streaming = false;
    try {
      scope.check();
      if (typeof env.ACCESS_TOKEN !== 'string' || !/^[!-~]{32,256}$/.test(env.ACCESS_TOKEN)) throw new HTTPError(503, 'CONFIGURATION_ERROR', 'Cloud AI is not configured.');
      if (!await scope.guard(authorized(request, env.ACCESS_TOKEN))) throw new HTTPError(401, 'UNAUTHORIZED', 'A valid access credential is required.');
      const path = new URL(request.url).pathname;
      if (!['/v1/models', '/v1/generate'].includes(path)) throw new HTTPError(404, 'NOT_FOUND', 'Not found.');
      const method = path === '/v1/models' ? 'GET' : 'POST';
      if (request.method !== method) return json(errorBody(new HTTPError(405, 'METHOD_NOT_ALLOWED', 'Unsupported method.')), 405, { Allow: method });
      if (!env.AI?.run || !env.RATE_LIMITER?.limit) throw new HTTPError(503, 'CONFIGURATION_ERROR', 'Cloud AI bindings are not configured.');
      let permitted: { success: boolean };
      try { permitted = await scope.guard(env.RATE_LIMITER.limit({ key: 'personal-access' })); }
      catch (error) { if (error instanceof HTTPError) throw error; throw new HTTPError(503, 'CONFIGURATION_ERROR', 'Rate limiting is unavailable.'); }
      if (!permitted.success) throw new HTTPError(429, 'RATE_LIMITED', 'Too many cloud requests. Wait a minute or switch to Local AI.', 60, true);
      if (path === '/v1/models') {
        // A catalog entry alone does not prove account/plan access. One-token probes do.
        const models = await Promise.all(MODELS.map(async id => {
          try {
            const result = await run(env, id, { messages: [{ role: 'user', content: 'Reply OK only. /no_think' }], max_tokens: 1, stream: false }, scope);
            if (typeof result !== 'object' || result === null || isStream(result)) { if (isStream(result)) void result.cancel(); throw new Error('Invalid model probe'); }
            const obj = result as Record<string, unknown>;
            if (obj.error || obj.success === false) throw obj.error ?? obj;
            if (typeof obj.response !== 'string' && !(Array.isArray(obj.choices) && obj.choices.length > 0 && obj.choices[0]?.message && typeof obj.choices[0].message === 'object')) throw new Error('Invalid model probe');
            return { id, available: true };
          } catch (error) { return { id, available: false, reason: safeError(error).code }; }
        }));
        scope.check(); return json({ models });
      }
      const input = await readInput(request, scope);
      const model = input.model ?? MODELS[0];
      if (input.passages.length === 0) {
        const raw = JSON.stringify({ sections: [{ title: 'Insufficient evidence', text: 'No source passages were retrieved. Search the dictionary for relevant entries and try again.', citations: [] }], insufficientEvidence: true });
        if (input.stream) { streaming = true; return streamAnswer({ response: raw }, scope, [], model); }
        return json(parseAnswer(raw, [], 'cloud', model));
      }
      const result = await run(env, model, { messages: buildMessages(input.question, input.passages, input), max_tokens: input.mode === 'detailed' ? 1800 : 1000, temperature: 0.2, stream: input.stream ?? false }, scope);
      if (input.stream) { streaming = true; return streamAnswer(result, scope, input.passages, model); }
      return json(await readResult(result, scope, input.passages, model));
    } catch (error) {
      const safe = safeError(error);
      return json(errorBody(safe), safe.status, { ...(safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {}), ...(safe.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) });
    } finally { if (!streaming) scope.close(); }
  },
};
