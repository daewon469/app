export type SiteAnalysisSection = {
  heading: string;
  body: string;
};

function cleanAnalysisTitle(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/\s*[-–—]\s*고객\s*브리핑\s*및\s*투자\s*분석\s*$/g, "")
    .replace(/^현장명:\s*/i, "")
    .trim() || null;
}

function normalizeSectionHeading(heading: string): string {
  const h = heading.trim();
  if (/^5\)/.test(h) || /브리핑\s*멘트/.test(h) || /고객\s*맞춤형/.test(h)) {
    return "5) 실전 브리핑 멘트";
  }
  return h;
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

  const sectionRegex = /\*\*(\d\)\s*[^*]+)\*\*\s*([\s\S]*?)(?=\*\*\d\)|\s*$)/g;
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

  return { title, sections };
}
