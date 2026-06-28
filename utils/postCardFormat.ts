import { Posts, type Post } from "../lib/api";

/** Postcard_S 신유형 — API card_type 값 */
export const CARD_TYPE_S = 5;

/** 목록 슬라이드(5유형)는 구인글(post_type=1)만 대상 */
export const JOB_POST_TYPE = 1;

export function isCardTypeS(cardType: unknown) {
  return Number(cardType) === CARD_TYPE_S;
}

export function isSlideListPost(post: Post) {
  if (!isCardTypeS(post.card_type)) return false;
  const pt = post.post_type;
  // listByType(1) / card_type=5 API 응답은 post_type이 비어 있을 수 있음
  if (pt == null || pt === undefined) return true;
  return Number(pt) === JOB_POST_TYPE;
}

export function filterSlideListPosts(items: Post[]) {
  return items.filter(isSlideListPost);
}

export function orderSlidePosts(items: Post[], slidePostIds: number[]): Post[] {
  const slide = items.filter(isSlideListPost);
  if (slidePostIds.length === 0) return slide;
  const byId = new Map(slide.map((p) => [Number(p.id), p]));
  const ordered = slidePostIds
    .map((id) => byId.get(id))
    .filter(Boolean) as Post[];
  const rest = slide.filter((p) => !slidePostIds.includes(Number(p.id)));
  return [...ordered, ...rest];
}

export async function fetchPostsByIds(ids: number[]): Promise<Post[]> {
  const out: Post[] = [];
  const BATCH = 15;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map((id) => Posts.get(Number(id))));
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value) out.push(r.value);
    });
  }
  const byId = new Map(out.map((p) => [Number(p.id), p]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Post[];
}

/** post_type=1 구인글 중 card_type=5만 조회 */
export async function fetchSlideListPosts(opts?: {
  username?: string;
  maxItems?: number;
}): Promise<Post[]> {
  const maxItems = opts?.maxItems ?? 20;
  const { items } = await Posts.listByType(JOB_POST_TYPE, {
    username: opts?.username,
    status: "published",
    limit: Math.max(maxItems, 20),
    card_type: CARD_TYPE_S,
  });
  return filterSlideListPosts(items).slice(0, maxItems);
}

/** UIConfig slide_post_ids + card_type=5 API를 합쳐 슬라이드 목록 구성 */
export async function resolveSlidePosts(
  slidePostIds: number[],
  opts?: { username?: string; maxItems?: number }
): Promise<Post[]> {
  const maxItems = opts?.maxItems ?? 20;
  const username = opts?.username;
  const byId = new Map<number, Post>();

  if (slidePostIds.length > 0) {
    const fromIds = filterSlideListPosts(await fetchPostsByIds(slidePostIds));
    fromIds.forEach((p) => byId.set(Number(p.id), p));
  }

  const fromApi = await fetchSlideListPosts({ username, maxItems: 50 });
  fromApi.forEach((p) => byId.set(Number(p.id), p));

  if (byId.size === 0) {
    // 서버 card_type 필터 미배포 시: 목록 API에서 5유형 스캔(관리자 화면과 동일)
    let cursor: string | undefined;
    for (let page = 0; page < 10 && byId.size < maxItems; page++) {
      const { items, next_cursor } = await Posts.list({
        username,
        status: "published",
        limit: 100,
        cursor,
      });
      filterSlideListPosts(items).forEach((p) => byId.set(Number(p.id), p));
      if (!next_cursor) break;
      cursor = next_cursor;
    }
  }

  return orderSlidePosts(Array.from(byId.values()), slidePostIds).slice(0, maxItems);
}

function simpleProvince(p?: string) {
  if (!p) return "";
  const map: Record<string, string> = {
    충청북도: "충북",
    충청남도: "충남",
    경상북도: "경북",
    경상남도: "경남",
    전라북도: "전북",
    전라남도: "전남",
    강원도: "강원",
  };
  if (map[p]) return map[p];
  return p.replace(/(특별시|광역시|자치시|자치도|특별자치도|도|특별자치시)$/g, "");
}

export function formatProvinceCity(province: string, city: string) {
  const prov = simpleProvince(province?.trim() ?? "");
  const rawCity = city == null ? "" : String(city).trim();
  const c = rawCity.toLowerCase() === "null" ? "" : rawCity;
  const cityOk = !!c && c !== "전체";
  return [prov, cityOk ? c : ""].filter(Boolean).join(" ");
}

export function formatRoles(post: Post) {
  const roles = [
    post.total_use ? "총괄" : null,
    post.branch_use ? "본부장" : null,
    post.hq_use ? "본부" : null,
    post.leader_use ? "팀장" : null,
    post.member_use ? "팀원" : null,
    post.team_use ? "팀" : null,
    post.each_use ? "각개" : null,
    post.other_role_name ? String(post.other_role_name) : null,
  ].filter(Boolean);

  const fees = [
    post.total_use ? post.total_fee : null,
    post.branch_use ? post.branch_fee : null,
    post.hq_use ? post.hq_fee : null,
    post.leader_use ? post.leader_fee : null,
    post.member_use ? post.member_fee : null,
    post.team_use ? post.team_fee : null,
    post.each_use ? post.each_fee : null,
    post.other_role_name ? post.other_role_fee : null,
  ].filter((f) => f?.trim());

  const roleText = roles.join("/") || "미정";
  const feeText = fees.length ? "/" + fees.join("/") : "";
  return roleText + feeText;
}
