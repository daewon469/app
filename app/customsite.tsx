import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, Text as RNText, TouchableOpacity, View } from "react-native";
import ScrollNavigator from "../components/ScrollNavigator";
import { Auth } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type RegionObj = { province: string; city: string };

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const regionObjToCode = (r: RegionObj): string => {
  const p = (r.province || "").trim();
  const c = (r.city || "").trim() || "전체";
  if (!p) return "";
  if (p === "전체") return "전체";
  if (c === "전체") return p;
  return `${p} ${c}`;
};

const regionCodeToObj = (code: string): RegionObj | null => {
  const v = (code || "").trim();
  if (!v) return null;
  if (v === "전체") return { province: "전체", city: "전체" };
  const parts = v.split(" ");
  if (parts.length === 1) return { province: parts[0], city: "전체" };
  return { province: parts[0], city: parts.slice(1).join(" ") || "전체" };
};

export default function CustomSiteSettingsScreen() {
  const params = useLocalSearchParams<{ username?: string }>();

  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [industries, setIndustries] = useState<string[]>([]);
  const [regions, setRegions] = useState<RegionObj[]>([]);
  // 모집(총괄/본부장/팀장/팀원/기타): 저장은 "대표 5종"만 유지
  const [roles, setRoles] = useState<string[]>([]);

  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(() => ({ contentHeight, layoutHeight }), [contentHeight, layoutHeight]);

  const ROLE_OPTIONS = useMemo(() => ["총괄", "본부장", "팀장", "팀원", "기타"] as const, []);
  const REGION_OPTIONS = useMemo(
    () =>
      [
        "전국",
        "서울",
        "경기",
        "인천",
        "강원",
        "제주",
        "부산",
        "울산",
        "대구",
        "광주",
        "대전",
        "세종",
        "경남",
        "경북",
        "전남",
        "전북",
        "충남",
        "충북",
      ] as const,
    []
  );
  const INDUSTRY_OPTIONS = useMemo(
    () =>
      [
        "아파트",
        "상가",
        "오피스",
        "오피스텔",
        "도시형생활주택",
        "레지던스",
        "호텔",
        "리조트",
        "지식산업센터",
        "타운하우스",
        "토지",
        "기타",
      ] as const,
    []
  );

  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#f9f9f9",
      text: "#000",
      subText: "#666",
      border: "#000",
      primary: "#4A6CF7",
      chipBg: "#fff",
    }),
    []
  );

  useEffect(() => {
    (async () => {
      const u = (params.username as string | undefined) || (await SecureStore.getItemAsync("username")) || null;
      setUsername(u);
      if (!u) return;

      try {
        setLoading(true);
        const res = await Auth.getUser(u);
        if (res.status !== 0 || !res.user) return;

        setIndustries(uniq((res.user.custom_industry_codes || []).map((s) => (s || "").trim()).filter(Boolean)));
        const parsed = (res.user.custom_region_codes || [])
          .map((s) => regionCodeToObj(String(s)))
          .filter(Boolean) as RegionObj[];
        // 빠른 선택 UI에 맞게: 시/군/구 단위는 시/도로 정규화(전국/전체는 그대로)
        const normalized = parsed.map((r) => {
          const p = (r.province || "").trim();
          if (!p) return r;
          if (p === "전체") return { province: "전체", city: "전체" };
          return { province: p, city: "전체" };
        });
        // 중복 제거
        setRegions(
          Array.from(
            new Map(normalized.map((r) => [`${r.province}__${r.city}`, r] as const)).values()
          )
        );
        setRoles(uniq((res.user.custom_role_codes || []).map((s) => String(s || "").trim()).filter(Boolean)));
      } catch {
        // 조용히 무시(네트워크 등)
      } finally {
        setLoading(false);
      }
    })();
  }, [params.username]);

  const regionCodes = useMemo(() => {
    return uniq(
      regions
        .map(regionObjToCode)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }, [regions]);

  const hasNationwide = useMemo(() => regions.some((r) => (r.province || "").trim() === "전체"), [regions]);
  const selectedProvinces = useMemo(() => {
    return uniq(
      regions
        .map((r) => ({ province: (r.province || "").trim(), city: (r.city || "").trim() || "전체" }))
        .filter((r) => !!r.province && r.province !== "전체")
        .map((r) => r.province)
    );
  }, [regions]);

  const toggleRegion = (label: (typeof REGION_OPTIONS)[number]) => {
    if (label === "전국") {
      setRegions((prev) => (prev.some((r) => (r.province || "").trim() === "전체") ? [] : [{ province: "전체", city: "전체" }]));
      return;
    }
    const province = label.trim();
    if (!province) return;
    setRegions((prev) => {
      const withoutAll = prev.filter((r) => (r.province || "").trim() !== "전체");
      const exists = withoutAll.some((r) => (r.province || "").trim() === province);
      const next = exists
        ? withoutAll.filter((r) => (r.province || "").trim() !== province)
        : [...withoutAll, { province, city: "전체" }];
      return Array.from(new Map(next.map((r) => [`${r.province}__${r.city}`, r] as const)).values());
    });
  };

  const toggleIndustry = (label: (typeof INDUSTRY_OPTIONS)[number]) => {
    const v = (label || "").trim();
    if (!v) return;
    setIndustries((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const resetAll = useCallback(() => {
    setIndustries([]);
    setRegions([]);
    setRoles([]);
  }, []);

  const save = async () => {
    if (!username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    try {
      setLoading(true);
      await Auth.updateUser(username, {
        custom_industry_codes: industries,
        custom_region_codes: regionCodes,
        custom_role_codes: roles,
      });
      Alert.alert("완료", "맞춤저장 설정이 저장되었습니다.", [{ text: "확인", onPress: () => router.back() }]);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "잠시 후 다시 시도해주세요.";
      Alert.alert("저장 실패", msg);
    } finally {
      setLoading(false);
    }
  };

  const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.chipBg,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={{ color: colors.subText, fontSize: 16, fontWeight: "900" }}>×</Text>
      </Pressable>
    </View>
  );

  const TableGrid = <T extends string>({
    items,
    columns,
    isActive,
    onToggle,
  }: {
    items: readonly T[];
    columns: number;
    isActive: (v: T) => boolean;
    onToggle: (v: T) => void;
  }) => {
    const rows = Math.max(1, Math.ceil(items.length / columns));
    const rowSlices = Array.from({ length: rows }, (_, i) => items.slice(i * columns, i * columns + columns));

    return (
      <View
        style={{
          marginTop: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#fff",
        }}
      >
        {rowSlices.map((slice, rowIdx) => (
          <View key={`row-${rowIdx}`}>
            <View style={{ flexDirection: "row" }}>
              {Array.from({ length: columns }, (_, colIdx) => {
                const v = slice[colIdx];
                const lastCol = colIdx === columns - 1;
                if (!v) {
                  return (
                    <View
                      key={`empty-${rowIdx}-${colIdx}`}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRightWidth: lastCol ? 0 : 1,
                        borderRightColor: colors.border,
                        backgroundColor: "#FFFFFF",
                      }}
                    />
                  );
                }
                const active = isActive(v);
                return (
                  <Pressable
                    key={v}
                    onPress={() => onToggle(v)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 6,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.primary : "#FFFFFF",
                      borderRightWidth: lastCol ? 0 : 1,
                      borderRightColor: colors.border,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ fontWeight: "900", color: active ? "#fff" : "#111", fontSize: 13 }}
                    >
                      {v}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {rowIdx !== rowSlices.length - 1 && <View style={{ height: 1, backgroundColor: colors.border }} />}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* 지역 / 업종 / 모집 / 저장하기: 하나의 카드로 묶음 */}
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#fff",
          }}
        >
          {/* 제목 + 우상단 닫기 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>맞춤저장 설정</Text>
              <Text style={{ color: "#aaa", fontSize: 11, fontWeight: "600" }}>(복수선택 가능)</Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: "#666", fontWeight: "700", fontSize: 14 }}>닫기</Text>
            </Pressable>
          </View>

          {/* 지역 */}
          <Text style={{ marginTop: 12, color: colors.text, fontSize: 15, fontWeight: "900" }}>
            지역{" "}
            <Text style={{ color: colors.subText, fontSize: 10, fontWeight: "500" }}>
              (복수선택 가능 / 미선택시 선택됨)
            </Text>
          </Text>
          <TableGrid
            items={REGION_OPTIONS}
            columns={6}
            isActive={(v) => (v === "전국" ? hasNationwide : selectedProvinces.includes(v))}
            onToggle={(v) => toggleRegion(v)}
          />

          {/* 업종 */}
          <Text style={{ marginTop: 14, color: colors.text, fontSize: 15, fontWeight: "900" }}>
            업종{" "}
            <Text style={{ color: colors.subText, fontSize: 10, fontWeight: "500" }}>
              (복수선택 가능 / 미선택시 선택됨)
            </Text>
          </Text>
          <TableGrid
            items={INDUSTRY_OPTIONS}
            columns={3}
            isActive={(v) => industries.includes(v)}
            onToggle={(v) => toggleIndustry(v)}
          />

          {/* 커스텀(리스트 외) 업종이 있으면 칩으로 노출 */}
          {industries.some((v) => !(INDUSTRY_OPTIONS as readonly string[]).includes(v)) && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: colors.subText, fontSize: 12, fontWeight: "800" }}>기타(저장된 값)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {industries
                  .filter((v) => !(INDUSTRY_OPTIONS as readonly string[]).includes(v))
                  .map((v) => (
                    <Chip key={v} label={v} onRemove={() => setIndustries((prev) => prev.filter((x) => x !== v))} />
                  ))}
              </View>
            </View>
          )}

          {/* 모집 */}
          <Text style={{ marginTop: 14, color: colors.text, fontSize: 15, fontWeight: "900" }}>
            모집{" "}
            <Text style={{ color: colors.subText, fontSize: 10, fontWeight: "500" }}>
              (복수선택 가능 / 미선택시 선택됨)
            </Text>
          </Text>
          <View
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#fff",
            }}
          >
            <View style={{ flexDirection: "row" }}>
              {ROLE_OPTIONS.map((r, idx) => {
                const active = roles.includes(r);
                const last = idx === ROLE_OPTIONS.length - 1;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.primary : "#FFFFFF",
                      borderRightWidth: last ? 0 : 1,
                      borderRightColor: colors.border,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: active ? "#fff" : "#111" }}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 저장하기 */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={resetAll}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#E0E0E0",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#111", fontWeight: "900", fontSize: 16 }}>초기화</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={save}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                {loading ? "저장 중..." : "저  장"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>

      {/* 커스텀 스크롤(우측 스크롤바 + 상/하 이동 버튼) */}
      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => scrollRef.current?.scrollTo?.({ y: 0, animated: true })}
        onBottom={() =>
          scrollRef.current?.scrollTo?.({
            y: Math.max(contentHeight - layoutHeight, 0),
            animated: true,
          })
        }
        bottomOffset={8}
        topOffset={0}
        trackOpacity={0.6}
        thumbOpacity={1.0}
        barWidth={4}
      />
    </View>
  );
}

