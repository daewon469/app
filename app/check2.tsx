import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  onAgree: () => void;
  onCancel?: () => void;
  title?: string;
  termsText?: string;
};

export default function ServiceTermsScreen({
  onAgree,
  onCancel,
  termsText = DEFAULT_TERMS,
}: Props) {
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [marketingAgree, setMarketingAgree] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [scrollH, setScrollH] = useState(0);

  const canContinue = checked;
  // 요청: 약관 화면은 항상 "검은색 글씨"로 보이도록 고정

  const onContentSizeChange = useCallback((_: number, h: number) => setContentH(h), []);
  const onLayout = useCallback((e: LayoutChangeEvent) => setScrollH(e.nativeEvent.layout.height), []);
  const onScroll = useCallback(
    (e: any) => {
      const { y } = e.nativeEvent.contentOffset;
      const paddingToBottom = 24;
      const reached = y + scrollH + paddingToBottom >= contentH;
      if (reached && !hasReachedEnd) setHasReachedEnd(true);
    },
    [contentH, scrollH, hasReachedEnd]
  );

  return (
    <View style={styles.container}>
      {/* 약관 본문 */}
      <View style={styles.card}>
        <ScrollView
          style={{ flex: 1 }}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Text style={styles.termsText}>{termsText}</Text>
        </ScrollView>

        {/* 진행 상태 (본문 아래) */}
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressDot, hasReachedEnd && styles.progressDotOn]} />
          <Text style={styles.progressText}>
            {hasReachedEnd ? "스크롤 확인 완료" : "내용을 끝까지 스크롤해 주세요"}
          </Text>
        </View>
      </View>

      {/* 동의 체크 및 버튼 */}
      <View style={styles.actionBox}>
        <Pressable
          onPress={() => setChecked((v) => !v)}
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text style={styles.checkLabel}>약관 및 방침을 모두 확인했고 동의합니다.(필수)</Text>
        </Pressable>

        <Pressable
          onPress={() => setMarketingAgree((v) => !v)}
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: marketingAgree }}
        >
          <View style={[styles.checkbox, marketingAgree && styles.checkboxOn]}>
            {marketingAgree ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text style={styles.checkLabelTight}>분양 구인광고 문자수신에 동의합니다.(선택)</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (canContinue) {
              router.push({
                pathname: "/signup",
                params: { marketing_consent: marketingAgree ? "1" : "0" },
              });
            }
          }}
          disabled={!canContinue}
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryBtnText}>계속</Text>
        </Pressable>
      </View>
    </View>
  );
}

const DEFAULT_TERMS = `
서비스 이용 약관

제 1 조 (목적)
이 약관은 '분양프로'(이하 “회사”)가 제공하는 모든 서비스(이하 “서비스”)의 이용 조건 및 절차, 이용자와 회사의 권리·의무와 책임사항 등을 규정함을 목적으로 합니다.

제 2 조 (정의)
1. “이용자”란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.
2. “회원”이란 회사와 이용계약을 체결하고 서비스를 지속적으로 이용할 수 있는 자를 말합니다.
3. “비회원”이란 회원으로 가입하지 않고 서비스를 이용하는 자를 말합니다.

제 3 조 (약관의 효력 및 변경)
1. 본 약관은 서비스 화면 또는 기타 방법으로 공지함으로써 효력을 발생합니다.
2. 회사는 필요 시 관계 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 변경 시 공지 후 시행합니다.
3. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원탈퇴를 요청할 수 있습니다.

제 4 조 (서비스의 제공 및 변경)
1. 회사는 다음 서비스를 제공합니다.
  (1) 분양 정보 등록 및 열람 서비스
  (2) 구인·구직 정보 제공 서비스
  (3) 커뮤니티 게시판 및 채팅 서비스
  (4) 기타 회사가 정하는 서비스
2. 회사는 서비스 개선을 위해 내용이나 기술적 사양을 변경할 수 있으며, 사전에 공지합니다.

제 5 조 (서비스의 중단)
회사는 다음 각 호에 해당하는 경우 서비스 제공을 일시 중단할 수 있습니다.
1. 시스템 점검·보수 등 불가피한 경우
2. 천재지변, 정전, 통신 두절 등 불가항력 사유 발생 시
3. 기타 회사가 필요하다고 판단한 경우

제 6 조 (회원의 의무)
1. 회원은 본 약관 및 관계 법령을 준수해야 하며, 다음 행위를 금합니다.
  (1) 타인의 정보를 도용하거나 허위 정보 입력
  (2) 서비스 운영을 방해하거나 고의로 시스템 장애 유발
  (3) 타인의 명예를 훼손하거나 불법 정보 게시
  (4) 저작권 등 제3자의 권리를 침해하는 행위
  (5) 기타 법령에 위반되는 행위
2. 회원이 위 조항을 위반할 경우 회사는 서비스 이용 제한 및 계약 해지를 할 수 있습니다.

제 7 조 (회사의 의무)
1. 회사는 관련 법령과 본 약관이 금지하지 않는 범위 내에서 서비스를 안정적으로 제공합니다.
2. 회사는 이용자의 개인정보를 보호하기 위해 개인정보처리방침을 수립하고 이를 준수합니다.

제 8 조 (게시물의 저작권)
서비스 내 게시물의 저작권은 게시자에게 있으며, 회사는 서비스 운영·홍보를 위한 범위 내에서 이를 이용할 수 있습니다.

제 9 조 (이용계약의 해지)
1. 이용자는 언제든지 회원탈퇴를 요청할 수 있으며, 회사는 관련 법령에 따라 신속히 처리합니다.
2. 회사는 이용자가 약관 또는 법령을 위반한 경우 사전 통보 후 이용계약을 해지할 수 있습니다.

제 10 조 (면책)
1. 회사는 천재지변, 불가항력 또는 이용자의 귀책사유로 인한 서비스 장애에 대해 책임을 지지 않습니다.
2. 회사는 이용자 상호 간의 거래나 분쟁에 관여하지 않으며, 이에 대한 책임을 지지 않습니다.

제 11 조 (분쟁해결)
본 약관과 관련된 분쟁은 관계 법령 및 상관례에 따라 해결하며, 소송이 제기될 경우 회사의 본사 소재지를 관할 법원으로 합니다.

제 12 조 (캐시의 환급 및 현금 교환 제한)
1. 이용자가 결제 등을 통하여 구매한 캐시는 서비스 내에서 정해진 용도에 한하여 사용할 수 있으며,
디지털 서비스를 위해 사용된 캐시는 어떠한 경우에도 현금으로 환급하거나 교환할 수 없습니다.
2. 캐시의 사용, 소멸, 유효기간 등 기타 사항은 서비스 정책에 따르며, 회사는 관련 내용을 사전 공지 후 변경할 수 있습니다.
3. 결제 후 사용한 적 없는 캐시 보유분에 한하여 현금으로 환불이 가능합니다. 

제 13 조 (이벤트 포인트 지급)
1. 이벤트로 진행 과정에서 지급된 포인트는 이벤트 종료 시에도 유효하며 회사 정책 변경 시 추가적인 지급은 되지 않을 수 있습니다.






개인정보처리방침

제 1 조 (개인정보 처리 목적)

분양프로는 회원가입, 서비스 제공 및 관리 등을 위하여 아래와 같이 개인정보를 처리합니다.

회원관리: 회원제 서비스 이용 및 이력 관리, 본인확인, 불만처리·민원처리 등 

서비스 제공: 가입 및 이용계약의 이행, 유료서비스 이용 시 요금정산 등

마케팅 및 광고: 신규서비스 개발 및 맞춤형 광고 등

기타: 관련 법령 또는 내부 정책에 따른 요구사항 이행

제 2 조 (처리하는 개인정보 항목)

회원가입, 서비스 이용과정에서 아래 개인정보 항목을 수집·처리합니다.

필수 항목: 아이디(닉네임), 비밀번호

선택 항목: 성함, 전화번호, 거주지역

제 3 조 (개인정보의 처리 및 보유기간)

회사는 개인정보 처리 목적이 달성된 후에는 지체 없이 해당 정보를 파기합니다. 다만, 다른 법령에 따라 보존해야 하는 경우라면 해당 기간 동안 안전하게 보관합니다.

회원가입정보: 탈퇴 시 또는 가입계약이 종료된 시점부터 3년 이내

결제·정산기록: 전자상거래 등에서의 소비자 보호에 관한 법률에 따라 5년

기타 관련 법령에 따른 보관기한 준수

제 4 조 (개인정보의 파기절차 및 방법)

파기절차: 보유기간의 경과, 처리목적 달성, 이용자의 요청 등에 따라 개인정보 파기 절차를 진행합니다.

파기방법:

전자적 파일 형태: 복원이 불가능한 방법으로 영구삭제

종이문서: 분쇄기 또는 소각 처리

제 5 조 (개인정보의 제3자 제공)

회사는 정보주체의 동의 또는 법률의 규정이 있는 경우를 제외하고는 개인정보를 제3자에게 제공하지 않습니다.

제3자 제공이 필요한 경우에는 제공받는 자, 제공 항목, 제공 목적, 제공기간 등을 회원에게 안내하고 동의를 받습니다.

제 6 조 (개인정보 처리의 위탁)

서비스 운영을 위해 외부에 위탁하는 경우, 위탁계약에서 개인정보 보호를 위한 조항을 포함하며 수탁자의 관리·감독을 실시합니다. 위탁업무 및 수탁자를 아래와 같이 안내합니다.

위탁업무: 서버관리, 결제처리, SMS발송 등

수탁자명: [수탁사명]

위탁기간: 계약기간 동안

제 7 조 (정보주체의 권리‧의무 및 행사방법)

정보주체(회원)는 언제든지 다음과 같은 권리를 행사할 수 있습니다.

개인정보 열람요구, 정정요구, 삭제요구, 처리정지 요구

동의 철회: 회원가입 탈퇴 또는 설정에서 동의를 철회할 수 있습니다.

권리행사 방법: 서비스 내 개인정보 설정 메뉴 또는 고객센터 이메일로 요청할 수 있습니다.

회사는 요청을 받은 날부터 지체 없이 처리하며, 정당한 사유가 있는 경우에는 그 사유를 회원에게 알립니다.

제 8 조 (개인정보의 안전성 확보조치)

회사는 개인정보보호법 제29조 및 관련 지침에 따라 다음과 같은 조치를 시행하고 있습니다.

내부관리계획 수립 및 시행

개인정보 취급자 최소화 및 정기교육

접근통제 및 접속기록 보관

암호화 및 보안프로그램 설치·운영

물리적 보관장소 출입통제


회사는 서비스 이용과 관련하여 이벤트, 혜택, 신규 서비스 안내, 프로모션 등의 광고성 정보를 문자메시지(SMS/MMS/LMS)로 발송할 수 있습니다.

이에 대해 동의하실 경우 아래와 같이 개인정보를 이용합니다.

1. 수집 항목
- 휴대전화번호

2. 이용 목적
- 이벤트 및 혜택 안내
- 신규 서비스 및 프로모션 정보 제공
- 마케팅 및 광고 활용

3. 보유 및 이용 기간
- 광고성 정보 수신 동의 철회 시 또는 회원 탈퇴 시까지

4. 동의 거부 권리 및 불이익
- 이용자는 광고성 정보 수신에 대한 동의를 거부할 수 있으며,
  동의하지 않더라도 서비스 이용에는 제한이 없습니다.

5. 수신 동의 철회 방법
- 문자 하단의 수신거부 안내
- 앱 내 설정 메뉴 또는 고객센터를 통한 철회
`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  card: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#000000",
    overflow: "hidden",
  },
  termsText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#000000",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  progressBarWrap: {
    height: 44,
    borderTopWidth: 1,
    borderColor: "#F0F2F4",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FAFBFC",
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFF",
  },
  progressDotOn: { borderColor: "#10B981", backgroundColor: "#D1FAE5" },
  progressText: { fontSize: 14, color: "#000000" },

  actionBox: { paddingHorizontal: 12, paddingBottom: 18, gap: 6 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6, // 요청: 체크박스-텍스트 간격을 더 붙임
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.4,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDisabled: { backgroundColor: "#F3F4F6" },
  checkboxOn: { borderColor: "#4A6CF7", backgroundColor: "#4A6CF7" },
  checkLabel: {
    fontSize: 15,
    lineHeight: 20,
    color: "#000000",
    marginTop: 0, // 요청: 네모박스/텍스트 세로 중앙 정렬 깨는 여백 제거
    includeFontPadding: false, // Android: 폰트 상하 패딩 제거로 중앙 정렬 개선
    textAlignVertical: "center",
  },
  checkLabelTight: {
    fontSize: 15,
    lineHeight: 20,
    color: "#000000",
    marginTop: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  primaryBtn: {
    height: 48,
    backgroundColor: "#4A6CF7",
    borderRadius: 10,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { backgroundColor: "#9CA3AF" },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
