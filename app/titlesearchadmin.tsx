import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text as RNText, TextInput as RNTextInput, ScrollView, View } from "react-native";
import { Posts, UIConfig, type Post } from "../lib/api";

const Text = ({ style, ...rest }: React.ComponentProps<typeof RNText>) => (
  <RNText {...rest} allowFontScaling={false} style={[{ color: "#111" }, style]} />
);

const TextInput = ({
  style,
  placeholderTextColor,
  ...rest
}: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput
    {...rest}
    allowFontScaling={false}
    placeholderTextColor={placeholderTextColor ?? "#666"}
    style={[{ color: "#111" }, style]}
  />
);

const normalizeQuery = (v: string) => (v || "").trim();

async function fetchPostsByIds(ids: number[]) {
  const out: Post[] = [];
  const BATCH = 15;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map((id) => Posts.get(Number(id))));
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value) out.push(r.value);
    });
  }
  // id 순서 유지
  const byId = new Map<number, Post>(out.map((p) => [Number(p.id), p]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Post[];
}

export default function TitleSearchAdmin() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadingRef = useRef(false);

  const [enabled, setEnabled] = useState(true);
  const [recommended, setRecommended] = useState<Post[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Post[]>([]);

  const recommendedIds = useMemo(
    () =>
      Array.from(
        new Set(
          (recommended || [])
            .map((p) => Number((p as any)?.id))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      ),
    [recommended],
  );

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await UIConfig.get();
      if (res.status !== 0) {
        Alert.alert("오류", "설정을 불러올 수 없습니다.");
        return;
      }
      const ts = (res.config as any)?.title_search ?? {};
      setEnabled(Boolean(ts?.enabled ?? true));
      const idsRaw = Array.isArray(ts?.recommended_post_ids) ? ts.recommended_post_ids : [];
      const ids = Array.from(
        new Set<number>(
          (idsRaw as any[])
            .map((v) => Number(v))
            .filter((n): n is number => Number.isFinite(n) && n > 0),
        ),
      );

      if (ids.length === 0) {
        setRecommended([]);
        return;
      }
      const posts = await fetchPostsByIds(ids);
      setRecommended(posts);
    } catch (e) {
      Alert.alert("오류", "설정을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSearch = useCallback(async () => {
    const q = normalizeQuery(searchText);
    if (!q) {
      Alert.alert("알림", "제목 검색어를 입력하세요.");
      return;
    }
    try {
      setSearching(true);
      const res = await Posts.searchTitle(q, { post_type: 1, status: "published", limit: 50 });
      setSearchResults(res.items ?? []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "검색에 실패했습니다.";
      Alert.alert("검색 실패", detail);
    } finally {
      setSearching(false);
    }
  }, [searchText]);

  const onAddFromSearch = useCallback(
    (post: Post) => {
      const id = Number((post as any)?.id);
      if (!Number.isFinite(id) || id <= 0) return;
      if (recommendedIds.includes(id)) {
        Alert.alert("알림", "이미 추가된 게시글입니다.");
        return;
      }
      setRecommended((prev) => [...prev, post]);
    },
    [recommendedIds],
  );

  const onRemove = useCallback((id: number) => {
    setRecommended((prev) => prev.filter((p) => Number(p.id) !== Number(id)));
  }, []);

  const onMove = useCallback((index: number, direction: "up" | "down") => {
    setRecommended((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const currentItem = next[index];
      next[index] = next[target];
      next[target] = currentItem;
      return next;
    });
  }, []);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const current = await UIConfig.get();
      const nextConfig = {
        ...current.config,
        title_search: {
          enabled: !!enabled,
          recommended_post_ids: recommendedIds,
        },
      } as any;

      const res = await UIConfig.update(nextConfig);
      if (res.status !== 0) {
        Alert.alert("오류", "저장에 실패했습니다.");
        return;
      }
      Alert.alert("저장 완료", "제목검색 추천현장이 저장되었습니다.");
      router.back();
    } catch (e) {
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [enabled, recommendedIds, saving]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#000",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", marginBottom: 10 }}>제목검색 추천현장 관리</Text>

          <Pressable
            onPress={() => setEnabled((p) => !p)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#000",
              backgroundColor: enabled ? "#2F6BFF" : "#f2f2f2",
              marginBottom: 10,
            }}
          >
            <Text style={{ fontWeight: "900", color: enabled ? "#fff" : "#111" }}>
              추천현장 노출: {enabled ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <Text style={{ fontWeight: "900", marginBottom: 6 }}>제목 검색으로 추가</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="예: 반포래미안"
              returnKeyType="search"
              onSubmitEditing={onSearch}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: "#000",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: "#fff",
              }}
            />
            <Pressable
              onPress={onSearch}
              disabled={saving || searching}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#000",
                backgroundColor: saving || searching ? "#ddd" : "#FFF6D2",
              }}
            >
              <Text style={{ fontWeight: "900" }}>{searching ? "검색중" : "검색"}</Text>
            </Pressable>
          </View>

          {(searchResults || []).length > 0 ? (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontWeight: "900", marginBottom: 8 }}>검색 결과</Text>
              {(searchResults || []).map((p) => {
                const id = Number((p as any)?.id);
                const already = recommendedIds.includes(id);
                return (
                  <View
                    key={`sr_${String(p.id)}`}
                    style={{
                      borderWidth: 1,
                      borderColor: "#000",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      backgroundColor: "#fff",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons name="search" size={18} color="#2F6BFF" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900" }} numberOfLines={2}>
                          {p.title}
                        </Text>
                        <Text style={{ marginTop: 4, color: "#666", fontWeight: "700" }}>ID: {String(p.id)}</Text>
                      </View>
                      <Pressable
                        onPress={() => onAddFromSearch(p)}
                        disabled={saving || already}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#000",
                          backgroundColor: saving ? "#eee" : already ? "#eee" : "#EAF0FF",
                          opacity: already ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: "900" }}>{already ? "추가됨" : "추가"}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {loading ? <ActivityIndicator style={{ marginTop: 10, marginBottom: 10 }} /> : null}

          <Text style={{ fontWeight: "900", marginBottom: 10 }}>
            현재 추천현장: {recommended.length}개
          </Text>

          {(recommended || []).map((p, index) => {
            const isFirst = index === 0;
            const isLast = index === recommended.length - 1;
            return (
              <View
                key={String(p.id)}
                style={{
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                  backgroundColor: "#fff",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="document-text-outline" size={18} color="#2F6BFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "900" }} numberOfLines={2}>
                      {p.title}
                    </Text>
                    <Text style={{ marginTop: 4, color: "#666", fontWeight: "700" }}>
                      ID: {String(p.id)}
                    </Text>
                  </View>

                  <View style={{ gap: 4 }}>
                    <Pressable
                      onPress={() => onMove(index, "up")}
                      disabled={saving || isFirst}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#000",
                        backgroundColor: saving || isFirst ? "#eee" : "#EAF0FF",
                        opacity: isFirst ? 0.7 : 1,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontWeight: "900" }}>↑</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onMove(index, "down")}
                      disabled={saving || isLast}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#000",
                        backgroundColor: saving || isLast ? "#eee" : "#EAF0FF",
                        opacity: isLast ? 0.7 : 1,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontWeight: "900" }}>↓</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => onRemove(Number(p.id))}
                    disabled={saving}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#000",
                      backgroundColor: saving ? "#eee" : "#ffe5e5",
                    }}
                  >
                    <Text style={{ fontWeight: "900" }}>삭제</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={onSave}
            disabled={saving || loading}
            style={{
              marginTop: 6,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: saving || loading ? "#aaa" : "#2F6BFF",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#000",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>저  장</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

