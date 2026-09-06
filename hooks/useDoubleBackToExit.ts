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
      if (pathname !== HOME_PATH) {
        lastBackPressed.current = 0;
        router.replace(HOME_PATH);
        return true;
      }

      const now = Date.now();
      if (now - lastBackPressed.current < EXIT_WINDOW_MS) {
        lastBackPressed.current = 0;
        BackHandler.exitApp();
        return true;
      }

      lastBackPressed.current = now;
      ToastAndroid.show(EXIT_HINT, ToastAndroid.SHORT);
      return true;
    });

    return () => sub.remove();
  }, [pathname]);
}
