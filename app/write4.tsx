import { KAKAO_MAP_JS_KEY } from "@/constants/keys";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Text as RNText,
    TextInput as RNTextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BusinessPicker from "../components/BusinessMapPicker";
import ScrollNavigator from "../components/ScrollNavigator";
import NaverMap from "../components/ui/navermap";
import { Posts } from "../lib/api";
import { buildKakaoMapUrl } from "../utils/map";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

// 전화번호 포맷(02/1588 포함)
const mobile = (value: string) => {
    const digits = (value || "").replace(/[^0-9]/g, "");
    if (!digits) return "";

    // 1588/1577/1566 등 대표번호(1xxx-xxxx)
    if (/^1(?:5|6|8)\d{2}/.test(digits)) {
        if (digits.length <= 4) return digits;
        return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
    }

    // 서울(02) 지역번호
    if (digits.startsWith("02")) {
        const rest = digits.slice(2);
        if (rest.length === 0) return "02";
        if (rest.length <= 3) return `02-${rest}`;
        if (rest.length <= 7) return `02-${rest.slice(0, 3)}-${rest.slice(3)}`;
        return `02-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
    }

    // 휴대폰/기타 지역번호(0xx)
    if (digits.startsWith("0")) {
        const a = digits.slice(0, 3);
        const rest = digits.slice(3);
        if (rest.length === 0) return a;
        if (rest.length <= 3) return `${a}-${rest}`;
        if (rest.length <= 7) return `${a}-${rest.slice(0, 3)}-${rest.slice(3)}`;
        return `${a}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
    }

    // fallback
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

// 업무 분류 배열 (원하는 값으로 수정 가능)
const JOB_INDUSTRIES = [
    // 표준 카테고리: "광고" (레거시: "광고업체")
    "광고",
    "대출",
    "급매물",
    "중고장터"
];
type AdPost = {
    id: number;

    title: string;
    content: string;
    image_url?: string | null;
    card_type?: number | null;
    post_type?: number | null;
    highlight_content?: string | null;

    company_agency?: string | null;
    agent?: string | null;
    agency_call?: string | null;

    business_address?: string | null;
    business_map_url?: string | null;
    business_lat?: number | null;
    business_lng?: number | null;

    job_industry?: string | null;

    item1_use?: boolean;
    item1_sup?: string | null;

    item2_use?: boolean;
    item2_sup?: string | null;

    item3_use?: boolean;
    item3_sup?: string | null;

    item4_use?: boolean;
    item4_sup?: string | null;

    province?: string | null;
    city?: string | null;
};

type LocationSel = {
    lat: number;
    lng: number;
    address?: string;
};

export default function AdPostWrite() {
    const { id, job_industry } = useLocalSearchParams<{ id?: string; job_industry?: string }>();
    const isEdit = !!id;
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const scrollRef = useRef<any>(null);
    const scrollY = useRef(new Animated.Value(0)).current;
    const scrollYNumberRef = useRef(0);
    const [contentHeight, setContentHeight] = useState(1);
    const [layoutHeight, setLayoutHeight] = useState(1);
    const getMetrics = useCallback(
        () => ({ contentHeight, layoutHeight }),
        [contentHeight, layoutHeight]
    );

    const [contentInputHeight, setContentInputHeight] = useState(200);
    const colors = {
        // 광고 탭(list4.tsx)과 배경 톤 통일
        background: "#fff",
        // 요청: 인풋박스 말고는 다 베이지 톤
        card: "#fff",
        text: "#000",
        // 요청: 카드 테두리 제거(비인풋 요소는 테두리 최소화)
        border: "transparent",
        primary: "#4A6CF7",
        link: "blue",
        subText: "#666",
    };

    const label = {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
    } as const;
    // 광고 > 업무상세(업무1~업무4) 제목만 파란색으로
    const blueLabel = { ...label, color: colors.primary } as const;

    const inputStyle = {
        borderWidth: 1,
        borderColor: "#000", // 요청: 인풋박스 검은색 테두리
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#fff", // 인풋만 흰색 유지
        color: colors.text,
    } as const;

    const cardBox = {
        // 요청: 카드 테두리 제거 + 배경은 베이지로 자연스럽게
        backgroundColor: colors.background,
        borderWidth: 0,
        borderColor: "transparent",
        borderRadius: 12,
        padding: 0,
        marginBottom: 16,
    } as const;

    // 이미지
    const [imageUri, setImageUri] = useState<string | null>(null);

    // 기본 필드
    const [title, setTitle] = useState("");
    const [highlight, setHighlight] = useState(""); // 현장 한마디

    const [companyAgency, setCompanyAgency] = useState("");
    const [agent, setAgent] = useState("");
    const [agencyCall, setAgencyCall] = useState("");

    const [businessAddress, setBusinessAddress] = useState<string | undefined>(undefined);
    const [businessMapUrl, setBusinessMapUrl] = useState<string | undefined>(undefined);
    const [businessLat, setBusinessLat] = useState<number | undefined>(undefined);
    const [businessLng, setBusinessLng] = useState<number | undefined>(undefined);

    // 카테고리(업무 분류): 스와이프로 전체 페이지 전환
    const [categoryIndex, setCategoryIndex] = useState(0);
    const didInitCategoryRef = useRef(false);
    const jobIndustry = JOB_INDUSTRIES[categoryIndex];
    const [showBizModal, setShowBizModal] = useState(false);
    // 업무 1~4 동적폼
    const WORK_ROLES = ["업무1", "업무2", "업무3", "업무4"] as const;
    type WorkRole = (typeof WORK_ROLES)[number];
    const [loading, setLoading] = useState(false);
    const [existingCardType, setExistingCardType] = useState<number | null>(null);
    // 어떤 업무가 선택되었는지
    const [selectedWorks, setSelectedWorks] = useState<Set<WorkRole>>(new Set());
    const toggleWork = (role: WorkRole) => {
        setSelectedWorks(prev => {
            const next = new Set(prev);
            if (next.has(role)) {
                next.delete(role);
            } else {
                next.add(role);
            }
            return next;
        });
    };
    // 각 업무별 텍스트
    const [workText, setWorkText] = useState<Record<WorkRole, string>>({
        업무1: "",
        업무2: "",
        업무3: "",
        업무4: "",
    });
    const [content, setContent] = useState("");

    const [selectedRegion, setSelectedRegion] = useState<{
        province: string;
        city: string;
    } | null>(null);

    // list4.tsx에서 "글작성" 진입 시 현재 탭(업무분류)을 전달받아 초기값으로 반영
    useEffect(() => {
        if (didInitCategoryRef.current) return;
        didInitCategoryRef.current = true;
        if (isEdit) return;

        const raw = String(job_industry ?? "").trim();
        if (!raw) return;
        const normalized = raw === "광고업체" ? "광고" : raw;
        const idx = JOB_INDUSTRIES.indexOf(normalized as any);
        if (idx >= 0) setCategoryIndex(idx);
    }, [isEdit, job_industry]);

    // ---- swipe pager (Reanimated) ----
    const swipeX = useSharedValue(0);
    const activeIndexSV = useSharedValue(0);
    const pageWidthSV = useSharedValue(0);
    const previewIndexSV = useSharedValue(-1); // -1: none
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [previewScrollY, setPreviewScrollY] = useState(0);

    useEffect(() => {
        activeIndexSV.value = categoryIndex;
    }, [categoryIndex, activeIndexSV]);

    useEffect(() => {
        pageWidthSV.value = screenWidth;
    }, [screenWidth, pageWidthSV]);

    useEffect(() => {
        const sub = scrollY.addListener(({ value }) => {
            scrollYNumberRef.current = value;
        });
        return () => {
            scrollY.removeListener(sub);
        };
    }, [scrollY]);

    const animateToIndex = useCallback(
        (targetIndex: number) => {
            const len = JOB_INDUSTRIES.length;
            if (targetIndex < 0 || targetIndex >= len) return;
            if (targetIndex === categoryIndex) return;

            setPreviewScrollY(scrollYNumberRef.current);
            setPreviewIndex(targetIndex);
            previewIndexSV.value = targetIndex;

            // left swipe => negative
            const dir = targetIndex > categoryIndex ? -1 : 1;
            swipeX.value = withSpring(
                dir * screenWidth,
                { damping: 18, stiffness: 220, mass: 0.9 },
                (finished) => {
                    if (!finished) return;
                    swipeX.value = 0;
                    runOnJS(setCategoryIndex)(targetIndex);
                    runOnJS(setPreviewIndex)(null);
                    previewIndexSV.value = -1;
                }
            );
        },
        [categoryIndex, previewIndexSV, screenWidth, swipeX]
    );

    // 업무 분류 버튼 탭 전환은 "슬라이드 효과" 없이 즉시 변경
    const jumpToIndex = useCallback(
        (targetIndex: number) => {
            const len = JOB_INDUSTRIES.length;
            if (targetIndex < 0 || targetIndex >= len) return;
            if (targetIndex === categoryIndex) return;

            // 진행 중인 스와이프/프리뷰 상태를 정리하고 즉시 전환
            swipeX.value = 0;
            previewIndexSV.value = -1;
            setPreviewIndex(null);
            setCategoryIndex(targetIndex);
        },
        [categoryIndex, previewIndexSV, swipeX]
    );

    const pan = Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-18, 18])
        .onBegin(() => {
            runOnJS(setPreviewScrollY)(scrollYNumberRef.current);
        })
        .onUpdate((e) => {
            "worklet";
            const len = JOB_INDUSTRIES.length;
            const idx = activeIndexSV.value;
            const w = pageWidthSV.value || 1;

            let dx = e.translationX;
            const atFirst = idx <= 0;
            const atLast = idx >= len - 1;

            // 끝에서는 약간 저항감
            if ((atFirst && dx > 0) || (atLast && dx < 0)) {
                dx *= 0.25;
            }

            swipeX.value = dx;

            const dir = dx < -6 ? 1 : dx > 6 ? -1 : 0; // 1: next, -1: prev
            let next = -1;
            if (dir === 1 && idx < len - 1) next = idx + 1;
            else if (dir === -1 && idx > 0) next = idx - 1;

            if (previewIndexSV.value !== next) {
                previewIndexSV.value = next;
                runOnJS(setPreviewIndex)(next === -1 ? null : next);
            }
        })
        .onEnd((e) => {
            "worklet";
            const len = JOB_INDUSTRIES.length;
            const idx = activeIndexSV.value;
            const w = pageWidthSV.value || 1;
            const dx = swipeX.value;
            const vx = e.velocityX;

            const threshold = w * 0.25;
            let target = -1;
            if ((dx < -threshold || vx < -800) && idx < len - 1) target = idx + 1;
            else if ((dx > threshold || vx > 800) && idx > 0) target = idx - 1;

            if (target === -1) {
                swipeX.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.9 }, () => {
                    previewIndexSV.value = -1;
                    runOnJS(setPreviewIndex)(null);
                });
                return;
            }

            const to = target > idx ? -w : w;
            swipeX.value = withSpring(to, { damping: 18, stiffness: 220, mass: 0.9 }, (finished) => {
                if (!finished) return;
                swipeX.value = 0;
                previewIndexSV.value = -1;
                runOnJS(setCategoryIndex)(target);
                runOnJS(setPreviewIndex)(null);
            });
        });

    const currentPageStyle = useAnimatedStyle(() => {
        const w = pageWidthSV.value || 1;
        const dx = swipeX.value;
        const t = Math.min(1, Math.abs(dx) / w);
        return {
            transform: [{ translateX: dx }],
            opacity: 1 - t * 0.08,
        };
    });

    const previewPageStyle = useAnimatedStyle(() => {
        const w = pageWidthSV.value || 1;
        const dx = swipeX.value;
        const has = previewIndexSV.value !== -1;
        const dir = dx < 0 ? 1 : dx > 0 ? -1 : 1; // next comes from right when dx<0
        const base = dir === 1 ? w : -w;
        const t = Math.min(1, Math.abs(dx) / w);
        return {
            transform: [{ translateX: base + dx }],
            opacity: has ? 0.92 + t * 0.08 : 0,
        };
    });

    const pickImage = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!res.canceled) {
            setImageUri(res.assets[0].uri);
        }
    };

    const onPickBiz = ({ address, lat, lng }: LocationSel) => {
        setBusinessAddress(address);
        setBusinessMapUrl(buildKakaoMapUrl(lat, lng));
        setBusinessLat(lat);
        setBusinessLng(lng);
    };

    const submit = async () => {
        if (!title.trim()) {
            Alert.alert("알림", "제목을 입력해주세요.");
            return;
        }
        if (!content.trim()) {
            Alert.alert("알림", "상세 내용을 입력해주세요.");
            return;
        }

        const [isLogin, username] = await Promise.all([
            SecureStore.getItemAsync("isLogin"),
            SecureStore.getItemAsync("username"),
        ]);

        if (!isLogin) {
            Alert.alert("로그인 필요", "로그인 후 작성할 수 있습니다.");
            return;
        }

        try {
            setLoading(true);
            let imageUrl: string | undefined;

            // 로컬 이미지일 경우 업로드
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

            const payload = {
                title,
                content,
                status: "published",

                image_url: imageUrl,
                // 요청: 광고글(post_type=4) 작성 시 card_type 기본값은 1로 고정
                card_type: isEdit ? (existingCardType ?? 1) : 1,
                // 서버가 path의 type(4)을 사용하더라도, payload에도 명시해 일관성 유지
                post_type: 4,
                highlight_content: highlight || undefined,

                company_agency: companyAgency || undefined,
                agent: agent || undefined,
                agency_call: agencyCall || undefined,

                business_address: businessAddress || undefined,
                business_map_url: businessMapUrl || undefined,
                business_lat: businessLat || undefined,
                business_lng: businessLng || undefined,

                job_industry: jobIndustry || undefined,

                item1_use: selectedWorks.has("업무1"),
                item1_sup: workText["업무1"] || undefined,

                item2_use: selectedWorks.has("업무2"),
                item2_sup: workText["업무2"] || undefined,

                item3_use: selectedWorks.has("업무3"),
                item3_sup: workText["업무3"] || undefined,

                item4_use: selectedWorks.has("업무4"),
                item4_sup: workText["업무4"] || undefined,

                province: selectedRegion?.province || undefined,
                city: selectedRegion?.city || undefined,
            };

            if (isEdit && id) {
                // ✅ 수정
                await Posts.update(Number(id), payload as any);
                Alert.alert("완료", "광고글이 수정되었습니다.");
            } else {
                // ✅ 신규 작성
                await Posts.createByType(payload as any, username ?? "", 4);
                Alert.alert("완료", "광고글이 등록되었습니다.");
            }

            router.back();
        } catch (e: any) {
            console.log(e);
            Alert.alert("오류", e?.message ?? "저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                setLoading(true);
                const post = (await Posts.get(Number(id))) as AdPost;

                setTitle(post.title ?? "");
                setContent(post.content ?? "");
                setImageUri(post.image_url ?? null);
                setExistingCardType(
                  typeof post.card_type === "number" ? post.card_type : null
                );

                setHighlight(post.highlight_content ?? "");

                setCompanyAgency(post.company_agency ?? "");
                setAgent(post.agent ?? "");
                setAgencyCall(mobile(post.agency_call ?? ""));

                setBusinessAddress(post.business_address ?? undefined);
                setBusinessMapUrl(post.business_map_url ?? undefined);
                setBusinessLat(post.business_lat ?? undefined);
                setBusinessLng(post.business_lng ?? undefined);

                // 업무 분류(카테고리) 복원
                if (post.job_industry) {
                    const normalizedIndustry = post.job_industry === "광고업체" ? "광고" : post.job_industry;
                    const idx = JOB_INDUSTRIES.indexOf(normalizedIndustry);
                    if (idx >= 0) setCategoryIndex(idx);
                }

                // 업무 1~4
                const nextSelected = new Set<WorkRole>();
                const nextText: Record<WorkRole, string> = {
                    업무1: "",
                    업무2: "",
                    업무3: "",
                    업무4: "",
                };

                if (post.item1_use) {
                    nextSelected.add("업무1");
                    nextText["업무1"] = post.item1_sup ?? "";
                }
                if (post.item2_use) {
                    nextSelected.add("업무2");
                    nextText["업무2"] = post.item2_sup ?? "";
                }
                if (post.item3_use) {
                    nextSelected.add("업무3");
                    nextText["업무3"] = post.item3_sup ?? "";
                }
                if (post.item4_use) {
                    nextSelected.add("업무4");
                    nextText["업무4"] = post.item4_sup ?? "";
                }

                setSelectedWorks(nextSelected);
                setWorkText(nextText);

                if (post.province || post.city) {
                    setSelectedRegion({
                        province: post.province ?? "",
                        city: post.city ?? "",
                    });
                } else {
                    setSelectedRegion(null);
                }
            } catch (e: any) {
                console.log(e);
                Alert.alert("오류", e?.message ?? "게시글을 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const renderFormScroll = (uiIndex: number, isPreview: boolean) => {
        return (
            <Animated.ScrollView
                // preview는 조작 불가(보기용), current만 ref/스크롤 이벤트 연결
                ref={isPreview ? undefined : scrollRef}
                scrollEnabled={!isPreview}
                contentOffset={isPreview ? { x: 0, y: previewScrollY } : undefined}
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: 120,
                    backgroundColor: colors.background,
                }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={isPreview ? undefined : (_, h) => setContentHeight(h)}
                onLayout={isPreview ? undefined : (e) => setLayoutHeight(e.nativeEvent.layout.height)}
                onScroll={
                    isPreview
                        ? undefined
                        : Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                            useNativeDriver: false,
                        })
                }
                scrollEventThrottle={16}
            >
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        marginBottom: 10,
                        color: "#666",
                    }}
                >
                    ※ 광고글을 등록해주세요
                </Text>

                {/* 이미지 업로드 */}
                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8, fontSize: 16 }]}>광고 이미지</Text>
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
                                disabled={isPreview}
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
                        disabled={isPreview}
                        onPress={pickImage}
                        style={{
                            backgroundColor: colors.primary,
                            borderRadius: 12,
                            paddingVertical: 12,
                            alignItems: "center",
                            opacity: isPreview ? 0.7 : 1,
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "600" }}>이미지를 선택해주세요. ( 클 릭 )</Text>
                    </TouchableOpacity>
                </View>

                {/* 제목 */}
                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>제목</Text>
                    <TextInput
                        placeholder="광고 제목을 입력하세요"
                        placeholderTextColor={colors.subText}
                        value={title}
                        onChangeText={setTitle}
                        style={inputStyle}
                        editable={!isPreview}
                    />
                </View>

                {/* 광고 한마디 */}
                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>광고 한마디</Text>
                    <TextInput
                        placeholder="예) 건당 100원 발송 현장 바로 콜 뜨는 광고"
                        placeholderTextColor={colors.subText}
                        value={highlight}
                        onChangeText={setHighlight}
                        maxLength={40}
                        style={inputStyle}
                        editable={!isPreview}
                    />
                </View>

                {/* 상호 / 담당자 / 연락처 */}
                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>상호</Text>
                    <TextInput
                        placeholder="예) 대원파트너스"
                        placeholderTextColor={colors.subText}
                        value={companyAgency}
                        onChangeText={setCompanyAgency}
                        style={inputStyle}
                        editable={!isPreview}
                    />
                </View>

                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>담당자</Text>
                    <TextInput
                        placeholder="예) 김대원 이사"
                        placeholderTextColor={colors.subText}
                        value={agent}
                        onChangeText={setAgent}
                        style={inputStyle}
                        editable={!isPreview}
                    />
                </View>

                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>연락처</Text>
                    <TextInput
                        placeholder="예) 010-1234-5678"
                        placeholderTextColor={colors.subText}
                        value={agencyCall}
                        onChangeText={v => setAgencyCall(mobile(v))}
                        keyboardType="phone-pad"
                        style={inputStyle}
                        editable={!isPreview}
                    />
                </View>

                {/* 업무 분류 */}
                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>업무 분류</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {JOB_INDUSTRIES.map((job, idx) => {
                            const active = uiIndex === idx;
                            return (
                                <TouchableOpacity
                                    key={job}
                                    disabled={isPreview}
                                    onPress={() => jumpToIndex(idx)}
                                    style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : "#000",
                                        backgroundColor: active ? colors.primary : "#fff",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: active ? "#fff" : colors.text,
                                            fontWeight: active ? "800" : "600",
                                        }}
                                    >
                                        {job}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 업무 1~4 동적폼 */}
                <View style={[cardBox, { marginBottom: 16 }]}>
                    <Text style={[label, { marginBottom: 8 }]}>업무 상세 (최대 4개)</Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {WORK_ROLES.map((role) => {
                            const active = selectedWorks.has(role);
                            return (
                                <TouchableOpacity
                                    key={role}
                                    disabled={isPreview}
                                    onPress={() => toggleWork(role)}
                                    style={{
                                        paddingVertical: 10,
                                        paddingHorizontal: 16,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: active ? colors.primary : "#000",
                                        backgroundColor: active ? colors.primary : "#fff",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: active ? "#fff" : colors.text,
                                            fontWeight: active ? "800" : "600",
                                        }}
                                    >
                                        {role}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View>
                        {WORK_ROLES.map((role) =>
                            selectedWorks.has(role) ? (
                                <View key={role} style={{ marginBottom: 12 }}>
                                    <Text style={[blueLabel, { marginBottom: 6 }]}>{role}</Text>
                                    <TextInput
                                        placeholder="예) 온라인 광고 집행, DM 발송 등"
                                        placeholderTextColor={colors.subText}
                                        value={workText[role]}
                                        onChangeText={text =>
                                            setWorkText(prev => ({
                                                ...prev,
                                                [role]: text,
                                            }))
                                        }
                                        style={inputStyle}
                                        editable={!isPreview}
                                    />
                                </View>
                            ) : null
                        )}
                    </View>
                </View>

                {/* 상세 내용 */}
                <View style={cardBox}>
                    <Text style={[label, { marginBottom: 8 }]}>상세 내용</Text>
                    <TextInput
                        placeholder="상세 내용을 입력하세요"
                        placeholderTextColor={colors.subText}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        scrollEnabled={false}
                        onContentSizeChange={
                            isPreview
                                ? undefined
                                : (e) => {
                                    const h = e.nativeEvent.contentSize.height;
                                    setContentInputHeight(Math.max(200, Math.ceil(h)));
                                }
                        }
                        style={[inputStyle, { height: contentInputHeight, textAlignVertical: "top" }]}
                        editable={!isPreview}
                    />
                </View>

                {/* 사업지 주소 + 지도 모달 */}
                <View style={cardBox}>
                    <NaverMap
                        title="사업지 주소"
                        placeholder="주소를 입력하세요."
                        address={businessAddress}
                        lat={businessLat}
                        lng={businessLng}
                        under={10}
                        onOpenModal={() => {
                            if (!isPreview) setShowBizModal(true);
                        }}
                    />
                </View>

                {/* 등록 버튼 */}
                <TouchableOpacity
                    disabled={isPreview}
                    onPress={submit}
                    style={{
                        backgroundColor: colors.primary,
                        borderRadius: 16,
                        paddingVertical: 14,
                        alignItems: "center",
                        marginBottom: 40,
                        opacity: isPreview ? 0.7 : 1,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                        광고글 등록하기
                    </Text>
                </TouchableOpacity>
            </Animated.ScrollView>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.select({ ios: "padding", android: "height" }) as any}
                keyboardVerticalOffset={100}
            >
                <GestureDetector gesture={pan}>
                    <View style={{ flex: 1 }}>
                        {/* 다음/이전 페이지(미리보기): 드래그 중에만 보이도록 */}
                        {previewIndex !== null && (
                            <Reanimated.View
                                pointerEvents="none"
                                style={[
                                    {
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                    },
                                    previewPageStyle,
                                ]}
                            >
                                {renderFormScroll(previewIndex, true)}
                            </Reanimated.View>
                        )}

                        {/* 현재 페이지 */}
                        <Reanimated.View
                            style={[
                                {
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                },
                                currentPageStyle,
                            ]}
                        >
                            {renderFormScroll(categoryIndex, false)}

                            {/* 커스텀 스크롤(우측 스크롤바 + 상/하 이동 버튼) */}
                            <ScrollNavigator
                                scrollY={scrollY}
                                getMetrics={getMetrics}
                                rightOffset={0}
                                onTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                                onBottom={() =>
                                    scrollRef.current?.scrollTo({
                                        y: Math.max(contentHeight - layoutHeight, 0),
                                        animated: true,
                                    })
                                }
                                bottomOffset={insets.bottom + 8}
                                topOffset={0}
                                trackOpacity={0.22}
                                thumbOpacity={0.9}
                                thumbColor="#FF0000"
                                barWidth={4}
                            />
                        </Reanimated.View>
                    </View>
                </GestureDetector>

                {/* 사업지 지도 모달 */}
                <BusinessPicker
                    visible={showBizModal}
                    onClose={() => setShowBizModal(false)}
                    onPick={(loc: LocationSel) => {
                        onPickBiz(loc);
                        setShowBizModal(false);
                    }}
                    clientId={KAKAO_MAP_JS_KEY}
                    initial={{ address: businessAddress || "" }}
                    showSameAsWorkButton={false}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
