import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import ReferralBonusTable from "../components/ui/ReferralBonusTable";
import { Auth, Referral, type ReferralListItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function ReferralsScreen() {
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
      background: "#fff", // app 기본 배경(list.tsx 등과 동일)
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      divider: "rgba(0,0,0,0.12)",
      borderSoft: "rgba(0,0,0,0.12)",
      primary: "#4A6CF7",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReferralListItem[]>([]);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      Alert.alert("오류", "사용자 정보가 없습니다.");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        // "추천인 수" 기준을 referralranking.tsx와 동일하게: 서버 집계 referral_count 우선 사용
        const [listRes, summaryRes] = await Promise.allSettled([
          Referral.listByReferrer(String(username)),
          Auth.getMyPageSummary(String(username)),
        ]);

        const nextItems =
          listRes.status === "fulfilled" && listRes.value.status === 0 ? (listRes.value.items ?? []) : [];
        setItems(nextItems);

        const countFromList = nextItems.length;
        const countFromSummary =
          summaryRes.status === "fulfilled" && summaryRes.value.status === 0
            ? (typeof (summaryRes.value as any).referral_count === "number"
                ? (summaryRes.value as any).referral_count
                : typeof (summaryRes.value as any).referralCount === "number"
                  ? (summaryRes.value as any).referralCount
                  : null)
            : null;

        // 요약에 값이 없으면(undefined) 목록 길이로 폴백
        setReferralCount(countFromSummary ?? countFromList);
      } catch (e) {
        console.warn(e);
        Alert.alert("오류", "추천 회원 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

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
            padding: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              내가 추천한 회원
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
                총 {referralCount}명
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            marginTop: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            ※ 추천인 포인트 보너스 지급
          </Text>
          <View style={{ height: 10 }} />
          <ReferralBonusTable
            colors={{
              text: colors.text,
              subText: colors.subText,
              headerText: colors.primary,
              borderSoft: colors.borderSoft,
            }}
          />
        </View>

        <Text
          style={{
            marginTop: 8,
            textAlign: "center",
            color: colors.text,
            fontSize: 14,
            fontWeight: "700",
          }}
        >
          ※ 포인트는 유료전환 시 캐시처럼 사용됩니다.
        </Text>

        <View style={{ marginTop: 10 }}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
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
              <Text style={{ color: colors.subText }}>추천한 회원이 없습니다.</Text>
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
              {/* 표 헤더 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: "#f8f9fa",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <Text style={{ flex: 1, color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                  닉네임
                </Text>
                <Text style={{ width: 110, textAlign: "right", color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                  추천가입일
                </Text>
              </View>

              {items.map((it) => (
                <View
                  key={String(it.id)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: 1,
                    borderTopColor: colors.divider,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" }}>
                      {it.referred_username}
                    </Text>
                    <Text style={{ width: 110, textAlign: "right", color: colors.text, fontSize: 15, fontWeight: "600" }}>
                      {it.created_at ? it.created_at.slice(0, 10) : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
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

