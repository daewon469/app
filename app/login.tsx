import { Auth } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Link, router } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text as RNText, TextInput as RNTextInput, TouchableOpacity, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const colors = {
    background: "#fff",
    card: "#f9f9f9",
    text: "#000",
    border: "#000",
    primary: "#4A6CF7",
    link: "blue",
  };
  useEffect(() => {
    async function initPush() {
      const ptoken = await getPushToken();
      setPushToken(ptoken);
    }
    initPush();
  }, []);
  const submit = useCallback(async () => {
    try {
      const res = await Auth.logIn(username, password, pushToken ?? undefined);

      Alert.alert("알림", "로그인 성공!");
      await Promise.all([
        SecureStore.setItemAsync('isLogin', 'true'),
        SecureStore.setItemAsync('username', username),
        SecureStore.setItemAsync('token', res?.token ?? ""),
      ]);
      router.replace("/list");
    } catch (e: any) {
      Alert.alert("로그인 실패", e?.response?.data?.detail ?? "아이디 또는 비밀번호를 확인하세요");
    }
  }, [username, password, pushToken, router]);

  return (
    <View style={{ padding: 20, gap: 16, backgroundColor: colors.background, flex: 1 }}>
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
            style={{ flex: 1, padding: 12, color: colors.text }}
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
        style={{
          backgroundColor: colors.primary,
          borderRadius: 16,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
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
    </View>
  );
}
async function getPushToken() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("알림 권한 거부됨", "푸시 알림을 받기 위해 권한을 허용해주세요.");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    console.log("### EXPO PUSH TOKEN:", token);

    return token;
  } catch (err) {
    console.log("푸시 토큰 획득 오류:", err);
    return null;
  }
}