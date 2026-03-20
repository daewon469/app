import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Pressable, Text as RNText, TextInput as RNTextInput, TouchableOpacity, View } from "react-native";
import ScrollNavigator from "../components/ScrollNavigator";
import BottomBar from "../components/ui/BottomBar";
import PostCard2 from "../components/ui/postcard2";
import { Posts, UIConfig, type Post } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recommendedEnabled, setRecommendedEnabled] = useState(true);
  const [recommendedItems, setRecommendedItems] = useState<Post[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [storedIsLogin, setStoredIsLogin] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const listRef = useRef<FlatList>(null);
  const BOTTOM_BAR_HEIGHT = 61;
  
  React.useEffect(() => {
    (async () => {
      const isLoginStr = await SecureStore.getItemAsync("isLogin");
      setStoredIsLogin(isLoginStr === "true");
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        setLoadingRecommended(true);
        const res = await UIConfig.get();
        if (res.status !== 0) return;
        const ts = (res.config as any)?.title_search ?? {};
        const enabled = Boolean(ts?.enabled ?? true);
        setRecommendedEnabled(enabled);
        if (!enabled) {
          setRecommendedItems([]);
          return;
        }
        const idsRaw = Array.isArray(ts?.recommended_post_ids) ? ts.recommended_post_ids : [];
        const ids = Array.from(
          new Set<number>(
            (idsRaw as any[])
              .map((v) => Number(v))
              .filter((n): n is number => Number.isFinite(n) && n > 0),
          ),
        );
        if (ids.length === 0) {
          setRecommendedItems([]);
          return;
        }
        // 너무 많은 ID가 있어도 터지지 않도록 배치로 로딩
        const out: Post[] = [];
        const BATCH = 15;
        for (let i = 0; i < ids.length; i += BATCH) {
          const slice = ids.slice(i, i + BATCH);
          const results = await Promise.allSettled(slice.map((id: number) => Posts.get(Number(id))));
          results.forEach((r) => {
            if (r.status === "fulfilled" && r.value) out.push(r.value);
          });
        }
        const byId = new Map<number, Post>(out.map((p) => [Number(p.id), p]));
        setRecommendedItems(ids.map((id) => byId.get(id)).filter(Boolean) as Post[]);
      } catch {
        // ignore
      } finally {
        setLoadingRecommended(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (!query.trim()) {
      setHasSearched(false);
      setItems([]);
    }
  }, [query]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return Alert.alert("알림", "검색어를 입력하세요.");

    setHasSearched(true);
    setLoading(true);
    try {
      let cursor: string | undefined = undefined;
      const all: Post[] = [];

   
      while (true) {
        const { items: fetched = [], next_cursor } = await Posts.list({
          status: "published",
          cursor,
        });
        all.push(...fetched);
        if (!next_cursor) break;
        cursor = next_cursor;
      }
      
      const lower = q.toLowerCase();
      const filtered = all.filter(
        (p) => (p.title ?? "").toLowerCase().includes(lower)
      );

      console.log("SEARCH_RESULT", q, filtered.length, filtered[0]);
      setItems(filtered);
    } catch (err) {
      console.error("검색 실패:", err);
      Alert.alert("오류", "검색 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getMetrics = useCallback(() => ({
    contentHeight,
    layoutHeight,
  }), [contentHeight, layoutHeight]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "white",
          borderWidth: 1,
          borderColor: "black",
          borderRadius: 8,
          paddingHorizontal: 8,
          alignItems: "center",
          marginHorizontal: 10,
          marginTop: 10,
          marginBottom: 10,
        }}
      >
        <TextInput
          style={{ flex: 1, height: 45, fontSize: 16 ,color: "black", }}
          placeholder="제목 검색"
          placeholderTextColor="#999"    
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={handleSearch}
          
          style={{
            backgroundColor: "#4A6CF7",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>검색</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

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
        style={{ flex: 1, backgroundColor: "#fff", paddingHorizontal: 10, paddingTop: 0 }}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + 2 }}
        ListHeaderComponent={
          !query.trim() ? (
            <View style={{ paddingBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111" }}>추천 현장</Text>
                {loadingRecommended ? <ActivityIndicator /> : null}
              </View>
              {!recommendedEnabled ? (
                <Text style={{ color: "#666", fontSize: 14 }}>추천 현장 노출이 꺼져있습니다.</Text>
              ) : recommendedItems.length === 0 ? (
                <Text style={{ color: "#666", fontSize: 14 }}>등록된 추천 현장이 없습니다.</Text>
              ) : (
                recommendedItems.map((item) => (
                  <View
                    key={`rec_${String(item.id)}`}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      marginBottom: 6,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "black",
                    }}
                  >
                    <GuardedTouch
                      enabled={!Boolean(storedIsLogin)}
                      onRequireLogin={() => Alert.alert("알림", "로그인이 필요합니다.")}
                    >
                      <PostCard2 post={item} />
                    </GuardedTouch>
                  </View>
                ))
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              marginBottom: 6,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "black",
            }}
          >
            <GuardedTouch
              enabled={!Boolean(storedIsLogin)}
              onRequireLogin={() => Alert.alert("알림", "로그인이 필요합니다.")}
            >
              <PostCard2 post={item} />
            </GuardedTouch>
          </View>
        )}
        ListEmptyComponent={
          !loading && hasSearched ? (
            <Text
              style={{
                textAlign: "center",
                marginTop: 40,
                color: "black",
                fontSize: 16,
              }}
            >
              검색 결과가 없습니다.
            </Text>
          ) : null
        }
      />
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
            offset: Math.max(
              contentHeight - layoutHeight,
              0
            ),
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

function GuardedTouch({
  enabled,
  children,
  onRequireLogin,
}: {
  enabled: boolean;
  children: React.ReactNode;
  onRequireLogin?: () => void;
}) {
  return (
    <View style={{ position: "relative" }}>
      <View pointerEvents={enabled ? "none" : "auto"}>
        {children}
      </View>

      {enabled ? (
        <Pressable
          onPress={onRequireLogin}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          }}
        />
      ) : null}
    </View>
  );
}
