export type UserGrade = -1 | 0 | 1 | 2 | 3 | 4;

export const USER_GRADE_LABEL: Record<UserGrade, string> = {
  "-1": "일반회원",
  0: "아마추어",
  1: "세미프로",
  2: "프로",
  3: "마스터",
  4: "레전드",
};

export function normalizeUserGrade(value: unknown): UserGrade | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n === -1 || n === 0 || n === 1 || n === 2 || n === 3 || n === 4) return n;
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
      // 뱃지 배경색(필요 시)
      badgeBgColor?: string;
      // 아이콘이 원 안에서 차지하는 비율(기본 0.68)
      iconScale?: number;
      // 뱃지 안에서 미세 보정(필요 시)
      offsetY?: number;
      // 아이콘 자체의 검은 아웃라인(겹치기) 제거
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
  // PointEventModal에 맞춘 아이콘/색상
  switch (g) {
    case 4:
      return { type: "ion", name: "trophy", color: "#FFD600", size: 18 };
    case 3:
      return { type: "text", text: "♠", color: "#111", fontSize: 16, offsetY: 0 };
    case 2:
      return { type: "ion", name: "heart", color: "#E53935", size: 18 };
    case 1:
      return { type: "ion", name: "diamond", color: "#50B6FF", size: 18 };
    case -1:
      // 내정보(사람) 아이콘: 파란 배경 + 흰색 아이콘(원에 가득 차게)
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
      // 클로버 느낌 대체: leaf(잎사귀)
      return { type: "ion", name: "leaf", color: "#00B200", size: 18, noOutline: true };
  }
}

