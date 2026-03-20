import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, RefreshControl, Text as RNText, View } from "react-native";
import ScrollNavigator from "../components/ScrollNavigator";
import BottomBar from "../components/ui/BottomBar";
import PostCard from "../components/ui/postcard";
import type { Post } from "../lib/api";
import { Posts } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function LikedPostsScreen() {
  const [storedIsLogin, setStoredIsLogin] = useState(false);
  const [storedUsername, setStoredUsername] = useState<string | null>(null);
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const listRef = useRef<FlatList>(null);
  const BOTTOM_BAR_HEIGHT = 61;
  // 파란띠 높이 통일(list/like/customlike 공통)
  const HEADER_HEIGHT = 22;
  const HEADER_COLOR = "#2F6BFF";
  // list.tsx 파란띠 텍스트 기준
  const HEADER_FONT_SIZE = 15;
  const HEADER_FONT_WEIGHT = "800" as const;
  const HEADER_LINE_HEIGHT = Math.ceil(HEADER_FONT_SIZE * 1.25);

  const HeaderText = (
    <Text
      allowFontScaling={false}
      style={{
        fontSize: HEADER_FONT_SIZE,
        lineHeight: HEADER_LINE_HEIGHT,
        color: "#FFFFFF",
        fontWeight: HEADER_FONT_WEIGHT,
        textAlign: "center",
        zIndex: 2,
        includeFontPadding: false,
      }}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      ※ '관 심 현 장' 을 보고 계십니다.
    </Text>
  );

  const fetchLikedPosts = useCallback(async (username: string, next?: string) => {
    if (!username) return;
    setLoading(true);
    try {
      const { items: fetched = [], next_cursor } = await Posts.listLiked({ username, cursor: next, limit: 10 });

      const withLikedFlag = fetched.map((p: Post) => ({
        ...p,
        liked: true,
      }));

      setItems((prev) => {
        const byId = new Map<number, Post>();
        (next ? [...prev, ...withLikedFlag] : withLikedFlag).forEach((p: Post) => {
          byId.set(p.id, p);
        });
        return Array.from(byId.values());
      });
      setCursor(next_cursor ?? null);
    } catch (err: any) {
      const status = err?.response?.status;
      console.error("관심현장 로드 실패:", err?.response?.data ?? err?.message ?? err);
      if (status === 401) {
        Alert.alert("세션 만료", "로그인이 만료되었습니다. 다시 로그인해주세요.", [
          { text: "확인", onPress: () => router.push("/login") },
        ]);
        return;
      }
      Alert.alert("오류", "관심현장을 불러오는 데 실패했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (storedIsLogin && storedUsername) {
      await fetchLikedPosts(storedUsername);
    }
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const s = await getSession();
        if (!alive) return;
        setStoredIsLogin(s.isLogin);
        setStoredUsername(s.isLogin ? s.username : null);
        setItems([]);
        setCursor(null);
        if (s.isLogin && s.username) {
          await fetchLikedPosts(s.username);
        }
      })();
      return () => {
        alive = false;
      };
    }, [fetchLikedPosts])
  );

  const loadMore = async () => {
    if (loading) return;
    if (!cursor) return;
    if (!storedIsLogin || !storedUsername) return;
    await fetchLikedPosts(storedUsername, cursor);
  };

  const getMetrics = useCallback(() => ({
    contentHeight,
    layoutHeight,
  }), [contentHeight, layoutHeight]);

  if (!storedIsLogin || !storedUsername) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View
          style={{
            height: HEADER_HEIGHT,
            backgroundColor: HEADER_COLOR,
            alignItems: "flex-start",
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          {HeaderText}
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "gray" }}>
            로그인 후 관심현장을 확인할 수 있습니다.
          </Text>
        </View>
        <BottomBar
          onToggleMapSearch={() =>
            router.push({ pathname: "/list", params: { openMap: "1" } })
          }
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          height: HEADER_HEIGHT,
          backgroundColor: HEADER_COLOR,
          alignItems: "flex-start",
          justifyContent: "center",
          paddingHorizontal: 16,
        }}
      >
        {HeaderText}
      </View>

      <View style={{ flex: 1 }}>
        {loading && items.length === 0 ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => String(item.id)}
            onContentSizeChange={(_, h) => {
              setContentHeight(h);
            }}
            onLayout={(e) => {
              setLayoutHeight(e.nativeEvent.layout.height);
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1, backgroundColor: "#fff", paddingHorizontal: 10, paddingTop: 3 }}
            contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + 2 }}
            renderItem={({ item }) =>
              <View style={{
                backgroundColor: "#fff",
                borderRadius: 15,
                marginBottom: 4,
                overflow: 'hidden',
                padding: 1,
                borderWidth: 1,
                borderColor: "black",
              }}
              >
                <PostCard post={item} />
              </View>
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}

            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              !loading ? (
                <Text style={{ textAlign: "center", marginTop: 60, color: "#777", fontWeight: "bold" }}>
                  관심 등록한 현장이 없습니다.
                </Text>
              ) : null
            }
            ListFooterComponent={
              loading && items.length > 0 ? <ActivityIndicator style={{ margin: 20 }} /> : null
            }
          />
        )}
      </View>
      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() =>
          listRef.current?.scrollToOffset({
            offset: 0,
            animated: true,
          })
        }
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
        onToggleMapSearch={() =>
          router.push({ pathname: "/list", params: { openMap: "1" } })
        }
      />
    </View>
  );
}
