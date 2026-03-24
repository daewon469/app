// app/community-list.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text as RNText,
    View,
} from "react-native";
import type { Post } from "../lib/api";
import { Posts } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function CommunityList() {
  const colors = {
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#ddd",
    primary: "#4A6CF7",
    subText: "#666",
  };

  const formatPostDateTime = (d: any) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const date = dt.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
    const time = dt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${date} ${time}`;
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

  // 🔥 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15; // 15개씩
  const totalPages = Math.ceil(items.length / pageSize);

  // 🔥 현재 페이지의 15개 데이터
  const paginatedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await Posts.listByType(3, {
          status: "published",
          limit: 100, // 전체를 가져오되, 페이지네이션은 클라이언트에서 처리
        });
        setItems(res.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderPostCard = (post: Post) => (
    <Pressable
      key={post.id}
      onPress={() =>
        router.push({ pathname: "/[id]", params: { id: String(post.id) } })
      }
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
            fontWeight: "400",
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
          }}
          numberOfLines={1}
        >
          {formatPostDateTime((post as any)?.created_at)}
        </Text>
      </View>
    </Pressable>
  );

  const PageBar = () => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 16,
        gap: 8,
      }}
    >
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
            borderColor: colors.text,
          }}
        >
          <Text
            style={{
              color: currentPage === page ? "#fff" : colors.text,
              fontWeight: "600",
            }}
          >
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
        {/* 상단 헤더: 제목 + 글 작성 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text
            style={{ fontSize: 23, fontWeight: "bold", color: colors.text }}
          >
            분<Text style={{ fontSize: 16 }}>양인</Text> 수
            <Text style={{ fontSize: 16 }}>다</Text>
          </Text>

          <Pressable
            onPress={() => router.push("/write3")}
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
        </View>

        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        )}

        {!loading && paginatedItems.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.subText }}>
            등록된 커뮤니티 글이 없습니다.
          </Text>
        ) : (
          <View style={listCardStyle}>{paginatedItems.map(renderPostCard)}</View>
        )}

        {/* 🔥 페이지네이션 바 */}
        {!loading && totalPages > 1 && <PageBar />}
      </ScrollView>
    </SafeAreaView>
  );
}