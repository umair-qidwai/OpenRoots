/** Explicit orthographic search aliases, not a morphology engine or root extractor.
 * Unknown forms are left to English full-text search; no root is guessed.
 */
const aliases: Record<string, string[]> = {
  kitab: ["كتاب"],
  kataba: ["كتب"],
  katb: ["كتب"],
  ilm: ["علم"],
  alim: ["عالم"],
  rahma: ["رحمة"],
  rahmah: ["رحمة"],
  sabr: ["صبر"],
  khawf: ["خوف"],
  khauf: ["خوف"],
  khashya: ["خشية"],
  khashyah: ["خشية"],
  taqwa: ["تقوى"],
  ghafr: ["غفر"],
  ghafara: ["غفر"],
  istighfar: ["استغفار"],
  huda: ["هدى"],
  nur: ["نور"],
  noor: ["نور"],
  rafa: ["رأفة"],
  rafah: ["رأفة"],
};
export function transliterationCandidates(query: string): string[] {
  const key = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ʿʾ‘’'`\-\s]/g, "");
  return aliases[key] ?? [];
}
