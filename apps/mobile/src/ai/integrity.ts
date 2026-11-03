/** Only metadata crosses JS. Hashing the actual GGUF must remain in native code. */
export type IntegrityDescriptor = { id: string; url: string; size: number; sha256: string };
export type ResumeRecord = { version: 1; modelId: string; sha256: string; url: string; fileUri: string; resumeData: string; bytes: number };
export async function verifyModelFile(uri: string, size: number, model: IntegrityDescriptor, nativeHash: (uri: string) => Promise<string>): Promise<void> {
  if (size !== model.size) throw new Error(`Model size mismatch: expected ${model.size}, received ${size}`);
  const digest = await nativeHash(uri);
  if (!/^[a-f0-9]{64}$/i.test(digest) || digest.toLowerCase() !== model.sha256) throw new Error('Model checksum mismatch; the file is not trusted');
}
export function validateResume(value: unknown, model: IntegrityDescriptor, partUri: string): ResumeRecord | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<ResumeRecord>;
  if (r.version !== 1 || r.modelId !== model.id || r.sha256 !== model.sha256 || r.url !== model.url || r.fileUri !== partUri || typeof r.resumeData !== 'string' || !r.resumeData || typeof r.bytes !== 'number' || !Number.isSafeInteger(r.bytes) || r.bytes < 0 || r.bytes > model.size) return null;
  return r as ResumeRecord;
}
export async function nativeSHA256(uri: string): Promise<string> {
  if (!uri.startsWith('file://')) throw new Error('Integrity requires a private local file');
  // This local Expo module hashes incrementally (1 MiB chunks) on both platforms.
  // No fallback: missing native code must fail before touching the model file.
  const { requireNativeModule } = await import('expo');
  const native = requireNativeModule<{sha256(uri:string):Promise<string>}>('OpenRootsIntegrity');
  return native.sha256(uri);
}
