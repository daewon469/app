import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text as RNText, View } from "react-native";
import {
  clampMeshOpacity,
  formatMeshOpacityPercent,
  getSlideMeshSettingsAsync,
  MAX_MESH_OPACITY,
  MESH_OPACITY_STEP,
  MIN_MESH_OPACITY,
  setSlideMeshOpacity,
  setSlideMeshTheme,
  type SlideMeshOpacityMap,
  type SlideMeshTheme,
} from "../utils/slideCardTheme";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const OPTIONS: {
  theme: SlideMeshTheme;
  label: string;
  textHint: string;
}[] = [
  { theme: "dark", label: "검은색", textHint: "화이트 텍스트" },
  { theme: "navy", label: "네이비", textHint: "화이트 텍스트" },
  { theme: "light", label: "화이트", textHint: "검은색 텍스트" },
];

export default function TestEnvScreen() {
  const [theme, setTheme] = useState<SlideMeshTheme>("dark");
  const [opacity, setOpacity] = useState<SlideMeshOpacityMap>({
    dark: 0.5,
    light: 0.5,
    navy: 0.5,
  });

  useEffect(() => {
    void getSlideMeshSettingsAsync().then((s) => {
      setTheme(s.theme);
      setOpacity(s.opacity);
    });
  }, []);

  const applyTheme = async (next: SlideMeshTheme) => {
    await setSlideMeshTheme(next);
    setTheme(next);
  };

  const applyOpacity = async (forTheme: SlideMeshTheme, next: number) => {
    const value = clampMeshOpacity(next);
    await setSlideMeshOpacity(forTheme, value);
    setOpacity((prev) => ({ ...prev, [forTheme]: value }));
  };

  const nudgeOpacity = (forTheme: SlideMeshTheme, delta: number) => {
    void applyOpacity(forTheme, opacity[forTheme] + delta);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#4A6CF7", fontWeight: "700" }}>← 내페이지</Text>
      </Pressable>
      <Text style={{ marginTop: 12, fontSize: 20, fontWeight: "900" }}>테스트 환경</Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
        5유형 슬라이드 카드 매쉬 색상·투명도를 선택합니다. 색상별로 투명도를 따로 저장합니다.
      </Text>

      <View style={{ marginTop: 16, gap: 10 }}>
        {OPTIONS.map((opt) => {
          const active = theme === opt.theme;
          const pct = formatMeshOpacityPercent(opacity[opt.theme]);
          return (
            <View
              key={opt.theme}
              style={{
                borderWidth: 1,
                borderColor: active ? "#4A6CF7" : "#ccc",
                backgroundColor: active ? "#EEF4FF" : "#fff",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Pressable onPress={() => void applyTheme(opt.theme)}>
                <Text style={{ fontWeight: "800" }}>
                  {opt.label} (투명도 {pct} · {opt.textHint})
                </Text>
              </Pressable>

              {active && (
                <View style={{ marginTop: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#555" }}>투명도</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#555" }}>{pct}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pressable
                      onPress={() => nudgeOpacity(opt.theme, -MESH_OPACITY_STEP)}
                      disabled={opacity[opt.theme] <= MIN_MESH_OPACITY}
                      style={{
                        width: 44,
                        height: 40,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#000",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fff",
                        opacity: opacity[opt.theme] <= MIN_MESH_OPACITY ? 0.4 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 22, fontWeight: "800" }}>−</Text>
                    </Pressable>
                    <View
                      style={{
                        flex: 1,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: "#DDE3F0",
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round(
                            ((opacity[opt.theme] - MIN_MESH_OPACITY) /
                              (MAX_MESH_OPACITY - MIN_MESH_OPACITY)) *
                              100,
                          )}%`,
                          height: "100%",
                          backgroundColor: "#4A6CF7",
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => nudgeOpacity(opt.theme, MESH_OPACITY_STEP)}
                      disabled={opacity[opt.theme] >= MAX_MESH_OPACITY}
                      style={{
                        width: 44,
                        height: 40,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#000",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fff",
                        opacity: opacity[opt.theme] >= MAX_MESH_OPACITY ? 0.4 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 22, fontWeight: "800" }}>+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
