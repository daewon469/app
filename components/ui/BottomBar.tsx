import { Auth } from "@/lib/api";
import { getSession } from "@/utils/session";
import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import React, { useState } from "react";
import { Alert, Platform, Pressable, Text as RNText, View } from "react-native";
import { Appbar } from "react-native-paper";
import { SafeAreaView } from 'react-native-safe-area-context';
 

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  onToggleMapSearch: () => void;
  mapSearchOpen?: boolean;
  onPressRegionSearch?: () => void;
  openRegionOnMount?: boolean;
};

export default function BottomBar({ onToggleMapSearch, onPressRegionSearch }: Props) {
  const [isLogin, setIsLogin] = useState(false);
  // 하단바 탭(아이콘/라벨) 크기 통일: 기존(24/13)에서 -1
  const TAB_ICON_SIZE = 23;
  const TAB_ICON_BOX_HEIGHT = 26;
  const TAB_LABEL_FONT_SIZE = 15;
  const BAR_BG_COLOR = "#EEF3FF"; // 아주 연한 네이비 톤
  const BAR_FG_COLOR = "#1A2B5F"; // 네이비
  const BAR_HEIGHT = Platform.OS === "ios" ? 49 : 56; // SafeArea(bottom) 제외 높이(탭바 표준)

  // 로그인 판정은 SecureStore의 isLogin("true")만 사용 (토큰/Redux 기반 판정 X)
  React.useEffect(() => {
    (async () => {
      try {
        const [isLoginStr] = await Promise.all([
          SecureStore.getItemAsync("isLogin"),
        ]);
        setIsLogin(isLoginStr === "true");
      } catch {
        setIsLogin(false);
      }
    })();
  }, []);

  const ensureLoginOrRedirect = React.useCallback(async (): Promise<boolean> => {
    try {
      const isLoginStr = await SecureStore.getItemAsync("isLogin");
      const ok = isLoginStr === "true";
      if (!ok) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.push("/login");
      }
      return ok;
    } catch {
      Alert.alert("알림", "로그인이 필요합니다.");
      router.push("/login");
      return false;
    }
  }, []);

  const hasCustomSiteConfig = React.useCallback(async (username: string): Promise<boolean> => {
    try {
      const res = await Auth.getUser(username);
      const inds = (res as any)?.user?.custom_industry_codes ?? [];
      const regs = (res as any)?.user?.custom_region_codes ?? [];
      const hasIndustry = Array.isArray(inds) && inds.map((s: any) => String(s ?? "").trim()).filter(Boolean).length > 0;
      const hasRegion = Array.isArray(regs) && regs.map((s: any) => String(s ?? "").trim()).filter(Boolean).length > 0;
      return hasIndustry || hasRegion;
    } catch {
      // 네트워크 등으로 확인 불가하면 "설정 화면"으로 보내 안전하게 처리
      return false;
    }
  }, []);

  const hasAreaSiteConfig = React.useCallback(async (username: string): Promise<boolean> => {
    try {
      const res = await Auth.getUser(username);
      const regs = (res as any)?.user?.area_region_codes ?? [];
      const hasRegion = Array.isArray(regs) && regs.map((s: any) => String(s ?? "").trim()).filter(Boolean).length > 0;
      return hasRegion;
    } catch {
      // 확인 불가하면 설정으로 보내 안전하게 처리
      return false;
    }
  }, []);

  return (
    <SafeAreaView style={{ paddingBottom: 0 }} edges={['bottom']}>
      <Appbar.Header
        mode="center-aligned"
        statusBarHeight={0}
        style={{
          height: BAR_HEIGHT,
          backgroundColor: BAR_BG_COLOR,
          justifyContent: "space-around",
        }}
      >
        <Pressable
          onPress={() => {
            if (!isLogin) {
              Alert.alert("알림", "로그인이 필요합니다.");
              return;
            }
            onToggleMapSearch();
          }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
            <Ionicons
              name="map"
              size={TAB_ICON_SIZE}
              color={BAR_FG_COLOR}
              style={{ height: TAB_ICON_SIZE, lineHeight: TAB_ICON_SIZE }}
            />
          </View>
          <Text style={{ fontSize: TAB_LABEL_FONT_SIZE, fontWeight: "bold", color: BAR_FG_COLOR }}>
            지도검색
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!isLogin) {
              Alert.alert("알림", "로그인이 필요합니다.");
              return;
            }
            router.push("/textsearch");
          }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
            <Ionicons
              name="search"
              size={TAB_ICON_SIZE}
              color={BAR_FG_COLOR}
              style={{ height: TAB_ICON_SIZE, lineHeight: TAB_ICON_SIZE }}
            />
          </View>
          <Text style={{ fontSize: TAB_LABEL_FONT_SIZE, fontWeight: "bold", color: BAR_FG_COLOR }}>
            제목검색
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!isLogin) {
              Alert.alert("알림", "로그인이 필요합니다.");
              return;
            }
            if (onPressRegionSearch) {
              onPressRegionSearch();
              return;
            }
            (async () => {
              const ok = await ensureLoginOrRedirect();
              if (!ok) return;
              const s = await getSession();
              const u = s.username;
              if (!s.isLogin || !u) {
                Alert.alert("알림", "로그인이 필요합니다.");
                router.push("/login");
                return;
              }
              const hasConfig = await hasAreaSiteConfig(u);
              router.push(hasConfig ? "/arealike" : "/areasite");
            })();
          }}

          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
            <Ionicons
              name="location"
              size={TAB_ICON_SIZE}
              color={BAR_FG_COLOR}
              style={{ height: TAB_ICON_SIZE, lineHeight: TAB_ICON_SIZE }}
            />
          </View>
          <Text style={{ 
            fontSize: TAB_LABEL_FONT_SIZE, 
            fontWeight: "bold", 
            color: BAR_FG_COLOR,
            marginTop: 0,
          }}>
            지역저장
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            (async () => {
              const ok = await ensureLoginOrRedirect();
              if (!ok) return;
              const s = await getSession();
              const u = s.username;
              if (!s.isLogin || !u) {
                Alert.alert("알림", "로그인이 필요합니다.");
                router.push("/login");
                return;
              }
              const hasConfig = await hasCustomSiteConfig(u);
              router.push(hasConfig ? "/customlike" : "/customsite");
            })();
          }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <View
            style={{
              height: TAB_ICON_BOX_HEIGHT,
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="options-outline"
              size={TAB_ICON_SIZE}
              color={BAR_FG_COLOR}
              style={{ height: TAB_ICON_SIZE, lineHeight: TAB_ICON_SIZE, marginTop: 0 }}
            />
          </View>
          <Text style={{ fontSize: TAB_LABEL_FONT_SIZE, fontWeight: "bold", color: BAR_FG_COLOR }}>
            맞춤저장
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            (async () => {
              const ok = await ensureLoginOrRedirect();
              if (!ok) return;
              router.push("/like");
            })();
          }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <View style={{ height: TAB_ICON_BOX_HEIGHT, justifyContent: "center" }}>
            <Ionicons
              name="heart"
              size={TAB_ICON_SIZE}
              color={BAR_FG_COLOR}
              style={{ height: TAB_ICON_SIZE, lineHeight: TAB_ICON_SIZE }}
            />
          </View>
          <Text style={{ fontSize: TAB_LABEL_FONT_SIZE, fontWeight: "bold", color: BAR_FG_COLOR }}>
            관심현장
          </Text>
        </Pressable>
      </Appbar.Header>
    </SafeAreaView>


  );
}





