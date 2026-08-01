import { Link } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { resolveMediaUrl, type Post } from "../../lib/api";
import { formatProvinceCity, formatRoles } from "../../utils/postCardFormat";
import {
  getSlideMeshSettingsAsync,
  slideMeshStyles,
  subscribeSlideMeshTheme,
} from "../../utils/slideCardTheme";
import Heart from "./heart";

export const LIST_CARD_HEIGHT_TYPE_S = 364;

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
  const [mesh, setMesh] = useState(() => slideMeshStyles("dark", 0.5));
  const imageUri = useMemo(() => resolveSlideCardImage(post), [post]);
  const industryProvinceCity = `${post.job_industry ?? ""}/${formatProvinceCity(post.province, post.city)}`;
  const resolvedRadius = edgeToEdge ? 0 : borderRadius;

  useEffect(() => {
    const load = () => {
      void getSlideMeshSettingsAsync().then((s) => {
        setMesh(slideMeshStyles(s.theme, s.opacity[s.theme]));
      });
    };
    load();
    return subscribeSlideMeshTheme(load);
  }, []);

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
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
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
              paddingTop: 2,
              paddingBottom: 3,
              backgroundColor: mesh.meshColor,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 17,
                fontWeight: "600",
                lineHeight: 19,
                color: mesh.textColor,
              }}
            >
              {post.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: "500",
                lineHeight: 15,
                color: mesh.textColor,
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
              paddingTop: 3,
              paddingBottom: 2,
              backgroundColor: mesh.meshColor,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: "500",
                lineHeight: 17,
                color: mesh.textColor,
              }}
            >
              {industryProvinceCity}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: "500",
                lineHeight: 17,
                color: mesh.textColor,
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
