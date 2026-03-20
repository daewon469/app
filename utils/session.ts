import * as SecureStore from "expo-secure-store";

export type SessionInfo = {
  isLogin: boolean;
  username: string | null;
};

export async function getSession(): Promise<SessionInfo> {
  try {
    const [isLoginStr, username] = await Promise.all([
      SecureStore.getItemAsync("isLogin"),
      SecureStore.getItemAsync("username"),
    ]);
    return { isLogin: isLoginStr === "true", username: username ?? null };
  } catch {
    return { isLogin: false, username: null };
  }
}

// 로그아웃은 "삭제"가 아니라 false로 저장 (요구사항)
export async function setLoggedOut(): Promise<void> {
  await SecureStore.setItemAsync("isLogin", "false");
}

