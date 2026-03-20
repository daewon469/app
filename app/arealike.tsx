import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Pressable, RefreshControl, Text as RNText, View } from "react-native";
import ScrollNavigator from "../components/ScrollNavigator";
import BottomBar from "../components/ui/BottomBar";
import PostCard from "../components/ui/postcard";
import { Auth, Posts, type Post } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const parseAreaCodesToPostListParams = (codes: string[]) => {
  const cleaned = uniq((codes || []).map((s) => String(s ?? "").trim()).filter(Boolean));
  const hasNationwide = cleaned.includes("전체");
  if (hasNationwide) {
    // 전국: 서버에서 province/city/regions를 주지 않으면 전국 조회
    return { province: undefined as string | undefined, city: undefined as string | undefined, regions: undefined as string | undefined };
  }

  if (cleaned.length <= 0) {
    return { province: undefined, city: undefined, regions: undefined };
  }

  if (cleaned.length === 1) {
    const one = cleaned[0];
    const parts = one.split(" ").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { province: one, city: undefined, regions: undefined };
    return { province: parts[0], city: parts.slice(1).join(" "), regions: undefined };
  }

  return { province: undefined, city: undefined, regions: cleaned.join(",") };
};

export default function AreaLikeScreen() {
  const [storedIsLogin, setStoredIsLogin] = useState(false);
  const [storedUsername, setStoredUsername] = useState<string | null>(null);
  const [hasAreaConditions, setHasAreaConditions] = useState(false);
  const [conditionsLoading, setConditionsLoading] = useState(false);
  const [conditionsChecked, setConditionsChecked] = useState(false);
  const [areaCodes, setAreaCodes] = useState<string[]>([]);

  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const listRef = useRef<FlatList>(null);
  const BOTTOM_BAR_HEIGHT = 61;

  // 파란띠 높이 통일(list/like/customlike/arealike 공통)
  const HEADER_HEIGHT = 22;
  const HEADER_COLOR = "#2F6BFF";
  const HEADER_FONT_SIZE = 15;
  const HEADER_FONT_WEIGHT = "800" as const;
  const HEADER_LINE_HEIGHT = Math.ceil(HEADER_FONT_SIZE * 1.25);

  const HeaderBar = (
    <View style={{ position: "relative", width: "100%", paddingHorizontal: 16, justifyContent: "center" }}>
      <Text
        allowFontScaling={false}
        style={{
          color: "#FFFFFF",
          fontWeight: HEADER_FONT_WEIGHT,
          fontSize: HEADER_FONT_SIZE,
          lineHeight: HEADER_LINE_HEIGHT,
          textAlign: "left",
          zIndex: 2,
          includeFontPadding: false,
          paddingRight: 106,
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        ※ '지 역 저 장' 을 보고 계십니다.
      </Text>
      <Pressable
        onPress={() => router.push("/areasite")}
        hitSlop={8}
        style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: "#fff",
            fontSize: HEADER_FONT_SIZE,
            fontWeight: HEADER_FONT_WEIGHT,
            lineHeight: HEADER_LINE_HEIGHT,
            includeFontPadding: false,
          }}
        >
          지역설정 하기
        </Text>
      </Pressable>
    </View>
  );

  const fetchAreaPosts = useCallback(
    async (username: string, codes: string[], next?: string) => {
      setLoading(true);
      try {
        const { province, city, regions } = parseAreaCodesToPostListParams(codes);
        const { items: fetched = [], next_cursor } = await Posts.list({
          username,
          cursor: next || undefined,
          limit: 10,
          status: "published",
          province,
          city,
          regions,
        });

        setItems((prev) => {
          const byId = new Map<number, Post>();
          (next ? [...prev, ...fetched] : fetched).forEach((p: Post) => byId.set(p.id, p));
          return Array.from(byId.values());
        });
        setCursor(next_cursor ?? null);
      } catch (err: any) {
        const status = err?.response?.status;
        console.error("지역저장 로드 실패:", err?.response?.data ?? err?.message ?? err);
        if (status === 401) {
          Alert.alert("세션 만료", "로그인이 만료되었습니다. 다시 로그인해주세요.", [
            { text: "확인", onPress: () => router.push("/login") },
          ]);
          return;
        }
        Alert.alert("오류", "지역저장을 불러오는 데 실패했어요.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const checkConditions = useCallback(async (username: string): Promise<{ ok: boolean; codes: string[] }> => {
    try {
      const res = await Auth.getUser(username);
      const regs = (res as any)?.user?.area_region_codes ?? [];
      const codes = uniq((regs || []).map((s: any) => String(s ?? "").trim()).filter(Boolean));
      const has = Array.isArray(codes) && codes.length > 0;
      return { ok: has, codes: codes as string[] };
    } catch {
      return { ok: false, codes: [] };
    }
  }, []);

  const reloadAll = useCallback(async () => {
    const s = await getSession();
    setStoredIsLogin(s.isLogin);
    setStoredUsername(s.username);
    setItems([]);
    setCursor(null);

    if (!s.isLogin || !s.username) {
      setHasAreaConditions(false);
      setAreaCodes([]);
      setConditionsChecked(true);
      return;
    }

    setConditionsLoading(true);
    try {
      const { ok, codes } = await checkConditions(s.username);
      setHasAreaConditions(ok);
      setAreaCodes(codes);
      setConditionsChecked(true);
      if (!ok) return;
      await fetchAreaPosts(s.username, codes);
    } finally {
      setConditionsLoading(false);
    }
  }, [checkConditions, fetchAreaPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (!alive) return;
        await reloadAll();
      })();
      return () => {
        alive = false;
      };
    }, [reloadAll])
  );

  const loadMore = async () => {
    if (loading) return;
    if (!cursor) return;
    if (!storedIsLogin || !storedUsername) return;
    if (!hasAreaConditions) return;
    await fetchAreaPosts(storedUsername, areaCodes, cursor);
  };

  const getMetrics = useCallback(
    () => ({
      contentHeight,
      layoutHeight,
    }),
    [contentHeight, layoutHeight]
  );

  if (!storedIsLogin) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ height: HEADER_HEIGHT, backgroundColor: HEADER_COLOR, alignItems: "center", justifyContent: "center" }}>
          {HeaderBar}
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "gray", textAlign: "center" }}>
            로그인 후 지역저장을 확인할 수 있습니다.
          </Text>
        </View>
        <BottomBar
          onToggleMapSearch={() => router.push({ pathname: "/list", params: { openMap: "1" } })}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ height: HEADER_HEIGHT, backgroundColor: HEADER_COLOR, alignItems: "center", justifyContent: "center" }}>
        {HeaderBar}
      </View>

      <View style={{ flex: 1 }}>
        {conditionsLoading && !conditionsChecked ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : !hasAreaConditions ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 18, gap: 12 }}>
            <Text style={{ textAlign: "center", color: "#555", fontWeight: "900", fontSize: 16, lineHeight: 22 }}>
              지역저장 조건이 없습니다.
              {"\n"}먼저 “지역저장 설정”에서 선호지역을 선택해주세요.
            </Text>
            <Pressable
              onPress={() => router.push("/areasite")}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: "#2F6BFF",
                borderWidth: 1,
                borderColor: "#000",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>지역저장 설정하러 가기</Text>
            </Pressable>
          </View>
        ) : loading && items.length === 0 ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => String(item.id)}
            onContentSizeChange={(_, h) => setContentHeight(h)}
            onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1, backgroundColor: "#fff", paddingHorizontal: 10, paddingTop: 3 }}
            contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + 2 }}
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 15,
                  marginBottom: 4,
                  overflow: "hidden",
                  padding: 1,
                  borderWidth: 1,
                  borderColor: "black",
                }}
              >
                <PostCard post={item} />
              </View>
            )}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              !loading ? (
                <Text style={{ textAlign: "center", marginTop: 60, color: "#777", fontWeight: "bold" }}>
                  지역저장에 해당하는 구인글이 없습니다.
                </Text>
              ) : null
            }
            ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator style={{ margin: 20 }} /> : null}
          />
        )}
      </View>

      {/* 지역설정 플로팅 버튼 (파란 배경, 하얀 글씨) */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 23,
          bottom: BOTTOM_BAR_HEIGHT + 14 + 80,
          zIndex: 80,
        }}
      >
        <Pressable
          onPress={() => router.push("/areasite")}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#2F6BFF",
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.25)",
            opacity: pressed ? 0.9 : 1,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          })}
          accessibilityRole="button"
          accessibilityLabel="지역저장 설정"
        >
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                textAlign: "center",
                fontWeight: "900",
                fontFamily: "PlusFont1",
                color: "#fff",
                fontSize: 13,
                lineHeight: 14,
                includeFontPadding: false,
                textShadowColor: "rgba(0,0,0,0.35)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }}
            >
              지역
            </Text>
            <Text
              style={{
                textAlign: "center",
                fontWeight: "900",
                fontFamily: "PlusFont1",
                color: "#fff",
                fontSize: 13,
                lineHeight: 14,
                includeFontPadding: false,
                marginTop: 0,
                textShadowColor: "rgba(0,0,0,0.35)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }}
            >
              설정
            </Text>
          </View>
        </Pressable>
      </View>

      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        onBottom={() =>
          listRef.current?.scrollToOffset({
            offset: Math.max(contentHeight - layoutHeight, 0),
            animated: true,
          })
        }
        bottomOffset={BOTTOM_BAR_HEIGHT + 2}
        topOffset={0}
        trackOpacity={0.6}
        thumbOpacity={1.0}
        barWidth={4}
      />

      <BottomBar
        onToggleMapSearch={() => router.push({ pathname: "/list", params: { openMap: "1" } })}
      />
    </View>
  );
}

