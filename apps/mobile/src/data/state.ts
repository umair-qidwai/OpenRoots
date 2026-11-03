import * as SQLite from "expo-sqlite";
import { useSyncExternalStore } from "react";
import type { AIAnswer, SourcePassage } from "@openroots/shared";
import { PersistentStore } from "../core/persistence";
export type Settings = {
  language: "en" | "ar";
  theme: "system" | "light" | "dark";
  fontSize: number;
  provider: "cloud" | "local";
  endpoint: string;
  cloudModel: string;
  detailed: boolean;
  fallback: boolean;
};
export type Message = {
  id: string;
  question: string;
  answer: AIAnswer;
  passages: SourcePassage[];
  at: number;
  original?: string;
};
export type State = {
  ready: boolean;
  settings: Settings;
  bookmarks: string[];
  history: string[];
  messages: Message[];
  saved: Message[];
};
const defaults: State = {
  ready: false,
  settings: {
    language: "en",
    theme: "system",
    fontSize: 24,
    provider: "cloud",
    endpoint: "",
    cloudModel: "@cf/qwen/qwen3-30b-a3b-fp8",
    detailed: false,
    fallback: false,
  },
  bookmarks: [],
  history: [],
  messages: [],
  saved: [],
};
let db: SQLite.SQLiteDatabase;
const store = new PersistentStore<State>(
  defaults,
  {
    read: async () => {
      const row = await db.getFirstAsync<{ json: string }>(
        "SELECT json FROM app_state WHERE id=1",
      );
      return row?.json ?? null;
    },
    write: async (json) => {
      await db.runAsync(
        "INSERT OR REPLACE INTO app_state(id,json) VALUES(1,?)",
        json,
      );
    },
  },
  (initial, saved) => {
    if (!saved || typeof saved !== "object")
      throw new Error(
        "Saved research could not be read. No data has been overwritten.",
      );
    const data = saved as Partial<State>;
    return {
      ...initial,
      ...data,
      settings: { ...initial.settings, ...data.settings },
      ready: false,
    };
  },
);
let initialization: Promise<void> | null = null;
export function initializeState() {
  if (!initialization)
    initialization = (async () => {
      db = await SQLite.openDatabaseAsync("openroots-user.db");
      await db.execAsync(
        "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL)",
      );
      await store.initialize();
      await store.update((current) => ({ ...current, ready: true }));
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  return initialization;
}
export function useApp() {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
export const getApp = store.get;
export const settings = (part: Partial<Settings>) =>
  store.update((s) => ({ ...s, settings: { ...s.settings, ...part } }));
export const bookmark = (id: string) =>
  store.update((s) => ({
    ...s,
    bookmarks: s.bookmarks.includes(id)
      ? s.bookmarks.filter((x) => x !== id)
      : [id, ...s.bookmarks],
  }));
export const remember = (query: string) =>
  store.update((s) => ({
    ...s,
    history: [query, ...s.history.filter((x) => x !== query)]
      .filter(Boolean)
      .slice(0, 60),
  }));
export const addMessage = (message: Message) =>
  store.update((s) => ({
    ...s,
    messages: [...s.messages, message].slice(-60),
  }));
export const saveMessage = (message: Message) =>
  store.update((s) => ({
    ...s,
    saved: [message, ...s.saved.filter((m) => m.id !== message.id)],
  }));
export const clearConversation = () =>
  store.update((s) => ({ ...s, messages: [] }));
export const clearSaved = () =>
  store.update((s) => ({
    ...s,
    bookmarks: [],
    history: [],
    messages: [],
    saved: [],
  }));
