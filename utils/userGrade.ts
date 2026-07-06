export type UserGrade = -1 | 0 | 1 | 2 | 3 | 4 | 5;

export const USER_GRADE_LABEL: Record<UserGrade, string> = {
  "-1": "일반회원",
  0: "아마추어",
  1: "세미프로",
  2: "프로",
  3: "마스터",
  4: "챌린저",
  5: "레전드",
};

export function normalizeUserGrade(value: unknown): UserGrade | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n === -1 || n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

export function getUserGradeLabel(value: unknown): string {
  const g = normalizeUserGrade(value);
  return g === null ? "일반회원" : USER_GRADE_LABEL[g];
}

export type UserGradeIconMeta =
  | {
      type: "ion";
      name: string;
      color: string;
      size: number;
      badgeBgColor?: string;
      iconScale?: number;
      offsetY?: number;
      noOutline?: boolean;
    }
  | {
      type: "text";
      text: string;
      color: string;
      fontSize?: number;
      badgeBgColor?: string;
      iconScale?: number;
      offsetY?: number;
      noOutline?: boolean;
    };

export function getUserGradeIconMeta(value: unknown): UserGradeIconMeta {
  const g = normalizeUserGrade(value) ?? -1;
  switch (g) {
    case 5:
      return { type: "ion", name: "trophy", color: "#FFD600", size: 18 };
    case 4:
      return { type: "ion", name: "ribbon", color: "#FF6D00", size: 18 };
    case 3:
      return { type: "text", text: "♠", color: "#111", fontSize: 16, offsetY: 0 };
    case 2:
      return { type: "ion", name: "heart", color: "#E53935", size: 18 };
    case 1:
      return { type: "ion", name: "diamond", color: "#50B6FF", size: 18 };
    case -1:
      return {
        type: "ion",
        name: "person",
        color: "#fff",
        size: 18,
        badgeBgColor: "#4A6CF7",
        iconScale: 0.7,
        noOutline: false,
      };
    case 0:
    default:
      return { type: "ion", name: "leaf", color: "#00B200", size: 18, noOutline: true };
  }
}

export const REFERRAL_GRADE_BONUS_ROWS = [
  { grade: "레전드", count: "500명", bonus: "5,000,000p" },
  { grade: "챌린저", count: "100명", bonus: "1,000,000p" },
  { grade: "마스터", count: "50명", bonus: "500,000p" },
  { grade: "프로", count: "20명", bonus: "200,000p" },
  { grade: "세미프로", count: "10명", bonus: "100,000p" },
  { grade: "아마추어", count: "5명", bonus: "50,000p" },
  { grade: "일반회원", count: "-", bonus: "-" },
] as const;
