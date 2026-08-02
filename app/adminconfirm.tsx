import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as RNText,
  View,
} from "react-native";
import { AdminUsers, Auth, OwnerUsers, type AdminUserListItem } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type AdminItem = AdminUserListItem & { admin_acknowledged?: boolean };

export default function AdminConfirmScreen() {
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
    [],
  );

  const [actor, setActor] = useState<string | null>(null);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    const admins: AdminItem[] = [];
    let cursor: string | null | undefined = undefined;
    for (let i = 0; i < 40; i++) {
      const res = await AdminUsers.list(cursor, 50, null);
      if (res.status === 3) {
        Alert.alert("권한 없음", "오너만 확인할 수 있습니다.");
        router.replace("/myboard");
        return;
      }
      if (res.status !== 0) {
        Alert.alert("오류", "관리자 목록을 불러오지 못했습니다.");
        return;
      }
      for (const u of res.items || []) {
        if (u.admin_acknowledged) admins.push(u);
      }
      cursor = res.next_cursor;
      if (!cursor) break;
    }
    setItems(admins);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s.isLogin || !s.username) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.replace("/login");
        return;
      }
      const summary = await Auth.getMyPageSummary(s.username);
      if (summary.status !== 0 || !summary.is_owner) {
        Alert.alert("권한 없음", "오너만 확인할 수 있습니다.");
        router.replace("/myboard");
        return;
      }
      setActor(s.username);
      setLoading(true);
      try {
        await loadAdmins();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAdmins]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAdmins();
    } finally {
      setRefreshing(false);
    }
  }, [loadAdmins]);

  const onRevoke = (nickname: string) => {
    if (!actor) return;
    Alert.alert("관리자 취소", `${nickname}님의 관리자 권한을 회수할까요?`, [
      { text: "닫기", style: "cancel" },
      {
        text: "취소하기",
        style: "destructive",
        onPress: async () => {
          setRevoking(nickname);
          try {
            const res = await OwnerUsers.setAdminAcknowledged(nickname, actor, false);
            if (res.status !== 0) {
              Alert.alert("오류", "관리자 권한 회수에 실패했습니다.");
              return;
            }
            setItems((prev) => prev.filter((u) => u.nickname !== nickname));
            Alert.alert("완료", "관리자 권한을 회수했습니다.");
          } finally {
            setRevoking(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>← 내페이지</Text>
      </Pressable>
      <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
        관리자 확인 (오너용)
      </Text>
      <Text style={{ marginTop: 6, fontSize: 13, color: colors.subText }}>
        현재 관리자로 지정된 회원을 확인하고, 필요 시 권한을 취소할 수 있습니다.
      </Text>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
          }
        >
          {items.length === 0 ? (
            <Text style={{ textAlign: "center", color: colors.subText, marginTop: 40 }}>
              현재 관리자가 없습니다.
            </Text>
          ) : (
            items.map((u) => (
              <View
                key={u.nickname}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  backgroundColor: colors.card,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>
                    {u.nickname}
                  </Text>
                  {!!u.name && (
                    <Text style={{ marginTop: 2, fontSize: 13, color: colors.subText }}>
                      {u.name}
                    </Text>
                  )}
                  {!!u.signup_date && (
                    <Text style={{ marginTop: 2, fontSize: 12, color: colors.subText }}>
                      가입: {String(u.signup_date).slice(0, 10)}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => onRevoke(u.nickname)}
                  disabled={revoking === u.nickname}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.danger,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    opacity: revoking === u.nickname ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 13 }}>
                    {revoking === u.nickname ? "처리 중..." : "취소"}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
