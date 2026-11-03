import { transliterationCandidates } from "./transliteration";
import type { SourcePassage } from "@openroots/shared";
import { makeSearch, lexicalTerms, normalize, ftsQuery } from "./search.ts";
export type Entry = {
  id: string;
  book_id: string;
  headword: string;
  root: string | null;
  text: string;
  source_url: string;
  locator: string | null;
  bookTitle: string;
  author: string;
  license: string;
};
export type Book = {
  id: string;
  title: string;
  author: string;
  source_url: string;
  license: string;
  edition: string;
  category: string;
  entryCount: number;
};
export type Bind = (string | number | null)[];
export interface QueryDatabase {
  getAllAsync<T>(sql: string, params?: Bind): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: Bind): Promise<T | null>;
}
const entryColumns =
  "SELECT e.*,b.title AS bookTitle,b.author,b.license FROM entries e JOIN books b ON b.id=e.book_id";
const passageColumns =
  "SELECT p.id,p.entry_id AS entryId,p.book_id AS bookId,b.title AS bookTitle,b.author,p.headword,p.root,p.text,e.source_url AS sourceUrl,b.license,e.locator";
const passageJoin =
  "FROM passages p JOIN entries e ON e.id=p.entry_id JOIN books b ON b.id=p.book_id";
export class DictionaryRepository {
  private db: QueryDatabase;
  private useFTS: boolean;
  constructor(db: QueryDatabase, options: { useFTS?: boolean } = {}) {
    this.db = db;
    this.useFTS = options.useFTS ?? true;
  }
  async search(
    query: string,
    normalized = true,
    book?: string,
  ): Promise<Entry[]> {
    if (!query.trim()) return [];
    if (normalized) {
      const aliases = transliterationCandidates(query);
      if (aliases.length) {
        const rows = (
          await Promise.all(
            aliases.map((alias) => this.search(alias, true, book)),
          )
        ).flat();
        if (rows.length)
          return [...new Map(rows.map((row) => [row.id, row])).values()].slice(
            0,
            60,
          );
      }
    }
    // The compact normalized indexes can satisfy exact/root matches without reading book bodies.
    if (normalized) {
      const key = normalize(query.trim());
      const exact = await this.db.getAllAsync<Entry>(
        `${entryColumns} WHERE e.id IN (SELECT id FROM entries WHERE normalized_headword=? UNION SELECT id FROM entries WHERE normalized_root=?) ${book ? "AND e.book_id=?" : ""} ORDER BY CASE WHEN e.normalized_headword=? THEN 0 ELSE 1 END,length(e.headword),e.id LIMIT 60`,
        [key, key, ...(book ? [book] : []), key],
      );
      if (exact.length) return exact;
    }
    const q = makeSearch(query, normalized, book, this.useFTS);
    return this.db.getAllAsync<Entry>(q.sql, q.params);
  }
  entry(id: string) {
    return this.db.getFirstAsync<Entry>(`${entryColumns} WHERE e.id=?`, [id]);
  }
  books() {
    return this.db.getAllAsync<Book>(
      "SELECT b.*,(SELECT COUNT(*) FROM entries e WHERE e.book_id=b.id) AS entryCount FROM books b ORDER BY b.title",
    );
  }
  passages(entryId: string) {
    return this.db.getAllAsync<SourcePassage>(
      `${passageColumns} ${passageJoin} WHERE p.entry_id=? ORDER BY p.ordinal`,
      [entryId],
    );
  }
  async retrieve(question: string): Promise<SourcePassage[]> {
    const scores = new Map<string, { passage: SourcePassage; score: number }>();
    const priorities: string[] = [];
    const terms = [
      ...new Set(
        lexicalTerms(question).flatMap((term) => [
          ...transliterationCandidates(term),
          term,
        ]),
      ),
    ].slice(0, 12);
    for (const term of terms) {
      const n = normalize(term);
      const rows = await this.db.getAllAsync<SourcePassage & { score: number }>(
        `${passageColumns},CASE WHEN e.normalized_headword=? THEN 100 WHEN e.normalized_root=? THEN 80 ELSE 20 END AS score ${passageJoin} WHERE trim(p.headword) <> '' AND p.id IN (SELECT id FROM passages WHERE entry_id IN (SELECT id FROM entries WHERE normalized_headword=? UNION SELECT id FROM entries WHERE normalized_root=?) UNION ${this.useFTS ? "SELECT passage_id FROM passages_fts WHERE passages_fts MATCH ?" : "SELECT id FROM passages WHERE normalized_text LIKE ? ESCAPE '\\'"} LIMIT 48) ORDER BY score DESC,p.ordinal,p.id LIMIT 12`,
        [
          n,
          n,
          n,
          n,
          this.useFTS
            ? ftsQuery(term)
            : "%" + n.replace(/[\\%_]/g, "\\$&") + "%",
        ],
      );
      const best = rows
        .filter((row) => JSON.stringify(row).length <= 4300)
        .sort((a, b) => {
          const ai = normalize(a.text).indexOf(n);
          const bi = normalize(b.text).indexOf(n);
          return (
            b.score - a.score ||
            (ai < 0 ? 1e9 : ai) - (bi < 0 ? 1e9 : bi) ||
            a.text.length - b.text.length ||
            a.id.localeCompare(b.id)
          );
        })[0];
      if (best && !priorities.includes(best.id)) priorities.push(best.id);
      for (const row of rows) {
        const { score, ...passage } = row;
        const previous = scores.get(passage.id);
        scores.set(passage.id, {
          passage,
          score: (previous?.score ?? 0) + score,
        });
      }
    }
    const ranked = [...scores.values()].sort((a, b) => {
      const ai = priorities.indexOf(a.passage.id);
      const bi = priorities.indexOf(b.passage.id);
      return (
        (ai < 0 ? 1e9 : ai) - (bi < 0 ? 1e9 : bi) ||
        b.score - a.score ||
        a.passage.id.localeCompare(b.passage.id)
      );
    });
    const chosen: SourcePassage[] = [];
    let chars = 0;
    // Preserve source text exactly and stay within the shared protocol, including metadata overhead.
    for (const { passage } of ranked) {
      const size = JSON.stringify(passage).length;
      if (passage.text.length > 6000 || chars + size > 21000) continue;
      chosen.push(passage);
      chars += size;
      if (chosen.length === 8) break;
    }
    return chosen;
  }
}
