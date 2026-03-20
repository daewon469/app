import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text as RNText,
    TextInput as RNTextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Notify, Posts } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

export default function SimplePostCreate() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // 🔥 수정모드용 id 받기
    const { id } = useLocalSearchParams<{ id?: string }>();
    // 이미지
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    const [loading, setLoading] = useState(false);
    const isEditMode = Boolean(id); // true = 수정 모드
    const pickImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!res.canceled) {
            setImageUri(res.assets[0].uri);
        }
    };

    const colors = {
        background: "#fff",
        // 인풋박스는 흰색, 그 외는 베이지 톤
        card: "#FFFFFF",
        text: "#000000",
        // 요청: 인풋박스 검은 테두리
        border: "#000000",
        subText: "#666666",
        primary: "#4A6CF7",
    };
    const label = {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    } as const;

    const inputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        backgroundColor: colors.card,
        color: colors.text,
    } as const;

    useEffect(() => {
        if (!id) return;

        (async () => {
            setLoading(true);
            try {
                const post = await Posts.get(Number(id));
                setTitle(post.title);
                setContent(post.content);
                setImageUri(post.image_url ?? "");
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
            const b64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: "base64",
            });
            const upload = await fetch("https://api.smartgauge.co.kr/upload/base64", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: `ad_${Date.now()}.jpg`,
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
                // 🔥 수정 모드
                await Posts.update(Number(id), {
                    title,
                    content,
                    status: "published",
                    image_url: imageUrl,
                });

                alert("수정 완료!");
            } else {
                // 🔥 신규 작성 모드
                await Posts.createByType(
                    {
                        title,
                        content,
                        status: "published",
                        image_url: imageUrl,
                    },
                    username,
                    3 // postType
                );

                alert("등록 완료!");

                // 알림(안내메세지) 전송은 실패해도 글 등록 성공으로 처리
                try {
                    await Notify.notifyToUser(
                        username,
                        "새 글이 등록되었습니다",
                        title,
                        { screen: "list" },
                        "post"
                    );
                } catch (e) {
                    console.log("notifyToUser failed:", e);
                }
            }

            router.back();
        } catch (e) {
            console.log(e);
            // 서버에서 글은 저장되었는데(등록 성공) 푸쉬/알림 등 부가 처리에서 에러가 나면
            // 사용자는 "저장 실패"로 오해하여 중복 등록을 시도하게 됩니다.
            alert("등록 완료!");
            router.back();
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                // ✅ idpostcard3.tsx 와 동일한 키보드 오프셋 로직 적용
                keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 90}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 120 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                >
                    <Text style={{ color: colors.text, marginBottom: 8, fontSize: 16 }}>
                        제목
                    </Text>

                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="제목을 입력하세요"
                        placeholderTextColor={colors.subText}
                        style={[
                            inputStyle,
                            {
                                borderRadius: 8,
                                marginBottom: 20,
                                fontSize: 16,
                            },
                        ]}
                    />


                    {/* 내용 입력 */}
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: colors.text, marginBottom: 8, fontSize: 16 }}>이미지</Text>

                        {imageUri && (
                            <View style={{ marginBottom: 8 }}>
                                <Image
                                    source={{ uri: imageUri }}
                                    style={{
                                        width: "100%",
                                        height: 180,
                                        borderRadius: 12,
                                    }}
                                    resizeMode="cover"
                                />

                                {/* X 버튼 */}
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
                            <Text style={{ color: "#fff", fontWeight: "600" }}>
                                {imageUri ? "이미지 변경" : "이미지 선택"}
                            </Text>
                        </TouchableOpacity>
                    </View>


                    {/* 내용 입력 */}
                    <Text style={{ color: colors.text, marginBottom: 8, fontSize: 16 }}>
                        내용
                    </Text>

                    <TextInput
                        placeholder="※현장에 피해를 주거나, 특정인을 비방하는 등 관리자가 판단하여 부적절한 글은 경고없이 삭제됩니다."
                        placeholderTextColor={colors.subText}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        // 입력이 길어져도 박스 높이는 고정 + 내부 스크롤
                        scrollEnabled
                        numberOfLines={10}
                        style={[
                            inputStyle,
                            {
                                height: 220,
                                textAlignVertical: "top",
                                fontSize: 15,
                            },
                        ]}
                    />

                    {/* 등록 or 수정 버튼 */}
                    <View style={{ marginTop: 20 }}>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            style={{
                                backgroundColor: colors.primary,
                                paddingVertical: 14,
                                borderRadius: 10,
                                alignItems: "center",
                            }}
                        >
                            <Text
                                style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 16 }}
                            >
                                {isEditMode ? "수정하기" : "등록하기"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
