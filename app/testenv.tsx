import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text as RNText, View } from "react-native";
import {
  getSlideMeshThemeAsync,
  setSlideMeshTheme,
  type SlideMeshTheme,
} from "../utils/slideCardTheme";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function TestEnvScreen() {
  const [theme, setTheme] = useState<SlideMeshTheme>("dark");

  useEffect(() => {
    void getSlideMeshThemeAsync().then(setTheme);
  }, []);

  const apply = async (next: SlideMeshTheme) => {
    await setSlideMeshTheme(next);
    setTheme(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#4A6CF7", fontWeight: "700" }}>← 내페이지</Text>
      </Pressable>
      <Text style={{ marginTop: 12, fontSize: 20, fontWeight: "900" }}>테스트 환경</Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
        5유형 슬라이드 카드 매쉬 색상을 선택합니다.
      </Text>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Pressable
          onPress={() => void apply("dark")}
          style={{
            borderWidth: 1,
            borderColor: theme === "dark" ? "#4A6CF7" : "#ccc",
            backgroundColor: theme === "dark" ? "#EEF4FF" : "#fff",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontWeight: "800" }}>검은색 (투명도 50% · 화이트 텍스트)</Text>
        </Pressable>
        <Pressable
          onPress={() => void apply("light")}
          style={{
            borderWidth: 1,
            borderColor: theme === "light" ? "#4A6CF7" : "#ccc",
            backgroundColor: theme === "light" ? "#EEF4FF" : "#fff",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontWeight: "800" }}>흰색 (투명도 50% · 검은색 텍스트)</Text>
        </Pressable>
      </View>
    </View>
  );
}
