import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text as RNText, View } from "react-native";
import { Auth, Notify } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  type?: string;
  created_at?: string | null;
  data?: {
    post_id?: number;
    post_type?: number;
    [key: string]: any;
  };
  is_read?: boolean;
  // 관리자 보낸 내역용
  target_username?: string | null;
};

export default function NotiPage() {
  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#ddd",
      primary: "#2F6BFF",
    }),
    [],
  );

  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [sentList, setSentList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [canSeeSent, setCanSeeSent] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");

  const syncBadgeAndCount = useCallback(async (u: string) => {
    try {
      const count = await Notify.getUnreadCount(u);
      await Notifications.setBadgeCountAsync(count);
      return count;
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const s = await getSession();
    setIsLogin(s.isLogin);
    setUsername(s.isLogin ? s.username : null);
    if (!s.isLogin || !s.username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      router.replace("/login");
      return;
    }

    setLoading(true);
    try {
      // 관리자 여부 확인(보낸 내역 탭 표시용)
      const summary = await Auth.getMyPageSummary(s.username);
      const isAdmin = !!(summary && (summary.admin_acknowledged || (summary as any).is_owner));
      setCanSeeSent(isAdmin);

      const rows = await Notify.getAllNotifications(s.username);
      setList(Array.isArray(rows) ? rows : []);

      if (isAdmin) {
        try {
          const sent = await Notify.getAdminSentNotifications(s.username, { limit: 1000 });
          const items = Array.isArray(sent?.items) ? sent.items : [];
          setSentList(items);
        } catch (e) {
          console.warn("보낸 알림 내역 불러오기 실패:", e);
          setSentList([]);
        }
      } else {
        setSentList([]);
      }
      await syncBadgeAndCount(s.username);
    } catch (e) {
      console.warn("알림 내역 불러오기 실패:", e);
      setList([]);
      setSentList([]);
    } finally {
      setLoading(false);
    }
  }, [syncBadgeAndCount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onPressItem = useCallback(
    async (item: NotificationItem) => {
      if (!isLogin || !username) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.replace("/login");
        return;
      }
      try {
        await Notify.markNotificationRead(item.id);
        setList((prev) => prev.map((v) => (v.id === item.id ? { ...v, is_read: true } : v)));
        await syncBadgeAndCount(username);
      } catch (e) {
        console.warn("알림 읽음 처리 실패:", e);
      }

      if (item.data?.post_id) {
        router.push({
          pathname: "/[id]",
          params: { id: String(item.data.post_id) },
        });
      }
    },
    [isLogin, username, syncBadgeAndCount],
  );

  const onPressMarkAllRead = useCallback(async () => {
    if (!isLogin || !username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      router.replace("/login");
      return;
    }
    if (markingAll) return;
    if (tab !== "inbox") return;
    if (list.length === 0) return;

    setMarkingAll(true);
    try {
      // 서버 일괄 처리 우선 (실패 시 legacy 순회로 fallback)
      try {
        await Notify.markAllNotificationsReadByUser(username);
      } catch {
        await Notify.markAllNotificationsRead(list.map((v) => v.id));
      }
      setList((prev) => prev.map((v) => ({ ...v, is_read: true })));
      await Notifications.setBadgeCountAsync(0);
    } catch (e) {
      console.warn("모두 확인 처리 실패:", e);
    } finally {
      setMarkingAll(false);
      await syncBadgeAndCount(username);
    }
  }, [isLogin, username, list, markingAll, syncBadgeAndCount, tab]);

  const formatDateTime = useCallback((v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }, []);

  const renderRows = tab === "sent" ? sentList : list;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text, marginLeft: 6 }}>내 알림 내역</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={onPressMarkAllRead}
            disabled={tab !== "inbox" || markingAll || list.length === 0}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: (markingAll || list.length === 0)
                ? "#E5E5E5"
                : (pressed ? "#1E5BFF" : colors.primary),
            })}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "900",
                color: (markingAll || list.length === 0) ? "#9A9A9A" : "#FFFFFF",
              }}
            >
              모두 확인
            </Text>
          </Pressable>
        </View>
      </View>

      {canSeeSent && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <Pressable
            onPress={() => setTab("inbox")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: tab === "inbox" ? colors.primary : "#FFFFFF",
              borderWidth: 1,
              borderColor: "#000",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "900", color: tab === "inbox" ? "#fff" : colors.text }}>
              받은 알림
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("sent")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: tab === "sent" ? colors.primary : "#FFFFFF",
              borderWidth: 1,
              borderColor: "#000",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "900", color: tab === "sent" ? "#fff" : colors.text }}>
              보낸 알림
            </Text>
          </Pressable>
        </View>
      )}

      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: "#000",
          borderRadius: 12,
          overflow: "hidden",
          flex: 1,
        }}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: colors.subText }}>불러오는 중...</Text>
          </View>
        ) : renderRows.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-off-outline" size={28} color={colors.subText} />
            <Text style={{ marginTop: 10, color: colors.subText }}>알림이 없습니다</Text>
          </View>
        ) : (
          <FlatList
            data={renderRows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => (tab === "inbox" ? onPressItem(item) : undefined)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: "rgba(0,0,0,0.10)",
                  backgroundColor: pressed ? "rgba(47,107,255,0.08)" : "#FFFFFF",
                  opacity: tab === "inbox" && item.is_read ? 0.75 : 1,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "900", color: colors.text }}>
                    {String(item.title ?? "")}
                  </Text>
                  {!!formatDateTime(item.created_at) && (
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.subText }}>
                      {formatDateTime(item.created_at)}
                    </Text>
                  )}
                </View>
                <Text style={{ marginTop: 4, fontSize: 13, color: "#555" }}>
                  {String(item.body ?? "")}
                </Text>
                {tab === "sent" && (
                  <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: colors.subText }}>
                    받는 사람: {String(item.target_username ?? "")}
                    {"  "}
                    {item.is_read ? "(확인)" : "(미확인)"}
                  </Text>
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

