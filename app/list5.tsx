import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text as RNText,
    View,
} from "react-native";
import type { Post } from "../lib/api";
import { Auth, Posts } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function NoticeList() {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const colors = {
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#ddd",
    primary: "#4A6CF7",
    subText: "#666",
  };

  const listCardStyle = {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.text,
    overflow: "hidden" as const,
  };

  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "";
    const s = String(iso);
    // 대부분 ISO8601: 2026-02-27T12:34:56... 또는 2026-02-27 12:34:56...
    const candidate = s.includes("T") ? s.replace("T", " ") : s;
    return candidate.length >= 16 ? candidate.slice(0, 16) : candidate.slice(0, 10);
  };

  const reload = useCallback(async () => {
    try {
      const s = await getSession();
      setIsLoggedIn(s.isLogin);
      setUsername(s.username);

      setLoading(true);
      const res = await Posts.listByType(5, {
        status: "published",
        // 서버(/community/posts/type/{post_type}) limit 상한이 100
        limit: 100,
      });
      setItems(res.items);
      // write5 → back 으로 돌아오면 "최신 글"이 바로 보이도록 1페이지로 리셋
      setCurrentPage(1);
    } catch (e) {
      console.log(e);
      Alert.alert("오류", "공지사항 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 진입 시 1회 로딩
  useEffect(() => {
    void reload();
  }, [reload]);

  // write5.tsx에서 back으로 돌아왔을 때 즉시 새로고침
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {};
    }, [reload])
  );

  useEffect(() => {
    (async () => {
      // 비로그인/토큰 없음이면 관리자 아님으로 간주
      if (!isLoggedIn || !username) {
        setIsAdmin(false);
        return;
      }

      try {
        setAdminLoading(true);
        const res = await Auth.getMyPageSummary(username);
        setIsAdmin(res.status === 0 && !!res.admin_acknowledged);
      } catch (e) {
        setIsAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    })();
  }, [isLoggedIn, username]);

  const renderRow = (post: Post) => (
    <Pressable
      key={post.id}
      onPress={() => router.push({ pathname: "/[id]", params: { id: String(post.id) } })}
    >
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          height: 32,
          justifyContent: "center",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
        }}
      >
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.text,
            marginRight: 8,
          }}
        />
        <Text
          style={{
            fontSize: 15,
            color: colors.text,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {post.title}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.subText,
            marginLeft: 8,
            width: 112,
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {formatDateTime(post.created_at)}
        </Text>
      </View>
    </Pressable>
  );

  const PageBar = () => (
    <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 16, gap: 8 }}>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Pressable
          key={page}
          onPress={() => setCurrentPage(page)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 6,
            backgroundColor: currentPage === page ? colors.primary : colors.card,
            borderWidth: 1,
            borderColor: "#000",
          }}
        >
          <Text style={{ color: currentPage === page ? "#fff" : colors.text, fontWeight: "600" }}>
            {page}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 12,
          paddingBottom: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text }}>
            공지사항
          </Text>

          {/* 관리자만 "글 작성" 버튼 노출 */}
          {!adminLoading && isLoggedIn && isAdmin ? (
            <Pressable
              onPress={() => router.push("/write5")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 16,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ fontSize: 13, color: "#fff", fontWeight: "600" }}>
                글 작성
              </Text>
            </Pressable>
          ) : null}
        </View>

        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        )}

        {!loading && paginatedItems.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.subText }}>
            등록된 공지사항이 없습니다.
          </Text>
        ) : (
          <View style={listCardStyle}>{paginatedItems.map(renderRow)}</View>
        )}

        {!loading && totalPages > 1 && <PageBar />}
      </ScrollView>
    </SafeAreaView>
  );
}

