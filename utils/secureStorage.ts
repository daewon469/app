import * as ExpoSecureStore from "expo-secure-store";
import { Platform } from "react-native";

const WEB_PREFIX = "secureStore.";

const isWeb = Platform.OS === "web";

function webGetItem(key: string): string | null {
  try {
    return localStorage.getItem(WEB_PREFIX + key);
  } catch {
    return null;
  }
}

function webSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(WEB_PREFIX + key, value);
  } catch {
    // ignore quota / private mode errors
  }
}

function webDeleteItem(key: string): void {
  try {
    localStorage.removeItem(WEB_PREFIX + key);
  } catch {
    // ignore
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) return webGetItem(key);
  return ExpoSecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    webSetItem(key, value);
    return;
  }
  await ExpoSecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    webDeleteItem(key);
    return;
  }
  await ExpoSecureStore.deleteItemAsync(key);
}
