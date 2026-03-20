import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  Text as RNText,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Auth, Post, Posts, StatusType } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const STATUS_TABS: (StatusType | "all")[] = ["all", "published", "closed"];

export default function MyPage() {
  const insets = useSafeAreaInsets();
  const BOTTOM_BAR_HEIGHT = 61;

  const colors = {
    background: "#fff",
    card:  "#fff",
    text:  "#000",
    border:  "#000",
    primary: "#4A6CF7",
    link: "blue",
  };

  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actorIsOwner, setActorIsOwner] = useState(false);
  const [tab, setTab] = useState<(StatusType | "all")>("all");
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repostingId, setRepostingId] = useState<number | null>(null);

  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(
    () => ({ contentHeight, layoutHeight }),
    [contentHeight, layoutHeight]
  );


  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s.isLogin || !s.username) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.replace("/login");
        return;
      }
      setMe(s.username);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!me) {
        setIsAdmin(false);
        setActorIsOwner(false);
        return;
      }
      try {
        const res = await Auth.getMyPageSummary(me);
        setIsAdmin(res.status === 0 && !!res.admin_acknowledged);
        setActorIsOwner(res.status === 0 && !!res.is_owner);
      } catch {
        setIsAdmin(false);
        setActorIsOwner(false);
      }
    })();
  }, [me]);

const fetchList = useCallback(
  async (reset = false) => {
    if (loading || !me) return;
    setLoading(true);

    try {
      const { items: list, next_cursor } = await Posts.mylist(
        3, 
        me,
        {
          status: tab === "all" ? undefined : tab,
          cursor: reset ? undefined : cursor,
          limit: 20,
        }
      );

      const merged = reset ? list : [...items, ...list];

      setItems(merged);
      setCursor(next_cursor);
    } finally {
      setLoading(false);
    }
  },
  [tab, cursor, items, me, loading]
);

  useEffect(() => {
    if (!me) return;
    setCursor(undefined);
    setItems([]);
    fetchList(true);
  }, [tab, me]); 

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList(true);
    setRefreshing(false);
  }, [fetchList]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || !me) return;
    await fetchList(false);
  }, [cursor, loading, me, fetchList]);

  const onDelete = (post: Post) => {
    Alert.alert("삭제", "정말 삭제하시겠습니까?", [
      { text: "취소" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const prev = items;
          setItems(prev.filter((i) => i.id !== post.id));
          try {
            await Posts.remove(post.id);
          } catch {
            Alert.alert("오류", "삭제에 실패했습니다.");
            setItems(prev);
          }
        },
      },
    ]);
  };

  const onClose = async (post: Post) => {
    const prev = items;
    const next = prev.map((p) => (p.id === post.id ? { ...p, status: "closed" } : p));
    setItems(next);
    try {
      await Posts.changeStatus(post.id, "closed");
    } catch {
      Alert.alert("오류", "마감 처리에 실패했습니다.");
      setItems(prev);
    }
  };

  const onPublish = async (post: Post) => {
    const prev = items;
    const next = prev.map((p) => (p.id === post.id ? { ...p, status: "published" } : p));
    setItems(next);
    try {
      await Posts.changeStatus(post.id, "published");
    } catch {
      Alert.alert("오류", "게시 처리에 실패했습니다.");
      setItems(prev);
    }
  };

  const onEdit = (post: Post) => {
    router.push({ pathname: "/write3", params: { id: String(post.id) } });
  };

  const onRecreate = (post: Post) => {
    if (!me) return;
    Alert.alert("재등록", "동일한 글을 복사해서 새 글로 등록할까요?", [
      { text: "취소" },
      {
        text: "재등록",
        onPress: async () => {
          setRepostingId(post.id);
          try {
            await Posts.recreate(post.id, me);
            Alert.alert("완료", "재등록되었습니다.");
            setCursor(undefined);
            await fetchList(true);
          } catch (e: any) {
            const msg =
              e?.response?.data?.detail ??
              e?.response?.data?.message ??
              e?.message ??
              "재등록에 실패했습니다.";
            Alert.alert("오류", String(msg));
          } finally {
            setRepostingId(null);
          }
        },
      },
    ]);
  };

  const statusLabel = (s: string) => {
    if (s === "published") return "게시내역";
    if (s === "closed") return "마감내역";
    return s;
  };

  const renderItem = ({ item }: { item: Post }) => {
    const ownerFromItem = item.community?.is_owner;
    const canDelete =
      typeof ownerFromItem === "boolean" ? ownerFromItem : Boolean(item.is_owner ?? actorIsOwner);

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginVertical: 8,
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.text }}>{item.title}</Text>
        <Text numberOfLines={2} style={{ color: colors.text }}>
          {item.content}
        </Text>
        <Text style={{ fontSize: 12, color: colors.text }}>
          상태: {statusLabel(item.status)}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 4,
            marginTop: 8,
            flexWrap: "nowrap",
            justifyContent: "space-between",
          }}
        >
          <ActionBtn
            label={repostingId === item.id ? "재등록 중..." : "재등록"}
            onPress={() => onRecreate(item)}
            disabled={repostingId === item.id}
            colors={colors}
          />
          <ActionBtn label="수정" onPress={() => onEdit(item)} colors={colors} />
          <ActionBtn
            label="마감"
            onPress={() => onClose(item)}
            disabled={item.status === "closed"}
            colors={colors}
          />
          <ActionBtn
            label="게시"
            onPress={() => onPublish(item)}
            disabled={item.status === "published"}
            colors={colors}
          />
          {canDelete && (
            <ActionBtn label="삭제" danger onPress={() => onDelete(item)} colors={colors} />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {STATUS_TABS.map((s) => (
          <Tab
            key={s}
            active={tab === s}
            label={s === "all" ? "전체" : s === "published" ? "게시내역" : "마감내역"}
            onPress={() => setTab(s)}
            colors={colors}
          />
        ))}
      </View>

      <Animated.FlatList
        ref={scrollRef}
        data={items}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 40 }}
        onEndReachedThreshold={0.2}
        onEndReached={loadMore}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
            titleColor="#000"
          />
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ textAlign: "center", color: colors.text, marginTop: 40 }}>
              내 글이 없습니다.
            </Text>
          ) : null
        }
      />

      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => scrollRef.current?.scrollToOffset?.({ offset: 0, animated: true })}
        onBottom={() =>
          scrollRef.current?.scrollToOffset?.({
            offset: Math.max(contentHeight - layoutHeight, 0),
            animated: true,
          })
        }
        bottomOffset={BOTTOM_BAR_HEIGHT + insets.bottom}
        topOffset={0}
        trackOpacity={0.6}
        thumbOpacity={1.0}
        barWidth={4}
      />
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionBtn({
  label,
  onPress,
  danger,
  disabled,
  colors,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  colors: any;
}) {
  const bg = danger ? (/* 위험 동작은 테마 중성 배경 + 보더로 */ colors.card) : colors.card;
  const border = danger ? "#ff6b63" : colors.border;
  const textColor = danger ? "#ff6b63" : colors.text;

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.2}
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: disabled ? 0.35 : 1,
        alignItems: "center",
      }}
    >
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: textColor, fontWeight: "600", fontSize: 12 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
