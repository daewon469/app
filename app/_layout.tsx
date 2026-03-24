import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from "expo-constants";
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SecureStore from "expo-secure-store";
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Text, TextInput, View } from "react-native";
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import 'react-native-reanimated';
import { Provider } from 'react-redux';
import ForceUpdateModal from "../components/ui/ForceUpdateModal";
import TopBar from "../components/ui/Topbar";
import { AppMeta, Notify } from "../lib/api";
import { store } from "../store";
import { compareVersions } from "../utils/compareVersions";

function disableFontScalingGlobally() {
  // 기기 "글자 크기" 설정과 무관하게 앱 폰트 크기를 고정합니다.
  const TextAny = Text as any;
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.allowFontScaling = false;

  const TextInputAny = TextInput as any;
  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.allowFontScaling = false;
}

disableFontScalingGlobally();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [forceUpdateVisible, setForceUpdateVisible] = useState(false);
  const [forceUpdateInfo, setForceUpdateInfo] = useState<{
    currentVersion?: string | null;
    latestVersion?: string | null;
    storeUrl?: string | null;
    message?: string | null;
  }>({});

  const didShowReferralUnreadAlertsRef = useRef(false);
  const didCheckForceUpdateRef = useRef(false);

  useEffect(() => {
    // 자동로그인(세션 복원): SecureStore -> redux(auth)
    // 로그인 세션은 isLogin/username 기반으로만 유지합니다(토큰 기반 복원 X).

    (async () => {
      const lastResponse =
        await Notifications.getLastNotificationResponseAsync();

      const data =
        lastResponse?.notification?.request?.content?.data;

      if (data?.post_id) {
        router.push({
          pathname: "/[id]",
          params: {
            id: String(data.post_id),
            fromPush: "1",
          },
        });
      }
    })();

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        showBadge: true,
        sound: "default",
      });
    }

    const subscription = Notifications.addNotificationReceivedListener(async () => {
      const username = await SecureStore.getItemAsync("username");
      if (username) {
        const count = await Notify.getUnreadCount(username);
        await Notifications.setBadgeCountAsync(count);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.post_id) {
          router.push({
            pathname: "/[id]",
            params: {
              id: String(data.post_id),
              fromPush: "1",
            },
          });
        }
      }
    );

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlusFont1: require("../assets/fonts/BMHANNAPro.ttf"),
  });

  useEffect(() => {
    if (!loaded) return;
    if (didShowReferralUnreadAlertsRef.current) return;
    didShowReferralUnreadAlertsRef.current = true;

    (async () => {
      try {
        const [isLoginStr, username] = await Promise.all([
          SecureStore.getItemAsync("isLogin"),
          SecureStore.getItemAsync("username"),
        ]);
        if (isLoginStr !== "true" || !username) return;

        const rows = await Notify.getUnreadNotifications(username);
        const referralRows = Array.isArray(rows)
          ? rows.filter((n: any) => n?.type === "referral" && n?.is_read === false)
          : [];

        // 서버가 최신순(desc)으로 주므로 오래된 것부터 순서대로 표시
        const ordered = referralRows.slice().reverse();

        const showOnce = (title: string, body: string) =>
          new Promise<void>((resolve) => {
            Alert.alert(title || "알림", body || "", [{ text: "확인", onPress: () => resolve() }]);
          });

        for (const n of ordered) {
          await showOnce(String(n?.title ?? "알림"), String(n?.body ?? ""));
          const id = Number(n?.id);
          if (Number.isFinite(id)) {
            await Notify.markNotificationRead(id);
          }
        }

        const count = await Notify.getUnreadCount(username);
        await Notifications.setBadgeCountAsync(count);
      } catch {
        // 네트워크 실패 등은 무시(다음 실행 때 다시 시도)
      }
    })();
  }, [loaded]);

  useEffect(() => {
    // 앱 시작 시 최신 버전 체크 → 필요 시 강제 업데이트 모달
    // list.tsx 같은 특정 화면에 의존하지 않고, 앱 전체에서 일관되게 동작하도록 Root에서 실행합니다.
    if (!loaded) return;
    if (didCheckForceUpdateRef.current) return;
    didCheckForceUpdateRef.current = true;

    (async () => {
      // 개발 중에는 강제 업데이트로 막히지 않게 스킵
      if (__DEV__) return;

      try {
        const os = Platform.OS;
        if (os !== "android" && os !== "ios") return;

        // NOTE: OTA 업데이트(Expo Updates)로 expoConfig.version이 바뀌면
        // 설치된 바이너리 버전과 달라질 수 있어, "네이티브 앱 버전"을 최우선으로 사용합니다.
        const currentVersion: string =
          (Constants as any)?.nativeAppVersion ??
          ((Constants.expoConfig as any)?.version as string) ??
          ((Constants as any)?.manifest?.version as string) ??
          "0.0.0";

        const res = await AppMeta.checkVersion(os, currentVersion);
        const latest = res?.latest_version ?? res?.min_supported_version;

        const pkg =
          ((Constants.expoConfig as any)?.android?.package as string) ??
          "com.smartgauge.bunyangpro";
        const fallbackStoreUrl =
          os === "android"
            ? `market://details?id=${encodeURIComponent(pkg)}`
            : null;

        const storeUrl = res?.store_url ?? fallbackStoreUrl;
        const needUpdate =
          !!res?.force_update ||
          (!!latest && compareVersions(currentVersion, latest) < 0);

        if (needUpdate) {
          setForceUpdateInfo({
            currentVersion,
            latestVersion: latest ?? null,
            storeUrl,
            message: res?.message ?? null,
          });
          setForceUpdateVisible(true);
        }
      } catch {
        // 네트워크 실패 등은 업데이트 강제하지 않음
      }
    })();
  }, [loaded]);

  // 다크모드 비활성화: 라이트 테마만 사용
  const paperTheme = MD3LightTheme;
  if (!loaded) {
    return null;
  }

  return (
    <Provider store={store}>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={DefaultTheme}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: "#fff" }}>
              <ForceUpdateModal
                visible={forceUpdateVisible}
                currentVersion={forceUpdateInfo.currentVersion}
                latestVersion={forceUpdateInfo.latestVersion}
                storeUrl={forceUpdateInfo.storeUrl}
                message={forceUpdateInfo.message}
              />
              <TopBar />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
                <Stack.Screen name="login" options={{ headerRight: () => null, title: "로그인" }} />
                <Stack.Screen name="signup" options={{ headerRight: () => null, title: "회원가입" }} />
                <Stack.Screen name="list" />
                <Stack.Screen name="[id]" options={{ title: "상세", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="write" options={{ title: "작성", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="mypage" options={{ title: "마이페이지", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="adminusers" options={{ title: "회원 관리", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="adminuserdetail" options={{ title: "회원 열람", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="todaystatus" options={{ title: "오늘의 현황", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="todayreferr" options={{ title: "추천 현황", headerBackButtonDisplayMode: "minimal" }} />
                <Stack.Screen name="todayreferrDetail" options={{ title: "추천 상세", headerBackButtonDisplayMode: "minimal" }} />


              </Stack>

              <StatusBar style="light" backgroundColor="#0B1B3A" />
            </View>
          </GestureHandlerRootView>
        </ThemeProvider></PaperProvider></Provider>
  );
}
