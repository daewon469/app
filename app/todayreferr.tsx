import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  Text as RNText,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Referral, type ReferralStatusDayItem, type ReferralStatusDetailItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

async function saveToAndroidDownloads(localUri: string, filename: string) {
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) throw new Error("폴더 접근 권한이 필요합니다.");

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const mime = "text/csv";
  const newUri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, filename, mime);
  await FileSystem.writeAsStringAsync(newUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return newUri;
}

function formatKoreanPhone(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  let digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;

  // 일부 데이터가 정수 변환 등으로 leading zero(0)가 누락된 경우 보정
  // 예) 1012345678 -> 01012345678
  if (digits.length === 10 && digits.startsWith("10")) {
    digits = `0${digits}`;
  }

  // 서울(02) 예외 처리
  if (digits.startsWith("02")) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw;
  }

  // 휴대폰/지역번호 일반 케이스
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`; // 010-1234-4567
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`; // 011/지역번호 등

  return raw;
}

function escapeCsv(value: string) {
  const s = String(value ?? "");
  // CSV: double-quote escaping
  const escaped = s.replace(/"/g, '""');
  // quote if contains comma, quote, or newline
  if (/[",\r\n]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function escapeExcelFormulaString(value: string) {
  // Excel 수식 문자열 내부용 escaping: " -> ""
  return String(value ?? "").replace(/"/g, '""');
}

function excelTextFormula(value: string) {
  const s = String(value ?? "");
  if (!s) return "";
  // CSV를 열 때도 날짜 자동인식을 피하려고 "텍스트를 반환하는 수식"으로 강제합니다.
  // 결과는 텍스트로 취급되어 보통 좌측정렬됩니다.
  return `="${escapeExcelFormulaString(s)}"`;
}

function preventCsvInjection(value: string) {
  const s = String(value ?? "");
  if (!s) return "";
  // Excel/Sheets에서 CSV를 열 때, 특정 문자로 시작하면 수식으로 실행될 수 있어 방지합니다.
  // (=, +, -, @) 로 시작하면 앞에 ' 를 붙여 텍스트로 강제.
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function buildReferralAllCsv(items: ReferralStatusDetailItem[]) {
  const header = ["날짜", "A(가입자)", "B(추천인)", "B_전화번호"].map(escapeCsv).join(",");
  const lines = (items ?? []).map((it) => {
    const d = escapeCsv(excelTextFormula(it.date ?? ""));
    const a = escapeCsv(preventCsvInjection(it.A_username ?? ""));
    const b = escapeCsv(preventCsvInjection(it.B_username ?? ""));
    const phone = escapeCsv(preventCsvInjection(formatKoreanPhone(it.B_phone_number ?? it.A_phone_number)));
    return [d, a, b, phone].join(",");
  });

  // BOM(\ufeff): 윈도우 엑셀 한글 깨짐 방지, 줄바꿈은 CRLF로 고정
  return `\ufeff${header}\r\n${lines.join("\r\n")}\r\n`;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let nextIdx = 0;

  const runOne = async () => {
    for (;;) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      result[idx] = await worker(items[idx], idx);
    }
  };

  const poolSize = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => runOne()));
  return result;
}

export default function TodayReferrScreen() {
  const insets = useSafeAreaInsets();
  const BOTTOM_BAR_HEIGHT = 61;

  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(() => ({ contentHeight, layoutHeight }), [contentHeight, layoutHeight]);

  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      divider: "rgba(0,0,0,0.12)",
      borderSoft: "rgba(0,0,0,0.12)",
      primary: "#4A6CF7",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<ReferralStatusDayItem[]>([]);
  const [exporting, setExporting] = useState(false);

  const loadDays = useCallback(async () => {
    const res = await Referral.statusDays({ limit: 60 });
    if (res?.status === 0) {
      setDays(res.items ?? []);
    } else {
      setDays([]);
    }
    return res;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadDays();
      } catch {
        Alert.alert("오류", "추천 현황을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDays]);

  const onPressDate = useCallback((date: string) => {
    const d = String(date || "").trim();
    if (!d) return;
    router.push({ pathname: "/todayreferrDetail", params: { date: d } });
  }, []);

  const handleExportExcelAll = useCallback(async () => {
    try {
      if (exporting) return;
      if (loading) {
        Alert.alert("알림", "데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (!days || days.length === 0) {
        Alert.alert("알림", "다운로드할 추천 데이터가 없습니다.");
        return;
      }

      setExporting(true);
      Alert.alert("알림", "엑셀 파일을 생성 중입니다. (데이터 양에 따라 시간이 걸릴 수 있어요)");

      const dates = days.map((d) => String(d.date || "").trim()).filter(Boolean);
      const details = await runWithConcurrency(
        dates,
        4,
        async (dateText) => {
          const res = await Referral.statusByDate(dateText);
          if (res?.status !== 0) return [] as ReferralStatusDetailItem[];
          return (res.items ?? []).map((it) => ({
            ...it,
            date: it.date ?? dateText,
          }));
        }
      );

      const allItems = details.flat().filter(Boolean);
      if (allItems.length === 0) {
        Alert.alert("알림", "다운로드할 추천 내역이 없습니다.");
        return;
      }

      allItems.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

      const filename = `referrals_all_${Date.now()}.csv`;
      const localUri = FileSystem.documentDirectory + filename;
      const csv = buildReferralAllCsv(allItems);
      await FileSystem.writeAsStringAsync(localUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (Platform.OS === "android") {
        await saveToAndroidDownloads(localUri, filename);
        Alert.alert("저장 완료", "선택한 폴더에 엑셀 파일이 저장되었습니다.");
        return;
      }

      if (Platform.OS === "ios") {
        await Sharing.shareAsync(localUri, {
          mimeType: "text/csv",
          dialogTitle: "엑셀 파일 열기/공유",
        });
        return;
      }

      Alert.alert("알림", "이 기기에서는 엑셀 다운로드를 지원하지 않습니다.");
    } catch (e: any) {
      Alert.alert("실패", e?.message ?? "파일 저장에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }, [days, exporting, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>추천 현황</Text>
            </View>

            <Pressable
              onPress={handleExportExcelAll}
              disabled={loading || exporting || days.length === 0}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "#fff",
                opacity: loading || exporting || days.length === 0 ? 0.35 : 1,
              }}
            >
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>
                {exporting ? "생성 중" : "엑셀 다운로드"}
              </Text>
            </Pressable>
          </View>
          <Text style={{ marginTop: 6, fontSize: 12, color: colors.subText }}>
            날짜를 클릭하면 상세 페이지로 연결됩니다.
          </Text>
        </View>

        <View style={{ marginTop: 10 }}>
          {loading ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 16,
                alignItems: "center",
              }}
            >
              <ActivityIndicator />
            </View>
          ) : days.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.subText }}>추천 데이터가 없습니다.</Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: "#f8f9fa",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <Text style={{ flex: 1, color: colors.primary, fontSize: 14, fontWeight: "800" }}>날짜</Text>
                <Text style={{ width: 90, textAlign: "right", color: colors.primary, fontSize: 14, fontWeight: "800" }}>
                  추천수
                </Text>
              </View>

              {days.map((d) => (
                <Pressable
                  key={d.date}
                  onPress={() => onPressDate(d.date)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: 1,
                    borderTopColor: colors.divider,
                    backgroundColor: "#fff",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "800" }}>
                      {d.date}
                    </Text>
                    <Text style={{ width: 90, textAlign: "right", color: colors.text, fontSize: 15, fontWeight: "900" }}>
                      {Number(d.referral_count ?? 0).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => scrollRef.current?.scrollTo?.({ y: 0, animated: true })}
        onBottom={() =>
          scrollRef.current?.scrollTo?.({
            y: Math.max(contentHeight - layoutHeight, 0),
            animated: true,
          })
        }
        bottomOffset={BOTTOM_BAR_HEIGHT + insets.bottom}
        topOffset={0}
        trackOpacity={0.6}
        thumbOpacity={1.0}
        barWidth={4}
      />
    </View>
  );
}

