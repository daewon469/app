import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { Post } from "../../lib/api";
import PostCardS from "./postcards";

type Props = {
  posts: Post[];
  autoPlayMs?: number;
  fullWidth?: boolean;
  listHorizontalPadding?: number;
};

function IndicatorDot({ active }: { active: boolean }) {
  const width = useRef(new Animated.Value(active ? 16 : 6)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? 16 : 6,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, width]);

  return (
    <Animated.View
      style={{
        width,
        height: 6,
        borderRadius: 3,
        marginHorizontal: 3,
        backgroundColor: active ? "#4A6CF7" : "#C5C5C5",
      }}
    />
  );
}

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
  const cardHeight = cardWidth;

  const commitIndex = (idx: number) => {
    const next = Math.max(0, Math.min(posts.length - 1, idx));
    if (next === activeIndexRef.current) return;
    activeIndexRef.current = next;
    setActiveIndex(next);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    commitIndex(Math.round(x / cardWidth));
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
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled={Platform.OS === "android"}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: cardWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: cardWidth * info.index,
            animated: false,
          });
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <PostCardS post={item} height={cardHeight} borderRadius={12} />
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
            <IndicatorDot key={p.id} active={i === activeIndex} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
