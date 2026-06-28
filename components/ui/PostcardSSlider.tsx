import React, { useMemo, useState } from "react";
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
};

export default function PostcardSSlider({ posts }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  // list FlatList paddingHorizontal(10) × 2
  const cardWidth = useMemo(() => Math.floor(windowWidth - 20), [windowWidth]);
  const cardHeight = useMemo(
    () => Math.min(LIST_CARD_HEIGHT_TYPE_S, Math.round(cardWidth * 0.95)),
    [cardWidth]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / cardWidth);
    const next = Math.max(0, Math.min(posts.length - 1, idx));
    if (next !== activeIndex) setActiveIndex(next);
  };

  if (posts.length === 0) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <FlatList
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
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <PostCardS post={item} height={cardHeight} />
          </View>
        )}
      />

      {posts.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 8,
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
                backgroundColor: i === activeIndex ? "#2F6BFF" : "#C5C5C5",
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
