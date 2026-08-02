import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text as RNText, View } from "react-native";
import { UIConfig } from "../lib/api";
import {
  clampMeshOpacity,
  formatMeshOpacityPercent,
  getSlideMeshSettingsAsync,
  MAX_MESH_OPACITY,
  MIN_MESH_OPACITY,
  parseSlideMeshSettings,
  setSlideMeshSettings,
  type SlideMeshOpacityMap,
  type SlideMeshSettings,
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

function OpacityRangeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const trackWidthRef = useRef(0);

  const valueFromX = useCallback((x: number) => {
    const w = trackWidthRef.current;
    if (w <= 0) return value;
    const ratio = Math.min(1, Math.max(0, x / w));
    const raw = MIN_MESH_OPACITY + ratio * (MAX_MESH_OPACITY - MIN_MESH_OPACITY);
    return clampMeshOpacity(raw);
  }, [value]);

  const fillPct = Math.round(
    ((clampMeshOpacity(value) - MIN_MESH_OPACITY) /
      (MAX_MESH_OPACITY - MIN_MESH_OPACITY)) *
      100,
  );

  return (
    <View
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => onChange(valueFromX(e.nativeEvent.locationX))}
      onResponderMove={(e) => onChange(valueFromX(e.nativeEvent.locationX))}
      style={{ height: 36, justifyContent: "center" }}
      accessibilityRole="adjustable"
      accessibilityValue={{
        min: Math.round(MIN_MESH_OPACITY * 100),
        max: Math.round(MAX_MESH_OPACITY * 100),
        now: Math.round(clampMeshOpacity(value) * 100),
      }}
    >
      <View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: "#DDE3F0",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${fillPct}%`,
            height: "100%",
            backgroundColor: "#4A6CF7",
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${fillPct}%`,
          marginLeft: -10,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#4A6CF7",
          borderWidth: 2,
          borderColor: "#fff",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </View>
  );
}

export default function TestEnvScreen() {
  const [theme, setTheme] = useState<SlideMeshTheme>("dark");
  const [opacity, setOpacity] = useState<SlideMeshOpacityMap>({
    dark: 0.5,
    light: 0.5,
    navy: 0.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const settingsRef = useRef<SlideMeshSettings>({
    theme: "dark",
    opacity: { dark: 0.5, light: 0.5, navy: 0.5 },
  });
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullConfigRef = useRef<Awaited<ReturnType<typeof UIConfig.get>>["config"] | null>(null);

  const applyLocal = useCallback(async (next: SlideMeshSettings) => {
    settingsRef.current = next;
    setTheme(next.theme);
    setOpacity(next.opacity);
    await setSlideMeshSettings(next);
  }, []);

  const persistToServer = useCallback(async (next: SlideMeshSettings) => {
    setSaving(true);
    try {
      const current = fullConfigRef.current ?? (await UIConfig.get()).config;
      fullConfigRef.current = current;
      const res = await UIConfig.update({
        ...current,
        slide_mesh: {
          theme: next.theme,
          opacity: {
            dark: next.opacity.dark,
            light: next.opacity.light,
            navy: next.opacity.navy,
          },
        },
      });
      if (res.status === 0 && res.config) {
        fullConfigRef.current = res.config;
      } else {
        Alert.alert("저장 실패", "서버에 저장하지 못했습니다. 다시 시도해 주세요.");
      }
    } catch {
      Alert.alert("저장 실패", "네트워크 오류로 서버에 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = await getSlideMeshSettingsAsync();
        if (!cancelled) {
          settingsRef.current = local;
          setTheme(local.theme);
          setOpacity(local.opacity);
        }
        const res = await UIConfig.get();
        if (cancelled) return;
        fullConfigRef.current = res.config;
        if (res.config?.slide_mesh) {
          const server = parseSlideMeshSettings(res.config.slide_mesh);
          await applyLocal(server);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [applyLocal]);

  const applyTheme = async (nextTheme: SlideMeshTheme) => {
    const next: SlideMeshSettings = {
      ...settingsRef.current,
      theme: nextTheme,
    };
    await applyLocal(next);
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    void persistToServer(next);
  };

  const applyOpacity = (forTheme: SlideMeshTheme, nextOpacity: number) => {
    const value = clampMeshOpacity(nextOpacity);
    const next: SlideMeshSettings = {
      ...settingsRef.current,
      opacity: { ...settingsRef.current.opacity, [forTheme]: value },
    };
    settingsRef.current = next;
    setOpacity(next.opacity);
    void setSlideMeshSettings(next);
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void persistToServer(next);
    }, 250);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#4A6CF7", fontWeight: "700" }}>← 내페이지</Text>
      </Pressable>
      <Text style={{ marginTop: 12, fontSize: 20, fontWeight: "900" }}>테스트 환경</Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
        5유형 슬라이드 카드 매쉬 색상·투명도를 선택합니다. 서버에 저장되어 앱·웹에 공통 적용됩니다.
      </Text>
      {saving ? (
        <Text style={{ marginTop: 6, fontSize: 12, color: "#4A6CF7" }}>서버 저장 중…</Text>
      ) : null}

      {loading ? (
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color="#4A6CF7" />
        </View>
      ) : (
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
                    <OpacityRangeSlider
                      value={opacity[opt.theme]}
                      onChange={(next) => applyOpacity(opt.theme, next)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
