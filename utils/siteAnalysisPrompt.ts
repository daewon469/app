export type SiteAnalysisSection = {
  heading: string;
  body: string;
};

/** AI 분석 챕터 고정 순서 */
export const SITE_ANALYSIS_CHAPTER_ORDER = [
  "건축개요",
  "설계특징",
  "입지/교통",
  "생활/학군",
  "미래가치",
  "투자가치",
  "실전 브리핑",
] as const;

function cleanAnalysisTitle(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/\s*[-–—]\s*고객\s*브리핑\s*및\s*투자\s*분석\s*$/g, "")
    .replace(/^현장명:\s*/i, "")
    .trim() || null;
}

function stripSectionNumber(heading: string): string {
  return heading.replace(/^\d+\)\s*/, "").trim();
}

function matchCanonicalChapter(heading: string): string | null {
  const h = stripSectionNumber(heading.trim());
  if (/건축\s*개요/.test(h)) return "건축개요";
  if (/설계\s*특징/.test(h)) return "설계특징";
  if (/입지/.test(h) || /교통/.test(h)) return "입지/교통";
  if (/생활/.test(h) || /학군/.test(h)) return "생활/학군";
  if (/미래\s*가치/.test(h)) return "미래가치";
  if (/투자\s*가치/.test(h)) return "투자가치";
  if (/실전\s*브리핑/.test(h) || /브리핑\s*멘트/.test(h) || /고객\s*맞춤형/.test(h)) {
    return "실전 브리핑";
  }
  return null;
}

function normalizeSectionHeading(heading: string): string {
  const canonical = matchCanonicalChapter(heading);
  if (!canonical) return stripSectionNumber(heading.trim());
  const idx = SITE_ANALYSIS_CHAPTER_ORDER.indexOf(
    canonical as (typeof SITE_ANALYSIS_CHAPTER_ORDER)[number],
  );
  return `${idx + 1}) ${canonical}`;
}

function chapterIndex(heading: string): number {
  const canonical = matchCanonicalChapter(heading) ?? stripSectionNumber(heading);
  const idx = SITE_ANALYSIS_CHAPTER_ORDER.indexOf(
    canonical as (typeof SITE_ANALYSIS_CHAPTER_ORDER)[number],
  );
  return idx >= 0 ? idx : SITE_ANALYSIS_CHAPTER_ORDER.length;
}

function sortSections(sections: SiteAnalysisSection[]): SiteAnalysisSection[] {
  return [...sections].sort((a, b) => chapterIndex(a.heading) - chapterIndex(b.heading));
}

/** 리포트 텍스트를 섹션 카드용으로 파싱 (실패 시 빈 배열) */
export function parseSiteAnalysisSections(text: string): {
  title: string | null;
  sections: SiteAnalysisSection[];
} {
  const raw = String(text ?? "").trim();
  if (!raw) return { title: null, sections: [] };

  const titleMatch = raw.match(/\*\*\[([^\]]+)\]\*\*/);
  const title = cleanAnalysisTitle(titleMatch?.[1]?.trim() || null);

  const sectionRegex = /\*\*(\d+\)\s*[^*]+)\*\*\s*([\s\S]*?)(?=\*\*\d+\)|\s*$)/g;
  const sections: SiteAnalysisSection[] = [];
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(raw)) !== null) {
    const heading = normalizeSectionHeading(match[1].trim());
    const body = match[2]
      .replace(/^\s*-\s*/gm, "")
      .replace(/\*\*/g, "")
      .trim();
    if (heading && body) sections.push({ heading, body });
  }

  return { title, sections: sortSections(sections) };
}
