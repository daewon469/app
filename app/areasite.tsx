import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text as RNText, View } from "react-native";
import CustomRegionMultiSelectModal, { type RegionObj } from "../components/CustomRegionMultiSelectModal";
import BottomBar from "../components/ui/BottomBar";
import { Auth } from "../lib/api";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const regionObjToCode = (r: RegionObj): string => {
  const p = (r?.province || "").trim();
  const c = (r?.city || "").trim() || "전체";
  if (!p) return "";
  if (p === "전체") return "전체";
  if (c === "전체") return p;
  return `${p} ${c}`;
};

const regionCodeToObj = (code: string): RegionObj | null => {
  const v = (code || "").trim();
  if (!v) return null;
  if (v === "전체") return { province: "전체", city: "전체" };
  const parts = v.split(" ").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { province: parts[0], city: "전체" };
  return { province: parts[0], city: parts.slice(1).join(" ") || "전체" };
};

export default function AreaSiteSettingsScreen() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<RegionObj[]>([]);

  const load = useCallback(async () => {
    const s = await getSession();
    setUsername(s.isLogin ? s.username : null);

    if (!s.isLogin || !s.username) {
      setSelectedRegions([]);
      return;
    }

    try {
      setLoading(true);
      const res = await Auth.getUser(s.username);
      const codes = (res as any)?.user?.area_region_codes ?? [];
      const parsed = (codes || [])
        .map((x: any) => regionCodeToObj(String(x)))
        .filter(Boolean) as RegionObj[];
      setSelectedRegions(parsed);
    } catch {
      setSelectedRegions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveCodes = useCallback(
    async (codes: string[]) => {
      if (!username) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.push("/login");
        return;
      }
      try {
        setLoading(true);
        await Auth.updateUser(username, { area_region_codes: codes });
        Alert.alert("완료", "지역저장 설정이 저장되었습니다.", [
          { text: "확인", onPress: () => router.replace("/arealike") },
        ]);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || "잠시 후 다시 시도해주세요.";
        Alert.alert("저장 실패", msg);
      } finally {
        setLoading(false);
      }
    },
    [username]
  );

  const onApply = useCallback(
    async (regions: RegionObj[]) => {
      const picked = (regions || []).filter(Boolean);
      setSelectedRegions(picked);
      const codes = uniq(picked.map(regionObjToCode).map((s) => s.trim()).filter(Boolean));
      await saveCodes(codes);
    },
    [saveCodes]
  );

  if (!username) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "gray", textAlign: "center" }}>
            로그인 후 지역현장 설정을 할 수 있습니다.
          </Text>
        </View>
        <BottomBar onToggleMapSearch={() => router.push({ pathname: "/list", params: { openMap: "1" } })} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <CustomRegionMultiSelectModal
        visible={true}
        presentation="inline"
        showCloseButton={true}
        showBackdrop={false}
        closeOnBackdropPress={false}
        titleText="지역저장 설정 (복수선택 가능)"
        titleFontSizeDelta={3}
        // customsite.tsx와 동일한 "바깥 여백" 감(좌우 16)
        inlinePaddingHorizontal={16}
        // 상/하도 과도하게 붙지 않게 여백 유지
        inlinePaddingTop={16}
        inlinePaddingBottom={16}
        // 모달(카드) 검은색 테두리
        cardBorderWidth={1}
        cardBorderColor={"#000"}
        onClose={() => router.back()}
        selectedRegions={selectedRegions}
        onApply={onApply}
      />

      {/* 저장/조회 중 상태 표시(모달 뒤에서라도 진행을 알 수 있게 유지) */}
      {loading ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 10, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

