export interface StateStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
/** Serialize read-modify-write operations; publish only after durable storage succeeds. */
export class PersistentStore<T extends object> {
  private state: T;
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private storage: StateStorage;
  private restore: (initial: T, saved: unknown) => T;
  constructor(
    initial: T,
    storage: StateStorage,
    restore: (initial: T, saved: unknown) => T = (initial, saved) => ({
      ...initial,
      ...(saved as Partial<T>),
    }),
  ) {
    this.state = initial;
    this.storage = storage;
    this.restore = restore;
  }
  get = (): T => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  async initialize(): Promise<void> {
    const raw = await this.storage.read();
    if (raw !== null) this.state = this.restore(this.state, JSON.parse(raw));
    this.listeners.forEach((listener) => listener());
  }
  update(change: (current: T) => T): Promise<void> {
    const operation = this.queue
      .catch(() => {})
      .then(async () => {
        const next = change(this.state);
        await this.storage.write(JSON.stringify(next));
        this.state = next;
        this.listeners.forEach((listener) => listener());
      });
    this.queue = operation;
    return operation;
  }
}
