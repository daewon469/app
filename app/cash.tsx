import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text as RNText, View } from "react-native";
import { Cash, type CashLedgerItem } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * ISO8601(UTC/Z 또는 offset 포함) 시간을 KST(UTC+9) 기준 "YYYY-MM-DD HH:mm:ss" 로 표시.
 * - 기기 로컬 타임존과 무관하게 항상 KST 기준으로 표기됩니다.
 */
const formatKstDatetime = (iso?: string | null) => {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return String(iso).slice(0, 19).replace("T", " ");

  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = pad2(kst.getUTCMonth() + 1);
  const d = pad2(kst.getUTCDate());
  const hh = pad2(kst.getUTCHours());
  const mm = pad2(kst.getUTCMinutes());
  const ss = pad2(kst.getUTCSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
};

const formatAmount = (n: number) => {
  const v = Number(n || 0);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString()}원`;
};

const displayReason = (reason: string) => {
  const r = (reason || "").toLowerCase();
  if (r.includes("referral")) return "추천인 가입";
  return reason;
};

export default function CashScreen() {
  const { username } = useLocalSearchParams<{ username?: string }>();

  const colors = useMemo(
    () => ({
      background: "#fff", // app 기본 배경(list.tsx 등과 동일)
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      divider: "rgba(0,0,0,0.12)",
      primary: "#4A6CF7",
      plus: "#1B9E77",
      minus: "#D64545",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CashLedgerItem[]>([]);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      Alert.alert("오류", "사용자 정보가 없습니다.");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await Cash.list(String(username));
        if (res.status === 0) {
          setItems(res.items || []);
        } else {
          setItems([]);
        }
      } catch (e) {
        console.warn(e);
        Alert.alert("오류", "캐시 내역을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>캐시 충전/사용 내역</Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "#EEF4FF",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
              최근 {items.length}건
            </Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
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
            <Text style={{ color: colors.subText }}>캐시 내역이 없습니다.</Text>
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
            {items.map((it, idx) => {
              const isPlus = Number(it.amount) >= 0;
              return (
                <View
                  key={String(it.id)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.divider,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                      {displayReason(it.reason)}
                    </Text>
                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                      {formatKstDatetime(it.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: isPlus ? colors.plus : colors.minus,
                    }}
                  >
                    {formatAmount(it.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

