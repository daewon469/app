import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const isPushNotificationsSupported = Platform.OS !== "web";

export async function setBadgeCountSafe(count: number): Promise<void> {
  if (!isPushNotificationsSupported) return;
  await Notifications.setBadgeCountAsync(count);
}
