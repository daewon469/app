import React, { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    Text as RNText,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export type RegionObj = { province: string; city: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedRegions?: RegionObj[];
  onApply: (regions: RegionObj[]) => void | Promise<void>;
  /** header 제목 텍스트(기본: "지역 선택(복수)") */
  titleText?: string;
  /** header 제목 폰트 크기 가산값(기본 0) */
  titleFontSizeDelta?: number;
  /** 하단 주요 버튼 텍스트(기본: "저장") */
  applyButtonText?: string;
  /**
   * modal: 기존 방식(딤 + Modal)
   * inline: 화면에 고정된 메뉴처럼 렌더(딤/배경클릭 닫기 없음)
   */
  presentation?: "modal" | "inline";
  /** header의 "닫기" 버튼 노출 여부 */
  showCloseButton?: boolean;
  /** (modal일 때) 배경 딤(어두운 오버레이) 노출 여부 */
  showBackdrop?: boolean;
  /** (modal일 때) 배경 클릭으로 닫기 */
  closeOnBackdropPress?: boolean;
  /** (inline일 때) 컨테이너 좌우 패딩 */
  inlinePaddingHorizontal?: number;
  /** (inline일 때) 컨테이너 상단 패딩 */
  inlinePaddingTop?: number;
  /** (inline일 때) 컨테이너 하단 패딩 */
  inlinePaddingBottom?: number;
  /** 카드 테두리(옵션). 기본은 기존 스타일 유지 */
  cardBorderWidth?: number;
  cardBorderColor?: string;
};

const PROVINCES = [
  "전체",
  "서울",
  "경기",
  "인천",
  "강원",
  "충북",
  "충남",
  "대전",
  "세종",
  "경북",
  "경남",
  "부산",
  "대구",
  "전북",
  "전남",
  "광주",
  "울산",
  "제주",
] as const;

const REGION_MAP: Record<string, string[]> = {
  전체: ["전체"],
  서울: [
    "전체",
    "강남구",
    "강동구",
    "강북구",
    "강서구",
    "관악구",
    "광진구",
    "구로구",
    "금천구",
    "노원구",
    "도봉구",
    "동대문구",
    "동작구",
    "마포구",
    "서대문구",
    "서초구",
    "성동구",
    "성북구",
    "송파구",
    "양천구",
    "영등포구",
    "용산구",
    "은평구",
    "종로구",
    "중구",
    "중랑구",
  ],
  경기: [
    "전체",
    "가평군",
    "고양시",
    "과천시",
    "광명시",
    "광주시",
    "구리시",
    "군포시",
    "김포시",
    "남양주시",
    "동두천시",
    "부천시",
    "성남시",
    "수원시",
    "시흥시",
    "안산시",
    "안성시",
    "안양시",
    "양주시",
    "양평군",
    "여주시",
    "연천군",
    "오산시",
    "용인시",
    "의왕시",
    "의정부시",
    "이천시",
    "파주시",
    "평택시",
    "포천시",
    "하남시",
    "화성시",
  ],
  인천: [
    "전체",
    "강화군",
    "계양구",
    "남동구",
    "동구",
    "미추홀구",
    "부평구",
    "서구",
    "연수구",
    "중구",
    "옹진군",
  ],
  부산: [
    "전체",
    "강서구",
    "금정구",
    "기장군",
    "남구",
    "동구",
    "동래구",
    "부산진구",
    "북구",
    "사상구",
    "사하구",
    "서구",
    "수영구",
    "연제구",
    "영도구",
    "중구",
    "해운대구",
  ],
  대구: ["전체", "남구", "달서구", "달성군", "동구", "북구", "서구", "수성구", "중구"],
  광주: ["전체", "광산구", "남구", "동구", "북구", "서구"],
  대전: ["전체", "대덕구", "동구", "서구", "유성구", "중구"],
  울산: ["전체", "남구", "동구", "북구", "울주군", "중구"],
  세종: ["전체"],
  강원: [
    "전체",
    "강릉시",
    "고성군",
    "동해시",
    "삼척시",
    "속초시",
    "양구군",
    "양양군",
    "영월군",
    "원주시",
    "인제군",
    "정선군",
    "철원군",
    "춘천시",
    "태백시",
    "평창군",
    "홍천군",
    "화천군",
    "횡성군",
  ],
  충북: [
    "전체",
    "괴산군",
    "단양군",
    "보은군",
    "영동군",
    "옥천군",
    "음성군",
    "제천시",
    "증평군",
    "진천군",
    "청주시",
    "충주시",
  ],
  충남: [
    "전체",
    "계룡시",
    "공주시",
    "금산군",
    "논산시",
    "당진시",
    "보령시",
    "부여군",
    "서산시",
    "서천군",
    "아산시",
    "예산군",
    "천안시",
    "청양군",
    "태안군",
    "홍성군",
  ],
  전북: [
    "전체",
    "고창군",
    "군산시",
    "김제시",
    "남원시",
    "무주군",
    "부안군",
    "순창군",
    "완주군",
    "익산시",
    "임실군",
    "장수군",
    "전주시",
    "정읍시",
    "진안군",
  ],
  전남: [
    "전체",
    "강진군",
    "고흥군",
    "곡성군",
    "광양시",
    "구례군",
    "나주시",
    "담양군",
    "목포시",
    "무안군",
    "보성군",
    "순천시",
    "신안군",
    "여수시",
    "영광군",
    "영암군",
    "완도군",
    "장성군",
    "장흥군",
    "진도군",
    "함평군",
    "해남군",
    "화순군",
  ],
  경북: [
    "전체",
    "경산시",
    "경주시",
    "고령군",
    "구미시",
    "군위군",
    "김천시",
    "문경시",
    "봉화군",
    "상주시",
    "성주군",
    "안동시",
    "영덕군",
    "영양군",
    "영주시",
    "영천시",
    "예천군",
    "울릉군",
    "울진군",
    "의성군",
    "청도군",
    "청송군",
    "칠곡군",
    "포항시",
  ],
  경남: [
    "전체",
    "거제시",
    "거창군",
    "고성군",
    "김해시",
    "남해군",
    "밀양시",
    "사천시",
    "산청군",
    "양산시",
    "의령군",
    "진주시",
    "창녕군",
    "창원시",
    "통영시",
    "하동군",
    "함안군",
    "함양군",
    "합천군",
  ],
  제주: ["전체", "서귀포시", "제주시"],
};

const normalize = (r: RegionObj): RegionObj | null => {
  const p = (r?.province || "").trim();
  const c = ((r?.city || "").trim() || "전체");
  if (!p) return null;
  if (p === "전체") return { province: "전체", city: "전체" };
  return { province: p, city: c };
};

const keyOf = (r: RegionObj) => `${r.province}__${r.city}`;

export default function CustomRegionMultiSelectModal({
  visible,
  onClose,
  selectedRegions = [],
  onApply,
  titleText = "지역 선택 (복수 선택 가능)",
  titleFontSizeDelta = 0,
  applyButtonText = "저장",
  presentation = "modal",
  showCloseButton = true,
  showBackdrop = true,
  closeOnBackdropPress = true,
  inlinePaddingHorizontal = 10,
  inlinePaddingTop = 10,
  inlinePaddingBottom = 10,
  cardBorderWidth = 0,
  cardBorderColor = "transparent",
}: Props) {
  const styles = useMemo(() => makeStyles({ titleFontSizeDelta }), [titleFontSizeDelta]);

  const [activeProvince, setActiveProvince] = useState<string>("전체");
  const [localSelected, setLocalSelected] = useState<RegionObj[]>([]);

  useEffect(() => {
    if (!visible) return;
    const normalized = (selectedRegions || [])
      .map((r) => normalize(r))
      .filter(Boolean) as RegionObj[];
    setLocalSelected(Array.from(new Map(normalized.map((r) => [keyOf(r), r] as const)).values()));
    setActiveProvince("전체");
  }, [visible, selectedRegions]);

  const hasAll = localSelected.some((r) => r.province === "전체");

  const provinceSelectedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of localSelected) {
      if (!r.province) continue;
      m.set(r.province, (m.get(r.province) || 0) + 1);
    }
    return m;
  }, [localSelected]);

  const toggle = (province: string, city: string) => {
    const norm = normalize({ province, city });
    if (!norm) return;

    if (norm.province === "전체") {
      setLocalSelected(hasAll ? [] : [{ province: "전체", city: "전체" }]);
      return;
    }

    setLocalSelected((prev) => {
      const withoutAll = prev.filter((x) => x.province !== "전체");
      const sameProv = withoutAll.filter((x) => x.province === norm.province);
      const others = withoutAll.filter((x) => x.province !== norm.province);

      if (norm.city === "전체") {
        const already = sameProv.some((x) => x.city === "전체");
        return already ? others : [...others, { province: norm.province, city: "전체" }];
      }

      const filteredSame = sameProv.filter((x) => x.city !== "전체");
      const exists = filteredSame.some((x) => x.city === norm.city);
      const nextSame = exists
        ? filteredSame.filter((x) => x.city !== norm.city)
        : [...filteredSame, { province: norm.province, city: norm.city }];
      return [...others, ...nextSame];
    });
  };

  const removeOne = (r: RegionObj) => {
    const norm = normalize(r);
    if (!norm) return;
    setLocalSelected((prev) => prev.filter((x) => keyOf(x) !== keyOf(norm)));
  };

  const reset = () => setLocalSelected([]);

  const apply = () => {
    try {
      const maybePromise = onApply(localSelected);
      if (maybePromise && typeof (maybePromise as any)?.then === "function") {
        (maybePromise as Promise<void>).then(onClose).catch(() => {
          // 저장 실패 등 에러는 호출측에서 처리(Alert 등). 여기서는 닫지 않음.
        });
        return;
      }
      onClose();
    } catch {
      // 호출측에서 처리. 여기서는 닫지 않음.
    }
  };

  const cities = REGION_MAP[activeProvince] || ["전체"];

  const Title = useMemo(() => {
    // "(복수)" / "(복수선택 가능)" / "(복수 선택 가능)" 문구가 포함된 경우,
    // 해당 부분만 회색으로 표시하고, 표기는 "(복수선택 가능)"으로 통일
    const hint = "(복수선택 가능)";
    const variants = ["(복수선택 가능)", "(복수 선택 가능)", "(복수)"] as const;
    const found = titleText ? variants.find((v) => titleText.includes(v)) : undefined;
    if (!titleText || !found) return <Text style={styles.title}>{titleText}</Text>;

    const [before, after] = titleText.split(found);
    return (
      <Text style={styles.title}>
        {before}
        <Text style={styles.titleHint}>{hint}</Text>
        {after}
      </Text>
    );
  }, [styles.title, styles.titleHint, titleText]);

  const CardContent = (
    <View style={[styles.card, { borderWidth: cardBorderWidth, borderColor: cardBorderColor }]}>
      <View style={styles.header}>
        {Title}
        {showCloseButton ? (
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>닫기</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sub}>
        선택: {localSelected.length}개 {hasAll ? "(전체 선택됨)" : ""}
      </Text>

      {/* 선택된 항목 칩 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {localSelected.length === 0 ? (
          <Text style={styles.emptyChipText}>선택된 지역이 없습니다.</Text>
        ) : (
          localSelected.map((r) => {
            const label = r.province === "전체" ? "전체" : r.city === "전체" ? r.province : `${r.province} ${r.city}`;
            return (
              <View key={keyOf(r)} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
                <Pressable onPress={() => removeOne(r)} hitSlop={8}>
                  <Text style={styles.chipX}>×</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 2열 선택 UI */}
      <View style={styles.body}>
        <View style={styles.col}>
          <Text style={styles.colTitle}>시/도</Text>
          <ScrollView>
            {PROVINCES.map((p) => {
              const active = activeProvince === p;
              const count = provinceSelectedCount.get(p) || 0;
              const selected = p === "전체" ? hasAll : count > 0;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    setActiveProvince(p);
                    if (p === "전체") toggle("전체", "전체");
                  }}
                  style={[styles.row, styles.rowDividerGray, active && styles.rowActive, selected && styles.rowSelected]}
                >
                  <Text style={[styles.rowText, active && styles.rowTextActive, selected && styles.rowTextSelected]}>
                    {p}
                    {p !== "전체" && count > 0 ? ` (${count})` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.col}>
          <Text style={styles.colTitle}>시/군/구</Text>
          <ScrollView>
            {cities.map((c) => {
              const selected = localSelected.some((r) => r.province === activeProvince && r.city === (c || "전체"));
              return (
                <Pressable
                  key={c}
                  onPress={() => toggle(activeProvince, c)}
                  style={[styles.row, styles.rowDividerGray, selected && styles.rowSelected]}
                >
                  <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={reset} style={styles.btnGhost}>
          <Text style={styles.btnGhostText}>초기화</Text>
        </Pressable>
        <Pressable onPress={apply} style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>
            {applyButtonText} ({localSelected.length})
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (presentation === "inline") {
    if (!visible) return null;
    return (
      <View
        style={[
          styles.overlay,
          styles.inlineOverlay,
          {
            paddingHorizontal: inlinePaddingHorizontal,
            paddingTop: inlinePaddingTop,
            paddingBottom: inlinePaddingBottom,
          },
        ]}
      >
        {CardContent}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, !showBackdrop && styles.overlayNoBackdrop]}>
        {closeOnBackdropPress ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        ) : null}
        {CardContent}
      </View>
    </Modal>
  );
}

const makeStyles = ({ titleFontSizeDelta = 0 }: { titleFontSizeDelta?: number } = {}) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 14,
    },
    overlayNoBackdrop: {
      backgroundColor: "transparent",
    },
    inlineOverlay: {
      // inline에서는 모달 딤 없이, 화면에 고정된 메뉴 느낌으로
      backgroundColor: "transparent",
      justifyContent: "flex-start",
      alignItems: "stretch",
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 10,
    },
    card: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: "#fff",
      borderRadius: 16,
      padding: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 16 + titleFontSizeDelta,
      fontWeight: "900",
      color: "#111",
    },
    titleHint: {
      fontSize: 11 + titleFontSizeDelta,
      fontWeight: "600",
      color: "#aaa",
    },
    close: {
      color: "#666",
      fontWeight: "700",
      fontSize: 14,
    },
    sub: {
      marginTop: 6,
      fontSize: 12,
      color: "#666",
    },
    chipsRow: {
      marginTop: 10,
      gap: 8,
      paddingVertical: 2,
      paddingRight: 6,
    },
    emptyChipText: {
      fontSize: 12,
      color: "#888",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#BDBDBD",
      backgroundColor: "#fff",
    },
    chipText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#4A6CF7",
    },
    chipX: {
      fontSize: 16,
      fontWeight: "900",
      color: "#666",
      marginTop: -2,
    },
    body: {
      marginTop: 12,
      flexDirection: "row",
      gap: 10,
      height: 320,
    },
    col: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#000",
      borderRadius: 12,
      overflow: "hidden",
    },
    colTitle: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#000",
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
      backgroundColor: "#fafafa",
    },
    row: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#000",
    },
    rowDividerGray: {
      borderBottomColor: "#BDBDBD",
    },
    rowActive: {
      backgroundColor: "#4A6CF7",
    },
    rowSelected: {
      backgroundColor: "#4A6CF7",
    },
    rowText: {
      fontSize: 14,
      color: "#000",
      fontWeight: "900",
    },
    rowTextSelected: {
      color: "#fff",
    },
    rowTextActive: {
      color: "#fff",
    },
    footer: {
      marginTop: 12,
      flexDirection: "row",
      gap: 10,
    },
    btnGhost: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#BDBDBD",
      alignItems: "center",
    },
    btnGhostText: {
      fontSize: 16,
      fontWeight: "900",
      color: "#111",
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: "#4A6CF7",
      alignItems: "center",
    },
    btnPrimaryText: {
      fontSize: 16,
      fontWeight: "900",
      color: "#fff",
    },
  });

