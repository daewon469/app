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
  const snappingRef = useRef(false);
  const wrapTokenRef = useRef(0);

  const cardWidth = useMemo(
    () => Math.floor(fullWidth ? windowWidth : windowWidth - listHorizontalPadding * 2),
    [fullWidth, listHorizontalPadding, windowWidth]
  );
  const cardHeight = cardWidth;
  const loop = posts.length > 1;

  // 앞뒤에 복제 카드를 붙여, 마지막에서 다음으로 밀면 첫 카드로 이어지게 한다.
  const data = useMemo(() => {
    if (!loop) return posts;
    return [posts[posts.length - 1], ...posts, posts[0]];
  }, [loop, posts]);

  const commitIndex = (idx: number) => {
    const next = Math.max(0, Math.min(posts.length - 1, idx));
    if (next === activeIndexRef.current) return;
    activeIndexRef.current = next;
    setActiveIndex(next);
  };

  const jumpToOffset = (offset: number) => {
    snappingRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
      requestAnimationFrame(() => {
        snappingRef.current = false;
      });
    });
  };

  const settle = (rawIndex: number) => {
    if (!loop) {
      commitIndex(rawIndex);
      return;
    }
    const count = posts.length;
    if (rawIndex <= 0) {
      jumpToOffset(cardWidth * count);
      commitIndex(count - 1);
      return;
    }
    if (rawIndex >= count + 1) {
      jumpToOffset(cardWidth);
      commitIndex(0);
      return;
    }
    commitIndex(rawIndex - 1);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (snappingRef.current) return;
    const x = e.nativeEvent.contentOffset.x;
    settle(Math.round(x / Math.max(cardWidth, 1)));
  };

  useEffect(() => {
    if (!autoPlayMs || posts.length <= 1) return;

    const id = setInterval(() => {
      const count = posts.length;
      const next = (activeIndexRef.current + 1) % count;
      activeIndexRef.current = next;
      setActiveIndex(next);
      // 마지막 다음은 뒤쪽 복제(첫 카드)로 넘긴 뒤, 실제 첫 카드 위치로 붙인다.
      const loopIndex = next === 0 ? count + 1 : next + 1;
      listRef.current?.scrollToOffset({ offset: cardWidth * loopIndex, animated: true });
      if (next === 0) {
        const token = ++wrapTokenRef.current;
        setTimeout(() => {
          if (wrapTokenRef.current !== token) return;
          listRef.current?.scrollToOffset({ offset: cardWidth, animated: false });
        }, 480);
      }
    }, autoPlayMs);

    return () => {
      clearInterval(id);
      wrapTokenRef.current += 1;
    };
  }, [autoPlayMs, posts.length, cardWidth]);

  if (posts.length === 0) return null;

  return (
    <View style={{ marginBottom: 8, width: cardWidth, alignSelf: fullWidth ? "stretch" : undefined }}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled={Platform.OS === "android"}
        initialScrollIndex={loop ? 1 : 0}
        onScrollBeginDrag={() => {
          wrapTokenRef.current += 1;
        }}
        initialNumToRender={data.length}
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
