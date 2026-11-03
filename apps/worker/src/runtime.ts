export class HTTPError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number, public localFallback = false) { super(message); }
}
export const TIMEOUT_MS = 30000;
/** Covers body upload, inference, and stream reads, even when a binding ignores its signal. */
export class RequestScope {
  readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout>;
  private readonly onAbort = () => this.abort(new HTTPError(499, 'CANCELED', 'Request canceled.'));
  constructor(private readonly client: AbortSignal) {
    this.timer = setTimeout(() => this.abort(new HTTPError(504, 'TIMEOUT', 'Cloud AI timed out. Retry or switch to Local AI.', undefined, true)), TIMEOUT_MS);
    client.addEventListener('abort', this.onAbort, { once: true });
    if (client.aborted) this.onAbort();
  }
  get signal(): AbortSignal { return this.controller.signal; }
  abort(reason = new HTTPError(499, 'CANCELED', 'Request canceled.')): void { if (!this.signal.aborted) this.controller.abort(reason); }
  check(): void { if (this.signal.aborted) throw this.signal.reason; }
  async guard<T>(task: Promise<T>): Promise<T> {
    this.check();
    let rejectAbort!: (error: unknown) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(this.signal.reason);
    this.signal.addEventListener('abort', onAbort, { once: true });
    try { return await Promise.race([task, aborted]); }
    finally { this.signal.removeEventListener('abort', onAbort); }
  }
  close(): void { clearTimeout(this.timer); this.client.removeEventListener('abort', this.onAbort); }
}

export function safeError(error: unknown): HTTPError {
  if (error instanceof HTTPError) return error;
  const obj = error as { code?: unknown; status?: unknown; message?: unknown; errors?: Array<{ code?: unknown }> } | null;
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : typeof obj?.message === 'string' ? obj.message : '';
  const codes = [obj?.code, obj?.errors?.[0]?.code, ...message.match(/\b(?:30\d\d|50\d\d)\b/g) ?? []].map(Number);
  if (codes.includes(3036) || /daily free allocation|quota exceeded|neurons.*exceed/i.test(message)) return new HTTPError(429, 'QUOTA_EXCEEDED', 'Cloud AI daily allowance is exhausted. Switch to Local AI or retry after the daily reset.', 3600, true);
  if (codes.some(c => [5007, 3042, 3041, 3023, 5035, 3040].includes(c)) || obj?.status === 403 || obj?.status === 404 || obj?.status === 429) return new HTTPError(503, 'MODEL_UNAVAILABLE', 'This model is unavailable for this account or temporarily at capacity. Try another available model or Local AI.', 60, true);
  if (codes.some(c => [3007, 3008].includes(c))) return new HTTPError(504, 'TIMEOUT', 'Cloud AI timed out. Retry or switch to Local AI.', undefined, true);
  return new HTTPError(502, 'UPSTREAM_ERROR', 'Cloud AI could not complete the request. Retry or switch to Local AI.', undefined, true);
}
export function errorBody(error: HTTPError): unknown {
  return { error: { code: error.code, message: error.message, retryable: [429, 502, 503, 504].includes(error.status), localFallback: error.localFallback, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) } };
}
