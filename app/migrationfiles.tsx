import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    Text as RNText,
    TextInput,
    ScrollView,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adminApi } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
    <RNText {...props} allowFontScaling={false} />
);

type MigrationStatus = {
    status: "idle" | "scanning" | "downloading" | "done" | "error";
    total: number;
    downloaded: number;
    skipped: number;
    failed: number;
    current_file: string | null;
    error: string | null;
    started_at: number | null;
    finished_at: number | null;
    failed_count: number;
};

const INITIAL_STATUS: MigrationStatus = {
    status: "idle",
    total: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    current_file: null,
    error: null,
    started_at: null,
    finished_at: null,
    failed_count: 0,
};

export default function MigrationFilesScreen() {
    const insets = useSafeAreaInsets();

    const colors = {
        background: "#fff",
        text: "#111",
        subText: "#666",
        border: "#ddd",
        primary: "#4A6CF7",
        danger: "#e74c3c",
        success: "#27ae60",
        warning: "#f39c12",
    };

    const [username, setUsername] = useState<string | null>(null);
    const [migStatus, setMigStatus] = useState<MigrationStatus>(INITIAL_STATUS);
    const [polling, setPolling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef(false);

    // 단일 파일 이전
    const [singleFileName, setSingleFileName] = useState("");
    const [singleLoading, setSingleLoading] = useState(false);
    const [singleResult, setSingleResult] = useState<{
        success: boolean;
        path: string;
        action: string;
        reason?: string;
    } | null>(null);
    const [singleError, setSingleError] = useState<string | null>(null);

    const isRunning = migStatus.status === "scanning" || migStatus.status === "downloading";
    const processed = migStatus.downloaded + migStatus.skipped + migStatus.failed;
    const progressPct = migStatus.total > 0 ? Math.round((processed / migStatus.total) * 100) : 0;

    // 상태 폴링
    const pollStatus = useCallback(async () => {
        if (pollingRef.current) return;
        pollingRef.current = true;
        setPolling(true);
        setError(null);

        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { data } = await adminApi.get(
                    "/admin/migration/uploads/auto-migration-status",
                    { timeout: 30000 },
                );
                const s = data as MigrationStatus;
                setMigStatus(s);

                if (s.status === "done" || s.status === "error" || s.status === "idle") {
                    break;
                }
                await new Promise((r) => setTimeout(r, 3000));
            }
        } catch (e: any) {
            const msg = e?.response?.data
                ? JSON.stringify(e.response.data).slice(0, 500)
                : e?.message ?? "상태 조회 실패";
            setError(msg);
        } finally {
            pollingRef.current = false;
            setPolling(false);
        }
    }, []);

    // 자동 마이그레이션 시작
    const startMigration = useCallback(async () => {
        setError(null);
        try {
            await adminApi.post(
                "/admin/migration/uploads/start-auto-migration",
                null,
                { timeout: 30000 },
            );
            // 시작 후 폴링 시작
            pollStatus();
        } catch (e: any) {
            const msg = e?.response?.data
                ? JSON.stringify(e.response.data).slice(0, 500)
                : e?.message ?? "마이그레이션 시작 실패";
            setError(msg);
        }
    }, [pollStatus]);

    // 단일 파일 이전 요청
    const pullSingleFile = useCallback(async () => {
        const trimmed = singleFileName.trim();
        if (!trimmed) {
            setSingleError("파일명을 입력해주세요.");
            return;
        }
        setSingleLoading(true);
        setSingleError(null);
        setSingleResult(null);
        try {
            const { data } = await adminApi.post(
                "/admin/migration/uploads/pull-single",
                { path: trimmed, overwrite: false },
                { timeout: 60000 },
            );
            setSingleResult(data);
        } catch (e: any) {
            const msg = e?.response?.data
                ? JSON.stringify(e.response.data).slice(0, 500)
                : e?.message ?? "단일 파일 이전 실패";
            setSingleError(msg);
        } finally {
            setSingleLoading(false);
        }
    }, [singleFileName]);

    // 현재 상태 한 번 가져오기
    const fetchCurrentStatus = useCallback(async () => {
        try {
            const { data } = await adminApi.get(
                "/admin/migration/uploads/auto-migration-status",
                { timeout: 15000 },
            );
            const s = data as MigrationStatus;
            setMigStatus(s);
            // 진행 중이면 자동 폴링 시작
            if (s.status === "scanning" || s.status === "downloading") {
                pollStatus();
            }
        } catch {
            // 무시 — 아직 서버에 상태가 없을 수 있음
        }
    }, [pollStatus]);

    useEffect(() => {
        (async () => {
            const [isLoginStr, stored] = await Promise.all([
                SecureStore.getItemAsync("isLogin"),
                SecureStore.getItemAsync("username"),
            ]);
            if (isLoginStr !== "true" || !stored) {
                Alert.alert("알림", "로그인이 필요합니다.");
                router.back();
                return;
            }
            setUsername(stored);
            fetchCurrentStatus();
        })();
    }, []);

    const statusLabel = () => {
        switch (migStatus.status) {
            case "idle":
                return { text: "대기 중", color: colors.subText, icon: "hourglass-outline" as const };
            case "scanning":
                return { text: "A 서버 파일 목록 조회 중…", color: colors.warning, icon: "search-outline" as const };
            case "downloading":
                return { text: "파일 다운로드 중…", color: colors.primary, icon: "cloud-download-outline" as const };
            case "done":
                return { text: "마이그레이션 완료!", color: colors.success, icon: "checkmark-circle-outline" as const };
            case "error":
                return { text: "오류 발생", color: colors.danger, icon: "warning-outline" as const };
            default:
                return { text: "알 수 없음", color: colors.subText, icon: "help-outline" as const };
        }
    };

    const sl = statusLabel();

    const elapsed = () => {
        if (!migStatus.started_at) return "";
        const end = migStatus.finished_at ?? Date.now() / 1000;
        const sec = Math.floor(end - migStatus.started_at);
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        return min > 0 ? `${min}분 ${s}초` : `${s}초`;
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* 상단 헤더 */}
            <View style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: "#fff",
            }}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 10 }}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 }}>
                    이미지 마이그레이션
                </Text>
                <Pressable onPress={fetchCurrentStatus} disabled={polling} hitSlop={10}>
                    {polling ? (
                        <ActivityIndicator size={20} color={colors.primary} />
                    ) : (
                        <Ionicons name="refresh" size={22} color={colors.primary} />
                    )}
                </Pressable>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
            >
                {/* 상태 카드 */}
                <View style={{
                    backgroundColor: "#f8f9fa",
                    borderRadius: 16,
                    padding: 24,
                    alignItems: "center",
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: "#eee",
                }}>
                    <Ionicons name={sl.icon} size={48} color={sl.color} />
                    <Text style={{ fontSize: 18, fontWeight: "800", color: sl.color, marginTop: 12 }}>
                        {sl.text}
                    </Text>
                    {migStatus.status === "error" && migStatus.error && (
                        <Text style={{ fontSize: 12, color: colors.danger, marginTop: 8, textAlign: "center" }}>
                            {migStatus.error}
                        </Text>
                    )}
                    {migStatus.started_at ? (
                        <Text style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
                            경과 시간: {elapsed()}
                        </Text>
                    ) : null}
                </View>

                {/* 진행률 바 */}
                {migStatus.total > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                                진행률
                            </Text>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                                {progressPct}% ({processed}/{migStatus.total})
                            </Text>
                        </View>
                        <View style={{
                            height: 12,
                            backgroundColor: "#e9ecef",
                            borderRadius: 6,
                            overflow: "hidden",
                        }}>
                            <View style={{
                                height: "100%",
                                width: `${progressPct}%`,
                                backgroundColor: migStatus.status === "done" ? colors.success : colors.primary,
                                borderRadius: 6,
                            }} />
                        </View>
                    </View>
                )}

                {/* 통계 카드 */}
                <View style={{
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 20,
                }}>
                    <StatChip label="전체" value={migStatus.total} bg="#e8eaf6" color="#333" />
                    <StatChip label="완료" value={migStatus.downloaded} bg="#e8f5e9" color={colors.success} />
                    <StatChip label="스킵" value={migStatus.skipped} bg="#f5f5f5" color="#999" />
                    <StatChip label="실패" value={migStatus.failed} bg="#ffebee" color={colors.danger} />
                </View>

                {/* 현재 파일 */}
                {isRunning && migStatus.current_file && (
                    <View style={{
                        backgroundColor: "#fffde7",
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: "#fff9c4",
                    }}>
                        <Text style={{ fontSize: 11, color: "#999", fontWeight: "600", marginBottom: 4 }}>
                            현재 처리 중
                        </Text>
                        <Text style={{ fontSize: 13, color: "#333" }} numberOfLines={2}>
                            {migStatus.current_file}
                        </Text>
                    </View>
                )}

                {/* ───── 단일 파일 이전 섹션 ───── */}
                <View style={{
                    backgroundColor: "#f8f9fa",
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: "#e0e0e0",
                }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 10 }}>
                        📄 단일 파일 이전
                    </Text>
                    <Text style={{ fontSize: 12, color: "#888", marginBottom: 10, lineHeight: 17 }}>
                        A 서버의 파일명(경로)을 입력하면 해당 파일만 B 서버로 이전합니다.{"\n"}
                        예: photo.jpg, images/photo.jpg
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <TextInput
                            style={{
                                flex: 1,
                                height: 44,
                                backgroundColor: "#fff",
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: "#ddd",
                                paddingHorizontal: 14,
                                fontSize: 14,
                                color: "#333",
                            }}
                            placeholder="파일명 입력 (예: photo.jpg)"
                            placeholderTextColor="#bbb"
                            value={singleFileName}
                            onChangeText={setSingleFileName}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!singleLoading}
                        />
                        <Pressable
                            disabled={singleLoading || !singleFileName.trim()}
                            onPress={pullSingleFile}
                            style={{
                                height: 44,
                                paddingHorizontal: 18,
                                backgroundColor: singleLoading || !singleFileName.trim() ? "#ccc" : "#FF9800",
                                borderRadius: 10,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {singleLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>이전</Text>
                            )}
                        </Pressable>
                    </View>

                    {/* 단일 파일 결과 */}
                    {singleResult && (
                        <View style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 10,
                            backgroundColor: singleResult.action === "downloaded"
                                ? "#e8f5e9"
                                : singleResult.action === "skipped"
                                    ? "#fff8e1"
                                    : "#ffebee",
                        }}>
                            <Text style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: singleResult.action === "downloaded"
                                    ? colors.success
                                    : singleResult.action === "skipped"
                                        ? colors.warning
                                        : colors.danger,
                            }}>
                                {singleResult.action === "downloaded" && "✅ 다운로드 완료"}
                                {singleResult.action === "skipped" && "⏭ 스킵 (이미 존재)"}
                                {singleResult.action === "failed" && `❌ 실패: ${singleResult.reason ?? ""}`}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                                {singleResult.path}
                            </Text>
                        </View>
                    )}

                    {/* 단일 파일 에러 */}
                    {singleError && (
                        <View style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 10,
                            backgroundColor: "#ffebee",
                        }}>
                            <Text style={{ fontSize: 12, color: colors.danger }}>{singleError}</Text>
                        </View>
                    )}
                </View>

                {/* ───── 자동 마이그레이션 섹션 ───── */}

                {/* 시작 버튼 */}
                <Pressable
                    disabled={isRunning}
                    onPress={() => {
                        Alert.alert(
                            "자동 마이그레이션",
                            "A 서버의 모든 파일을 B 서버로 자동 이전합니다.\n서버 로그에서 진행 상황을 확인할 수 있습니다.",
                            [
                                { text: "취소", style: "cancel" },
                                { text: "시작", onPress: startMigration },
                            ],
                        );
                    }}
                    style={{
                        backgroundColor: isRunning ? "#ccc" : colors.primary,
                        borderRadius: 12,
                        paddingVertical: 16,
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 10,
                        marginBottom: 12,
                    }}
                >
                    {isRunning && <ActivityIndicator color="#fff" size="small" />}
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                        {isRunning ? "마이그레이션 진행 중…" : "자동 마이그레이션 시작"}
                    </Text>
                </Pressable>

                {/* 안내 문구 */}
                <View style={{
                    backgroundColor: "#f0f4ff",
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 8,
                }}>
                    <Text style={{ fontSize: 12, color: "#555", lineHeight: 18 }}>
                        💡 서버가 백그라운드에서 자동으로 A→B 파일을 이전합니다.{"\n"}
                        이 화면을 닫아도 서버에서 계속 진행됩니다.{"\n"}
                        서버 로그(print)에서 각 파일의 이전 상태를 확인할 수 있습니다.
                    </Text>
                </View>

                {/* 에러 표시 */}
                {error && (
                    <View style={{
                        backgroundColor: "#ffebee",
                        borderRadius: 10,
                        padding: 14,
                        marginTop: 16,
                    }}>
                        <Text style={{ fontSize: 12, color: colors.danger }}>
                            {error}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

function StatChip({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
    return (
        <View style={{
            flex: 1,
            backgroundColor: bg,
            borderRadius: 8,
            paddingVertical: 10,
            alignItems: "center",
        }}>
            <Text style={{ fontSize: 11, color: "#888", fontWeight: "600" }}>{label}</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color, marginTop: 2 }}>{value}</Text>
        </View>
    );
}
