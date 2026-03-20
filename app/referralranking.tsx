import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Referral, type ReferralRankingItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function ReferralRankingScreen() {
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
    }),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReferralRankingItem[]>([]);

  const maskNickname = (value: string) => {
    const chars = Array.from(String(value ?? ""));
    if (chars.length <= 2) return chars.join("");
    return `${chars.slice(0, 2).join("")}${"*".repeat(chars.length - 2)}`;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await Referral.ranking();
        if (res.status === 0) setItems(res.items ?? []);
        else setItems([]);
      } catch (e) {
        console.warn(e);
        Alert.alert("오류", "추천인 랭킹을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          추천인 랭킹
        </Text>
      </View>

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
            <Text style={{ color: colors.subText }}>랭킹 데이터가 없습니다.</Text>
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
            {/* 헤더: 닉네임 / 추천인 */}
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
              <Text style={{ width: 54, color: colors.primary, fontSize: 13, fontWeight: "900" }}>
                등수
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
                추천인
              </Text>
            </View>

            {items.map((it, idx) => (
              <View
                key={`${it.rank}-${it.nickname}-${it.referral_count}`}
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
                  <Text style={{ width: 54, color: colors.text, fontSize: 15, fontWeight: "700" }}>
                    {it.rank}등
                  </Text>
                  <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" }}>
                    {maskNickname(it.nickname)}
                  </Text>
                  <Text style={{ width: 90, textAlign: "right", color: colors.text, fontSize: 15, fontWeight: "700" }}>
                    {Number(it.referral_count ?? 0)}명
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

