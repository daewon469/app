import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";

const EXIT_WINDOW_MS = 2000;
const EXIT_HINT = "한번 더 클릭하면 종료됩니다.";
const HOME_PATH = "/list";

export function useDoubleBackToExit() {
  const pathname = usePathname();
  const lastBackPressed = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const onHome = pathname === HOME_PATH;

      // 홈은 히스토리가 있어도 종료만 담당 (한 번에 pop 되며 앱이 꺼지지 않게)
      if (onHome) {
        const now = Date.now();
        if (now - lastBackPressed.current < EXIT_WINDOW_MS) {
          lastBackPressed.current = 0;
          BackHandler.exitApp();
          return true;
        }
        lastBackPressed.current = now;
        ToastAndroid.show(EXIT_HINT, ToastAndroid.SHORT);
        return true;
      }

      if (router.canGoBack()) {
        lastBackPressed.current = 0;
        router.back();
        return true;
      }

      lastBackPressed.current = 0;
      router.replace(HOME_PATH);
      return true;
    });

    return () => sub.remove();
  }, [pathname]);
}
