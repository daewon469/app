import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text as RNText, TextInput as RNTextInput, View } from "react-native";
import { API_URL, UIConfig, type UIConfigBannerItem } from "../lib/api";
import { isReferralModalAction, isReferralModalLinkUrl, normalizeBannerClickAction, REFERRAL_MODAL_ACTION_LINK_LEGACY } from "../lib/ui_banner_actions";

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

type SlotItem = UIConfigBannerItem & {
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

export default function TopBannerAdmin() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadingRef = useRef(false);

  const DEFAULT_TOP_BANNER_HEIGHT = 70;
  const DEFAULT_RESIZE_MODE: "contain" | "cover" | "stretch" = "contain";

  const [enabled, setEnabled] = useState(true);
  const [slots, setSlots] = useState<Array<SlotItem | null>>([null, null]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await UIConfig.get();
      if (res.status !== 0) {
        Alert.alert("오류", "상단 배너 설정을 불러올 수 없습니다.");
        return;
      }

      const tb: any = (res.config as any)?.top_banner ?? { enabled: true, items: [] };
      setEnabled(!!tb?.enabled);

      const baseHeight = Number(tb?.height ?? DEFAULT_TOP_BANNER_HEIGHT) || DEFAULT_TOP_BANNER_HEIGHT;
      const baseResizeMode = (() => {
        const rm = String(tb?.resize_mode ?? DEFAULT_RESIZE_MODE);
        return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
      })();

      const rawItems = Array.isArray(tb?.items) ? tb.items : [];
      const cleaned: SlotItem[] = rawItems
        .filter((it: any) => typeof it?.image_url === "string" && it.image_url.trim())
        .slice(0, 2)
        .map((it: any) => ({
          image_url: String(it.image_url),
          link_url: it?.link_url ?? null,
          click_action: isReferralModalLinkUrl(it?.link_url) ? "referral_modal" : normalizeBannerClickAction(it?.click_action),
          width_px: (() => {
            const w = Number(it?.width_px);
            return Number.isFinite(w) && w > 0 ? w : null;
          })(),
          width_percent: (() => {
            const wp = Number(it?.width_percent);
            if (!Number.isFinite(wp)) return 100;
            return clampInt(wp, 40, 100);
          })(),
          height: Number(it?.height ?? baseHeight) || baseHeight,
          resize_mode: (() => {
            const rm = String(it?.resize_mode ?? baseResizeMode);
            return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
          })(),
          width_px_text: (() => {
            const w = Number(it?.width_px);
            return Number.isFinite(w) && w > 0 ? String(Math.floor(w)) : "";
          })(),
          height_text: String(Number(it?.height ?? baseHeight) || baseHeight),
        }));

      setSlots([cleaned[0] ?? null, cleaned[1] ?? null]);
    } catch {
      Alert.alert("오류", "상단 배너 설정을 불러올 수 없습니다.");
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
      body: JSON.stringify({ filename: `top_banner_${Date.now()}.png`, base64: b64 }),
    });
    const data = await upload.json();
    const url = (data as any)?.url;
    if (!url || typeof url !== "string") throw new Error("업로드 실패");
    return url;
  }, []);

  const onPickSlotImage = useCallback(
    async (slotIndex: 0 | 1) => {
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
        setSlots((prev) => {
          const next = [...prev] as Array<SlotItem | null>;
          const current = next[slotIndex];
          next[slotIndex] = {
            image_url: url,
            link_url: current?.link_url ?? null,
            click_action: normalizeBannerClickAction((current as any)?.click_action),
            width_px: current?.width_px ?? null,
            width_percent: current?.width_percent ?? 100,
            height: current?.height ?? DEFAULT_TOP_BANNER_HEIGHT,
            resize_mode: current?.resize_mode ?? DEFAULT_RESIZE_MODE,
            width_px_text: current?.width_px_text ?? "",
            height_text: current?.height_text ?? String(DEFAULT_TOP_BANNER_HEIGHT),
          };
          return next;
        });
      } catch (e: any) {
        Alert.alert("오류", e?.message ?? "업로드에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [uploadImageToServer]
  );

  const topBannerItemsForSave = useMemo(() => {
    return (slots || [])
      .filter((it): it is SlotItem => Boolean(it?.image_url))
      .map((it) => ({
        image_url: it.image_url,
        link_url: (() => {
          const ca = normalizeBannerClickAction((it as any)?.click_action);
          if (ca === "referral_modal") return REFERRAL_MODAL_ACTION_LINK_LEGACY;
          const link = String(it.link_url ?? "").trim();
          return link ? link : null;
        })(),
        click_action: normalizeBannerClickAction((it as any)?.click_action),
        width_px: (() => {
          const n = parseIntOrNull(String((it as any)?.width_px_text ?? ""));
          if (n === null) return null;
          return clampInt(n, 120, 1200);
        })(),
        width_percent: clampInt(Number((it as any)?.width_percent ?? 100) || 100, 40, 100),
        height: (() => {
          const n = parseIntOrNull(String((it as any)?.height_text ?? ""));
          const h = n === null ? DEFAULT_TOP_BANNER_HEIGHT : n;
          return clampInt(h, 60, 260);
        })(),
        resize_mode: (() => {
          const rm = String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE);
          return (rm === "cover" || rm === "stretch" ? rm : "contain") as "contain" | "cover" | "stretch";
        })(),
      }));
  }, [slots]);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const current = await UIConfig.get();
      if (current.status !== 0) {
        Alert.alert("오류", "현재 설정을 불러올 수 없습니다.");
        return;
      }

      const curTop: any = (current.config as any)?.top_banner ?? {};
      const nextConfig = {
        ...current.config,
        top_banner: {
          enabled: !!enabled,
          // 섹션 레벨 기본값은 기존 값을 유지(필요 시만 서버에서 수정)
          height: Number(curTop?.height ?? DEFAULT_TOP_BANNER_HEIGHT) || DEFAULT_TOP_BANNER_HEIGHT,
          resize_mode: (String(curTop?.resize_mode ?? DEFAULT_RESIZE_MODE) === "cover" ? "cover" : "contain") as
            | "contain"
            | "cover",
          // 슬롯 2개만 저장(서버에서도 2개로 제한)
          items: topBannerItemsForSave.slice(0, 2),
        },
      } as any;

      const res = await UIConfig.update(nextConfig);
      if (res.status !== 0) {
        Alert.alert("오류", "저장에 실패했습니다.");
        return;
      }

      // 저장 직후 서버 반영 여부를 다시 확인(다른 관리자 화면에서 덮어쓰기/저장 실패 감지)
      try {
        const after = await UIConfig.get();
        const afterItems = Array.isArray((after.config as any)?.top_banner?.items)
          ? (after.config as any).top_banner.items.filter((x: any) => Boolean(x?.image_url))
          : [];
        const intended = topBannerItemsForSave.slice(0, 2).filter((x: any) => Boolean(x?.image_url));

        if (after.status === 0 && intended.length > 0 && afterItems.length === 0) {
          Alert.alert(
            "저장 확인 필요",
            "저장은 완료로 응답했지만 서버에 상단배너(items)가 비어있습니다.\n(다른 배너/팝업 관리자 화면에서 덮어썼거나 서버 반영이 실패했을 수 있습니다.)\n다시 저장 후에도 동일하면 서버 로그/DB를 확인해주세요."
          );
          // 화면 유지(사용자가 상태를 확인하고 다시 저장할 수 있게)
          return;
        }
      } catch {
        // ignore (저장 자체는 성공했으므로 이동은 허용)
      }

      Alert.alert("저장 완료", "상단 배너 설정이 저장되었습니다.");
      router.back();
    } catch {
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [enabled, saving, topBannerItemsForSave]);

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
          <Text style={{ fontSize: 18, fontWeight: "900", marginBottom: 10 }}>상단배너 관리</Text>

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
              상단배너 노출: {enabled ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <Text style={{ fontWeight: "900", marginBottom: 10 }}>
            상단 배너는 2개 슬롯만 사용합니다. (빈 슬롯은 첫화면 기본 배너로 대체됩니다)
          </Text>

          {([0, 1] as const).map((slotIndex) => {
            const it = slots[slotIndex];
            return (
              <View
                key={`slot-${slotIndex}`}
                style={{
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 10,
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ fontWeight: "900", marginBottom: 8 }}>슬롯 {slotIndex + 1}</Text>

                <View style={{ alignItems: "center" }}>
                  <Pressable
                    onPress={() => {
                      if (!it?.image_url) return;
                      setPreviewUri(String(it.image_url));
                      setPreviewVisible(true);
                    }}
                    style={{ width: "100%", alignItems: "center" }}
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
                              const h = n === null ? DEFAULT_TOP_BANNER_HEIGHT : n;
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
                            height: DEFAULT_TOP_BANNER_HEIGHT,
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

                <Pressable
                  onPress={() => onPickSlotImage(slotIndex)}
                  disabled={saving}
                  style={{
                    marginTop: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: saving ? "#ddd" : "#FFF6D2",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900" }}>PNG 업로드로 이미지 설정/교체</Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setSlots((prev) => {
                      const next = [...prev] as Array<SlotItem | null>;
                      next[slotIndex] = null;
                      return next;
                    })
                  }
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
                  <Text style={{ fontWeight: "900" }}>슬롯 비우기</Text>
                </Pressable>

                <Text style={{ fontWeight: "900", marginTop: 10, marginBottom: 6 }}>클릭 링크(선택)</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                  <Pressable
                    onPress={() =>
                      setSlots((prev) => {
                        const next = [...prev] as Array<SlotItem | null>;
                        const cur = next[slotIndex];
                        if (!cur) return next;
                        next[slotIndex] = { ...(cur as any), click_action: "link" };
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
                      setSlots((prev) => {
                        const next = [...prev] as Array<SlotItem | null>;
                        const cur = next[slotIndex];
                        if (!cur) return next;
                        next[slotIndex] = { ...(cur as any), click_action: "referral_modal", link_url: REFERRAL_MODAL_ACTION_LINK_LEGACY };
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
                  value={it?.link_url ?? ""}
                  onChangeText={(t) => {
                    setSlots((prev) => {
                      const next = [...prev] as Array<SlotItem | null>;
                      const cur = next[slotIndex];
                      if (!cur) {
                        next[slotIndex] = {
                          image_url: "",
                          link_url: t,
                          click_action: "link",
                          width_px: null,
                          width_percent: 100,
                          height: DEFAULT_TOP_BANNER_HEIGHT,
                          resize_mode: DEFAULT_RESIZE_MODE,
                          width_px_text: "",
                          height_text: String(DEFAULT_TOP_BANNER_HEIGHT),
                        };
                      } else {
                        next[slotIndex] = { ...(cur as any), link_url: t };
                      }
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

                <Text style={{ fontWeight: "900", marginTop: 10, marginBottom: 6 }}>배너 너비(px, 비우면 100%)</Text>
                <TextInput
                  value={String((it as any)?.width_px_text ?? "")}
                  onChangeText={(t) => {
                    const cleaned = digitsOnly(t);
                    setSlots((prev) => {
                      const next = [...prev] as Array<SlotItem | null>;
                      const cur = next[slotIndex];
                      if (!cur) return next;
                      next[slotIndex] = { ...(cur as any), width_px_text: cleaned };
                      return next;
                    });
                  }}
                  onBlur={() => {
                    setSlots((prev) => {
                      const next = [...prev] as Array<SlotItem | null>;
                      const cur = next[slotIndex] as any;
                      if (!cur) return next;
                      const n = parseIntOrNull(String(cur?.width_px_text ?? ""));
                      next[slotIndex] = { ...cur, width_px_text: n === null ? "" : String(clampInt(n, 120, 1200)) };
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
                    setSlots((prev) => {
                      const next = [...prev] as Array<SlotItem | null>;
                      const cur = next[slotIndex];
                      if (!cur) return next;
                      next[slotIndex] = { ...(cur as any), height_text: cleaned };
                      return next;
                    });
                  }}
                  onBlur={() => {
                    setSlots((prev) => {
                      const next = [...prev] as Array<SlotItem | null>;
                      const cur = next[slotIndex] as any;
                      if (!cur) return next;
                      const n = parseIntOrNull(String(cur?.height_text ?? ""));
                      const h = n === null ? DEFAULT_TOP_BANNER_HEIGHT : n;
                      next[slotIndex] = { ...cur, height_text: String(clampInt(h, 60, 260)) };
                      return next;
                    });
                  }}
                  keyboardType="number-pad"
                  placeholder="예: 70"
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
                      setSlots((prev) => {
                        const next = [...prev] as Array<SlotItem | null>;
                        const cur = next[slotIndex];
                        if (!cur) return next;
                        next[slotIndex] = { ...(cur as any), resize_mode: "contain" };
                        return next;
                      })
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#000",
                      backgroundColor: String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "contain" ? "#2F6BFF" : "#f2f2f2",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "contain" ? "#fff" : "#111" }}>
                      원본
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setSlots((prev) => {
                        const next = [...prev] as Array<SlotItem | null>;
                        const cur = next[slotIndex];
                        if (!cur) return next;
                        // "맞추기": 비율 유지 없이(왜곡 허용) 너비/높이를 동시에 맞춰 잘림 없이 표시
                        next[slotIndex] = { ...(cur as any), resize_mode: "stretch" };
                        return next;
                      })
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#000",
                      backgroundColor: String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "stretch" ? "#2F6BFF" : "#f2f2f2",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: String((it as any)?.resize_mode ?? DEFAULT_RESIZE_MODE) === "stretch" ? "#fff" : "#111" }}>
                      맞추기
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

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
              <Image source={{ uri: previewUri }} style={{ width: "100%", height: 360, backgroundColor: "#f2f2f2" }} resizeMode="contain" />
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

