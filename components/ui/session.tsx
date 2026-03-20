import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { getSession, setLoggedOut } from "../../utils/session";
export default function SessionPill() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const colors = {
    background: "black",
    card: "#fff",
    text: "#fff",
    border: "#fff",
    primary: "#4A6CF7",
    link: "blue",
  };

  const reload = useCallback(async () => {
    const s = await getSession();
    setIsLoggedIn(s.isLogin);
    setUsername(s.username);
  }, []);

  useEffect(() => {
    reload();
  }, [pathname, reload]);
  const onPress = () => {
    if (!isLoggedIn) {
      router.push({ pathname: "/login" });
      return
    }
    else {
      Alert.alert("로그아웃", "정말 로그아웃할까요?", [
        { text: "취소", style: "cancel" },
        {
          text: "로그아웃",
          style: "destructive",
          onPress: () => {
            (async () => {
              await setLoggedOut();
              await reload();
            })();
          },
        },
      ],
        { cancelable: true }
      );
    }
  }
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: -22,
        backgroundColor: "#4B5A2A",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 6,
            backgroundColor: isLoggedIn ? "#10b981" : "#ef4444",
          }}
        />
        <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.text }}>
          {isLoggedIn ? (username ?? "로그인") : "로그인"}
        </Text>
      </View>
    </Pressable>
  );
}
