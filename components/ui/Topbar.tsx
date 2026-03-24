import { Ionicons } from '@expo/vector-icons';
import * as Notifications from "expo-notifications";
import { router, usePathname } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text as RNText, ScrollView, StyleSheet, View } from "react-native";
import { Portal } from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalBackHandler } from "../../hooks/useModalBackHandler";
import { Notify } from "../../lib/api";
import { getSession } from "../../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  type?: string;
  data?: {
    post_id?: number;
    post_type?: number;
    [key: string]: any;
  };
  is_read?: boolean;
};

export default function TopBar() {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [list, setList] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const IS_IOS = Platform.OS === "ios";
  const HEADER_BG = "#0B1B3A";

  // 상단바 탭(아이콘/라벨) 수치: iOS는 더 슬림하게
  const TAB_ICON_SIZE =  23;
  const TAB_ICON_BOX_HEIGHT = 26;
  const TAB_LABEL_FONT_SIZE =  15;
  const TAB_LABEL_LINE_HEIGHT = 13;
  // 헤더 본체 높이(SafeArea(top) 제외 높이)
  const HEADER_HEIGHT = IS_IOS ? 44 : 56;
  const TAB_PADDING_VERTICAL = IS_IOS ? 1 : 6;
  // 헤더 두께는 유지하고, iOS에서 콘텐츠만 살짝 위로
  const TAB_PADDING_TOP = IS_IOS ? 0 : TAB_PADDING_VERTICAL;
  const TAB_PADDING_BOTTOM = IS_IOS ? 2 : TAB_PADDING_VERTICAL;
  const HEADER_BORDER_WIDTH = IS_IOS ? StyleSheet.hairlineWidth : 1;
  const tabHitSlop = IS_IOS ? { top: 8, bottom: 8, left: 6, right: 6 } : undefined;
  const NOTI_ICON_WRAPPER_SIZE = IS_IOS ? 21 : 26;
  const NOTI_BADGE_OFFSET = IS_IOS ? 4 : 6;
  const tabLabelStyle = {
    fontSize: TAB_LABEL_FONT_SIZE,
    lineHeight: TAB_LABEL_LINE_HEIGHT,
    fontWeight: "bold" as const,
    color: "white",
  };
  const tabButtonStyle = {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingTop: TAB_PADDING_TOP,
    paddingBottom: TAB_PADDING_BOTTOM,
  };

  useModalBackHandler(open, () => setOpen(false));

  const getLocalDateKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // local timezone 기준
  };

  const reloadSession = useCallback(async () => {
    const s = await getSession();
    setIsLogin(s.isLogin);
    // 렌더 분기 기준을 isLogin으로 통일하기 위해, 비로그인일 땐 username을 로컬에서 확실히 비움
    setUsername(s.isLogin ? s.username : null);
    if (!s.isLogin) {
      setOpen(false);
      setList([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    reloadSession();
  }, [pathname, reloadSession]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);
  useEffect(() => {
    if (!isLogin || !username) return;

    const fetchBadge = async () => {
      try {
        const count = await Notify.getUnreadCount(username);
        await Notifications.setBadgeCountAsync(count);
      } catch (e) {
        console.warn("배지 업데이트 오류:", e);
      }
    };

    fetchBadge();
  }, [isLogin, username]);
  const loadNotifications = async () => {
    if (!isLogin || !username) return;
    try {
      const data = await Notify.getUnreadNotifications(username);
      setList(data);
    } catch (e) {
      console.warn("알림 불러오기 실패:", e);
    }
  };

  const onPressNotification = async (item: NotificationItem) => {
    if (!isLogin || !username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      setOpen(false);
      return;
    }
    await Notify.markNotificationRead(item.id);

    const count = await Notify.getUnreadCount(username);
    await Notifications.setBadgeCountAsync(count);

    if (item.data?.post_id) {
      router.push({
        pathname: "/[id]",
        params: { id: String(item.data?.post_id) },
      })
    }

    setOpen(false);
    loadNotifications();
  };

  const onPressMarkAllRead = useCallback(async () => {
    if (!isLogin || !username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      setOpen(false);
      return;
    }
    if (markingAll) return;
    if (!list || list.length === 0) return;

    setMarkingAll(true);
    try {
      await Notify.markAllNotificationsRead(list.map((v) => v.id));
      setList([]);
      setUnreadCount(0);
      await Notifications.setBadgeCountAsync(0);
    } catch (e) {
      console.warn("모두 확인 처리 실패:", e);
    } finally {
      setMarkingAll(false);
      // 서버 카운트와 동기화(부분 실패 케이스 대비)
      try {
        const count = await Notify.getUnreadCount(username);
        setUnreadCount(count);
        await Notifications.setBadgeCountAsync(count);
        await loadNotifications();
      } catch {
        // ignore
      }
    }
  }, [isLogin, username, list, markingAll]);

  useEffect(() => {
    if (isLogin && username) {
      loadUnreadCount();
    }
  }, [isLogin, username, open]);

  const loadUnreadCount = async () => {
    try {
      const count = await Notify.getUnreadCount(username ?? "");
      setUnreadCount(count);
    } catch (e) {
      console.log("unread count error", e);
    }
  };

  return (
    <View style={{ position: "relative" }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: HEADER_BG }}>
        <View
          style={{
            height: HEADER_HEIGHT,
            backgroundColor: HEADER_BG,
            flexDirection: "row",
            justifyContent: "flex-start",
            borderBottomWidth: HEADER_BORDER_WIDTH,
            borderBottomColor: "black",
            overflow: "visible",
          }}
        >
          <Pressable
            hitSlop={tabHitSlop}
            onPress={async () => {
              if (!isLogin || !username) {
                Alert.alert("알림", "로그인이 필요합니다.");
                return;
              }
              Alert.alert(
                "안내",
                "재등록을 위해 내 구인글 관리로 이동하시겠습니까?",
                [
                  {
                    text: "재등록",
                    onPress: () => router.push("/mypage"),
                  },
                  {
                    text: "신규등록",

                    style: "cancel",
                    onPress: () => router.push("/write"),
                  },
                ],
                { cancelable: true },
              );
            }}
            style={tabButtonStyle}
          >
            <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
              <Ionicons name="create" size={TAB_ICON_SIZE} color="white" />
            </View>
            <Text style={tabLabelStyle}>구인등록</Text>
          </Pressable>

          <Pressable
            hitSlop={tabHitSlop}
            onPress={() => router.push("/list4")}
            style={tabButtonStyle}
          >
            <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
              <Ionicons name="megaphone" size={TAB_ICON_SIZE} color="white" />
            </View>
            <Text style={tabLabelStyle}>광고</Text>
          </Pressable>

          <Pressable
            hitSlop={tabHitSlop}
            onPress={() => router.push("/list")}
            style={tabButtonStyle}
          >
            <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
              <Ionicons name="home" size={TAB_ICON_SIZE} color="white" />
            </View>
            <Text style={tabLabelStyle}>첫화면</Text>
          </Pressable>

          {isLogin ? (
            <Pressable
              hitSlop={tabHitSlop}
              onPress={() => {
                if (!username) {
                  Alert.alert("알림", "로그인이 필요합니다.");
                  return;
                }
                setOpen((v) => !v);
              }}
              style={tabButtonStyle}
            >
              <View
                style={{
                  position: "relative",
                  width: NOTI_ICON_WRAPPER_SIZE,
                  height: NOTI_ICON_WRAPPER_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="notifications" size={TAB_ICON_SIZE} color="white" />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -NOTI_BADGE_OFFSET,
                      right: -NOTI_BADGE_OFFSET,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: "red",
                      justifyContent: "center",
                      alignItems: "center",
                      paddingHorizontal: 4,
                      borderWidth: 2,
                      borderColor: HEADER_BG,
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
                      {unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={tabLabelStyle}>알림</Text>
            </Pressable>
          ) : (
            <Pressable
              hitSlop={tabHitSlop}
              onPress={() => router.push("/login")}
              style={tabButtonStyle}
            >
              <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
                <Ionicons name="log-in" size={TAB_ICON_SIZE} color="white" />
              </View>
              <Text style={tabLabelStyle}>로그인</Text>
            </Pressable>
          )}

          <Pressable
            hitSlop={tabHitSlop}
            onPress={() => {
              if (isLogin) router.push("/myboard");
              else router.push("/check2");
            }}
            style={tabButtonStyle}
          >
            <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
              <Ionicons name="person" size={TAB_ICON_SIZE} color="white" />
            </View>
            <Text style={tabLabelStyle}>{isLogin ? "마이메뉴" : "회원가입"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <Portal>
        {open && (
          <Pressable
            onPress={() => setOpen(false)}
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                height: 260,
                top: (insets?.top ?? 0) + HEADER_HEIGHT + 6,
                right: 8,
                width: 260,
                backgroundColor: "#fff",
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 12,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600" }}>
                  알림
                </Text>

                <Pressable
                  onPress={onPressMarkAllRead}
                  disabled={markingAll || list.length === 0}
                  style={({ pressed }) => ({
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: (markingAll || list.length === 0)
                      ? "#E5E5E5"
                      : (pressed ? "#1E5BFF" : "#2F6BFF"),
                  })}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: (markingAll || list.length === 0) ? "#9A9A9A" : "#FFFFFF",
                    }}
                  >
                    모두 확인
                  </Text>
                </Pressable>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#E0E0E0",

                  flex: 1,
                }}
              >
                {list.length === 0 ? (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "#777", fontSize: 14, marginTop: 8 }}>
                      알림이 없습니다
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 180 }}>
                    {list.map((item: NotificationItem) => (
                      <Pressable
                        key={item.id}
                        onPress={() => onPressNotification(item)}
                        style={{
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: "#E5E5E5",

                        }}
                      >
                        <Text style={{ fontWeight: "600", fontSize: 14 }}>
                          {item.title}
                        </Text>
                        <Text style={{ color: "#555", fontSize: 13 }}>
                          {item.body}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            </Pressable>
          </Pressable>
        )}
      </Portal>
    </View>

  );
}
