// app/list4.tsx
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text as RNText,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Posts, type Post } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const { width } = Dimensions.get("window");
const SIDE_PEEK = 10; // 좌/우로 보이는 정도
const PAGE_GAP = 12; // 페이지 간 간격
const PAGE_WIDTH = width - SIDE_PEEK * 2;
const SNAP_INTERVAL = PAGE_WIDTH + PAGE_GAP;

// NOTE:
// - 표준 카테고리: "광고"
// - 레거시 데이터(job_industry="광고업체")는 하위호환으로 "광고"로 매핑
const MAIN_CATEGORIES = ["광고", "대출", "급매물", "중고장터"] as const;
const SPECIAL_CATEGORY = "광고하기";

type MainCategory = (typeof MAIN_CATEGORIES)[number];
type SpecialCategory = typeof SPECIAL_CATEGORY;
type Category = MainCategory | SpecialCategory;

function mapJobToCategory(job?: string | null): MainCategory {
  const v = String(job ?? "").trim();
  // legacy → new name
  if (v === "광고업체") return "광고";
  if (MAIN_CATEGORIES.includes(v as MainCategory)) {
    return v as MainCategory;
  }
  return "광고";
}
export default function AdScreen() {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const activeCategory = MAIN_CATEGORIES[categoryIndex];
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const loadingMoreRef = useRef(false);
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList<MainCategory> | null>(null);
  const pageScrollRefs = useRef<Array<any | null>>(Array(MAIN_CATEGORIES.length).fill(null));
  const scrollYByIndex = useRef<Animated.Value[]>(
    MAIN_CATEGORIES.map(() => new Animated.Value(0))
  ).current;

  const metricsRef = useRef<{ content: number[]; layout: number[] }>({
    content: Array(MAIN_CATEGORIES.length).fill(1),
    layout: Array(MAIN_CATEGORIES.length).fill(1),
  });
  const [contentHeights, setContentHeights] = useState<number[]>(Array(MAIN_CATEGORIES.length).fill(1));
  const [layoutHeights, setLayoutHeights] = useState<number[]>(Array(MAIN_CATEGORIES.length).fill(1));

  const getMetrics = useCallback(() => {
    const i = categoryIndex;
    return { contentHeight: contentHeights[i] ?? 1, layoutHeight: layoutHeights[i] ?? 1 };
  }, [categoryIndex, contentHeights, layoutHeights]);

  // list4 화면에 "들어올 때/돌아올 때"마다 신규글이 보이도록 포커스 기반으로 재조회
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        try {
          const s = await getSession();
          if (!alive) return;
          setIsLogin(s.isLogin);
          setUsername(s.username);

          // 더보기 상태 초기화(등록 후 복귀 시 cursor가 stale일 수 있음)
          loadingMoreRef.current = false;
          setLoadingMore(false);
          setCursor(undefined);
          setHasMore(true);

          setLoading(true);
          const res = await Posts.listByType(4, {
            status: "published",
            limit: 100,
          });
          if (!alive) return;
          setItems(res.items ?? []);
          setCursor(res.next_cursor || undefined);
          setHasMore(Boolean(res.next_cursor));

          // 신규글이 보이도록 최상단으로 이동
          pageScrollRefs.current?.[categoryIndex]?.scrollTo?.({ y: 0, animated: false });
        } catch (e) {
          console.log(e);
        } finally {
          if (!alive) return;
          setLoading(false);
        }
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  // 탭/스와이프로 카테고리 전환 시, 해당 페이지를 상단으로
  useEffect(() => {
    pageScrollRefs.current?.[categoryIndex]?.scrollTo?.({ y: 0, animated: true });
  }, [categoryIndex]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    if (!cursor) return;
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const currentCursor = cursor;
      const res = await Posts.listByType(4, {
        status: "published",
        limit: 100,
        cursor: currentCursor,
      });
      const nextItems = res.items ?? [];
      setItems((prev) => {
        const byId = new Map<number, Post>();
        [...prev, ...nextItems].forEach((p) => byId.set(p.id, p));
        return Array.from(byId.values());
      });
      // 더 이상 가져올 데이터가 없거나(빈 배열),
      // cursor가 갱신되지 않으면(무한 호출 방지) 더보기 종료
      const nextCursor = res.next_cursor || undefined;
      if (!nextCursor || nextItems.length === 0 || nextCursor === currentCursor) {
        setCursor(undefined);
        setHasMore(false);
      } else {
        setCursor(nextCursor);
        setHasMore(true);
      }
    } catch (e) {
      console.log(e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, hasMore]);

  // 카테고리별로 미리 정렬된 목록을 만들어 pager 각 페이지가 바로 사용
  const orderedItemsByCategory = useMemo(() => {
    const toTime = (v: any) => {
      const t = Date.parse(String(v ?? ""));
      return Number.isFinite(t) ? t : 0;
    };
    const byNewest = (a: Post, b: Post) => {
      const diff = toTime(b.created_at) - toTime(a.created_at);
      return diff !== 0 ? diff : (b.id ?? 0) - (a.id ?? 0);
    };

    const out: Record<string, Post[]> = {};
    MAIN_CATEGORIES.forEach((c) => {
      const filtered = (items || []).filter((p) => mapJobToCategory(p.job_industry) === c);
      const type1 = filtered.filter((p) => p.card_type === 1).sort(byNewest);
      const type2 = filtered.filter((p) => p.card_type === 2).sort(byNewest);
      const type3 = filtered.filter((p) => p.card_type === 3).sort(byNewest);
      out[c] = [...type1, ...type2, ...type3];
    });
    return out as Record<MainCategory, Post[]>;
  }, [items]);

  const handleChangeCategory = useCallback(
    (c: Category) => {
      if (c === "광고하기") {
        if (!isLogin || !username) {
          Alert.alert("알림", "로그인이 필요합니다.");
          return;
        }
        // 현재 탭(업무분류)을 write4에 전달 → 작성 후 돌아오면 같은 탭에서 신규글이 바로 보임
        router.push({
          pathname: "/write4",
          params: { job_industry: activeCategory },
        });
        return;
      }
      const idx = MAIN_CATEGORIES.indexOf(c as MainCategory);
      if (idx >= 0) {
        setCategoryIndex(idx);
        pagerRef.current?.scrollToOffset({ offset: idx * SNAP_INTERVAL, animated: true });
        pageScrollRefs.current?.[idx]?.scrollTo?.({ y: 0, animated: true });
      }
    },
    [activeCategory, isLogin, username]
  );

  interface CategoryTabsProps {
    active: Category;
    onChange: (c: Category) => void;
  }

  function CategoryTabs({ active, onChange }: CategoryTabsProps) {
    return (
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsRow}>
          {MAIN_CATEGORIES.map((c) => {
            const isActive = c === active;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.mainTab, isActive && styles.mainTabActive]}
                onPress={() => onChange(c)}
              >
                <Text
                  style={[styles.mainTabText, isActive && styles.mainTabTextActive]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* 광고등록 버튼 */}
          <TouchableOpacity
            style={styles.specialTabItem}
            onPress={() => onChange(SPECIAL_CATEGORY)}
          >
            <Text
              style={{
                color: "#FF8A3D",
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              글작성
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CategoryTabs active={activeCategory} onChange={handleChangeCategory} />

      {/* 부드러운 넘기기(양옆 화면이 살짝 보이는) */}
      <View style={styles.scroll}>
        <Animated.FlatList
          ref={(r) => {
            pagerRef.current = r as any;
          }}
          data={MAIN_CATEGORIES as unknown as MainCategory[]}
          keyExtractor={(c) => c}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          snapToAlignment="start"
          disableIntervalMomentum
          bounces={false}
          contentContainerStyle={{ paddingHorizontal: SIDE_PEEK }}
          ItemSeparatorComponent={() => <View style={{ width: PAGE_GAP }} />}
          getItemLayout={(_, index) => ({
            length: SNAP_INTERVAL,
            offset: SNAP_INTERVAL * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const x = Number(e?.nativeEvent?.contentOffset?.x ?? 0);
            const next = Math.max(0, Math.min(MAIN_CATEGORIES.length - 1, Math.round(x / SNAP_INTERVAL)));
            if (next !== categoryIndex) {
              setCategoryIndex(next);
            }
          }}
          renderItem={({ item: cat, index }) => {
            const data = orderedItemsByCategory[cat] ?? [];
            return (
              <View style={{ width: PAGE_WIDTH }}>
                <Animated.ScrollView
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                  ref={(r) => {
                    pageScrollRefs.current[index] = r;
                  }}
                  onContentSizeChange={(_, h) => {
                    const hh = Math.max(1, Number(h || 1));
                    metricsRef.current.content[index] = hh;
                    setContentHeights((prev) => {
                      const next = [...prev];
                      next[index] = hh;
                      return next;
                    });
                  }}
                  onLayout={(e) => {
                    const lh = Math.max(1, Number(e.nativeEvent.layout.height || 1));
                    metricsRef.current.layout[index] = lh;
                    setLayoutHeights((prev) => {
                      const next = [...prev];
                      next[index] = lh;
                      return next;
                    });
                  }}
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollYByIndex[index] } } }],
                    {
                      useNativeDriver: false,
                      listener: (ev: any) => {
                        const y = Number(ev?.nativeEvent?.contentOffset?.y ?? 0);
                        const layoutH = metricsRef.current.layout[index] ?? 1;
                        const contentH = metricsRef.current.content[index] ?? 1;
                        const threshold = 220;
                        if (hasMore && !loadingMoreRef.current && y + layoutH >= contentH - threshold) {
                          loadMore();
                        }
                      },
                    }
                  )}
                  scrollEventThrottle={16}
                  nestedScrollEnabled
                  directionalLockEnabled
                >
                  {loading && items.length === 0 ? (
                    <ActivityIndicator style={{ marginTop: 20 }} />
                  ) : (
                    <FlatList
                      data={data}
                      keyExtractor={(it) => String(it.id)}
                      scrollEnabled={false}
                      renderItem={({ item }) => (
                        <View>
                          {item.card_type === 3 ? <AdCardTitleOnly item={item} /> : <AdCardSlim item={item} />}
                        </View>
                      )}
                      ListFooterComponent={
                        loadingMore ? (
                          <View style={{ paddingVertical: 16 }}>
                            <ActivityIndicator />
                          </View>
                        ) : null
                      }
                    />
                  )}
                </Animated.ScrollView>
              </View>
            );
          }}
        />
      </View>

      {/* 커스텀 스크롤(우측 스크롤바 + 상/하 이동 버튼) */}
      <ScrollNavigator
        scrollY={scrollYByIndex[categoryIndex]}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => pageScrollRefs.current?.[categoryIndex]?.scrollTo({ y: 0, animated: true })}
        onBottom={() =>
          pageScrollRefs.current?.[categoryIndex]?.scrollTo({
            y: Math.max((contentHeights[categoryIndex] ?? 1) - (layoutHeights[categoryIndex] ?? 1), 0),
            animated: true,
          })
        }
        bottomOffset={insets.bottom + 8}
        topOffset={0}
        trackOpacity={0.22}
        thumbOpacity={0.9}
        thumbColor="#FF0000"
        barWidth={4}
      />
    </View>
  );
}

function AdCardTitleOnly({ item }: AdCardProps) {
  return (
    <TouchableOpacity
      style={styles.cardTitleOnly}
      onPress={() =>
        router.push({
          pathname: "/[id]",
          params: { id: String(item.id) },
        })
      }
      activeOpacity={0.9}
    >
      <Text style={styles.cardTitleOnlyText} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
}

interface AdCardProps {
  item: Post;
}

function AdCardSlim({ item }: AdCardProps) {
  const source = item.image_url
    ? { uri: item.image_url }
    : require("../assets/images/brend1.png");

  return (
    <TouchableOpacity
      style={styles.cardSlim}
      onPress={() =>
        router.push({
          pathname: "/[id]",
          params: { id: String(item.id) },
        })
      }
      activeOpacity={0.9}
    >
      <Image source={source} style={styles.cardSlimImage} />

      <View style={styles.cardSlimContent}>
        {!!item.company_agency && (
          <Text style={styles.cardAgency} numberOfLines={1}>
            {item.company_agency}
          </Text>
        )}

        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>

      </View>
    </TouchableOpacity>
  );
}

/* ───────────────────────── 스타일 ───────────────────────── */

const PRIMARY = "#0099FF";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  cardSlim: {
    marginTop: 14,
    marginHorizontal: 6,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
  },
  cardSlimImage: {
    width: "100%",
    height: 200,   // 기존 200 → 약 70% (2/3 축소)
    backgroundColor: "#DDD",
  },
  cardSlimContent: {
    height: 52,              // ← 제목 영역 높이 (조절 가능)
    justifyContent: "center",// ← 수직 중앙
    paddingHorizontal: 12,
  },

  cardTitleOnly: {
    marginTop: 12,
    marginHorizontal: 6,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    elevation: 1,
    justifyContent: "center",
  },
  cardTitleOnlyText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },

  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  tabText: {
    fontSize: 15,
    color: "#666",
  },
  tabTextActive: {
    color: PRIMARY,
    fontWeight: "600",
  },

  /* 상단 AD 안내 바 */
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#005AC1",
  },
  noticePrefix: {
    color: "white",
    fontWeight: "700",
    marginRight: 6,
  },
  noticeText: {
    color: "white",
    flex: 1,
    fontSize: 12,
  },

  scroll: {
    flex: 1,
  },

  /* 배너 캐러셀 */
  bannerScroll: {
    marginTop: 10,
  },
  bannerSlide: {
    width,
    paddingHorizontal: 10,
  },
  bannerImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#CCC",
  },
  bannerBookmark: {
    position: "absolute",
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* 카드 */
  card: {
    marginTop: 14,
    marginHorizontal: 6,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
  },
  cardImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#DDD",
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardAgency: {
    fontSize: 13,
    color: PRIMARY,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },
  cardDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },

  /* 태그 */
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
  },
  tagText: {
    fontSize: 11,
    color: "#3F5BD9",
  },
  tabsWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E1E4EA",
    backgroundColor: "white",
    paddingVertical: 0,
  },

  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 0,
  },

  mainTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  mainTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: PRIMARY,
  },

  mainTabText: {
    fontSize: 15,
    color: "#666",
  },

  mainTabTextActive: {
    color: PRIMARY,
    fontWeight: "900",
  },

  /* 광고등록 버튼 */
  specialTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    elevation: 3,
  },
  specialTabText: {
    color: "#005AC1",
    fontWeight: "600",
    fontSize: 15,
  },
});
