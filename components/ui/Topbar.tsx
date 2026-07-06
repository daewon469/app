import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text as RNText, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSession } from "../../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export default function TopBar() {
  const [isLogin, setIsLogin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const pathname = usePathname();
  const IS_IOS = Platform.OS === "ios";
  const HEADER_BG = "#0B1B3A";

  // 상단바 탭(아이콘/라벨) 수치: iOS는 더 슬림하게
  const TAB_ICON_SIZE =  23;
  const TAB_ICON_BOX_HEIGHT = 26;
  const TAB_LABEL_FONT_SIZE = 15;
  // 헤더 본체 높이(SafeArea(top) 제외 높이): 아이콘/텍스트 크기는 유지하고 전체 두께만 축소
  const HEADER_HEIGHT = IS_IOS ? 40 : 50;
  const TAB_PADDING_VERTICAL = IS_IOS ? 0 : 2;
  const TAB_PADDING_TOP = TAB_PADDING_VERTICAL;
  const TAB_PADDING_BOTTOM = TAB_PADDING_VERTICAL;
  const HEADER_BORDER_WIDTH = IS_IOS ? StyleSheet.hairlineWidth : 1;
  const tabHitSlop = IS_IOS ? { top: 8, bottom: 8, left: 6, right: 6 } : undefined;
  const tabLabelStyle = {
    fontSize: TAB_LABEL_FONT_SIZE,
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

  const reloadSession = useCallback(async () => {
    const s = await getSession();
    setIsLogin(s.isLogin);
    // 렌더 분기 기준을 isLogin으로 통일하기 위해, 비로그인일 땐 username을 로컬에서 확실히 비움
    setUsername(s.isLogin ? s.username : null);
  }, []);

  useEffect(() => {
    reloadSession();
  }, [pathname, reloadSession]);

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
              const registerActions: {
                text: string;
                style?: "default" | "cancel" | "destructive";
                onPress?: () => void;
              }[] = [
                {
                  text: "재등록",
                  onPress: () => router.push("/mypage"),
                },
                {
                  text: "신규등록",
                  onPress: () => router.push("/write"),
                },
              ];

              if (IS_IOS) {
                registerActions.push({
                  text: "닫기",
                  style: "cancel",
                });
              }

              Alert.alert(
                "안내",
                "재등록을 위해 내 구인글 관리로 이동하시겠습니까?",
                registerActions,
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
            onPress={() => Alert.alert("안내", "업데이트 예정입니다.")}
            style={tabButtonStyle}
          >
            <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
              <Ionicons name="people" size={TAB_ICON_SIZE} color="white" />
            </View>
            <Text style={tabLabelStyle}>협력업체</Text>
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
              onPress={() => router.push("/list4")}
              style={tabButtonStyle}
            >
              <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
                <Ionicons name="megaphone" size={TAB_ICON_SIZE} color="white" />
              </View>
              <Text style={tabLabelStyle}>광고</Text>
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
            <Text style={tabLabelStyle}>{isLogin ? "내페이지" : "회원가입"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>

  );
}
