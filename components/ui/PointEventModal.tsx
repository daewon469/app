import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useModalBackHandler } from "../../hooks/useModalBackHandler";
import { Popup } from "../../lib/api";
import ReferralBonusTable from "./ReferralBonusTable";

function disableFontScalingInPointEventModalModule() {
  const TextAny = Text as any;
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.allowFontScaling = false;
}

disableFontScalingInPointEventModalModule();

type Props = {
  visible: boolean;
  onClose: () => void;
  onDontShowToday: () => void;
  username?: string | null;
};

export default function PointEventModal({ visible, onClose, onDontShowToday }: Props) {
  const [dontShowToday, setDontShowToday] = useState(false);

  useModalBackHandler(visible, onClose);

  // 모달을 다시 열 때 체크 상태 초기화(이전 상태 잔존 방지)
  useEffect(() => {
    if (visible) setDontShowToday(false);
  }, [visible]);

  const colors = useMemo(
    () => ({
      overlay: "rgba(0,0,0,0.55)",
      // 다크/라이트 모두 라이트 톤으로 고정
      cardBg: "#FFF8EF",
      frameOuter: "#4B5A2A", // 올리브(상단툴바 색)
      text: "#1E1A14",
      subText: "#6E5A44",
      primary: "#4B5A2A",
      action: "#4A6CF7", // 버튼(출석/닫기) 파란색
      accent: "#B8860B",
      borderSoft: "rgba(110,90,68,0.25)",
      disabled: "#9E9E9E",
    }),
    []
  );

  const handleClose = () => {
    onClose();
  };

  const handleDontShowAndClose = () => {
    // 즉시 닫히도록: 체크 → 오늘 숨김 저장 → close
    setDontShowToday(true);
    onClose();

    // 방문자 집계 기준: "오늘 다시 보이지 않기" 클릭 시점에 서버 popup_last_seen_at 갱신
    // - 서버는 /community/stats/today에서 popup_last_seen_at 기반으로 today/total_visitors를 집계함
    // - 로그인(토큰) 필요. 실패해도 UX에는 영향 없도록 무시.
    try {
      onDontShowToday();
    } catch {
      // ignore
    }

    (async () => {
      try {
        const isLogin = await SecureStore.getItemAsync("isLogin");
        if (isLogin !== "true") return;
        await Popup.markSeenToday();
      } catch {
        // ignore
      }
    })();
  };

  return (
    <Modal
      visible={visible}
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={handleClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: "85%",
            maxWidth: 400,
            backgroundColor: colors.cardBg,
            borderRadius: 0,
            padding: 4,
            borderWidth: 2,
            borderColor: colors.frameOuter,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View
            style={{
              borderWidth: 2,
              borderColor: colors.action,
              borderRadius: 0,
              padding: 12,
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
            {/* 제목 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons name="sparkles" size={18} color={"#E11D48"} />
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: colors.text,
                  textAlign: "center",
                  letterSpacing: 0.2,
                }}
              >
                추천인{" "}
                <Text allowFontScaling={false} style={{ color: colors.action }}>
                  포인트
                </Text>{" "}
                <Text allowFontScaling={false} style={{ color: "#E11D48" }}>
                  보너스
                </Text>{" "}
                지급
              </Text>
              <Ionicons name="gift" size={18} color={"#E11D48"} />
            </View>

            {/* 구분선 */}
            <View
              style={{
                marginTop: 12,
                marginBottom: 12,
                height: 1,
                backgroundColor: "#111",
              }}
            />

            {/* 추천인 포인트 보너스 지급(공용 컴포넌트) */}
            <ReferralBonusTable
              colors={{
                text: colors.text,
                subText: colors.subText,
                headerText: colors.action,
                borderSoft: colors.borderSoft,
              }}
              showBottomDividerAfterLastRow
            />

            <Text
              allowFontScaling={false}
              style={{
                marginTop: 10,
                fontSize: 14,
                color: colors.text,
                lineHeight: 18,
                fontWeight: "700",
                textAlign: "left",
              }}
            >
              ✓ 회원 등급은 '마이메뉴' 에서 확인 가능합니다.
              {"\n"}✓ 포인트는 유료전환 시 캐시처럼 사용됩니다.
            </Text>

            {/* 하단: 체크박스 + 오늘 다시보지않기 (누르면 즉시 닫힘) */}
            <Pressable
              onPress={handleDontShowAndClose}
              style={{
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                marginTop: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 14,
                  color: "#000",
                  fontWeight: "700",
                }}
              >
                오늘 다시 보지 않기
              </Text>
            </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
