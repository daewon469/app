import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, Text as RNText, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

function spacedLabel(text: string): string {
  return text.replace(/\s/g, "").split("").join(" ");
}

type ReferralModalProps = {
  visible: boolean;
  onClose: () => void;
  referralCode: string | null;
  onCopy: () => void;
  onRecommendKakao: () => void;
  onRecommendSms: () => void;
  colors: {
    card: string;
    text: string;
    border: string;
    primary: string;
  };
};

export default function ReferralModal({
  visible,
  onClose,
  referralCode,
  onCopy,
  onRecommendKakao,
  onRecommendSms,
  colors,
}: ReferralModalProps) {
  const buttonTextStyle = {
    fontWeight: "700" as const,
    fontSize: 15,
    letterSpacing: 6,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 380,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: "#000",
            padding: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              추천하기
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={26} color={colors.text} />
            </Pressable>
          </View>

          <Text
            style={{
              fontSize: 13,
              color: colors.text === "#000" ? "#666" : colors.text,
              marginBottom: 12,
              lineHeight: 18,
            }}
          >
            {referralCode
              ? `추천인코드(${referralCode})와 링크가 함께 발송됩니다.`
              : "추천인코드와 링크가 함께 발송됩니다."}
          </Text>

          <View style={{ gap: 10 }}>
            <Pressable
              onPress={onRecommendKakao}
              style={{
                backgroundColor: "#FEE500",
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ ...buttonTextStyle, color: "#111" }}>
                {spacedLabel("카 톡  추 천")}
              </Text>
            </Pressable>

            <Pressable
              onPress={onRecommendSms}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ ...buttonTextStyle, color: "#fff" }}>
                {spacedLabel("문 자  추 천")}
              </Text>
            </Pressable>

            <Pressable
              onPress={onCopy}
              style={{
                backgroundColor: "#22C55E",
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ ...buttonTextStyle, color: "#fff" }}>
                {spacedLabel("복 사   하 기")}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={{
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ ...buttonTextStyle, color: colors.text }}>
                {spacedLabel("취 소")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
