import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Stats, type TodayStatusResponse } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

function StatLine({
  label,
  value,
  color,
  valueColor,
  isLast,
}: {
  label: string;
  value: string;
  color: string;
  valueColor: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "rgba(0,0,0,0.08)",
      }}
    >
      <Text style={{ fontSize: 14, color, fontWeight: "800", flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "900", color: valueColor }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function TodayStatusScreen() {
  const insets = useSafeAreaInsets();
  const BOTTOM_BAR_HEIGHT = 61;

  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(() => ({ contentHeight, layoutHeight }), [contentHeight, layoutHeight]);

  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      primary: "#4A6CF7",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStatus, setTodayStatus] = useState<TodayStatusResponse | null>(null);

  const load = useCallback(async () => {
    const res = await Stats.today();
    setTodayStatus(res);
    return res;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  // 주기 갱신(가벼운 집계 API)
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        await load();
      } catch {
        // ignore
      }
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshing]);

  const dateText = todayStatus?.date ? `(${todayStatus.date})` : "";
  const totalUsers = String(todayStatus?.total_users ?? "-");
  const newUsers = String(todayStatus?.new_users ?? "-");
  // 방문자수 집계 기준: 팝업 "오늘 다시 보이지 않기" 클릭 시 서버 popup_last_seen_at 갱신
  const totalVisitors = String(todayStatus?.total_visitors ?? "-");
  const todayVisitors = String(todayStatus?.today_visitors ?? "-");
  const totalJobPosts = String(todayStatus?.total_job_posts ?? "-");
  const todayJobPosts = String(todayStatus?.today_job_posts ?? "-");
  const totalAdPosts = String(todayStatus?.total_ad_posts ?? "-");
  const todayAdPosts = String(todayStatus?.today_ad_posts ?? "-");
  const totalChatPosts = String(todayStatus?.total_chat_posts ?? "-");
  const todayChatPosts = String(todayStatus?.today_chat_posts ?? "-");

  const lines = useMemo(
    () => [
      { label: "전체 회원", value: totalUsers },
      { label: "오늘 신규회원", value: newUsers },
      { label: "전체 방문자수", value: totalVisitors },
      { label: "오늘 방문자수", value: todayVisitors },
      { label: "전체 구인글", value: totalJobPosts },
      { label: "오늘 구인글", value: todayJobPosts },
      { label: "전체 광고글", value: totalAdPosts },
      { label: "오늘 광고글", value: todayAdPosts },
      { label: "전체 수다글", value: totalChatPosts },
      { label: "오늘 수다글", value: todayChatPosts },
    ],
    [
      totalUsers,
      newUsers,
      totalVisitors,
      todayVisitors,
      totalJobPosts,
      todayJobPosts,
      totalAdPosts,
      todayAdPosts,
      totalChatPosts,
      todayChatPosts,
    ]
  );

  const pairs = useMemo(() => {
    const out: Array<{ a: { label: string; value: string }; b: { label: string; value: string } }> = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i] && lines[i + 1]) out.push({ a: lines[i], b: lines[i + 1] });
    }
    return out;
  }, [lines]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>오늘의 현황</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: colors.subText }}>{dateText}</Text>
              </View>
            </View>

            <Pressable
              onPress={onRefresh}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: "#f8f9fa",
                borderWidth: 1,
                borderColor: "#ddd",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {refreshing ? <ActivityIndicator size="small" /> : <Ionicons name="refresh" size={16} color={colors.text} />}
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>새로고침</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 12, height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />

          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              {pairs.map((p, idx) => (
                <View
                  key={`${p.a.label}-${p.b.label}`}
                  style={{
                    marginTop: idx === 0 ? 0 : 10,
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                  }}
                >
                  <StatLine label={p.a.label} value={p.a.value} color="#111" valueColor="#111" />
                  <StatLine label={p.b.label} value={p.b.value} color="#2563EB" valueColor="#2563EB" isLast />
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

