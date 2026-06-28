import { Platform, type TextStyle } from "react-native";

/** Android에서 fontWeight만 지정하면 기기·OS마다 합성 굵기가 달라질 수 있어 fontFamily를 함께 고정 */
export function fixedFontWeight(weight: TextStyle["fontWeight"]): TextStyle {
  if (Platform.OS !== "android") {
    return { fontWeight: weight };
  }

  switch (weight) {
    case "200":
    case "300":
    case "400":
    case "normal":
      return {
        fontFamily: "sans-serif",
        fontWeight: "normal",
        includeFontPadding: false,
      };
    case "500":
      return {
        fontFamily: "sans-serif-medium",
        fontWeight: "500",
        includeFontPadding: false,
      };
    case "600":
    case "700":
    case "800":
    case "900":
    case "bold":
      return {
        fontFamily: "sans-serif-medium",
        fontWeight: weight === "600" ? "600" : "700",
        includeFontPadding: false,
      };
    default:
      return {
        fontFamily: "sans-serif",
        fontWeight: weight,
        includeFontPadding: false,
      };
  }
}

export const listItemTitleTextStyle: TextStyle = {
  fontSize: 15,
  flex: 1,
  ...fixedFontWeight("400"),
};

export const listItemDateTextStyle: TextStyle = {
  fontSize: 11,
  marginLeft: 8,
  ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
};
