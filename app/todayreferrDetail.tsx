import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollNavigator from "../components/ScrollNavigator";
import { Referral, type ReferralStatusDetailItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

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

export default function TodayReferrDetailScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const insets = useSafeAreaInsets();
  const BOTTOM_BAR_HEIGHT = 61;
  const CELL_MAX_LINES = 1;
  const CELL_LINE_HEIGHT = 16;
  const CELL_MIN_HEIGHT = CELL_MAX_LINES * CELL_LINE_HEIGHT;
  const PHONE_COL_WIDTH = 132;

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
      primary: "#4A6CF7",
    }),
    []
  );

  const dateText = String(date ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReferralStatusDetailItem[]>([]);

  const handleCopyPhone = useCallback(async (phone: string) => {
    const text = String(phone ?? "").trim();
    if (!text) {
      Alert.alert("안내", "복사할 전화번호가 없습니다.");
      return;
    }
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("복사 완료", `${text}\n클립보드에 복사되었습니다.`);
    } catch {
      Alert.alert("오류", "전화번호 복사에 실패했습니다.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!dateText) {
        setLoading(false);
        setItems([]);
        Alert.alert("오류", "날짜 정보가 없습니다.");
        return;
      }

      try {
        setLoading(true);
        const res = await Referral.statusByDate(dateText);
        if (res?.status === 0) setItems(res.items ?? []);
        else setItems([]);
      } catch {
        Alert.alert("오류", "추천 상세 정보를 불러오지 못했습니다.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dateText]);

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
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
              추천 상세 {dateText ? `(${dateText})` : ""}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: colors.subText,
              marginTop: 4,
              fontWeight: "400",
            }}
          >
            A 회원 신규 가입 시 B 회원 추천
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
          ) : items.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.subText }}>해당 날짜의 추천 내역이 없습니다.</Text>
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
                  paddingVertical: 10,
                  paddingLeft: 14,
                  paddingRight: 6,
                  backgroundColor: "#f8f9fa",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <Text
                  style={{
                    flex: 1.25,
                    paddingRight: 8,
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "900",
                    lineHeight: CELL_LINE_HEIGHT,
                    minHeight: CELL_MIN_HEIGHT,
                  }}
                  numberOfLines={CELL_MAX_LINES}
                >
                  A(가입자)
                </Text>
                <Text
                  style={{
                    flex: 1.25,
                    paddingRight: 8,
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "900",
                    lineHeight: CELL_LINE_HEIGHT,
                    minHeight: CELL_MIN_HEIGHT,
                  }}
                  numberOfLines={CELL_MAX_LINES}
                >
                  B(추천인)
                </Text>
                <Text
                  style={{
                    width: PHONE_COL_WIDTH,
                    flexShrink: 0,
                    paddingLeft: 39,
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "900",
                    textAlign: "left",
                    lineHeight: CELL_LINE_HEIGHT,
                    minHeight: CELL_MIN_HEIGHT,
                  }}
                  numberOfLines={CELL_MAX_LINES}
                >
                  B_전화번호
                </Text>
                
              </View>

              {items.map((it, idx) => {
                const phoneText = formatKoreanPhone(it.B_phone_number ?? it.A_phone_number);
                return (
                  <View
                    key={`${it.A_username ?? "A"}-${it.B_username ?? "B"}-${it.B_phone_number ?? it.A_phone_number ?? ""}-${idx}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingLeft: 14,
                      paddingRight: 6,
                      borderBottomWidth: idx === items.length - 1 ? 0 : 1,
                      borderBottomColor: colors.divider,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1.25,
                        paddingRight: 8,
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: "800",
                        lineHeight: CELL_LINE_HEIGHT,
                        minHeight: CELL_MIN_HEIGHT,
                      }}
                      numberOfLines={CELL_MAX_LINES}
                    >
                      {it.A_username ?? ""}
                    </Text>
                    <Text
                      style={{
                        flex: 1.25,
                        paddingRight: 8,
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: "800",
                        lineHeight: CELL_LINE_HEIGHT,
                        minHeight: CELL_MIN_HEIGHT,
                      }}
                      numberOfLines={CELL_MAX_LINES}
                    >
                      {it.B_username ?? ""}
                    </Text>
                    <Pressable
                      onPress={() => handleCopyPhone(phoneText)}
                      style={{
                        width: PHONE_COL_WIDTH,
                        flexShrink: 0,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 13,
                          fontWeight: "800",
                          textAlign: "right",
                          lineHeight: CELL_LINE_HEIGHT,
                          minHeight: CELL_MIN_HEIGHT,
                        }}
                        numberOfLines={CELL_MAX_LINES}
                      >
                        {phoneText}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
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

