import { normalizeArabic as normalize } from "@openroots/shared";
export { normalize };
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
export function ftsQuery(text: string): string {
  return '"' + normalize(text.trim()).replace(/"/g, '""') + '"';
}
/** Bound candidate retrieval uses FTS5 and compact headword/root indexes, never a full book-text scan. */
export function makeSearch(
  query: string,
  normalized = true,
  bookId?: string,
  useFTS = true,
) {
  const original = query.trim();
  const key = normalized ? normalize(original) : original;
  const like = "%" + escapeLike(key) + "%";
  const head = normalized ? "e.normalized_headword" : "e.headword";
  const root = normalized ? "e.normalized_root" : "e.root";
  const sourceColumns =
    "SELECT e.*,b.title AS bookTitle,b.author,b.license FROM entries e JOIN books b ON b.id=e.book_id";
  const candidates = useFTS
    ? `SELECT p.entry_id FROM passages p WHERE p.id IN (SELECT passage_id FROM passages_fts WHERE passages_fts MATCH ? LIMIT 180)`
    : `SELECT entry_id FROM (SELECT entry_id FROM passages WHERE normalized_text LIKE ? ESCAPE '\\' LIMIT 180)`;
  const order = `ORDER BY CASE WHEN ${head} = ? THEN 0 WHEN ${root} = ? THEN 1 ELSE 2 END,length(e.headword),e.id LIMIT 60`;
  if (normalized)
    return {
      sql: `${sourceColumns} WHERE e.id IN (${candidates} UNION SELECT id FROM entries INDEXED BY entries_headword WHERE normalized_headword LIKE ? ESCAPE '\\' UNION SELECT id FROM entries INDEXED BY entries_root WHERE normalized_root LIKE ? ESCAPE '\\') ${bookId ? "AND e.book_id=?" : ""} ${order}`,
      params: [
        useFTS
          ? ftsQuery(original)
          : "%" + escapeLike(normalize(original)) + "%",
        like,
        like,
        ...(bookId ? [bookId] : []),
        key,
        key,
      ],
    };
  return {
    sql: `${sourceColumns} WHERE e.id IN (${candidates}) AND (e.headword LIKE ? ESCAPE '\\' OR e.root LIKE ? ESCAPE '\\' OR e.text LIKE ? ESCAPE '\\') ${bookId ? "AND e.book_id=?" : ""} ${order}`,
    params: [
      useFTS ? ftsQuery(original) : "%" + escapeLike(normalize(original)) + "%",
      like,
      like,
      like,
      ...(bookId ? [bookId] : []),
      key,
      key,
    ],
  };
}
export function lexicalTerms(question: string): string[] {
  const arabic = question.match(/[\u0621-\u064a\u066e-\u06d3\u064b-\u065f]+/g);
  return [
    ...new Set(
      arabic ??
        question
          .toLowerCase()
          .split(/[^a-z'-]+/)
          .filter(
            (w) =>
              w.length > 2 &&
              ![
                "what",
                "the",
                "root",
                "meaning",
                "explain",
                "compare",
                "between",
                "and",
                "for",
                "this",
                "translate",
              ].includes(w),
          ),
    ),
  ].slice(0, 8);
}
export function selectTranslation(original: string, selection: string): string {
  const text = selection.trim();
  if (!text || !original.includes(text))
    throw new Error(
      "Choose an exact, nonempty passage from the original source.",
    );
  if (text.length > 6000)
    throw new Error("Select a shorter passage (maximum 6,000 characters).");
  return text;
}
export function safeEndpoint(input: string): string {
  const u = new URL(input);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw new Error(
      "Use an HTTPS Worker URL without credentials, query or fragment.",
    );
  return u.href.replace(/\/$/, "");
}
