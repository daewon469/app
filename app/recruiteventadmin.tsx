import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text as RNText,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { UIConfig } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

export default function RecruitEventAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [rewardPointAmount, setRewardPointAmount] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await UIConfig.get();
      if (res.status !== 0) {
        Alert.alert("오류", "설정을 불러올 수 없습니다.");
        return;
      }
      const ev = (res.config as any)?.recruit_event ?? {};
      setEnabled(Boolean(ev?.enabled ?? false));
      setRewardPointAmount(String(ev?.reward_point_amount ?? 0));
    } catch {
      Alert.alert("오류", "설정을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onApply = () => {
    const amount = Number(rewardPointAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      Alert.alert("입력 오류", "지급 포인트는 0 이상의 숫자여야 합니다.");
      return;
    }

    Alert.alert("일괄 적용", "설정값을 저장하고 모든 구인글에 일괄 적용할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "적용",
        onPress: async () => {
          setSaving(true);
          try {
            const res = await UIConfig.applyRecruitEvent({
              enabled,
              reward_point_amount: Math.floor(amount),
            });
            if (res.status !== 0) {
              Alert.alert("오류", "적용에 실패했습니다.");
              return;
            }
            Alert.alert(
              "완료",
              `저장되었습니다.\n구인글 ${res.updated_count ?? 0}건에 일괄 적용되었습니다.`,
            );
          } catch {
            Alert.alert("오류", "적용에 실패했습니다.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#0B1B3A" }}>구인등록 이벤트</Text>
      </View>
      <Text style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 18 }}>
        지급 포인트 금액과 이벤트 여부를 설정한 뒤, 모든 구인글에 일괄 적용합니다. 이후 새로
        등록되는 구인글에도 동일 설정이 자동 반영됩니다.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <View style={{ gap: 14 }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#0B1B3A", marginBottom: 8 }}>
              지급 포인트 금액
            </Text>
            <TextInput
              value={rewardPointAmount}
              onChangeText={setRewardPointAmount}
              keyboardType="number-pad"
              placeholder="예: 1000"
              placeholderTextColor="#999"
              style={{
                borderWidth: 1,
                borderColor: "#000",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                backgroundColor: "#f9f9f9",
                fontSize: 15,
                color: "#111",
              }}
            />
          </View>

          <View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#0B1B3A", marginBottom: 8 }}>
              이벤트 여부
            </Text>
            <Pressable
              onPress={() => setEnabled((v) => !v)}
              style={{
                borderWidth: 1,
                borderColor: "#000",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                backgroundColor: enabled ? "#EEF4FF" : "#fff",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: enabled ? "#4A6CF7" : "#666" }}>
                {enabled ? "이벤트 적용 중" : "이벤트 아님"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onApply}
            disabled={saving}
            style={{
              marginTop: 8,
              backgroundColor: "#4A6CF7",
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
              {saving ? "적용 중..." : "저장 및 일괄 적용"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
