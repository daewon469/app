// app/news-list.tsx
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

export default function NewsList() {
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
  const pageSize = 15;
  const totalPages = Math.ceil(items.length / pageSize);

  // 🔥 현재 페이지의 아이템 15개만 slice
  const paginatedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await Posts.listByType(2, {
          status: "published",
          limit: 100,
        });
        setItems(res.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderNewsCard = (post: Post) => (
    <Pressable
      key={post.id}
      onPress={() =>
        router.push({
          pathname: "/newswebview",
          params: { url: encodeURIComponent(post.agent || "") },
        })
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

  const PageBar = () => {
    if (totalPages <= 1) return null;

    const pagesPerGroup = 5;
    const pageGroup = Math.floor((currentPage - 1) / pagesPerGroup);
    const startPage = pageGroup * pagesPerGroup + 1;
    const endPage = Math.min(startPage + pagesPerGroup - 1, totalPages);

    const pageNumbers = [];
    for (let p = startPage; p <= endPage; p++) {
      pageNumbers.push(p);
    }

    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginTop: 16,
          gap: 6,
        }}
      >
        {/* 🔹 이전 그룹( < ) */}
        {pageGroup > 0 && (
          <Pressable
            onPress={() => setCurrentPage(startPage - 1)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.text,
            }}
          >
            <Text style={{ color: colors.text }}>{"<"}</Text>
          </Pressable>
        )}

        {/* 🔹 현재 그룹 5개의 번호 */}
        {pageNumbers.map((page) => (
          <Pressable
            key={page}
            onPress={() => setCurrentPage(page)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor:
                currentPage === page ? colors.primary : colors.card,
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

        {/* 🔹 다음 그룹( > ) */}
        {endPage < totalPages && (
          <Pressable
            onPress={() => setCurrentPage(endPage + 1)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.text,
            }}
          >
            <Text style={{ color: colors.text }}>{">"}</Text>
          </Pressable>
        )}
      </View>
    );
  };

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
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "bold",
              color: colors.text,
            }}
          >
            분양 뉴스
          </Text>
        </View>

        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        )}

        {!loading && paginatedItems.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.subText }}>
            등록된 분양 뉴스가 없습니다.
          </Text>
        ) : (
          <View style={listCardStyle}>{paginatedItems.map(renderNewsCard)}</View>
        )}

        {/* 🔥 페이지네이션 바 */}
        {!loading && totalPages > 1 && <PageBar />}
      </ScrollView>
    </SafeAreaView>
  );
}
