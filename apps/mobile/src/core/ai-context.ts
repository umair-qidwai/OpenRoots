import type { SourcePassage, AIOptions } from "@openroots/shared";
export function compactPassages(
  passages: SourcePassage[],
  provider: "cloud" | "local",
): SourcePassage[] {
  if (provider === "cloud") return passages;
  const result: SourcePassage[] = [];
  let chars = 2;
  for (const passage of passages) {
    const size = JSON.stringify(passage).length + 1;
    if (chars + size > 4500) continue;
    result.push(passage);
    chars += size;
    if (result.length === 3) break;
  }
  return result;
}
type HistoryMessage = {
  question: string;
  answer: { sections: { text: string }[] };
};
/** History is context, not evidence; trimming it never changes saved originals. */
export function conversationContext(
  messages: HistoryMessage[],
  provider: "cloud" | "local",
): NonNullable<AIOptions["history"]> {
  const local = provider === "local";
  return messages
    .slice(local ? -1 : -3)
    .flatMap((m) => [
      {
        role: "user" as const,
        content: m.question.slice(0, local ? 400 : 1000),
      },
      {
        role: "assistant" as const,
        content: m.answer.sections
          .map((s) => s.text)
          .join("\n")
          .slice(0, local ? 600 : 1500),
      },
    ])
    .filter((t) => t.content.trim());
}
