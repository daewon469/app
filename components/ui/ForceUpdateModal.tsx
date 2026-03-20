import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import * as Linking from "expo-linking";

type Props = {
  visible: boolean;
  currentVersion?: string | null;
  latestVersion?: string | null;
  storeUrl?: string | null;
  message?: string | null;
};

export default function ForceUpdateModal({
  visible,
  currentVersion,
  latestVersion,
  storeUrl,
  message,
}: Props) {
  const [opening, setOpening] = useState(false);

  const colors = useMemo(
    () => ({
      overlay: "rgba(0,0,0,0.55)",
      cardBg: "#FFFFFF",
      border: "rgba(0,0,0,0.12)",
      title: "#111",
      text: "#222",
      subText: "rgba(0,0,0,0.65)",
      primary: "#4B5A2A",
      primaryText: "#fff",
    }),
    []
  );

  const handleUpdatePress = async () => {
    if (opening) return;
    setOpening(true);
    try {
      if (storeUrl) {
        // Android: https PlayStore URL이면 market://로 우선 시도(스토어 앱으로 자연스럽게 이동)
        const normalizedUrl = (() => {
          if (Platform.OS !== "android") return storeUrl;
          const s = String(storeUrl);
          const m = s.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?id=([^&]+)/i);
          if (m?.[1]) return `market://details?id=${m[1]}`;
          return s;
        })();
        try {
          await Linking.openURL(normalizedUrl);
        } catch {
          // Android: market:// 실패 시 웹 URL로 폴백
          if (normalizedUrl.startsWith("market://details?id=")) {
            const id = normalizedUrl.replace("market://details?id=", "").split("&")[0];
            if (id) {
              await Linking.openURL(`https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`);
            }
          }
        }
      }
    } finally {
      // 스토어로 이동 후에도 앱이 떠있을 수 있으므로 false로 복구
      setOpening(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 강제 업데이트: 뒤로가기/닫기 차단
      onRequestClose={() => {}}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.cardBg,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.title, textAlign: "center" }}>
            업데이트가 필요합니다
          </Text>

          <Text
            style={{
              marginTop: 10,
              fontSize: 14,
              lineHeight: 20,
              color: colors.text,
              textAlign: "center",
            }}
          >
            {message || "원활한 이용을 위해 최신 버전으로 업데이트 후 이용해 주세요."}
          </Text>

          {(currentVersion || latestVersion) && (
            <View style={{ marginTop: 12, gap: 4 }}>
              {!!currentVersion && (
                <Text style={{ fontSize: 12, color: colors.subText, textAlign: "center" }}>
                  현재 버전: {currentVersion}
                </Text>
              )}
              {!!latestVersion && (
                <Text style={{ fontSize: 12, color: colors.subText, textAlign: "center" }}>
                  최신 버전: {latestVersion}
                </Text>
              )}
            </View>
          )}

          <Pressable
            onPress={handleUpdatePress}
            disabled={opening}
            style={{
              marginTop: 16,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              opacity: opening ? 0.8 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.primaryText }}>
              {opening ? "이동 중..." : "업데이트 하러가기"}
            </Text>
          </Pressable>

          {!storeUrl && (
            <Text style={{ marginTop: 10, fontSize: 12, color: colors.subText, textAlign: "center" }}>
              스토어 링크를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
