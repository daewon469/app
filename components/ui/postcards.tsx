import { Link } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { resolveMediaUrl, type Post } from "../../lib/api";
import { formatProvinceCity, formatRoles } from "../../utils/postCardFormat";
import Heart from "./heart";

/** 웹 listCardLayout LIST_CARD_HEIGHT_TYPE_S 와 동일 */
export const LIST_CARD_HEIGHT_TYPE_S = 364;

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

/** 밝은 메쉬 위 현장 한마디 — 미지정 시 검정 */
function resolveSlideHighlightColor(color?: string | null) {
  const raw = String(color ?? "").trim();
  if (!raw) return "#111";
  return raw;
}

function resolveSlideCardImage(post: Post) {
  return resolveMediaUrl(post.image_url);
}

function CardImage({ uri, style }: { uri: string | null; style?: object }) {
  if (!uri) {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#262626" }, style]} />;
  }
  return (
    <ExpoImage
      source={{ uri }}
      cachePolicy="memory-disk"
      contentFit="cover"
      style={[StyleSheet.absoluteFillObject, style]}
    />
  );
}

type Props = {
  post: Post;
  showHeart?: boolean;
  height?: number;
  borderRadius?: number;
  edgeToEdge?: boolean;
};

function PostCardS({
  post,
  showHeart = true,
  height = LIST_CARD_HEIGHT_TYPE_S,
  borderRadius = 12,
  edgeToEdge = false,
}: Props) {
  const imageUri = useMemo(() => resolveSlideCardImage(post), [post]);
  const industryProvinceCity = `${post.job_industry ?? ""}/${formatProvinceCity(post.province, post.city)}`;
  const resolvedRadius = edgeToEdge ? 0 : borderRadius;

  return (
    <View style={{ position: "relative", width: "100%", height }}>
      <Link href={{ pathname: "/[id]", params: { id: post.id } }} asChild>
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            borderRadius: resolvedRadius,
            borderWidth: edgeToEdge ? 0 : 1,
            borderColor: "#000",
            backgroundColor: "#000",
          }}
        >
          <CardImage uri={imageUri} />

          {/* 상단: 불투명 흰 배경 + 하단 검정 테두리 */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: "#fff",
              borderBottomWidth: 1,
              borderBottomColor: "#000",
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                fontSize: 16,
                fontWeight: "700",
                lineHeight: 20,
                color: "#000",
              }}
            >
              {post.title}
            </Text>
            {post.highlight_content ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  lineHeight: 18,
                  color: resolveSlideHighlightColor(post.highlight_color),
                }}
              >
                {post.highlight_content}
              </Text>
            ) : null}
          </View>

          {/* 하단: 불투명 흰 배경 + 상단 검정 테두리 */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: "#fff",
              borderTopWidth: 1,
              borderTopColor: "#000",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: "700",
                lineHeight: 18,
                color: "#0B57D0",
              }}
            >
              {industryProvinceCity}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: "700",
                lineHeight: 18,
                color: "#C62828",
              }}
            >
              {formatRoles(post)}
            </Text>
          </View>
        </Pressable>
      </Link>

      {showHeart ? (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", right: 8, top: 8, zIndex: 20 }}
        >
          <Heart postId={post.id} postLiked={post.liked} size={22} />
        </View>
      ) : null}
    </View>
  );
}

export default React.memo(PostCardS);
