import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text as RNText, TextInput as RNTextInput, View } from "react-native";
import { API_URL, UIConfig } from "../lib/api";

const Text = ({ style, ...rest }: React.ComponentProps<typeof RNText>) => (
  <RNText {...rest} allowFontScaling={false} style={[{ color: "#111" }, style]} />
);

const TextInput = ({
  style,
  placeholderTextColor,
  ...rest
}: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput
    {...rest}
    allowFontScaling={false}
    placeholderTextColor={placeholderTextColor ?? "#666"}
    style={[{ color: "#111" }, style]}
  />
);

export default function PopupAdmin() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadingRef = useRef(false);

  const [enabled, setEnabled] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [widthPercentText, setWidthPercentText] = useState("92");
  const [heightText, setHeightText] = useState("360");
  const [resizeMode, setResizeMode] = useState<"contain" | "cover" | "stretch">("contain");

  const linkUrlNormalized = useMemo(() => (linkUrl || "").trim(), [linkUrl]);

  const popupWidthPercent = useMemo(() => {
    const n = parseInt((widthPercentText || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n <= 0) return 92;
    return Math.min(Math.max(n, 40), 100);
  }, [widthPercentText]);

  const popupHeight = useMemo(() => {
    const n = parseInt((heightText || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n <= 0) return 360;
    return Math.min(Math.max(n, 200), 900);
  }, [heightText]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await UIConfig.get();
      if (res.status !== 0) {
        Alert.alert("오류", "팝업 설정을 불러올 수 없습니다.");
        return;
      }
      setEnabled(!!res.config.popup.enabled);
      const img = res.config.popup.image_url;
      setImageUrl(typeof img === "string" && img.trim() ? img.trim() : null);
      setLinkUrl(res.config.popup.link_url ?? "");
      setWidthPercentText(String((res.config.popup as any)?.width_percent ?? 92));
      setHeightText(String((res.config.popup as any)?.height ?? 360));
      setResizeMode((() => {
        const rm = String((res.config.popup as any)?.resize_mode ?? "contain");
        return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
      })());
    } catch (e) {
      Alert.alert("오류", "팝업 설정을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadImageToServer = useCallback(async (localUri: string) => {
    const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
    const upload = await fetch(`${API_URL}/upload/base64`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: `popup_${Date.now()}.png`, base64: b64 }),
    });
    const data = await upload.json();
    const url = (data as any)?.url;
    if (!url || typeof url !== "string") throw new Error("업로드 실패");
    return url;
  }, []);

  const onPickPopupImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("권한 필요", "사진/미디어 접근 권한이 필요합니다.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (picked.canceled) return;
      const uri = picked.assets?.[0]?.uri;
      if (!uri) return;

      setSaving(true);
      const url = await uploadImageToServer(uri);
      setImageUrl(url);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "업로드에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [uploadImageToServer]);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const current = await UIConfig.get();
      const nextConfig = {
        ...current.config,
        popup: {
          enabled: !!enabled,
          image_url: imageUrl ?? null,
          link_url: linkUrlNormalized || null,
          width_percent: popupWidthPercent,
          height: popupHeight,
          resize_mode: resizeMode,
        },
      };
      const res = await UIConfig.update(nextConfig);
      if (res.status !== 0) {
        Alert.alert("오류", "저장에 실패했습니다.");
        return;
      }
      Alert.alert("저장 완료", "팝업 설정이 저장되었습니다.");
      router.back();
    } catch (e) {
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [enabled, imageUrl, linkUrlNormalized, popupWidthPercent, popupHeight, resizeMode, saving]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#000",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", marginBottom: 10 }}>팝업창 관리</Text>

          <Pressable
            onPress={() => setEnabled((p) => !p)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#000",
              backgroundColor: enabled ? "#2F6BFF" : "#f2f2f2",
              marginBottom: 10,
            }}
          >
            <Text style={{ fontWeight: "900", color: enabled ? "#fff" : "#111" }}>
              팝업 노출: {enabled ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onPickPopupImage}
            disabled={saving}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#000",
              backgroundColor: saving ? "#ddd" : "#FFF6D2",
              marginBottom: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "900" }}>PNG 업로드로 팝업 이미지 설정</Text>
          </Pressable>
          {!imageUrl ? (
            <Text style={{ color: "#666", marginBottom: 12 }}>현재 설정된 팝업 이미지가 없습니다.</Text>
          ) : null}

          <Text style={{ fontWeight: "900", marginBottom: 6 }}>팝업 노출 기준 미리보기</Text>
          <View
            style={{
              width: `${popupWidthPercent}%`,
              alignSelf: "center",
              borderRadius: 0,
              overflow: "hidden",
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#000",
              marginBottom: 12,
            }}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: "100%", height: popupHeight, backgroundColor: "#f2f2f2" }}
                resizeMode={resizeMode}
              />
            ) : (
              <View style={{ height: popupHeight, backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#666" }}>이미지 없음</Text>
              </View>
            )}
          </View>

          <Text style={{ fontWeight: "900", marginBottom: 6 }}>팝업 너비(화면 대비 %, 40~100)</Text>
          <TextInput
            value={widthPercentText}
            onChangeText={setWidthPercentText}
            keyboardType="number-pad"
            placeholder="예: 92"
            style={{
              borderWidth: 1,
              borderColor: "#000",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "#fff",
              marginBottom: 10,
            }}
          />

          <Text style={{ fontWeight: "900", marginBottom: 6 }}>팝업 높이(px)</Text>
          <TextInput
            value={heightText}
            onChangeText={setHeightText}
            keyboardType="number-pad"
            placeholder="예: 360"
            style={{
              borderWidth: 1,
              borderColor: "#000",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "#fff",
              marginBottom: 10,
            }}
          />

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => setResizeMode("contain")}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#000",
                backgroundColor: resizeMode === "contain" ? "#2F6BFF" : "#f2f2f2",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: resizeMode === "contain" ? "#fff" : "#111" }}>원본</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // "맞추기": 비율 유지 없이(왜곡 허용) 너비/높이를 동시에 맞춰 잘림 없이 표시
                setResizeMode("stretch");
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#000",
                backgroundColor: resizeMode === "stretch" ? "#2F6BFF" : "#f2f2f2",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: resizeMode === "stretch" ? "#fff" : "#111" }}>맞추기</Text>
            </Pressable>
          </View>

          <Text style={{ fontWeight: "900", marginBottom: 6 }}>클릭 링크(선택)</Text>
          <TextInput
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://..."
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: "#000",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "#fff",
              marginBottom: 10,
            }}
          />

          {imageUrl ? (
            <Pressable
              onPress={() => setImageUrl(null)}
              style={{
                marginBottom: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#000",
                backgroundColor: "#ffe5e5",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "900" }}>이미지 제거</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onSave}
            disabled={saving || loading}
            style={{
              marginTop: 6,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: saving || loading ? "#aaa" : "#2F6BFF",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#000",
            }}
          >
            <Text style={{ fontWeight: "900", color: "#fff" }}>저장</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

