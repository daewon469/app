import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text as RNText, View } from "react-native";
import { Card } from "react-native-paper";
import type { Post } from "../../lib/api";
import { Posts } from "../../lib/api";
import { getSession } from "../../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  postType?: 2 | 3;
  title?: string;
  moreHref?: "/list2" | "/list3" | "/listboard";
};

export default function NewsPreviewSection({
  postType = 2,
  title = "분양 뉴스",
  moreHref = "/list2",
}: Props) {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const colors = {
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#333",
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

  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { items } = await Posts.listByType(postType, {
          status: "published",
        });
        setItems(items.slice(0, 3));
      } finally {
        setLoading(false);
      }
    })();
  }, [postType]);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      setIsLogin(s.isLogin);
      setUsername(s.username);
    })();
  }, []);

  if (loading && items.length === 0) {
    return (
      <View style={{ paddingVertical: 0 }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={() => {
        if (!isLogin || !username) {
          Alert.alert("알림", "로그인이 필요합니다.");
          return;
        }
        router.push(moreHref);
      }}
      style={{
        marginHorizontal: 0,
        marginTop: 0,
        marginBottom: 0,
      }}
    >
      <Card
        mode="elevated"
        style={{
          borderRadius: 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content
          style={{
            paddingTop: 0,
            paddingBottom: 0,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginVertical: 6,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.text,
              }}
            >
              {title}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "400",
                  color: colors.primary,
                  marginRight: 2,
                }}
              >
                더보기
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </View>
          </View>

          {items.map((post) => (
            <View
              key={post.id}
              style={{
                borderTopWidth: 0.5,
                borderTopColor: colors.border,
                height: 27,
                justifyContent: "center",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "400",
                  color: colors.text,
                  flex: 1,
                  lineHeight: 18,
                }}
                numberOfLines={1}
              >
                • {post.title}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.subText,
                  marginLeft: 8,
                }}
                numberOfLines={1}
              >
                {formatPostDateTime((post as any)?.created_at)}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>
    </Pressable>
  );
}
