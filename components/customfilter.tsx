import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text as RNText, StyleProp, StyleSheet, TextStyle, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

export type CustomFilterValue = {
  provinces: string[]; // ["전체"] or ["서울","경기",...]
  industries: string[]; // ["아파트", ...]
  roles: string[]; // ["총괄","본부장","팀장","팀원","기타"]
};

type Props = {
  visible: boolean;
  value: CustomFilterValue;
  onClose: () => void;
  onApply: (value: CustomFilterValue) => void;
};

const ROLE_OPTIONS = ["총괄", "본부장", "팀장", "팀원", "기타"] as const;
const REGION_OPTIONS = [
  "전국",
  "서울",
  "경기",
  "인천",
  "강원",
  "제주",
  "부산",
  "울산",
  "대구",
  "광주",
  "대전",
  "세종",
  "경남",
  "경북",
  "전남",
  "전북",
  "충남",
  "충북",
] as const;
const INDUSTRY_OPTIONS = [
  "아파트",
  "상가",
  "오피스",
  "오피스텔",
  "도시형생활주택",
  "레지던스",
  "호텔",
  "리조트",
  "지식산업센터",
  "타운하우스",
  "토지",
  "기타",
] as const;

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

function TableGrid<T extends string>({
  items,
  columns,
  isActive,
  onToggle,
  numberOfLines = 1,
  textStyle,
  activeTextStyle,
}: {
  items: readonly T[];
  columns: number;
  isActive: (v: T) => boolean;
  onToggle: (v: T) => void;
  numberOfLines?: number;
  textStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
}) {
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const rowSlices = Array.from({ length: rows }, (_, i) => items.slice(i * columns, i * columns + columns));

  return (
    <View style={styles.tableOuter}>
      {rowSlices.map((slice, rowIdx) => (
        <View key={`row-${rowIdx}`}>
          <View style={{ flexDirection: "row" }}>
            {Array.from({ length: columns }, (_, colIdx) => {
              const v = slice[colIdx];
              const lastCol = colIdx === columns - 1;
              if (!v) {
                return <View key={`empty-${rowIdx}-${colIdx}`} style={[styles.cell, { borderRightWidth: lastCol ? 0 : 1 }]} />;
              }
              const active = isActive(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => onToggle(v)}
                  style={[
                    styles.cell,
                    { borderRightWidth: lastCol ? 0 : 1 },
                    active ? styles.cellActive : null,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={numberOfLines}
                    ellipsizeMode="tail"
                    style={[
                      styles.cellText,
                      textStyle,
                      active ? styles.cellTextActive : null,
                      active ? activeTextStyle : null,
                    ]}
                  >
                    {v}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {rowIdx !== rowSlices.length - 1 ? <View style={styles.tableRowDivider} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function CustomFilterModal({ visible, value, onClose, onApply }: Props) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setProvinces(uniq((value?.provinces || []).map((s) => String(s ?? "").trim()).filter(Boolean)));
    setIndustries(uniq((value?.industries || []).map((s) => String(s ?? "").trim()).filter(Boolean)));
    setRoles(uniq((value?.roles || []).map((s) => String(s ?? "").trim()).filter(Boolean)));
  }, [visible, value]);

  const hasNationwide = useMemo(() => provinces.includes("전체"), [provinces]);
  const selectedProvinces = useMemo(() => provinces.filter((p) => p !== "전체"), [provinces]);

  const toggleProvince = (label: (typeof REGION_OPTIONS)[number]) => {
    if (label === "전국") {
      setProvinces((prev) => (prev.includes("전체") ? [] : ["전체"]));
      return;
    }
    const p = label.trim();
    if (!p) return;
    setProvinces((prev) => {
      const withoutAll = prev.filter((x) => x !== "전체");
      const exists = withoutAll.includes(p);
      return exists ? withoutAll.filter((x) => x !== p) : [...withoutAll, p];
    });
  };

  const toggleIndustry = (label: (typeof INDUSTRY_OPTIONS)[number]) => {
    const v = label.trim();
    setIndustries((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const toggleRole = (label: (typeof ROLE_OPTIONS)[number]) => {
    const v = label.trim();
    setRoles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const resetAll = () => {
    setProvinces([]);
    setIndustries([]);
    setRoles([]);
  };

  const apply = () => {
    onApply({
      provinces: uniq((provinces || []).map((s) => s.trim()).filter(Boolean)),
      industries: uniq((industries || []).map((s) => s.trim()).filter(Boolean)),
      roles: uniq((roles || []).map((s) => s.trim()).filter(Boolean)),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              맞춤 보기 <Text style={styles.titleHint}>(필터)</Text>
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          <View>
            {/* 지역 */}
            <Text style={styles.sectionTitleFirst}>
              지역{" "}
              <Text style={styles.sectionSub}>(복수선택 가능 / 미선택시 전체)</Text>
            </Text>
            <TableGrid
              items={REGION_OPTIONS}
              columns={6}
              isActive={(v) => (v === "전국" ? hasNationwide : selectedProvinces.includes(v))}
              onToggle={toggleProvince}
              textStyle={styles.cellTextRegion}
            />

            {/* 업종 */}
            <Text style={styles.sectionTitle}>
              업종{" "}
              <Text style={styles.sectionSub}>(복수선택 가능 / 미선택시 전체)</Text>
            </Text>
            <TableGrid
              items={INDUSTRY_OPTIONS}
              columns={3}
              isActive={(v) => industries.includes(v)}
              onToggle={toggleIndustry}
              numberOfLines={2}
            />

            {/* 모집 */}
            <Text style={styles.sectionTitle}>
              모집{" "}
              <Text style={styles.sectionSub}>(복수선택 가능 / 미선택시 전체)</Text>
            </Text>
            <View style={styles.rolesOuter}>
              <View style={{ flexDirection: "row" }}>
                {ROLE_OPTIONS.map((r, idx) => {
                  const active = roles.includes(r);
                  const last = idx === ROLE_OPTIONS.length - 1;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => toggleRole(r)}
                      style={[
                        styles.roleCell,
                        { borderRightWidth: last ? 0 : 1 },
                        active ? styles.roleCellActive : null,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.roleText, active ? styles.roleTextActive : null]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={resetAll} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>초기화</Text>
            </Pressable>
            <Pressable onPress={apply} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>보  기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111",
  },
  titleHint: {
    fontSize: 12,
    fontWeight: "800",
    color: "#888",
  },
  close: {
    color: "#666",
    fontWeight: "800",
    fontSize: 14,
  },
  sub: {
    marginTop: 6,
    fontSize: 12,
    color: "#666",
  },
  sectionTitleFirst: {
    marginTop: 6,
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionTitle: {
    marginTop: 14,
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionSub: {
    color: "#666",
    fontSize: 8,
    fontWeight: "500",
  },
  tableOuter: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  tableRowDivider: {
    height: 1,
    backgroundColor: "#000",
  },
  cell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRightColor: "#000",
  },
  cellActive: {
    backgroundColor: "#4A6CF7",
  },
  cellText: {
    fontWeight: "900",
    color: "#111",
    fontSize: 13,
  },
  cellTextRegion: {
    fontSize: 13,
  },
  cellTextActive: {
    color: "#fff",
  },
  rolesOuter: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  roleCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRightColor: "#000",
  },
  roleCellActive: {
    backgroundColor: "#4A6CF7",
  },
  roleText: {
    fontWeight: "900",
    color: "#111",
    fontSize: 13,
  },
  roleTextActive: {
    color: "#fff",
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  btnGhostText: {
    fontWeight: "900",
    color: "#111",
    fontSize: 16,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#4A6CF7",
    alignItems: "center",
  },
  btnPrimaryText: {
    fontWeight: "900",
    color: "#fff",
    fontSize: 16,
  },
});

