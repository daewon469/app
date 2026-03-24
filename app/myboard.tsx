import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Modal, Platform, Pressable, Text as RNText, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import ScrollNavigator from "../components/ScrollNavigator";
import UserGradeBadge from "../components/ui/UserGradeBadge";
import { API_URL, Auth, Referral, type MyPageSummaryResponse } from "../lib/api";
import { getUserGradeLabel } from "../utils/userGrade";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

async function saveToAndroidDownloads(localUri: string, filename: string) {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) throw new Error("폴더 접근 권한이 필요합니다.");

    const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
        perm.directoryUri,
        filename,
        mime
    );
    await FileSystem.writeAsStringAsync(newUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    return newUri;
}
export default function MyPagePreview() {
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const BOTTOM_BAR_HEIGHT = 61;

    const [username, setUsername] = useState<string | null>(null);
    const [isLogin, setIsLogin] = useState(false);

    const [summary, setSummary] = useState<MyPageSummaryResponse | null>(null);
    const [referralModalVisible, setReferralModalVisible] = useState(false);
    const referralCount = summary?.referral_count ?? 0;
    const [referralNetworkCount, setReferralNetworkCount] = useState(0);

    const scrollRef = useRef<any>(null);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [contentHeight, setContentHeight] = useState(1);
    const [layoutHeight, setLayoutHeight] = useState(1);
    const getMetrics = useCallback(
        () => ({ contentHeight, layoutHeight }),
        [contentHeight, layoutHeight]
    );

    const colors = {
        background: "#fff",
        card: "#fff",
        text: "#111",
        subText: "#666",
        border: "#ddd",
        primary: "#4A6CF7",
    };

    const mockCounts = {
        jobs: summary?.posts.type1 ?? 0,
        talks: summary?.posts.type3 ?? 0,
        ads: summary?.posts.type4 ?? 0,
        inquiries: (summary?.posts as any)?.type6 ?? 0,
    };
    // 서버 집계값(referral_count) 기준으로 추천 인원수 표시 (referralranking.tsx와 동일 기준)

    const canSeeAdminMenu = !!summary && (summary.admin_acknowledged ?? false);
    const canSeeOwnerMenu = !!summary && (summary.is_owner ?? false);

    useEffect(() => {
        (async () => {
            try {
                const [isLoginStr, stored] = await Promise.all([
                    SecureStore.getItemAsync("isLogin"),
                    SecureStore.getItemAsync("username"),
                ]);
                const ok = isLoginStr === "true";
                setIsLogin(ok);
                if (!ok) {
                    Alert.alert("알림", "로그인이 필요합니다.");
                    router.replace("/login");
                    return;
                }
                if (!stored) {
                    Alert.alert("알림", "로그인이 필요합니다.");
                    router.replace("/login");
                    return;
                }

                setUsername(stored);

                const [res, networkCount] = await Promise.all([
                    Auth.getMyPageSummary(stored),
                    Referral.networkCount(stored, { max_depth: 20 }).catch((e) => {
                        console.warn("myboard: referral networkCount failed:", e);
                        return 0;
                    }),
                ]);
                setReferralNetworkCount(networkCount);

                console.log("myboard: getMyPageSummary response:", res);

                if (res.status === 0) {
                    const referralCountFromSummary =
                        typeof (res as any).referral_count === "number"
                            ? (res as any).referral_count
                            : typeof (res as any).referralCount === "number"
                                ? (res as any).referralCount
                                : 0;
                    setSummary({
                        status: res.status,
                        signup_date: res.signup_date,
                        user_grade: (res as any).user_grade ?? -1,
                        is_owner: (res as any).is_owner ?? false,
                        posts: res.posts,
                        point_balance: res.point_balance ?? 0,
                        cash_balance: res.cash_balance ?? 0,
                        admin_acknowledged: res.admin_acknowledged ?? false,
                        referral_code: res.referral_code ?? null,
                        referral_count: referralCountFromSummary,
                    });
                } else {
                    console.error("myboard: getMyPageSummary failed with status:", res.status);
                    Alert.alert("오류", "회원 정보를 불러올 수 없습니다.");
                }
            } catch (error) {
                console.error("myboard: error loading user data:", error);
                Alert.alert("오류", "회원 정보를 불러오는데 실패했습니다.");
            }
        })();
    }, []);

    const handleLogout = () => {
        Alert.alert("로그아웃", "정말 로그아웃할까요?", [
            { text: "취소", style: "cancel" },
            {
                text: "로그아웃",
                style: "destructive",
                onPress: async () => {
                    // 로그아웃 시에만 isLogin을 false로 저장 (삭제 X)
                    await SecureStore.setItemAsync("isLogin", "false");
                    setIsLogin(false);
                    router.replace("/list");
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        if (!username) {
            Alert.alert("오류", "로그인 정보가 없습니다.");
            return;
        }

        Alert.alert(
            "회원탈퇴",
            "정말로 회원을 탈퇴하시겠습니까?\n탈퇴 후에는 포인트는 소멸되고, 저장기능은 복구할 수 없습니다.",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "탈퇴하기",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await Auth.deleteUser(username);

                            if (res.status === 0) {
                                await Promise.all([
                                    SecureStore.setItemAsync("isLogin", "false"),
                                    SecureStore.deleteItemAsync("username"),
                                    SecureStore.deleteItemAsync("token"),
                                ]);
                                setIsLogin(false);

                                Alert.alert("탈퇴 완료", "회원 탈퇴가 정상적으로 처리되었습니다.");

                                router.replace("/list");
                            } else {
                                Alert.alert("오류", "회원 탈퇴 중 문제가 발생했습니다.");
                            }
                        } catch (e) {
                            Alert.alert("에러", "서버 통신 중 문제가 발생했습니다.");
                        }
                    },
                },
            ]
        );
    };

    const handleOpenPushSettings = async () => {
        try {
            await Linking.openSettings();
        } catch (e) {
            Alert.alert("오류", "설정 화면을 열 수 없습니다.");
        }
    };

    const referralCode = (summary?.referral_code ?? "52330").toString().trim() || "52330";
    const INSTALL_URL = "https://play.google.com/store/apps/details?id=com.smartgauge.bunyangpro";

    const buildReferralMessage = () => {
        return `분양프로 설치 링크
${INSTALL_URL}

내 추천인코드: ${referralCode}

안녕하세요! (__) (^.^)

<분양프로>는 분양상담사 구인구직에 최적화된 어플입니다.

무료로 구인등록 하시고, 다양한 포인트 혜택도 누려보세요!

지금 '플레이스토어'에서 <분양프로>를 다운 받아보세요^^
`;
    };

    const handleRecommendKakao = async () => {
        try {
            await Share.share({ message: buildReferralMessage() });
        } catch (e) {
            Alert.alert("오류", "공유를 실행할 수 없습니다.");
        } finally {
            setReferralModalVisible(false);
        }
    };

    const handleRecommendSms = async () => {
        try {
            const body = encodeURIComponent(buildReferralMessage());
            const url = Platform.OS === "ios" ? `sms:&body=${body}` : `sms:?body=${body}`;
            await Linking.openURL(url);
        } catch (e) {
            Alert.alert("오류", "문자 앱을 열 수 없습니다.");
        } finally {
            setReferralModalVisible(false);
        }
    };

    const handleCopyReferralMessage = async () => {
        try {
            await Clipboard.setStringAsync(buildReferralMessage());
            Alert.alert("복사 완료", "추천 문구가 클립보드에 복사되었습니다.");
        } catch (e) {
            Alert.alert("오류", "추천 문구 복사에 실패했습니다.");
        }
    };

    const handleExportUsersExcel = async () => {
        try {
            const url = `${API_URL}/community/users/export`;
            const filename = `users_${Date.now()}.xlsx`;
            const localUri = FileSystem.documentDirectory + filename;

            const downloadRes = await FileSystem.downloadAsync(url, localUri, {
                headers: {
                    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
            });

            const { uri } = downloadRes;
            const status = (downloadRes as any)?.status as number | undefined;
            const headers = ((downloadRes as any)?.headers ?? {}) as Record<string, string>;
            const contentType =
                headers["content-type"] ??
                headers["Content-Type"] ??
                headers["CONTENT-TYPE"] ??
                "";

            // 서버 에러(JSON/HTML)를 .xlsx로 저장해버리면 "손상된 파일"로 보입니다.
            if (status && status >= 400) {
                let detail = "";
                try {
                    detail = await FileSystem.readAsStringAsync(uri);
                } catch {
                    detail = "";
                }
                await FileSystem.deleteAsync(uri, { idempotent: true });
                throw new Error(`엑셀 다운로드 실패 (HTTP ${status})${detail ? `\n${detail}` : ""}`);
            }

            // 200이라도 content-type이 엑셀이 아니면(프록시/에러페이지) 저장하지 않음
            if (
                contentType &&
                !contentType.includes(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                ) &&
                !contentType.includes("application/octet-stream")
            ) {
                let detail = "";
                try {
                    detail = await FileSystem.readAsStringAsync(uri);
                } catch {
                    detail = "";
                }
                await FileSystem.deleteAsync(uri, { idempotent: true });
                throw new Error(
                    `엑셀 다운로드 실패 (Content-Type: ${contentType})${detail ? `\n${detail}` : ""}`
                );
            }

            if (Platform.OS === "android") {
                await saveToAndroidDownloads(uri, filename);
                Alert.alert("저장 완료", "선택한 폴더에 엑셀 파일이 저장되었습니다.");
            } else {
                await Sharing.shareAsync(uri, {
                    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    dialogTitle: "엑셀 파일 열기/공유",
                });
            }
        } catch (e: any) {
            Alert.alert("실패", e?.message ?? "파일 저장에 실패했습니다.");
        }
    };

    const handleUploadMigration = () => {
        if (!username) {
            Alert.alert("알림", "로그인이 필요합니다.");
            return;
        }
        router.push("/migrationfiles");
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Animated.ScrollView
                ref={scrollRef}
                style={{ flex: 1, backgroundColor: colors.background }}
                contentContainerStyle={{ padding: 16, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_, h) => setContentHeight(h)}
                onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >

                {/* 내 정보 카드 */}
                <View
                    style={{
                        padding: 20,
                        borderRadius: 16,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "#000",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}
                >
                    {/* 프로필 헤더 */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                        {/* 사람 아이콘 대신 회원등급 아이콘 */}
                        <View style={{ marginRight: 12 }}>
                            <UserGradeBadge
                                grade={summary?.user_grade ?? -1}
                                size={56}
                                // 아이콘 뱃지(0~4): 배경 #f8f9fa / 일반회원(-1): 기존 유지(흰 아이콘이라 배경 변경 시 가독성 저하)
                                bgColor={(summary?.user_grade ?? -1) === -1 ? undefined : "#f8f9fa"}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <Text
                                    style={{
                                        fontSize: 20,
                                        fontWeight: "700",
                                        color: colors.text,
                                    }}
                                >
                                    {username}
                                </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                                <Ionicons name="ribbon-outline" size={12} color={colors.subText} />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: colors.subText,
                                        marginLeft: 4,
                                    }}
                                >
                                    회원등급: {getUserGradeLabel(summary?.user_grade ?? -1)}
                                </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                                <Ionicons name="calendar-outline" size={12} color={colors.subText} />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: colors.subText,
                                        marginLeft: 4,
                                    }}
                                >
                                    가입일: {summary?.signup_date || "정보 없음"}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* 포인트 & 캐시 정보 */}
                    <View
                        style={{
                            flexDirection: "column",
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            paddingTop: 16,
                            gap: 12,
                        }}
                    >
                        <Pressable
                            style={{
                                width: "100%",
                                backgroundColor: "#f8f9fa",
                                padding: 12,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                            onPress={() => {
                                if (!username) {
                                    Alert.alert("알림", "로그인이 필요합니다.");
                                    return;
                                }
                                router.push({ pathname: "/points", params: { username } });
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Ionicons name="star" size={18} color="#FFD700" />
                                    <Text
                                        style={{
                                            fontSize: 17,
                                            color: "#000",
                                            marginLeft: 6,
                                            fontWeight: "700",
                                        }}
                                    >
                                        포인트
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        fontSize: 18,
                                        fontWeight: "700",
                                        color: "#000",
                                    }}
                                >
                                    {summary?.point_balance?.toLocaleString() || 0}점
                                </Text>
                            </View>
                        </Pressable>
                        <Pressable
                            style={{
                                width: "100%",
                                backgroundColor: "#f8f9fa",
                                padding: 12,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                            onPress={() => {
                                if (!username) {
                                    Alert.alert("알림", "로그인이 필요합니다.");
                                    return;
                                }
                                router.push({ pathname: "/cash", params: { username } });
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Ionicons name="wallet" size={18} color={colors.primary} />
                                    <Text
                                        style={{
                                            fontSize: 16,
                                            color: "#000",
                                            marginLeft: 6,
                                            fontWeight: "700",
                                        }}
                                    >
                                        캐시
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        fontSize: 18,
                                        fontWeight: "700",
                                        color: "#000",
                                    }}
                                >
                                    {summary?.cash_balance?.toLocaleString() || 0}원
                                </Text>
                            </View>
                        </Pressable>
                    </View>
                </View>

                {/* 추가로 분리된 "추천/내 정보 관리" 섹션 */}
                <View
                    style={{
                        marginTop: 10,
                        paddingTop: 16,
                        paddingHorizontal: 16,
                        paddingBottom: 8,
                        borderRadius: 12,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "#000",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.text,
                            marginBottom: 8,
                        }}
                    >
                        1.포인트 관리
                    </Text>
                    {/* 추천하기 (추천인코드) */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            if (!referralCode) {
                                Alert.alert("알림", "추천인코드가 없습니다.");
                                return;
                            }
                            setReferralModalVisible(true);
                        }}
                    >
                        <Ionicons
                            name="key-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                추천하기{" "}
                                <Text style={{ color: colors.subText }}>
                                    (추천인코드 {summary?.referral_code || "없음"})
                                </Text>
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.subText}
                        />
                    </Pressable>
                    {/* 내가 추천한 회원 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push({ pathname: "/referrals", params: { username } });
                        }}
                    >
                        <Ionicons
                            name="people-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                내가 추천한 회원{" "}
                                <Text style={{ color: colors.subText }}>({referralCount}명)</Text>
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.subText}
                        />
                    </Pressable>



                    {/* 추천인 랭킹 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/referralranking")}
                    >
                        <Ionicons
                            name="trophy-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                추천인 랭킹
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>


                    {/* 내 인맥(하위 추천) */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push({ pathname: "/referralnetwork", params: { username } });
                        }}
                    >
                        <Ionicons
                            name="git-network-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                나의 추천인 인맥{" "}
                                <Text style={{ color: colors.subText }}>({referralNetworkCount}명)</Text>
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>
                    {/* 내 포인트 적립 내역 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push({ pathname: "/points", params: { username } });
                        }}
                    >
                        <Ionicons
                            name="star-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                적립/사용 내역
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.subText}
                        />
                    </Pressable>
                </View>

                {/* 내 캐시 관리 섹션 */}
                <View
                    style={{
                        padding: 16,
                        marginTop: 10,
                        borderRadius: 12,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "#000",
                    }}

                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.text,
                            marginBottom: 8,
                        }}
                    >
                        2.캐시 관리
                    </Text>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }

                            Alert.alert(
                                "알림",
                                "아직 오픈되지 않은 기능입니다.",
                                [{ text: "확인" }],
                                { cancelable: true } // Android: 뒤로가기로 닫힘
                            );
                        }}
                    >
                        <Ionicons
                            name="wallet-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                캐시 충전
                            </Text>

                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push({ pathname: "/cash", params: { username } });
                        }}
                    >
                        <Ionicons
                            name="receipt-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                충전/사용 내역
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>
                </View>

                {/* 내 글 관리 섹션 */}
                <View
                    style={{
                        marginTop: 10,
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "#000",
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: colors.text,
                            }}
                        >
                            3.글 관리
                        </Text>
                    </View>

                    {/* 내 구인글 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/mypage")}
                    >
                        <MaterialIcons
                            name="work-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "400", color: colors.text }}>
                                내 구인글 <Text style={{ color: colors.subText }}>({mockCounts.jobs})</Text>
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 내 수다글 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/mypage3")}
                    >
                        <Ionicons
                            name="chatbubbles-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "400", color: colors.text }}>
                                내 수다글 <Text style={{ color: colors.subText }}>({mockCounts.talks})</Text>
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 내 광고글 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/mypage4")}
                    >
                        <MaterialIcons
                            name="campaign"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "400", color: colors.text }}>
                                내 광고글 <Text style={{ color: colors.subText }}>({mockCounts.ads})</Text>
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 내 문의글 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/mypage6")}
                    >
                        <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "400", color: colors.text }}>
                                내 문의글 <Text style={{ color: colors.subText }}>({mockCounts.inquiries})</Text>
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 알림 내역 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push("/noti");
                        }}
                    >
                        <Ionicons
                            name="list-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                내 알림 내역
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>
                </View>

                {/* 설정 섹션 (내 글 관리와 문의 사이) */}
                <View
                    style={{
                        marginTop: 10,
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "#000",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.text,
                            marginBottom: 8,
                        }}
                    >
                        4.설정
                    </Text>

                    {/* 내 정보 수정 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push({
                                pathname: "/signup",
                                params: {
                                    mode: "edit",
                                    username,
                                },
                            });
                        }}
                    >
                        <Ionicons
                            name="create-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                내 정보 수정
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 지역저장 설정 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push("/areasite");
                        }}
                    >
                        <Ionicons
                            name="location-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                지역저장 설정
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 맞춤저장 설정 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => {
                            if (!username) {
                                Alert.alert("알림", "로그인이 필요합니다.");
                                return;
                            }
                            router.push({
                                pathname: "/customsite",
                                params: { username },
                            });
                        }}
                    >
                        <Ionicons
                            name="options-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                맞춤저장 설정
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    {/* 푸시알림 설정 */}
                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={handleOpenPushSettings}
                    >
                        <Ionicons
                            name="notifications-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                푸시알림 설정
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                </View>

                {/* 질문 / 문의 섹션 */}
                <View
                    style={{
                        padding: 16,
                        borderRadius: 12,
                        marginTop: 10,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: "#000",
                    }}

                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.text,
                            marginBottom: 8,
                        }}
                    >
                        5.고객센터
                    </Text>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/list5")}
                    >
                        <Ionicons
                            name="help-buoy-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                공지사항
                            </Text>

                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() => router.push("/write6")}
                    >
                        <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                문의 및 건의사항
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={() =>
                            router.push({
                                pathname: "/write7",
                                params: { presetTitle: "(주)대원파트너스 분양대행 문의" },
                            })
                        }
                    >
                        <Ionicons
                            name="business-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                (주)대원파트너스 분양대행 문의
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={handleLogout}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                로그아웃
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>

                    <Pressable
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                        }}
                        onPress={handleDeleteAccount}
                    >
                        <Ionicons
                            name="person-remove-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text }}>
                                회원탈퇴
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </Pressable>
                </View>

                {/* 추천하기 모달 (카톡/문자) */}
                <Modal
                    visible={referralModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setReferralModalVisible(false)}
                >
                    <Pressable
                        style={{
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.4)",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: 16,
                        }}
                        onPress={() => setReferralModalVisible(false)}
                    >
                        <Pressable
                            onPress={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                maxWidth: 380,
                                borderRadius: 14,
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: "#000",
                                padding: 16,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    marginBottom: 6,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 16,
                                        fontWeight: "700",
                                        color: colors.text,
                                    }}
                                >
                                    추천하기
                                </Text>
                                <Pressable
                                    onPress={handleCopyReferralMessage}
                                    hitSlop={8}
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: "#000",
                                        backgroundColor: "#fff",
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                                        복사하기
                                    </Text>
                                </Pressable>
                            </View>
                            <Text
                                style={{
                                    fontSize: 13,
                                    color: colors.subText,
                                    marginBottom: 12,
                                    lineHeight: 18,
                                }}
                            >
                                설치 링크와 추천인코드가 함께 전송됩니다.
                            </Text>

                            <View style={{ gap: 10 }}>
                                <Pressable
                                    onPress={handleRecommendKakao}
                                    style={{
                                        backgroundColor: "#FEE500",
                                        borderRadius: 12,
                                        paddingVertical: 12,
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={{ color: "#111", fontWeight: "700", fontSize: 15 }}>
                                        카톡 추천
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={handleRecommendSms}
                                    style={{
                                        backgroundColor: colors.primary,
                                        borderRadius: 12,
                                        paddingVertical: 12,
                                        alignItems: "center",
                                    }}
                                >
                                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                                        문자 추천
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => setReferralModalVisible(false)}
                                    style={{
                                        borderRadius: 12,
                                        paddingVertical: 12,
                                        alignItems: "center",
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        backgroundColor: "#fff",
                                    }}
                                >
                                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                                        취소
                                    </Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* 관리자 카드 섹션 */}
                {canSeeAdminMenu && (
                    <View
                        style={{
                            padding: 16,
                            borderRadius: 12,
                            marginTop: 10,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: "#000",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: colors.text,
                                marginBottom: 8,
                            }}
                        >
                            6.관리자 메뉴
                        </Text>

                        {/* 내 공지사항 글(관리자만) */}
                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/mypage5")}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    공지사항 관리
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/list6")}
                        >
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                   문의 및 건의사항 확인
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/adminusers")}
                        >
                            <Ionicons
                                name="people-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    회원 관리 <Text style={{ color: colors.subText }}>(관리자용)</Text>
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/titlesearchadmin")}
                        >
                            <Ionicons
                                name="search-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    제목검색 추천현장 관리
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/todaystatus")}
                        >
                            <Ionicons
                                name="stats-chart-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    오늘의 현황
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingTop: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/todayreferr")}
                        >
                            <Ionicons
                                name="people-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    추천 현황
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>


                    </View>
                )}

                {/* 오너 메뉴 카드 섹션 */}
                {canSeeOwnerMenu && (
                    <View
                        style={{
                            padding: 16,
                            borderRadius: 12,
                            marginTop: 10,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: "#000",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: colors.text,
                                marginBottom: 8,
                            }}
                        >
                            7.오너 메뉴
                        </Text>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/adminusers")}
                        >
                            <Ionicons
                                name="people-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    회원 관리 <Text style={{ color: colors.subText }}>(오너용)</Text>
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/list7")}
                        >
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    분양대행 문의 확인
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/topbanneradmin")}
                        >
                            <Ionicons
                                name="image-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    상단배너 관리
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/banneradmin")}
                        >
                            <Ionicons
                                name="images-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    하단배너 관리
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={() => router.push("/popupadmin")}
                        >
                            <Ionicons
                                name="albums-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    팝업창 관리
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>

                        <Pressable
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                // 마지막 항목: 아래쪽이 두꺼워 보이지 않게 top padding만 적용
                                paddingTop: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                            onPress={handleExportUsersExcel}
                        >
                            <Ionicons
                                name="download-outline"
                                size={20}
                                color={colors.primary}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: colors.text }}>
                                    엑셀 다운로드
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </Pressable>
                    </View>
                )}

                {/* 회사 정보 섹션 */}
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 20,
                        paddingBottom: 20,
                        marginTop: 10,
                        alignItems: "center",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.subText,
                            marginBottom: 2,
                            lineHeight: 16,
                            textAlign: "center",
                        }}
                    >
                        (주)대원파트너스 대표이사 김대원
                    </Text>

                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.subText,
                            marginBottom: 2,
                            lineHeight: 16,
                            textAlign: "center",
                        }}
                    >
                        경기도 평택시 고덕면 도시지원1길 116, 113호(지1지식산업센터)
                    </Text>
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.subText,
                            marginBottom: 2,
                            lineHeight: 16,
                            textAlign: "center",
                        }}
                    >
                        사업자등록번호 219-87-04066
                    </Text>
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.subText,
                            marginBottom: 2,
                            lineHeight: 16,
                            textAlign: "center",
                        }}
                    >
                        통신판매업신고번호 제 2026-경기송탄-0005호
                    </Text>
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.subText,
                            marginBottom: 2,
                            lineHeight: 16,
                            textAlign: "center",
                        }}
                    >
                        이메일 daewon469@naver.com
                    </Text>
                    <Text
                        style={{
                            fontSize: 11,
                            color: colors.subText,
                            lineHeight: 16,
                            textAlign: "center",
                        }}
                    >
                        고객센터 031-664-1119
                    </Text>
                </View>

            </Animated.ScrollView>

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
                bottomOffset={BOTTOM_BAR_HEIGHT + insets.bottom}
                topOffset={0}
                trackOpacity={0.6}
                thumbOpacity={1.0}
                barWidth={4}
            />

        </View>
    );
}

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#f8f9fa",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#ddd",
                paddingVertical: 10,
                paddingHorizontal: 10,
            }}
        >
            <Text style={{ fontSize: 12, color: "#666", fontWeight: "700" }} numberOfLines={1}>
                {label}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 16, fontWeight: "900", color: "#111" }} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}
