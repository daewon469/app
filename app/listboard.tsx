import { Ionicons } from "@expo/vector-icons";
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
export default function NewBoard() {
  const colors = {
    // 앱 전반 톤과 맞춰 배경은 베이지
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

  const [news, setNews] = useState<Post[]>([]);
  const [community, setCommunity] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [newsRes, comRes] = await Promise.all([
          Posts.listByType(2, { status: "published", limit: 30 }),
          Posts.listByType(3, { status: "published", limit: 50 }),
        ]);
        setNews(newsRes.items.slice(0, 7));
        setCommunity(comRes.items.slice(0, 8));
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: colors.background,
        }}
      >

        {loading && (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        )}


        <View style={{ marginBottom: 0 }}>

          <View style={{
            marginBottom: 10,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <Text
              style={{
                fontSize: 23,
                fontWeight: "bold",
                color: colors.text,
              }}
            >
              분양 뉴스
            </Text>

            <Pressable
              onPress={() => router.push("/list2")}
              style={{
                paddingHorizontal: 6,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: colors.primary,
                  marginRight: 2,
                  fontWeight: "500",
                }}
              >
                더보기
              </Text>

              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {news.length === 0 && !loading ? (
            <Text style={{ fontSize: 13, color: colors.subText }}>
              아직 등록된 분양 뉴스가 없습니다.
            </Text>
          ) : (
            <View style={listCardStyle}>{news.map(renderNewsCard)}</View>
          )}
        </View>

        <View
          style={{
            backgroundColor: colors.border,
            marginVertical: 8,
          }}
        />
        <View style={{ marginTop: 12 }}>

          <View style={{
            marginBottom: 10,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          }}>

            <Text
              style={{
                fontSize: 23,
                fontWeight: "bold",
                color: colors.text,
              }}
            >
              분<Text style={{ fontSize: 16 }}>양인</Text> 수<Text style={{ fontSize: 16 }}>다</Text>
            </Text>

            <Pressable
              onPress={() => router.push("/list3")}
              style={{
                paddingHorizontal: 6,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: colors.primary,
                  marginRight: 2,
                  fontWeight: "500",
                }}
              >
                더보기
              </Text>

              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable></View>

          {community.length === 0 && !loading ? (
            <Text style={{ fontSize: 13, color: colors.subText }}>
              아직 등록된 커뮤니티 글이 없습니다.
            </Text>
          ) : (
            <View style={listCardStyle}>{community.map(renderPostCard)}</View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
