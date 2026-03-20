import React, { useEffect, useState } from "react";
import { Dimensions, Image, SafeAreaView, ScrollView, Text as RNText, View } from "react-native";
import { Card } from "react-native-paper";
import type { Post } from "../../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  post: Post;
};

export default function IdPostCard5({ post }: Props) {
  const colors = {
    // idpostcard3.tsx와 동일 톤
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#000",
    subText: "#666",
    primary: "#4A6CF7",
  };

  const createdAt = new Date(post.created_at);
  const createdAtText = post.created_at
    ? `${createdAt.toLocaleDateString("ko-KR")} ${createdAt.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {/* 제목 카드 (idpostcard3.tsx 스타일) */}
        <Card
          mode="elevated"
          style={{
            borderRadius: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 1,
          }}
        >
          <Card.Content>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "bold",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              {post.title}
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: colors.subText }}>
                공지사항
              </Text>
              <Text style={{ fontSize: 13, color: colors.subText }}>
                {createdAtText}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {post.image_url && <DynamicImage uri={post.image_url} />}

        {/* 내용 카드 (idpostcard3.tsx 스타일) */}
        <Card
          mode="elevated"
          style={{
            borderRadius: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: 0,
            marginBottom: 8,
            marginTop: 1,
          }}
        >
          <Card.Content>
            <Text style={{ fontSize: 15, lineHeight: 22, color: colors.text }}>
              {post.content}
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const screenWidth = Dimensions.get("window").width;
function DynamicImage({ uri }: { uri: string }) {
  const [height, setHeight] = useState(200);
  const horizontalPadding = 16;
  const cardWidth = screenWidth - horizontalPadding * 2;

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => {
        const scale = cardWidth / w;
        setHeight(h * scale);
      },
      () => setHeight(200)
    );
  }, [uri, cardWidth]);

  return (
    <Image
      source={{ uri }}
      style={{
        width: cardWidth,
        height,
        resizeMode: "cover",
        borderRadius: 10,
        alignSelf: "center",
      }}
    />
  );
}

