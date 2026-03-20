import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Posts } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

const formatPhone = (value: string) => {
  // 하이픈 자동 삽입(간단 버전)
  const digits = (value || "").replace(/[^0-9]/g, "");
  if (!digits) return "";

  // 1588/1577/1566 등 대표번호(1xxx-xxxx)
  if (/^1(?:5|6|8)\d{2}/.test(digits)) {
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
  }

  // 서울(02)
  if (digits.startsWith("02")) {
    const rest = digits.slice(2);
    if (rest.length === 0) return "02";
    if (rest.length <= 3) return `02-${rest}`;
    if (rest.length <= 7) return `02-${rest.slice(0, 3)}-${rest.slice(3, 7)}`;
    return `02-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }

  // 휴대폰/기타(0xx)
  const head = digits.slice(0, 3);
  const rest = digits.slice(3);
  if (digits.length <= 3) return digits;
  if (rest.length <= 3) return `${head}-${rest}`;
  if (rest.length <= 7) return `${head}-${rest.slice(0, 3)}-${rest.slice(3, 7)}`;
  return `${head}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
};

export default function InquiryWrite7() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [agencyCall, setAgencyCall] = useState("");
  const [loading, setLoading] = useState(false);

  const colors = {
    background: "#fff",
    card: "#FFFFFF",
    text: "#000000",
    border: "#DDDDDD",
    subText: "#666666",
    primary: "#4A6CF7",
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
    color: colors.text,
  } as const;

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled) {
      setImageUri(res.assets[0].uri);
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const post = await Posts.get(Number(id));
        setTitle(post.title);
        setContent(post.content);
        setImageUri(post.image_url ?? null);
        setAgencyCall(String(post.agency_call ?? ""));
      } catch (e) {
        console.log(e);
        alert("글 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!title.trim()) return alert("제목을 입력하세요.");
    if (!content.trim()) return alert("내용을 입력하세요.");

    const username = await SecureStore.getItemAsync("username");
    if (!username) return alert("로그인 필요");

    let imageUrl: string | undefined;
    if (imageUri && !imageUri.startsWith("http")) {
      const b64 = await FileSystem.readAsStringAsync(imageUri, { encoding: "base64" });
      const upload = await fetch("https://api.smartgauge.co.kr/upload/base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `inquiry7_${Date.now()}.jpg`,
          base64: b64,
        }),
      });
      const data = await upload.json();
      imageUrl = data.url;
    } else if (imageUri) {
      imageUrl = imageUri;
    }

    try {
      if (isEditMode) {
        await Posts.update(Number(id), {
          title,
          content,
          status: "published",
          image_url: imageUrl,
          card_type: 7,
          post_type: 7,
          agency_call: agencyCall.trim() ? agencyCall.trim() : undefined,
        });
        alert("수정 완료!");
      } else {
        await Posts.createByType(
          {
            title,
            content,
            status: "published",
            image_url: imageUrl,
            card_type: 7,
            agency_call: agencyCall.trim() ? agencyCall.trim() : undefined,
          } as any,
          username,
          7
        );
        alert("등록 완료!");
      }
      router.back();
    } catch (e) {
      console.log(e);
      alert("저장 실패. 다시 시도해주세요.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 90}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 120 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {/* 제목 라벨 & 안내문구 */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontSize: 16, marginRight: 10 }}>제목</Text>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력해주세요."
            placeholderTextColor={colors.subText}
            style={{
              borderWidth: 1,
              borderColor: "#000",
              backgroundColor: colors.card,
              color: colors.text,
              padding: 12,
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 16,
            }}
          />

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.text, marginBottom: 8, fontSize: 16 }}>이미지</Text>

            {imageUri && (
              <View style={{ marginBottom: 8 }}>
                <Image source={{ uri: imageUri }} style={{ width: "100%", height: 180, borderRadius: 12 }} resizeMode="cover" />

                <TouchableOpacity
                  onPress={() => setImageUri(null)}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>×</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={pickImage}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>{imageUri ? "이미지 변경" : "이미지 선택"}</Text>
            </TouchableOpacity>
          </View>

          {/* 내용 라벨 & 안내문구 */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: "#000", fontSize: 16, marginRight: 10 }}>내용</Text>
            <Text style={{ color: "#888", fontSize: 12 }}>(회사명, 현장주소 등)</Text>
          </View>

          <TextInput
            placeholder="현장 내용과 원할한 소통을 위해 연락처를 남겨주세요."
            placeholderTextColor={colors.subText}
            value={content}
            onChangeText={setContent}
            multiline
            style={[inputStyle, { minHeight: 220, textAlignVertical: "top", fontSize: 15 }]}
          />

          <View style={{ marginTop: 18 }}>
            <Text style={{ color: "#000", fontSize: 16, marginBottom: 8 }}>연락처</Text>
            <TextInput
              value={agencyCall}
              onChangeText={(v) => setAgencyCall(formatPhone(v))}
              placeholder="예) 010-1234-5678"
              placeholderTextColor={colors.subText}
              keyboardType="phone-pad"
              style={[inputStyle, { fontSize: 15 }]}
            />
          </View>

          <Text
            style={{
              marginTop: 10,
              color: "#000",
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            자료전송 : daewon469@naver.com 
          </Text>

          <View style={{ marginTop: 13 }}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {loading ? "저장 중..." : isEditMode ? "수정하기" : "등록하기"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
