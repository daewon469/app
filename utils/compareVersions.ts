/**
 * 간단한 "a.b.c" 형태 버전 비교 유틸.
 * - 숫자 외 문자는 무시(예: "1.0.0-beta" -> 1.0.0으로 비교)
 * - 반환값: a < b => -1, a == b => 0, a > b => 1
 */
export function compareVersions(a: string, b: string): number {
  const pa = toParts(a);
  const pb = toParts(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function toParts(v: string): number[] {
  const raw = (v ?? "").toString().trim();
  if (!raw) return [0];

  const parts = raw.split(".");
  const nums = parts.map((p) => {
    const digits = (p ?? "").replace(/[^0-9]/g, "");
    const n = parseInt(digits || "0", 10);
    return Number.isFinite(n) ? n : 0;
  });

  // trailing 0 정리(1.0.0 == 1)
  while (nums.length > 1 && nums[nums.length - 1] === 0) nums.pop();
  return nums.length ? nums : [0];
}
