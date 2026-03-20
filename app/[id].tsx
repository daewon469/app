// [id].tsx
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";

import IdPostCard from "../components/ui/idpostcard";
import IdPostCard2 from "../components/ui/idpostcard2";
import IdPostCard3 from "../components/ui/idpostcard3";
import IdPostCard4 from "../components/ui/idpostcard4";
import IdPostCard5 from "../components/ui/idpostcard5";
import IdPostCard6 from "../components/ui/idpostcard6";
import IdPostCard7 from "../components/ui/idpostcard7";

import { Posts, type Post } from "../lib/api";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    (async () => {
      if (id) {
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          setPost(await Posts.get(numericId));
        }
      }
    })();
  }, [id]);

  if (!post) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const renderCard = () => {
    switch (post.post_type) {
      case 1:
        return <IdPostCard post={post} />;

      case 2:
        return <IdPostCard2 post={post} />;

      case 3:
        return <IdPostCard3 post={post} />;
        
      case 4:
        return <IdPostCard4 post={post} />;

      case 5:
        return <IdPostCard5 post={post} />;

      case 6:
        return <IdPostCard6 post={post} />;

      case 7:
        return <IdPostCard7 post={post} />;

      default:
        return <IdPostCard post={post} />;
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: "height" }) as any}
      keyboardVerticalOffset={45}
    >
      {renderCard()}
    </KeyboardAvoidingView>
  );
}
