import type { TextStyle } from "react-native";

export const INPUT_TEXT_FONT_WEIGHT: TextStyle["fontWeight"] = "400";
/** 본문(400) 기준 2단계 얇은 플레이스홀더 굵기 */
export const PLACEHOLDER_FONT_WEIGHT: TextStyle["fontWeight"] = "200";

export function inputFontWeightStyle(
  value: string | null | undefined,
): Pick<TextStyle, "fontWeight"> {
  const hasValue = Boolean(String(value ?? "").trim());
  return {
    fontWeight: hasValue ? INPUT_TEXT_FONT_WEIGHT : PLACEHOLDER_FONT_WEIGHT,
  };
}
