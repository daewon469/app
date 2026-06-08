import React from "react";
import { Modal, Pressable, Text as RNText, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

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
              gap: 12,
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
            <Pressable
              onPress={onCopy}
              hitSlop={8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#000",
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                복사하기
              </Text>
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
              ? `추천인코드(${referralCode})가 함께 전송됩니다.`
              : "추천인코드가 함께 전송됩니다."}
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
              <Text style={{ color: "#111", fontWeight: "700", fontSize: 15 }}>
                카톡 추천
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
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                문자 추천
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
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                취소
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
