import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text as RNText, TextInput as RNTextInput, View } from "react-native";
import { API_URL, UIConfig, type UIConfigBannerItem } from "../lib/api";
import { isReferralModalAction, isReferralModalLinkUrl, normalizeBannerClickAction, REFERRAL_MODAL_ACTION_LINK } from "../lib/ui_banner_actions";

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

type BannerAdminItem = UIConfigBannerItem & {
  width_px_text?: string;
  height_text?: string;
};

const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(value)));
const digitsOnly = (text: string) => (text || "").replace(/[^0-9]/g, "");
const parseIntOrNull = (text: string) => {
  const d = digitsOnly(text);
  if (!d) return null;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : null;
};

export default function BannerAdmin() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadingRef = useRef(false);

  const [enabled, setEnabled] = useState(true);
  const [intervalPostsText, setIntervalPostsText] = useState("10");
  const [items, setItems] = useState<BannerAdminItem[]>([]);

  const intervalPosts = useMemo(() => {
    const n = parseInt((intervalPostsText || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n <= 0) return 10;
    return Math.min(Math.max(n, 1), 200);
  }, [intervalPostsText]);

  const DEFAULT_BANNER_HEIGHT = 110;
  const DEFAULT_RESIZE_MODE: "contain" | "cover" | "stretch" = "contain";

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await UIConfig.get();
      if (res.status !== 0) {
        Alert.alert("오류", "배너 설정을 불러올 수 없습니다.");
        return;
      }
      setEnabled(!!res.config.banner.enabled);
      setIntervalPostsText(String(res.config.banner.interval_posts ?? 10));
      const bannerBaseHeight = Number((res.config.banner as any)?.height ?? DEFAULT_BANNER_HEIGHT) || DEFAULT_BANNER_HEIGHT;
      const bannerBaseResizeMode = (() => {
        const rm = String((res.config.banner as any)?.resize_mode ?? DEFAULT_RESIZE_MODE);
        return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
      })();
      const rawItems = Array.isArray(res.config.banner.items) ? res.config.banner.items : [];
      // 빈 uri가 들어오면 RN Image가 경고를 띄우므로 로드 단계에서 정리
      const cleaned = rawItems
        .filter((it) => typeof it?.image_url === "string" && it.image_url.trim())
        .map((it) => ({
          ...it,
          click_action: isReferralModalLinkUrl((it as any)?.link_url) ? "referral_modal" : normalizeBannerClickAction((it as any)?.click_action),
          width_px: (() => {
            const w = Number((it as any)?.width_px);
            return Number.isFinite(w) && w > 0 ? w : null;
          })(),
          height: Number((it as any)?.height ?? bannerBaseHeight) || bannerBaseHeight,
          resize_mode: (() => {
            const rm = String((it as any)?.resize_mode ?? bannerBaseResizeMode);
            return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
          })(),
          width_px_text: (() => {
            const w = Number((it as any)?.width_px);
            return Number.isFinite(w) && w > 0 ? String(Math.floor(w)) : "";
          })(),
          height_text: String(Number((it as any)?.height ?? bannerBaseHeight) || bannerBaseHeight),
        }));
      setItems(cleaned);
    } catch (e) {
      Alert.alert("오류", "배너 설정을 불러올 수 없습니다.");
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
      body: JSON.stringify({ filename: `banner_${Date.now()}.png`, base64: b64 }),
    });
    const data = await upload.json();
    const url = (data as any)?.url;
    if (!url || typeof url !== "string") throw new Error("업로드 실패");
    return url;
  }, []);

  const pickImageAndUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", "사진/미디어 접근 권한이 필요합니다.");
      return null;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (picked.canceled) return null;
    const uri = picked.assets?.[0]?.uri;
    if (!uri) return null;

    const url = await uploadImageToServer(uri);
    return url;
  }, [uploadImageToServer]);

  const onAddBanner = useCallback(async () => {
    try {
      setSaving(true);
      const url = await pickImageAndUpload();
      if (!url) return;
      setItems((prev) => [
        ...prev,
        {
          image_url: url,
          link_url: null,
          click_action: "link",
          width_px: null,
          height: DEFAULT_BANNER_HEIGHT,
          resize_mode: DEFAULT_RESIZE_MODE,
          width_px_text: "",
          height_text: String(DEFAULT_BANNER_HEIGHT),
        },
      ]);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "업로드에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [pickImageAndUpload]);

  const onChangeSlotImage = useCallback(
    async (idx: number) => {
      if (saving) return;
      try {
        setSaving(true);
        const url = await pickImageAndUpload();
        if (!url) return;
        setItems((prev) => {
          const next = [...prev];
          const cur = next[idx] as any;
          next[idx] = { ...cur, image_url: url };
          return next;
        });
      } catch (e: any) {
        Alert.alert("오류", e?.message ?? "업로드에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [pickImageAndUpload, saving],
  );

  const onRemoveSlotImage = useCallback(
    (idx: number) => {
      const cur = items?.[idx];
      if (!cur?.image_url) return;
      Alert.alert("사진 제거", "이 슬롯의 사진을 제거할까요? (저장 시 배너 목록에서 제외됩니다)", [
        { text: "취소", style: "cancel" },
        {
          text: "제거",
          style: "destructive",
          onPress: () =>
            setItems((prev) => {
              const next = [...prev];
              const v = next[idx] as any;
              next[idx] = { ...v, image_url: "" };
              return next;
            }),
        },
      ]);
    },
    [items],
  );

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const current = await UIConfig.get();
      const nextConfig = {
        ...current.config,
        banner: {
          enabled: !!enabled,
          interval_posts: intervalPosts,
          // 배너 레벨 기본값은 기존 값을 유지(관리 화면에서 편집 제거)
          height: Number((current.config.banner as any)?.height ?? DEFAULT_BANNER_HEIGHT) || DEFAULT_BANNER_HEIGHT,
          resize_mode: (
            ((current.config.banner as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "cover" ? "cover" : "contain"
          ) as "contain" | "cover",
          // 배너별 설정 저장
          items: (items || [])
            .filter((it) => it?.image_url)
            .map((it) => ({
              image_url: it.image_url,
              link_url: (() => {
                const ca = normalizeBannerClickAction((it as any)?.click_action);
                if (ca === "referral_modal") return REFERRAL_MODAL_ACTION_LINK;
                const link = String(it.link_url ?? "").trim();
                return link ? link : null;
              })(),
              click_action: normalizeBannerClickAction((it as any)?.click_action),
              width_px: (() => {
                const n = parseIntOrNull(String((it as any)?.width_px_text ?? ""));
                if (n === null) return null;
                return clampInt(n, 120, 1200);
              })(),
              height: (() => {
                const n = parseIntOrNull(String((it as any)?.height_text ?? ""));
                const h = n === null ? DEFAULT_BANNER_HEIGHT : n;
                return clampInt(h, 60, 260);
              })(),
              resize_mode: (() => {
                const rm = String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE);
                return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
              })(),
            })),
        },
      };
      const res = await UIConfig.update(nextConfig);
      if (res.status !== 0) {
        Alert.alert("오류", "저장에 실패했습니다.");
        return;
      }
      Alert.alert("저장 완료", "배너 설정이 저장되었습니다.");
      router.back();
    } catch (e) {
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [enabled, intervalPosts, items, saving]);

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
          <Text style={{ fontSize: 18, fontWeight: "900", marginBottom: 10 }}>배너 관리</Text>

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
              배너 노출: {enabled ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <Text style={{ fontWeight: "900", marginBottom: 6 }}>몇 개마다 배너를 넣을까요? (글 기준)</Text>
          <TextInput
            value={intervalPostsText}
            onChangeText={setIntervalPostsText}
            keyboardType="number-pad"
            placeholder="예: 10"
            style={{
              borderWidth: 1,
              borderColor: "#000",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "#fff",
              marginBottom: 14,
            }}
          />

          <Pressable
            onPress={onAddBanner}
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
            <Text style={{ fontWeight: "900" }}>PNG 업로드로 배너 추가</Text>
          </Pressable>

          <Text style={{ fontWeight: "900", marginBottom: 10 }}>
            배너 종류: {items.length}개 (업로드한 순서대로 돌아갑니다)
          </Text>

          {(items || []).map((it, idx) => (
            <View
              key={`banner_${idx}`}
              style={{
                borderWidth: 1,
                borderColor: "#000",
                borderRadius: 12,
                padding: 10,
                marginBottom: 10,
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ fontWeight: "900", marginBottom: 8 }}>배너 {idx + 1}</Text>
              {/* 목록 노출 기준 미리보기(배너별 설정) */}
              <View style={{ alignItems: "center" }}>
                <Pressable
                  onPress={() => {
                    if (!it?.image_url) return;
                    setPreviewUri(String(it.image_url));
                    setPreviewVisible(true);
                  }}
                  style={{
                    width: "100%",
                    alignItems: "center",
                  }}
                >
                  <View
                  style={{
                    width: (() => {
                      const n = parseIntOrNull(String((it as any)?.width_px_text ?? ""));
                      if (n === null) return "100%";
                      return clampInt(n, 120, 1200);
                    })(),
                    borderRadius: 0,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: "#fff",
                  }}
                >
                  {it?.image_url ? (
                    <Image
                      source={{ uri: it.image_url }}
                      style={{
                        width: "100%",
                        height: (() => {
                          const n = parseIntOrNull(String((it as any)?.height_text ?? ""));
                          const h = n === null ? DEFAULT_BANNER_HEIGHT : n;
                          return clampInt(h, 60, 260);
                        })(),
                        backgroundColor: "#f2f2f2",
                      }}
                      resizeMode={(() => {
                        const rm = String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE);
                        return rm === "cover" || rm === "stretch" ? (rm as any) : "contain";
                      })()}
                    />
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        height: Math.max(60, Math.min(260, Number((it as any)?.height ?? DEFAULT_BANNER_HEIGHT) || DEFAULT_BANNER_HEIGHT)),
                        backgroundColor: "#f2f2f2",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#666", fontWeight: "900" }}>이미지 없음</Text>
                    </View>
                  )}
                  </View>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => onChangeSlotImage(idx)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: saving ? "#ddd" : "#EAF0FF",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900" }}>{it?.image_url ? "사진 변경" : "사진 추가"}</Text>
                </Pressable>

                <Pressable
                  onPress={() => onRemoveSlotImage(idx)}
                  disabled={saving || !it?.image_url}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: saving || !it?.image_url ? "#eee" : "#ffe5e5",
                    alignItems: "center",
                    opacity: saving || !it?.image_url ? 0.7 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900" }}>사진 제거</Text>
                </Pressable>
              </View>

              <Text style={{ fontWeight: "900", marginTop: 10, marginBottom: 6 }}>배너 너비(px, 비우면 100%)</Text>
              <TextInput
                value={String((it as any)?.width_px_text ?? "")}
                onChangeText={(t) => {
                  const cleaned = digitsOnly(t);
                  setItems((prev) => {
                    const next = [...prev];
                    next[idx] = { ...(next[idx] as any), width_px_text: cleaned };
                    return next;
                  });
                }}
                onBlur={() => {
                  setItems((prev) => {
                    const next = [...prev];
                    const cur = next[idx] as any;
                    const n = parseIntOrNull(String(cur?.width_px_text ?? ""));
                    next[idx] = { ...cur, width_px_text: n === null ? "" : String(clampInt(n, 120, 1200)) };
                    return next;
                  });
                }}
                keyboardType="number-pad"
                placeholder="예: 360"
                style={{
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: "#fff",
                }}
              />

              <Text style={{ fontWeight: "900", marginTop: 10, marginBottom: 6 }}>배너 높이(px, 60~260)</Text>
              <TextInput
                value={String((it as any)?.height_text ?? "")}
                onChangeText={(t) => {
                  const cleaned = digitsOnly(t);
                  setItems((prev) => {
                    const next = [...prev];
                    next[idx] = { ...(next[idx] as any), height_text: cleaned };
                    return next;
                  });
                }}
                onBlur={() => {
                  setItems((prev) => {
                    const next = [...prev];
                    const cur = next[idx] as any;
                    const n = parseIntOrNull(String(cur?.height_text ?? ""));
                    const h = n === null ? DEFAULT_BANNER_HEIGHT : n;
                    next[idx] = { ...cur, height_text: String(clampInt(h, 60, 260)) };
                    return next;
                  });
                }}
                keyboardType="number-pad"
                placeholder="예: 110"
                style={{
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: "#fff",
                }}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[idx] = { ...(next[idx] as any), resize_mode: "contain" };
                      return next;
                    })
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: ((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "contain" ? "#2F6BFF" : "#f2f2f2",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: ((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "contain" ? "#fff" : "#111" }}>
                    원본
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setItems((prev) => {
                      const next = [...prev];
                      // "맞추기": 비율 유지 없이(왜곡 허용) 너비/높이를 동시에 맞춰 잘림 없이 표시
                      next[idx] = { ...(next[idx] as any), resize_mode: "stretch" };
                      return next;
                    })
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: ((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "stretch" ? "#2F6BFF" : "#f2f2f2",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: ((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "stretch" ? "#fff" : "#111" }}>
                    맞추기
                  </Text>
                </Pressable>
              </View>

              <Text style={{ fontWeight: "900", marginTop: 10, marginBottom: 6 }}>클릭 링크(선택)</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <Pressable
                  onPress={() =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[idx] = { ...(next[idx] as any), click_action: "link" };
                      return next;
                    })
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: isReferralModalAction((it as any)?.click_action) ? "#f2f2f2" : "#2F6BFF",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: isReferralModalAction((it as any)?.click_action) ? "#111" : "#fff" }}>
                    외부링크 열기
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setItems((prev) => {
                      const next = [...prev];
                      next[idx] = { ...(next[idx] as any), click_action: "referral_modal", link_url: REFERRAL_MODAL_ACTION_LINK };
                      return next;
                    })
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: isReferralModalAction((it as any)?.click_action) ? "#2F6BFF" : "#f2f2f2",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: isReferralModalAction((it as any)?.click_action) ? "#fff" : "#111" }}>
                    추천하기 모달
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={it.link_url ?? ""}
                onChangeText={(t) => {
                  setItems((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], link_url: t, click_action: "link" };
                    return next;
                  });
                }}
                placeholder="https://..."
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: "#fff",
                }}
              />
              {isReferralModalAction((it as any)?.click_action) ? (
                <Text style={{ marginTop: 6, color: "#666", fontWeight: "900" }}>
                  현재 클릭 액션이 "추천하기 모달" 입니다. (서버 호환을 위해 link_url은 "action:referral_modal"로 저장됩니다)
                </Text>
              ) : null}

              <Pressable
                onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#000",
                  backgroundColor: "#ffe5e5",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900" }}>삭제</Text>
              </Pressable>
            </View>
          ))}

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
            <Text style={{ fontWeight: "900", color: "#fff" }}>
              저장
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable
          onPress={() => setPreviewVisible(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 16 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: 0,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.15)",
            }}
          >
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ width: "100%", height: 360, backgroundColor: "#f2f2f2" }}
                resizeMode="contain"
              />
            ) : (
              <View style={{ width: "100%", height: 240, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontWeight: "900", color: "#111" }}>미리보기 없음</Text>
              </View>
            )}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setPreviewVisible(false);
              }}
              style={{ padding: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" }}
            >
              <Text style={{ fontWeight: "900", color: "#111", textAlign: "center" }}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

