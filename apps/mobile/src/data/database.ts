import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import { DictionaryRepository } from "../core/repository";
export type { Entry, Book } from "../core/repository";
let repository: DictionaryRepository;
let initialization: Promise<void> | null = null;
export function initializeDictionary() {
  if (!initialization)
    initialization = (async () => {
      const assetId = require("../../assets/dictionaries/openroots.db");
      let db: SQLite.SQLiteDatabase;
      if (Platform.OS === "web") {
        // The preview reads the genuine DB in memory: avoid a large OPFS backup
        // on every fresh browser profile. Native retains its bundled offline file.
        const { Asset } = await import("expo-asset");
        const response = await fetch(Asset.fromModule(assetId).uri);
        if (!response.ok)
          throw new Error(
            "Could not load the bundled dictionary (" + response.status + ").",
          );
        db = await SQLite.deserializeDatabaseAsync(
          new Uint8Array(await response.arrayBuffer()),
        );
      } else {
        await SQLite.importDatabaseFromAssetAsync("openroots.db", { assetId });
        db = await SQLite.openDatabaseAsync("openroots.db");
      }
      await db.execAsync("PRAGMA query_only=ON");
      repository = new DictionaryRepository(
        {
          getAllAsync: (sql, params = []) => db.getAllAsync(sql, params),
          getFirstAsync: (sql, params = []) => db.getFirstAsync(sql, params),
        },
        { useFTS: Platform.OS !== "web" },
      );
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  return initialization;
}
export const searchEntries = (
  query: string,
  normalized = true,
  book?: string,
) => repository.search(query, normalized, book);
export const getEntry = (id: string) => repository.entry(id);
export const getBooks = () => repository.books();
export const getPassages = (entryId: string) => repository.passages(entryId);
export const retrieve = (question: string) => repository.retrieve(question);
