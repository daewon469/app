import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Referral, type ReferralNetworkItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

function formatDate(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function maskNickname(value: string) {
  const chars = Array.from(String(value ?? ""));
  if (chars.length <= 2) return chars.join("");
  return `${chars.slice(0, 2).join("")}${"*".repeat(chars.length - 2)}`;
}

export default function ReferralNetworkScreen() {
  const { username } = useLocalSearchParams<{ username?: string }>();
  const insets = useSafeAreaInsets();
  const BOTTOM_BAR_HEIGHT = 61;

  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(
    () => ({ contentHeight, layoutHeight }),
    [contentHeight, layoutHeight]
  );

  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      divider: "rgba(0,0,0,0.12)",
      primary: "#4A6CF7",
      success: "#1B8A3A",
      warn: "#B45309",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<ReferralNetworkItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [rewardGranted, setRewardGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "more") => {
      if (!username) {
        setLoading(false);
        setError("사용자 정보가 없습니다.");
        Alert.alert("오류", "사용자 정보가 없습니다.");
        return;
      }

      try {
        setError(null);
        if (mode === "initial") setLoading(true);
        else setLoadingMore(true);

        const res = await Referral.network(String(username), {
          limit: 50,
          cursor: mode === "more" ? nextCursor : null,
          max_depth: 20,
        });

        if (res.status !== 0) {
          throw new Error("서버 응답 오류");
        }

        setTotalCount(Number(res.total_count ?? 0));
        setRewardGranted(typeof res.reward?.granted === "boolean" ? res.reward.granted : null);
        setNextCursor(res.next_cursor ?? null);

        const nextItems = (res.items ?? []).filter(Boolean);
        setItems((prev) => (mode === "more" ? [...prev, ...nextItems] : nextItems));
      } catch (e) {
        console.warn(e);
        setError("인맥 목록을 불러오지 못했습니다.");
        Alert.alert("오류", "인맥 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [nextCursor, username]
  );

  useEffect(() => {
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const showReward = totalCount >= 100;
  const rewardText = rewardGranted ? "100만 포인트 지급 완료" : "100만 포인트 지급 대기";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      >
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 12, // 제목 카드 높이 축소
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            나의 추천인 인맥
          </Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "#EEF4FF",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
              총 {totalCount}명
            </Text>
          </View>
        </View>

        <Text
          style={{
            marginTop: 6,
            color: colors.text,
            fontSize: 14,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          👥 인맥 <Text style={{ color: colors.primary, fontWeight: "900" }}>100명</Text> 달성 시{" "}
          <Text style={{ color: "#DC2626", fontWeight: "900" }}>1,000,000p</Text> 지급 🎉
        </Text>

        {showReward && (
          <Text
            style={{
              marginTop: 6,
              textAlign: "right",
              color: rewardGranted ? colors.success : colors.warn,
              fontWeight: "900",
            }}
          >
            {rewardText}
          </Text>
        )}
      </View>

      <View style={{ marginTop: 10 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : error ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.subText, marginBottom: 10 }}>{error}</Text>
            <Pressable
              onPress={() => load("initial")}
              style={{
                alignSelf: "flex-start",
                backgroundColor: colors.primary,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#000",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>재시도</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.subText }}>아직 인맥이 없습니다.</Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* 헤더: 닉네임 / 인맥단계 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
                backgroundColor: "#F8F9FA",
              }}
            >
              <Text style={{ width: 18, color: colors.subText, fontSize: 13, fontWeight: "900" }}>
                {" "}
              </Text>
              <Text style={{ flex: 1, color: colors.primary, fontSize: 13, fontWeight: "900" }}>
                닉네임
              </Text>
              <Text
                style={{
                  width: 90,
                  textAlign: "right",
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: "900",
                }}
              >
                인맥단계
              </Text>
            </View>

            {items.map((it, idx) => (
              <View
                key={`${it.nickname}-${it.depth}-${idx}`}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.divider,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ width: 18, color: colors.text, fontSize: 13, fontWeight: "900" }}>
                    ※
                  </Text>
                  <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" }}>
                    {maskNickname(String(it.nickname ?? ""))}
                  </Text>
                  <Text style={{ width: 90, textAlign: "right", color: colors.text, fontSize: 15, fontWeight: "700" }}>
                    {Number(it.depth ?? 0)}단계
                  </Text>
                </View>

                {/* 서버가 날짜를 내려주면 표시(표 형식 유지 위해 작은 보조 텍스트) */}
                {!!formatDate(it.signup_date ?? it.created_at ?? null) && (
                  <Text style={{ marginTop: 4, marginLeft: 18, color: colors.subText, fontSize: 12, fontWeight: "600" }}>
                    가입일: {formatDate(it.signup_date ?? it.created_at ?? null)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {!loading && !error && nextCursor !== null && (
        <Pressable
          onPress={() => load("more")}
          disabled={loadingMore}
          style={{
            marginTop: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          {loadingMore ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: colors.primary, fontWeight: "900" }}>더 보기</Text>
          )}
        </Pressable>
      )}
      </Animated.ScrollView>

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
        bottomOffset={BOTTOM_BAR_HEIGHT + insets.bottom}
        topOffset={0}
        trackOpacity={0.6}
        thumbOpacity={1.0}
        barWidth={4}
      />
    </View>
  );
}

