// app/list7.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { Posts } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function InquiryList7() {
  const colors = {
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#ddd",
    primary: "#4A6CF7",
    subText: "#666",
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "";
    const s = String(iso);
    const candidate = s.includes("T") ? s.replace("T", " ") : s;
    return candidate.length >= 16 ? candidate.slice(0, 16) : candidate.slice(0, 10);
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

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await Posts.listByType(7, {
          status: "published",
          limit: 100,
        });
        setItems(res.items);
      } catch (e) {
        console.log(e);
        Alert.alert("오류", "분양대행 문의 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderRow = (post: Post) => (
    <Pressable key={post.id} onPress={() => router.push({ pathname: "/[id]", params: { id: String(post.id) } })}>
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
        <Text style={{ fontSize: 15, color: colors.text, flex: 1 }} numberOfLines={1}>
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text }}>분양대행 문의 확인</Text>
        </View>

        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        )}

        {!loading && paginatedItems.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.subText }}>등록된 분양대행 문의가 없습니다.</Text>
        ) : (
          <View style={listCardStyle}>{paginatedItems.map(renderRow)}</View>
        )}

        {!loading && totalPages > 1 && <PageBar />}
      </ScrollView>
    </SafeAreaView>
  );
}

