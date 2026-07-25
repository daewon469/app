import { api, type Post } from "../lib/api";

export type SiteAnalysisPayload = {
  title?: string;
  site_name?: string | null;
  highlight_content?: string | null;
  job_industry?: string | null;
  province?: string | null;
  city?: string | null;
  workplace_address?: string | null;
  business_address?: string | null;
  content?: string | null;
  company_agency?: string | null;
};

export function postToSiteAnalysisPayload(post: Post): SiteAnalysisPayload {
  return {
    title: post.title,
    site_name: post.site_name,
    highlight_content: post.highlight_content,
    job_industry: post.job_industry,
    province: post.province,
    city: post.city,
    workplace_address: post.workplace_address,
    business_address: post.business_address,
    content: post.content,
    company_agency: post.company_agency,
  };
}

export async function requestSiteAnalysis(
  payload: SiteAnalysisPayload,
): Promise<{ ok: true; analysis: string } | { ok: false; error: string }> {
  try {
    const { data } = await api.post<{
      ok?: boolean;
      analysis?: string;
      error?: string;
    }>("/community/ai/site-analysis", payload, { timeout: 90_000 });
    if (!data?.ok || !data.analysis) {
      return { ok: false, error: data?.error || "AI 분석에 실패했습니다." };
    }
    return { ok: true, analysis: data.analysis };
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
        ?.error ||
      (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
      "AI 분석 요청 중 오류가 발생했습니다.";
    return { ok: false, error: String(msg) };
  }
}
