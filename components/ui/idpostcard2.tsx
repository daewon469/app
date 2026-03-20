import { useEffect, useState } from "react";
import {
  Dimensions,
  Image, SafeAreaView, ScrollView, Text, View
} from "react-native";
import { Card } from "react-native-paper";
import type { Post } from "../../lib/api";
const screenWidth = Dimensions.get("window").width;

type Props = {
  post: Post;
};

export default function SimplePostDetail({ post }: Props) {
  const colors = {
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#ddd",
    subText: "#666",
  };

  const createdAt = new Date(post.created_at);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 16 }}
      >
        {/* 제목 */}
        <Card
          mode="elevated"
          style={{
            borderRadius: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
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

            {/* 닉네임 + 일자 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 13, color: colors.subText }}>
                {post.author?.username ?? "익명"}
              </Text>
              <Text style={{ fontSize: 13, color: colors.subText }}>
                {createdAt.toLocaleDateString("ko-KR")}{" "}
                {createdAt.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* 이미지 (있을 때만) */}
        {post.image_url && (
          <View style={{ marginBottom: 16 }}>
            <DynamicImage uri={post.image_url} />
          </View>
        )}

        {/* 내용 */}
        <Card
          mode="elevated"
          style={{
            borderRadius: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: 4,
          }}
        >
          <Card.Content>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: colors.text,
              }}
            >
              {post.content}
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function DynamicImage({ uri }: { uri: string }) {
  const [height, setHeight] = useState(200);
  const horizontalPadding = 16; // 
  const cardWidth = screenWidth - horizontalPadding * 2;

  useEffect(() => {
    Image.getSize(uri, (width, height) => {
      const scale = cardWidth / width; // 
      setHeight(height * scale);
    });
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={{
        width: cardWidth,
        height,
        resizeMode: "cover",

        alignSelf: "center",

      }}
    />
  );
}