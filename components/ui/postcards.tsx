import { Link } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { resolveMediaUrl, type Post } from "../../lib/api";
import { formatProvinceCity, formatRoles } from "../../utils/postCardFormat";
import Heart from "./heart";

/** 웹 listCardLayout LIST_CARD_HEIGHT_TYPE_S 와 동일 */
export const LIST_CARD_HEIGHT_TYPE_S = 250;

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

/** 슬라이드 카드(어두운 배경)용 현장 한마디 색 — 검은색이면 흰색 */
function resolveSlideHighlightColor(color?: string | null) {
  const raw = String(color ?? "").trim();
  if (!raw) return "#fff";
  const lower = raw.toLowerCase();
  if (lower === "black" || lower === "#000" || lower === "#000000" || lower === "#111111") {
    return "#fff";
  }
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
  const topPaddingH = edgeToEdge ? 12 : 8;
  const topPaddingTop = edgeToEdge ? 10 : 4;

  return (
    <Link href={{ pathname: "/[id]", params: { id: post.id } }} asChild>
      <Pressable
        style={{
          position: "relative",
          width: "100%",
          height,
          overflow: "visible",
          borderRadius: resolvedRadius,
          borderWidth: edgeToEdge ? 0 : 1,
          borderColor: "#000",
          backgroundColor: "#000",
          shadowColor: "#000",
          shadowOpacity: edgeToEdge ? 0 : 0.18,
          shadowRadius: edgeToEdge ? 0 : 8,
          shadowOffset: { width: 0, height: edgeToEdge ? 0 : 4 },
          elevation: edgeToEdge ? 0 : 4,
        }}
      >
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            overflow: "hidden",
            borderRadius: resolvedRadius,
          }}
        >
          <CardImage uri={imageUri} />

          <LinearGradient
            pointerEvents="box-none"
            colors={["rgba(0,0,0,0.9)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
            locations={[0, 0.55, 1]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              paddingHorizontal: topPaddingH,
              paddingTop: topPaddingTop,
              paddingBottom: 14,
            }}
          >
            <View
              pointerEvents="box-none"
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "700",
                  lineHeight: 22,
                  color: "#fff",
                }}
              >
                {post.title}
              </Text>
              {showHeart ? (
                <View
                  style={{ height: 22, justifyContent: "flex-start", marginTop: -6 }}
                  pointerEvents="auto"
                >
                  <Heart postId={post.id} postLiked={post.liked} size={20} />
                </View>
              ) : null}
            </View>
            {post.highlight_content ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  fontSize: 15,
                  fontWeight: "700",
                  lineHeight: 20,
                  color: resolveSlideHighlightColor(post.highlight_color),
                }}
              >
                {post.highlight_content}
              </Text>
            ) : null}
          </LinearGradient>

          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
            locations={[0, 0.45, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
              paddingHorizontal: edgeToEdge ? 12 : 8,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: "#7eb8ff",
              }}
            >
              {industryProvinceCity}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontSize: 15,
                fontWeight: "700",
                color: "#ffb4b4",
              }}
            >
              {formatRoles(post)}
            </Text>
          </LinearGradient>
        </View>
      </Pressable>
    </Link>
  );
}

export default React.memo(PostCardS);
