import {
  parseAnswer,
  type AIAnswer,
  type SourcePassage,
} from "@openroots/shared";
/** A server returns AIAnswer metadata; the shared model-output parser accepts only its evidence payload. */
export function parseCloudResponse(
  data: unknown,
  passages: SourcePassage[],
  expectedModel: string,
): AIAnswer {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid Cloud AI response.");
  const value = data as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        !["sections", "insufficientEvidence", "provider", "model"].includes(
          key,
        ),
    ) ||
    value.provider !== "cloud" ||
    value.model !== expectedModel
  )
    throw new Error("Cloud AI returned unexpected provider or model metadata.");
  return parseAnswer(
    JSON.stringify({
      sections: value.sections,
      insufficientEvidence: value.insufficientEvidence,
    }),
    passages,
    "cloud",
    expectedModel,
  );
}
