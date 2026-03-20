import React, { useEffect, useMemo, useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const INDUSTRIES = [
    "아파트",
    "상가",
    "오피스",
    "오피스텔",
    "도시형생활주택",
    "레지던스",
    "호텔",
    "리조트",
    "지식산업센터",
    "타운하우스",
    "토지",
    "기타",
] as const;

type Props = {
    visible: boolean;
    onClose: () => void;
    onSelect: (industry: string) => void;
    selectedIndustry?: string; // 단일 선택(기존)

    // 복수 선택(맞춤현장용)
    multiple?: boolean;
    selectedIndustries?: string[];
    onApply?: (industries: string[]) => void;
};

export default function IndustrySelectModal({
    visible,
    onClose,
    onSelect,
    selectedIndustry = "",
    multiple = false,
    selectedIndustries = [],
    onApply,
}: Props) {
    const colors = {
        dim: "rgba(0,0,0,0.45)",
        card: "#fff",
        text: "#000",
        border: "#ddd",
        subText: "#666",
        // 선택(활성) 색상: 파란색(맞춤현장 설정 UI와 통일)
        active: "#4A6CF7",
    };

    const isCustomSelected = useMemo(() => {
        if (!selectedIndustry?.trim()) return false;
        return !(INDUSTRIES as readonly string[]).includes(selectedIndustry.trim());
    }, [selectedIndustry]);

    const [picked, setPicked] = useState<string>("");       // 단일 선택 모달 내부에서 선택된 값
    const [otherText, setOtherText] = useState<string>(""); // 기타 입력값

    const [multiPicked, setMultiPicked] = useState<string[]>([]);

    useEffect(() => {
        if (!visible) return;

        if (multiple) {
            setMultiPicked(Array.from(new Set((selectedIndustries || []).map((s) => s.trim()).filter(Boolean))));
            setPicked("");
            setOtherText("");
            return;
        }

        const si = selectedIndustry.trim();
        if (!si) {
            setPicked("");
            setOtherText("");
            return;
        }

        if (isCustomSelected) {
            setPicked("기타");
            setOtherText(si);
        } else {
            setPicked(si);
            setOtherText("");
        }
    }, [visible, selectedIndustry, isCustomSelected]);

    const applyOther = () => {
        const v = otherText.trim();
        if (!v) return;
        if (multiple) {
            if (!multiPicked.includes(v)) {
                setMultiPicked([...multiPicked, v]);
            }
            setOtherText("");
            return;
        }
        onSelect(v);
        onClose();
    };

    const toggleMulti = (v: string) => {
        const value = (v || "").trim();
        if (!value) return;
        if (multiPicked.includes(value)) {
            setMultiPicked(multiPicked.filter((x) => x !== value));
        } else {
            setMultiPicked([...multiPicked, value]);
        }
    };

    const resetMulti = () => setMultiPicked([]);

    const applyMulti = () => {
        const out = Array.from(new Set(multiPicked.map((s) => s.trim()).filter(Boolean)));
        onApply?.(out);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: colors.dim }} onPress={onClose}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            marginHorizontal: 16,
                            marginTop: 60,         
                            borderRadius: 16,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            overflow: "hidden",
                            maxHeight: "85%",       
                        }}
                    >
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 14 }}
                        >
                            {/* 헤더 */}
                            <View style={{ padding: 14, paddingBottom: 8 }}>
                                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>업종 선택</Text>
                                <Text style={{ marginTop: 4, fontSize: 13, marginBottom: 2, color: colors.subText }}>
                                    아래 항목 중 하나를 선택하세요
                                </Text>
                            </View>

                            {/* ✅ 3x4 그리드 */}
                            <FlatList
                                data={INDUSTRIES as unknown as string[]}
                                keyExtractor={(item) => item}
                                numColumns={3}
                                scrollEnabled={false}
                                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 0, paddingBottom: 8 }}
                                renderItem={({ item }) => {
                                    const active = multiple ? multiPicked.includes(item) : picked === item;
                                    return (
                                        <View style={{ width: "33.3333%", padding: 5 }}>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                onPress={() => {
                                                    if (item === "기타") {
                                                        setPicked("기타");
                                                        return;
                                                    }
                                                    if (multiple) {
                                                        toggleMulti(item);
                                                        return;
                                                    }
                                                    setPicked(item);
                                                    onSelect(item);
                                                    onClose();
                                                }}
                                                style={{
                                                    borderRadius: 12,
                                                    borderWidth: 1,
                                                    borderColor: active ? colors.active : colors.border,
                                                    backgroundColor: active ? colors.active : "transparent",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    paddingVertical: 10,
                                                    minHeight: 48,
                                                    paddingHorizontal: 4,
                                                }}
                                            >
                                                <Text
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                    adjustsFontSizeToFit
                                                    minimumFontScale={0.9}
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: "700",
                                                        color: active ? "#fff" : colors.text,
                                                    }}
                                                >
                                                    {item}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                }}
                            />

                            {/* ✅ 기타 선택 시 입력 */}
                            {picked === "기타" && (
                                <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
                                        기타 업종 입력
                                    </Text>

                                    <TextInput
                                        value={otherText}
                                        onChangeText={setOtherText}
                                        placeholder="예) 연립/빌라, 공장, 물류센터..."
                                        placeholderTextColor={colors.subText}
                                        style={{
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            borderRadius: 12,
                                            paddingVertical: 12,
                                            paddingHorizontal: 12,
                                            color: colors.text,
                                        }}
                                    />

                                    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity
                                            onPress={onClose}
                                            style={{
                                                flex: 1,
                                                borderRadius: 12,
                                                paddingVertical: 12,
                                                alignItems: "center",
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                            }}
                                        >
                                            <Text style={{ color: colors.text, fontWeight: "700" }}>
                                                {multiple ? "닫기" : "취소"}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={applyOther}
                                            disabled={!otherText.trim()}
                                            style={{
                                                flex: 1,
                                                borderRadius: 12,
                                                paddingVertical: 12,
                                                alignItems: "center",
                                                backgroundColor: otherText.trim() ? colors.active : colors.border,
                                            }}
                                        >
                                            <Text style={{ color: "#fff", fontWeight: "800" }}>
                                                {multiple ? "추가" : "적용"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* 복수선택: 하단 적용/초기화 */}
                            {multiple && (
                                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                                    <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                                        <TouchableOpacity
                                            onPress={resetMulti}
                                            style={{
                                                flex: 1,
                                                borderRadius: 12,
                                                paddingVertical: 12,
                                                alignItems: "center",
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                backgroundColor: "transparent",
                                            }}
                                        >
                                            <Text style={{ color: colors.text, fontWeight: "800" }}>초기화</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={applyMulti}
                                            style={{
                                                flex: 1,
                                                borderRadius: 12,
                                                paddingVertical: 12,
                                                alignItems: "center",
                                                backgroundColor: colors.active,
                                            }}
                                        >
                                            <Text style={{ color: "#fff", fontWeight: "900" }}>
                                                적용 ({multiPicked.length})
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </Pressable>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    );
}
