import { Link } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { resolveMediaUrl, type Post } from "../../lib/api";
import { formatProvinceCity, formatRoles } from "../../utils/postCardFormat";
import Heart from "./heart";

/** 웹과 동일 — 1:1일 때 미사용, 레거시 참조용 */
export const LIST_CARD_HEIGHT_TYPE_S = 364;

/** 검정 매쉬 고정 투명도 */
const MESH_OPACITY = 0.5;

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

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
      contentFit="fill"
      style={[StyleSheet.absoluteFillObject, style]}
    />
  );
}

type Props = {
  post: Post;
  showHeart?: boolean;
  /** 지정 시 해당 높이 사용, 미지정 시 width 기준 1:1 */
  height?: number;
  borderRadius?: number;
  edgeToEdge?: boolean;
};

function PostCardS({
  post,
  showHeart = true,
  height,
  borderRadius = 12,
  edgeToEdge = false,
}: Props) {
  const imageUri = useMemo(() => resolveSlideCardImage(post), [post]);
  const industryProvinceCity = `${post.job_industry ?? ""}/${formatProvinceCity(post.province, post.city)}`;
  const resolvedRadius = edgeToEdge ? 0 : borderRadius;
  const meshBg = `rgba(0,0,0,${MESH_OPACITY})`;

  return (
    <View
      style={{
        position: "relative",
        width: "100%",
        ...(height != null ? { height } : { aspectRatio: 1 }),
      }}
    >
      <Link href={{ pathname: "/[id]", params: { id: post.id } }} asChild>
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: resolvedRadius,
            borderBottomRightRadius: resolvedRadius,
            borderWidth: edgeToEdge ? 0 : 1,
            borderColor: "#000",
            backgroundColor: "#000",
          }}
        >
          <CardImage uri={imageUri} />

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
              backgroundColor: meshBg,
              borderBottomWidth: 1,
              borderBottomColor: "#000",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 17,
                fontWeight: "700",
                lineHeight: 20,
                color: "#fff",
              }}
            >
              {post.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: "700",
                lineHeight: 16,
                color: "#fff",
              }}
            >
              {String(post.highlight_content ?? "").trim() || " "}
            </Text>
          </View>

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
              backgroundColor: meshBg,
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
                color: "#fff",
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
                color: "#fff",
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
