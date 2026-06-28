import { Link } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { resolveMediaUrl, type Post } from "../../lib/api";
import { formatProvinceCity, formatRoles } from "../../utils/postCardFormat";
import Heart from "./heart";

/** 웹 listCardLayout LIST_CARD_HEIGHT_TYPE_S 와 동일 */
export const LIST_CARD_HEIGHT_TYPE_S = 350;

/** 상단 대형 이미지 영역 비율 */
const TOP_SECTION_RATIO = 0.58;

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

function resolveSlideCardImages(post: Post) {
  const ext = post as Post & {
    image_url_2?: string | null;
    image_url2?: string | null;
    image_url_3?: string | null;
    image_url3?: string | null;
  };
  const top = resolveMediaUrl(post.image_url);
  const bottomLeft = resolveMediaUrl(ext.image_url_2 ?? ext.image_url2) ?? top;
  const bottomRight = resolveMediaUrl(ext.image_url_3 ?? ext.image_url3) ?? top;
  return { top, bottomLeft, bottomRight };
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
};

function PostCardS({ post, showHeart = true, height = LIST_CARD_HEIGHT_TYPE_S }: Props) {
  const { top, bottomLeft, bottomRight } = useMemo(() => resolveSlideCardImages(post), [post]);
  const topHeight = Math.round(height * TOP_SECTION_RATIO);
  const bottomHeight = height - topHeight;
  const industryProvinceCity = `${post.job_industry ?? ""}/${formatProvinceCity(post.province, post.city)}`;

  return (
    <Link href={{ pathname: "/[id]", params: { id: post.id } }} asChild>
      <Pressable
        style={{
          position: "relative",
          width: "100%",
          height,
          overflow: "hidden",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#000",
          backgroundColor: "#000",
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        {/* 상단 — 대형 이미지 + 제목 */}
        <View style={{ height: topHeight, width: "100%", position: "relative" }}>
          <CardImage uri={top} />

          {showHeart ? (
            <Heart
              postId={post.id}
              postLiked={post.liked}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 10,
              }}
            />
          ) : null}

          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0.9)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
            locations={[0, 0.55, 1]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              paddingHorizontal: 8,
              paddingTop: 4,
              paddingBottom: 14,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                fontSize: 16,
                fontWeight: "700",
                lineHeight: 22,
                color: "#fff",
              }}
            >
              {post.title}
            </Text>
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
        </View>

        {/* 하단 — 2분할 이미지 + 업종/역할 텍스트 */}
        <View style={{ height: bottomHeight, width: "100%", flexDirection: "row", position: "relative" }}>
          <View style={{ flex: 1, position: "relative" }}>
            <CardImage uri={bottomLeft} />
          </View>
          <View style={{ flex: 1, position: "relative" }}>
            <CardImage uri={bottomRight} />
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"]}
            locations={[0, 0.45, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
              paddingHorizontal: 8,
              paddingTop: 16,
              paddingBottom: 4,
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
