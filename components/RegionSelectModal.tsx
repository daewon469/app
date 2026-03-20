import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Step = "province" | "city";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (province: string, city: string) => void;

  // 복수 선택(맞춤현장용)
  multiple?: boolean;
  selectedRegions?: Array<{ province: string; city: string }>;
  onApply?: (regions: Array<{ province: string; city: string }>) => void;
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
];

const REGION_MAP: Record<string, string[]> = {
  전체: ["전체"],

  /* ===================== 서울특별시 ===================== */
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

  /* ===================== 경기도 ===================== */
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

  /* ===================== 인천광역시 ===================== */
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

  /* ===================== 부산광역시 ===================== */
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

  /* ===================== 대구광역시 ===================== */
  대구: [
    "전체",
    "남구",
    "달서구",
    "달성군",
    "동구",
    "북구",
    "서구",
    "수성구",
    "중구",
  ],

  /* ===================== 광주광역시 ===================== */
  광주: [
    "전체",
    "광산구",
    "남구",
    "동구",
    "북구",
    "서구",
  ],

  /* ===================== 대전광역시 ===================== */
  대전: [
    "전체",
    "대덕구",
    "동구",
    "서구",
    "유성구",
    "중구",
  ],

  /* ===================== 울산광역시 ===================== */
  울산: [
    "전체",
    "남구",
    "동구",
    "북구",
    "울주군",
    "중구",
  ],

  /* ===================== 세종특별자치시 ===================== */
  세종: ["전체"],

  /* ===================== 강원특별자치도 ===================== */
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

  /* ===================== 충청북도 ===================== */
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

  /* ===================== 충청남도 ===================== */
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

  /* ===================== 전북특별자치도 ===================== */
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

  /* ===================== 전라남도 ===================== */
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

  /* ===================== 경상북도 ===================== */
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

  /* ===================== 경상남도 ===================== */
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

  /* ===================== 제주특별자치도 ===================== */
  제주: [
    "전체",
    "서귀포시",
    "제주시",
  ],
};
export default function RegionSelectModal({
  visible,
  onClose,
  onSelect,
  multiple = false,
  selectedRegions = [],
  onApply,
}: Props) {
  const [step, setStep] = useState<Step>("province");
  const [province, setProvince] = useState<string>("전체");
  const [multiSelected, setMultiSelected] = useState<Array<{ province: string; city: string }>>(
    [],
  );

  useEffect(() => {
    if (!visible) return;

    if (multiple) {
      setStep("province");
      setProvince("전체");
      setMultiSelected(
        Array.from(
          new Map(
            (selectedRegions || [])
              .map((r) => ({
                province: (r.province || "").trim(),
                city: ((r.city || "").trim() || "전체"),
              }))
              .filter((r) => r.province)
              .map((r) => [`${r.province}__${r.city}`, r] as const)
          ).values()
        )
      );
      return;
    }

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "city") {
        setStep("province");
        return true;
      }
      onClose();
      return true;
    });

    return () => sub.remove();
  }, [visible, step]);

  const styles = makeStyles();

  const toggleRegion = (prov: string, city: string) => {
    const p = (prov || "").trim();
    const c = (city || "").trim() || "전체";
    if (!p) return;

    // 전체(전국) 선택은 단독
    if (p === "전체") {
      const hasAll = multiSelected.some((r) => r.province === "전체");
      setMultiSelected(hasAll ? [] : [{ province: "전체", city: "전체" }]);
      return;
    }

    setMultiSelected((prev) => {
      const withoutAll = prev.filter((r) => r.province !== "전체");
      const sameProv = withoutAll.filter((r) => r.province === p);
      const others = withoutAll.filter((r) => r.province !== p);

      // city 전체는 해당 province를 단독으로 만든다
      if (c === "전체") {
        const alreadyProvAll = sameProv.some((r) => r.city === "전체");
        return alreadyProvAll ? others : [...others, { province: p, city: "전체" }];
      }

      // 특정 city 토글: province 전체가 있으면 제거 후 추가
      const filteredSame = sameProv.filter((r) => r.city !== "전체");
      const exists = filteredSame.some((r) => r.city === c);
      const nextSame = exists
        ? filteredSame.filter((r) => r.city !== c)
        : [...filteredSame, { province: p, city: c }];
      return [...others, ...nextSame];
    });
  };

  const applyMulti = () => {
    onApply?.(multiSelected);
    onClose();
  };

  const resetMulti = () => setMultiSelected([]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* backdrop: 카드 바깥 영역만 닫기 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          {/* 헤더 */}
          <View style={styles.header}>
            {step === "city" && (
              <Pressable onPress={() => setStep("province")}>
                <Text style={styles.back}>←</Text>
              </Pressable>
            )}
            <Text style={styles.title}>
              {step === "province" ? "지역 선택" : "시·군·구 선택"}
            </Text>
          </View>

          {/* 설명 */}
          {step === "province" && (
            <Text style={styles.desc}>
              전체 선택 시 전국 검색이 적용됩니다.
            </Text>
          )}

          {/* 버튼 그리드 */}
          <View style={styles.grid}>
            {step === "province" &&
              PROVINCES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => {
                    setProvince(p);
                    if (multiple) {
                      if (p === "전체") {
                        toggleRegion("전체", "전체");
                        return;
                      }
                      // 복수선택에서는 province 클릭 시 city 단계로 이동(도시 선택)
                      setStep("city");
                      return;
                    }

                    if (p === "전체") {
                      onSelect("전체", "");
                      onClose();
                      return;
                    }
                    onSelect(p, "");

                    if (REGION_MAP[p]?.length > 1) {
                      setStep("city");
                    } else {
                      onClose();
                    }
                  }}
                  style={[
                    styles.item,
                    province === p && styles.itemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.itemText,
                      province === p && styles.itemTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}

            {step === "city" &&
              REGION_MAP[province]?.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    if (multiple) {
                      toggleRegion(province, c);
                      return;
                    }
                    onSelect(province, c);
                    onClose();
                    setStep("province");
                  }}
                  style={[
                    styles.item,
                    multiple &&
                      multiSelected.some((r) => r.province === province && r.city === c) &&
                      styles.itemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.itemText,
                      multiple &&
                        multiSelected.some((r) => r.province === province && r.city === c) &&
                        styles.itemTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
          </View>

          {/* 복수선택: 적용/초기화 */}
          {multiple && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={resetMulti}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#ccc",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "800", color: "#000" }}>
                  초기화
                </Text>
              </Pressable>

              <Pressable
                onPress={applyMulti}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#4A6CF7",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  적용 ({multiSelected.length})
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: "85%",
      backgroundColor: "#fff",
      borderRadius: 14,
      padding: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      gap: 8,
    },
    back: {
      fontSize: 18,
      color: "#000",
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    desc: {
      fontSize: 12,
      color: "#555",
      marginBottom: 12,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    item: {
      width: "30%",
      paddingVertical: 10,
      marginBottom: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#ccc",
      alignItems: "center",
    },
    itemActive: {
      backgroundColor: "#4A6CF7",
      borderColor: "#4A6CF7",
    },
    itemText: {
      fontSize: 13,
      color: "#000",
    },
    itemTextActive: {
      color: "#fff",
      fontWeight: "700",
    },
  });
