import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { AdminUsers, Auth, OwnerUsers, type AdminUserListItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

const digitsOnly = (s: string) => (s || "").replace(/[^0-9]/g, "");
const formatCommaNumber = (digits: string) => {
  const d = digitsOnly(digits);
  if (!d) return "";
  const n = Number(d);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ko-KR");
};

type RestrictionDraft = {
  post1Days: string;
  post3Days: string;
  post4Days: string;
  reason: string;
};

type AdminUserListItemEx = AdminUserListItem & {
  admin_acknowledged?: boolean;
};

export default function AdminUserListScreen() {
  const insets = useSafeAreaInsets();
  const BOTTOM_BAR_HEIGHT = 61;

  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      primary: "#4A6CF7",
      danger: "#ff3b30",
    }),
    []
  );

  const [actor, setActor] = useState<string | null>(null);
  const [actorIsOwner, setActorIsOwner] = useState(false);
  const [actorIsAdmin, setActorIsAdmin] = useState(false);

  const [items, setItems] = useState<AdminUserListItemEx[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionTargetUser, setActionTargetUser] = useState<AdminUserListItemEx | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const [restrictionVisible, setRestrictionVisible] = useState(false);
  const [restrictionDraft, setRestrictionDraft] = useState<RestrictionDraft>({
    post1Days: "",
    post3Days: "",
    post4Days: "",
    reason: "",
  });
  const [savingRestriction, setSavingRestriction] = useState(false);

  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [sendingNotify, setSendingNotify] = useState(false);

  const [grantVisible, setGrantVisible] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [settingAdmin, setSettingAdmin] = useState(false);

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
      const [isLoginStr, username] = await Promise.all([
        SecureStore.getItemAsync("isLogin"),
        SecureStore.getItemAsync("username"),
      ]);
      if (isLoginStr !== "true" || !username) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.replace("/login");
        return;
      }
      setActor(username);
      // 권한 플래그는 서버가 최종 방어하지만, 프런트 UX 분리를 위해 요약값을 한 번 더 확인
      // (권한 관련 값이 stale일 수 있으므로, 서버 응답(status=3)을 최종 기준으로 처리)
      try {
        // mypage 요약을 재활용하지 않고, 우선 안전한 기본값으로 시작
        // 상세 권한은 API 응답(status=3)으로 UX 처리
        // 다만 과거 구현이 grade>=3도 오너 메뉴로 노출하므로, 지급 버튼은 is_owner만 true일 때만 보여줌
        // -> 여기서는 로컬 플래그만 관리(서버에서 status=3이면 뒤로가기)
        const summaryRaw = await Auth.getMyPageSummary(username);
        setActorIsOwner(Boolean((summaryRaw as any)?.is_owner ?? false));
        setActorIsAdmin(Boolean((summaryRaw as any)?.admin_acknowledged ?? false));
      } catch {
        setActorIsOwner(false);
        setActorIsAdmin(false);
      }
    })();
  }, []);

  // 검색 디바운스(입력 멈춘 뒤 검색)
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery((searchText || "").trim()), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AdminUsers.list(null, 50, searchQuery || null);
      if (res.status !== 0) {
        Alert.alert("오류", "회원 목록을 불러올 수 없습니다.");
        setItems([]);
        setNextCursor(null);
        return;
      }
      setItems(res.items ?? []);
      setNextCursor(res.next_cursor ?? null);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const fetchMore = useCallback(async () => {
    if (loadingMore) return;
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await AdminUsers.list(nextCursor, 50, searchQuery || null);
      if (res.status !== 0) return;
      setItems((prev) => [...prev, ...(res.items ?? [])]);
      setNextCursor(res.next_cursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, searchQuery]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFirstPage();
    } finally {
      setRefreshing(false);
    }
  }, [fetchFirstPage]);

  const openActions = (user: AdminUserListItemEx) => {
    setActionTarget(user.nickname);
    setActionTargetUser(user);
    setActionSheetVisible(true);
  };

  const closeAllModals = () => {
    setActionSheetVisible(false);
    setRestrictionVisible(false);
    setNotifyVisible(false);
    setGrantVisible(false);
  };

  const handleViewDetail = () => {
    if (!actionTarget || !actor) return;
    setActionSheetVisible(false);
    router.push({
      pathname: "/adminuserdetail",
      params: { target: actionTarget, actor },
    });
  };

  const handleOpenRestriction = () => {
    setActionSheetVisible(false);
    setRestrictionDraft({ post1Days: "", post3Days: "", post4Days: "", reason: "" });
    setRestrictionVisible(true);
  };

  const handleOpenNotify = () => {
    setActionSheetVisible(false);
    setNotifyTitle("");
    setNotifyBody("");
    setNotifyVisible(true);
  };

  const handleViewPoints = () => {
    if (!actionTarget) return;
    setActionSheetVisible(false);
    router.push({ pathname: "/points", params: { username: actionTarget } });
  };

  const handleViewCash = () => {
    if (!actionTarget) return;
    setActionSheetVisible(false);
    router.push({ pathname: "/cash", params: { username: actionTarget } });
  };

  const handleOpenGrant = () => {
    setActionSheetVisible(false);
    setGrantAmount("");
    setGrantReason("");
    setGrantVisible(true);
  };

  const handleApplyRestriction = async () => {
    if (!actionTarget || !actor) return;
    if (savingRestriction) return;

    const toDays = (s: string) => {
      const n = Number((s || "").trim());
      if (!Number.isFinite(n)) return null;
      if (n < 0) return null;
      return Math.floor(n);
    };

    const d1 = toDays(restrictionDraft.post1Days);
    const d3 = toDays(restrictionDraft.post3Days);
    const d4 = toDays(restrictionDraft.post4Days);

    const changes: { post_type: number; days: number }[] = [];
    if (d1 !== null) changes.push({ post_type: 1, days: d1 });
    if (d3 !== null) changes.push({ post_type: 3, days: d3 });
    if (d4 !== null) changes.push({ post_type: 4, days: d4 });

    if (changes.length === 0) {
      Alert.alert("입력 필요", "제재 일수를 0 이상 숫자로 입력해 주세요. (0은 해제)");
      return;
    }

    setSavingRestriction(true);
    try {
      const res = await AdminUsers.setRestrictions(actionTarget, actor, changes, restrictionDraft.reason);
      if (res.status !== 0) {
        Alert.alert("오류", "제재 설정에 실패했습니다.");
        return;
      }
      Alert.alert("완료", "제재 설정이 적용되었습니다.");
      setRestrictionVisible(false);
    } finally {
      setSavingRestriction(false);
    }
  };

  const handleSendNotify = async () => {
    if (!actionTarget || !actor) return;
    if (sendingNotify) return;

    const title = (notifyTitle || "").trim();
    const body = (notifyBody || "").trim();
    if (!title) {
      Alert.alert("입력 오류", "제목을 입력해 주세요.");
      return;
    }
    if (!body) {
      Alert.alert("입력 오류", "내용을 입력해 주세요.");
      return;
    }

    setSendingNotify(true);
    try {
      const res = await AdminUsers.notifyUser(actionTarget, actor, title, body);
      if (res.status !== 0) {
        Alert.alert("오류", "알림 전송에 실패했습니다.");
        return;
      }
      Alert.alert("완료", "알림을 전송했습니다.");
      setNotifyVisible(false);
    } finally {
      setSendingNotify(false);
    }
  };

  const handleGrantPoints = async () => {
    if (!actionTarget || !actor) return;
    if (granting) return;

    const amountRaw = digitsOnly(grantAmount);
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("입력 오류", "지급 포인트는 1 이상의 숫자여야 합니다.");
      return;
    }
    const reason = (grantReason || "").trim();
    if (!reason) {
      Alert.alert("입력 오류", "사유(reason)를 입력해 주세요.");
      return;
    }

    setGranting(true);
    try {
      const res = await OwnerUsers.grantPoints(actionTarget, actor, Math.floor(amount), reason);
      if (res.status !== 0) {
        Alert.alert("오류", "포인트 지급에 실패했습니다.");
        return;
      }
      Alert.alert("완료", "포인트가 지급되었습니다.");
      setGrantVisible(false);
    } finally {
      setGranting(false);
    }
  };

  const handleSetAdminAcknowledged = async () => {
    if (!actionTarget || !actor) return;
    if (!actorIsOwner) return;
    if (settingAdmin) return;

    const current = Boolean(actionTargetUser?.admin_acknowledged ?? false);
    const next = !current;

    Alert.alert("관리자 수정", next ? `${actionTarget}님을 관리자로 지정할까요?` : `${actionTarget}님의 관리자 권한을 회수할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: next ? "부여" : "회수",
        style: "default",
        onPress: async () => {
          setSettingAdmin(true);
          try {
            const res = await OwnerUsers.setAdminAcknowledged(actionTarget, actor, next);
            if (res.status !== 0) {
              Alert.alert("오류", "관리자 수정에 실패했습니다.");
              return;
            }
            setItems((prev) => prev.map((u) => (u.nickname === actionTarget ? { ...u, admin_acknowledged: next } : u)));
            setActionTargetUser((prev) => (prev && prev.nickname === actionTarget ? { ...prev, admin_acknowledged: next } : prev));
            Alert.alert("완료", next ? "관리자 권한이 부여되었습니다." : "관리자 권한이 회수되었습니다.");
            setActionSheetVisible(false);
          } finally {
            setSettingAdmin(false);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item, index }: { item: AdminUserListItemEx; index: number }) => (
    <Pressable
      onPress={() => openActions(item)}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }} numberOfLines={1}>
            <Text style={{ color: colors.subText }}>{items.length - index}.</Text>
            {item.nickname}
          </Text>
          <Text
            style={{ marginLeft: 10, fontSize: 14, fontWeight: "800", color: colors.primary }}
            numberOfLines={1}
          >
            {item.name ?? "-"}
          </Text>
        </View>
        <Text style={{ marginLeft: 12, fontSize: 12, fontWeight: "800", color: colors.subText, textAlign: "right" }}>
          {item.signup_date ?? "-"}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>회원 관리</Text>
        <Text style={{ marginTop: 4, fontSize: 12, color: colors.subText }}>
          {actor ? `접속 계정: ${actor}` : "세션 확인 중..."}{" "}
          {actorIsAdmin ? "(관리자)" : ""} {actorIsOwner ? "(오너)" : ""}
        </Text>
      </View>

      {/* Search */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "white",
          borderWidth: 1,
          borderColor: "black",
          borderRadius: 8,
          paddingHorizontal: 8,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <TextInput
          style={{ flex: 1, height: 45, fontSize: 16, color: "black" }}
          placeholder="닉네임/성함 검색"
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => setSearchQuery((searchText || "").trim())}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setSearchQuery((searchText || "").trim())}
          style={{
            backgroundColor: "#4A6CF7",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>검색</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: colors.subText }}>불러오는 중...</Text>
        </View>
      ) : (
        <Animated.FlatList
          ref={scrollRef}
          data={items}
          keyExtractor={(u, idx) => `${(u as any)?.id ?? u.nickname}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.2}
          onEndReached={fetchMore}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={{ paddingTop: 40 }}>
              <Text style={{ textAlign: "center", color: colors.subText }}>회원이 없습니다.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}

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

      {/* ActionSheet */}
      <Modal visible={actionSheetVisible} transparent animationType="fade" onRequestClose={() => setActionSheetVisible(false)}>
        <Pressable
          onPress={() => setActionSheetVisible(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              padding: 16,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
              적용 대상 : {actionTarget ?? "사용자"} 
            </Text>

            <Pressable onPress={handleViewDetail} style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>열람(읽기 전용)</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />

            <Pressable onPress={handleOpenRestriction} style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>제재(작성 제한)</Text>
            </Pressable>

            <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
            <Pressable onPress={handleOpenNotify} style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>알림 전송</Text>
            </Pressable>

            <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
            <Pressable onPress={handleViewPoints} style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>포인트 내역 열람</Text>
            </Pressable>

            <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
            <Pressable onPress={handleViewCash} style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>캐시 내역 열람</Text>
            </Pressable>

            {/* 오너만 지급 노출 */}
            {actorIsOwner && (
              <>
                <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
                <Pressable onPress={handleSetAdminAcknowledged} style={{ paddingVertical: 14 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "900",
                      color:
                        !settingAdmin && !Boolean(actionTargetUser?.admin_acknowledged ?? false)
                          ? colors.primary
                          : colors.text,
                    }}
                  >
                    {settingAdmin
                      ? "관리자 수정 중..."
                      : Boolean(actionTargetUser?.admin_acknowledged ?? false)
                        ? "관리자 권한 회수"
                        : "관리자 권한 부여(오너)"}
                  </Text>
                </Pressable>
                <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
                <Pressable onPress={handleOpenGrant} style={{ paddingVertical: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: colors.primary }}>포인트 지급(오너)</Text>
                </Pressable>
              </>
            )}

            <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }} />
            <Pressable onPress={() => setActionSheetVisible(false)} style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.danger }}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* RestrictionModal */}
      <Modal visible={restrictionVisible} transparent animationType="fade" onRequestClose={() => setRestrictionVisible(false)}>
        <Pressable
          onPress={() => setRestrictionVisible(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>제재 설정</Text>
            <Text style={{ marginTop: 6, fontSize: 12, color: colors.subText }}>
              일수(days)를 입력하세요. 0은 해제입니다.
            </Text>

            <Field
              label="구인글(post_type=1) 제한 일수"
              value={restrictionDraft.post1Days}
              onChange={(v) => setRestrictionDraft((p) => ({ ...p, post1Days: v }))}
            />
            <Field
              label="수다글(post_type=3) 제한 일수"
              value={restrictionDraft.post3Days}
              onChange={(v) => setRestrictionDraft((p) => ({ ...p, post3Days: v }))}
            />
            <Field
              label="광고글(post_type=4) 제한 일수"
              value={restrictionDraft.post4Days}
              onChange={(v) => setRestrictionDraft((p) => ({ ...p, post4Days: v }))}
            />
            <Field
              label="사유(선택)"
              value={restrictionDraft.reason}
              onChange={(v) => setRestrictionDraft((p) => ({ ...p, reason: v }))}
              multiline
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => setRestrictionVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  opacity: savingRestriction ? 0.6 : 1,
                }}
                disabled={savingRestriction}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyRestriction}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: savingRestriction ? 0.6 : 1,
                }}
                disabled={savingRestriction}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {savingRestriction ? "적용 중..." : "적용"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* NotifyModal */}
      <Modal visible={notifyVisible} transparent animationType="fade" onRequestClose={() => setNotifyVisible(false)}>
        <Pressable
          onPress={() => setNotifyVisible(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>알림 전송</Text>
            <Text style={{ marginTop: 6, fontSize: 12, color: colors.subText }}>
              대상: {actionTarget ?? "-"}
            </Text>

            <Field label="제목" value={notifyTitle} onChange={setNotifyTitle} />
            <Field label="내용" value={notifyBody} onChange={setNotifyBody} multiline />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => setNotifyVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  opacity: sendingNotify ? 0.6 : 1,
                }}
                disabled={sendingNotify}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleSendNotify}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: sendingNotify ? 0.6 : 1,
                }}
                disabled={sendingNotify}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {sendingNotify ? "전송 중..." : "전송"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* GrantPointModal */}
      <Modal visible={grantVisible} transparent animationType="fade" onRequestClose={() => setGrantVisible(false)}>
        <Pressable
          onPress={() => setGrantVisible(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>포인트 지급(오너)</Text>
            <Field
              label="지급 포인트(amount)"
              value={formatCommaNumber(grantAmount)}
              onChange={(t) => setGrantAmount(digitsOnly(t))}
              keyboardType="numeric"
            />
            <Field label="사유(reason)" value={grantReason} onChange={setGrantReason} />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => setGrantVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  opacity: granting ? 0.6 : 1,
                }}
                disabled={granting}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleGrantPoints}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: granting ? 0.6 : 1,
                }}
                disabled={granting}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {granting ? "지급 중..." : "지급"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", marginBottom: 6, fontWeight: "800" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="입력"
        placeholderTextColor="rgba(0,0,0,0.35)"
        keyboardType={keyboardType ?? "default"}
        multiline={!!multiline}
        style={{
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.2)",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 9,
          minHeight: multiline ? 70 : undefined,
          backgroundColor: "#fff",
          color: "#111",
        }}
      />
    </View>
  );
}

