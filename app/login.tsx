import { Auth } from "@/lib/api";
import { getApiErrorMessage, LOGIN_FAIL_MESSAGE } from "@/lib/authErrors";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Link, router } from "expo-router";
import * as SecureStore from "../utils/secureStorage";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { isPushNotificationsSupported } from "../utils/notifications";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

const inputFontSizeStyle = (value: string | null | undefined) => ({
  fontSize: String(value ?? "").trim() ? 14 : 13,
});

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const colors = {
    background: "#fff",
    card: "#f9f9f9",
    text: "#000",
    border: "#000",
    primary: "#4A6CF7",
    link: "blue",
  };

  const submit = useCallback(async () => {
    if (submittingRef.current || loading) return;
    if (!username.trim()) {
      Alert.alert("알림", "닉네임을 입력해 주세요.");
      return;
    }
    if (!password) {
      Alert.alert("알림", "비밀번호를 입력해 주세요.");
      return;
    }

    submittingRef.current = true;
    try {
      setLoading(true);
      const pushToken = await getPushTokenSilent();
      const res = await Auth.logIn(username.trim(), password, pushToken ?? undefined);

      if (res.status === 0 && res.token) {
        await Promise.all([
          SecureStore.setItemAsync("isLogin", "true"),
          SecureStore.setItemAsync("username", username.trim()),
          SecureStore.setItemAsync("token", res.token),
        ]);
        Alert.alert("알림", "로그인 성공!", [
          { text: "확인", onPress: () => router.replace("/list") },
        ]);
        return;
      }

      Alert.alert(
        "로그인 실패",
        res.status === 1 ? res.detail ?? LOGIN_FAIL_MESSAGE : LOGIN_FAIL_MESSAGE,
      );
    } catch (e: unknown) {
      Alert.alert("로그인 실패", getApiErrorMessage(e, LOGIN_FAIL_MESSAGE));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [username, password, loading]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.select({ ios: "padding", android: "height" }) as "padding" | "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={{ paddingStart: 6, fontSize: 15, marginBottom: 10, color: colors.text }}>※ 닉네임</Text>
          <TextInput
            placeholder="닉네임을 입력해 주세요."
            placeholderTextColor="#888"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              backgroundColor: colors.card,
              color: colors.text,
              ...inputFontSizeStyle(username),
            }}
          />
        </View>

        <View style={{ marginBottom: 10 }}>
          <Text style={{ paddingStart: 6, fontSize: 15, marginBottom: 10, color: colors.text }}>※ 비밀번호</Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.card,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <TextInput
              placeholder="비밀번호를 입력해 주세요."
              placeholderTextColor="#888"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={{
                flex: 1,
                padding: 12,
                color: colors.text,
                ...inputFontSizeStyle(password),
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            paddingVertical: 12,
            alignItems: "center",
            justifyContent: "center",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>로그인</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <Link href="/signup" asChild>
            <Pressable>
              <Text style={{ color: colors.link, paddingVertical: 6 }}>
                회원가입
              </Text>
            </Pressable>
          </Link>
          <Text style={{ color: colors.text, opacity: 0.6 }}>|</Text>
          <Link href="/findid" asChild>
            <Pressable>
              <Text style={{ color: colors.link, paddingVertical: 6 }}>아이디 찾기</Text>
            </Pressable>
          </Link>
          <Text style={{ color: colors.text, opacity: 0.6 }}>|</Text>
          <Link href="/resetpassword" asChild>
            <Pressable>
              <Text style={{ color: colors.link, paddingVertical: 6 }}>비밀번호 찾기</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 푸시 권한이 없어도 null만 반환 — 로그인을 막지 않음 */
async function getPushTokenSilent(): Promise<string | null> {
  if (!isPushNotificationsSupported) return null;

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status === "undetermined") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}
