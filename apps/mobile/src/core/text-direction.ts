/** Pick a paragraph's base direction without modifying its original Unicode text. */
export function readingDirection(text: string): "ltr" | "rtl" {
  const arabic = (text.match(/[\u0621-\u064a\u066e-\u06d3]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return arabic > latin ? "rtl" : "ltr";
}
