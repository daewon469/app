// app/index.tsx
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SecureStore from "../../utils/secureStorage";
import { useEffect } from "react";
import {
  getNotificationPostId,
  isNotificationPostNavigationPending,
  markNotificationPostNavigationPending,
} from "../../utils/notificationNavigation";
import { isPushNotificationsSupported } from "../../utils/notifications";

export default function Index() {
  useEffect(() => {

    (async () => {
      if (isPushNotificationsSupported) {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        const postId = getNotificationPostId(
          lastResponse?.notification?.request?.content?.data,
        );
        if (postId) {
          markNotificationPostNavigationPending();
          return;
        }
      }

      const autologin = await SecureStore.getItemAsync("isLogin");
      console.log("isLogin:", autologin);
      if (isNotificationPostNavigationPending()) return;
      router.replace("/list")
      //  autologin === "true" ? router.replace("/list") : router.replace("/login");
    })();
  }, []);

  return null;
}