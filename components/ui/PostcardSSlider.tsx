import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { Post } from "../../lib/api";
import PostCardS, { LIST_CARD_HEIGHT_TYPE_S } from "./postcards";

type Props = {
  posts: Post[];
  autoPlayMs?: number;
  fullWidth?: boolean;
  listHorizontalPadding?: number;
};

export default function PostcardSSlider({
  posts,
  autoPlayMs = 0,
  fullWidth = false,
  listHorizontalPadding = 10,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Post>>(null);
  const activeIndexRef = useRef(0);

  const cardWidth = useMemo(
    () => Math.floor(fullWidth ? windowWidth : windowWidth - listHorizontalPadding * 2),
    [fullWidth, listHorizontalPadding, windowWidth]
  );
  const cardHeight = useMemo(() => LIST_CARD_HEIGHT_TYPE_S, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / cardWidth);
    const next = Math.max(0, Math.min(posts.length - 1, idx));
    activeIndexRef.current = next;
    if (next !== activeIndex) setActiveIndex(next);
  };

  useEffect(() => {
    if (!autoPlayMs || posts.length <= 1) return;

    const id = setInterval(() => {
      const next = (activeIndexRef.current + 1) % posts.length;
      activeIndexRef.current = next;
      setActiveIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, autoPlayMs);

    return () => clearInterval(id);
  }, [autoPlayMs, posts.length, cardWidth]);

  if (posts.length === 0) return null;

  return (
    <View style={{ marginBottom: 8, width: cardWidth, alignSelf: fullWidth ? "stretch" : undefined }}>
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => String(item.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        nestedScrollEnabled={Platform.OS === "android"}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: cardWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: cardWidth * info.index,
            animated: true,
          });
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <PostCardS
              post={item}
              height={cardHeight}
              borderRadius={12}
            />
          </View>
        )}
      />

      {posts.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 4,
          }}
        >
          {posts.map((p, i) => (
            <View
              key={p.id}
              style={{
                width: i === activeIndex ? 16 : 6,
                height: 6,
                borderRadius: 3,
                marginHorizontal: 3,
                backgroundColor: i === activeIndex ? "#4A6CF7" : "#C5C5C5",
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
