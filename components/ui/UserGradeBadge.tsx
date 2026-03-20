import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { getUserGradeIconMeta } from "../../utils/userGrade";

type Props = {
  grade?: number | null;
  size?: number; // 뱃지 지름
  bgColor?: string; // 뱃지 배경색 오버라이드(필요 시)
};

export default function UserGradeBadge({ grade, size = 18, bgColor }: Props) {
  const meta = useMemo(() => getUserGradeIconMeta(grade), [grade]);

  const badgeStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: "#111",
      backgroundColor: bgColor ?? (meta as any)?.badgeBgColor ?? "#D9D9D9", // 기본 실버
      justifyContent: "center" as const,
      alignItems: "center" as const,
      overflow: "hidden" as const,
    }),
    [size, meta, bgColor]
  );

  if (meta.type === "ion") {
    // 뱃지 원 안에서 아이콘이 더 큰 비율을 차지하도록 스케일 업
    const scale = (meta as any)?.iconScale ?? 0.68;
    const iconSize = Math.min(
      Math.floor(size * scale),
      size - 10 // 테두리(2) + 아웃라인(+2) 고려
    );
    const dy = meta.offsetY ?? 0;
    const noOutline = (meta as any)?.noOutline ?? false;
    return (
      <View style={badgeStyle}>
        <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
          {!noOutline && (
            <Ionicons
              name={meta.name as any}
              size={iconSize + 2}
              color={"#111"}
              style={{ position: "absolute", transform: [{ translateY: dy }] }}
            />
          )}
          <Ionicons
            name={meta.name as any}
            size={iconSize}
            color={meta.color}
            style={{ transform: [{ translateY: dy }] }}
          />
        </View>
      </View>
    );
  }

  // 텍스트/이모지도 원 안에서 더 크게 보이도록 스케일 업
  const fontSize = Math.min(Math.floor(size * 0.78), size - 12);
  const dy = meta.offsetY ?? 0;
  return (
    <View style={badgeStyle}>
      <Text
        style={{
          fontSize,
          lineHeight: fontSize,
          fontWeight: "900",
          color: meta.color,
          textAlign: "center",
          textAlignVertical: "center",
          includeFontPadding: false,
          ...(meta.noOutline
            ? null
            : {
                textShadowColor: "#111",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 1,
              }),
          transform: [{ translateY: dy }],
        }}
      >
        {meta.text}
      </Text>
    </View>
  );
}

