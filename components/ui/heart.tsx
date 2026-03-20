import { Posts } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, ViewStyle } from "react-native";

const DEEP_RED = "#8B0000";

export default function Heart({
  postId,
  style,
  size = 22,
  color = DEEP_RED,
  postLiked,
}: {
  postId: number;
  style?: ViewStyle;
  size?: number;
  color?: string;
  postLiked?: boolean;
}) {
  
  const [username, setUsername] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(postLiked);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const name = await SecureStore.getItemAsync("username");
      setUsername(name);
    })();
  }, []);

  useEffect(() => {
    setFavorite(postLiked);
  }, [postLiked]);

  const toggleLike = async () => {
    if (loading || !username) return;
    setLoading(true);
    try {
      if (!favorite) {
        const res = await Posts.like(postId, username);
        if (res.ok) setFavorite(true);
      } else {
        const res = await Posts.unlike(postId, username);
        if (res.ok) setFavorite(false);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("에러", "좋아요 요청 실패");
    } finally {
      setLoading(false);
    }
  };

  if (username === null) {
  return (
    <Pressable style={style}>
      <Text style={{ fontSize: size }}>🤍</Text>
    </Pressable>
  );
}

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        toggleLike();
      }}
      hitSlop={8}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={favorite ? "관심 해제" : "관심 등록"}
    >
      <Text style={{ fontSize: size, color }}>{favorite ? "❤️" : "🤍"}</Text>
    </Pressable>
  );
}
