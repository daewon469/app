import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text as RNText, View } from "react-native";
import { AdminUsers } from "../lib/api";
import { getUserGradeLabel } from "../utils/userGrade";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

function formatKstToMinute(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);

    // 가능하면 IANA timezone으로 안전하게 처리
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // sv-SE는 "YYYY-MM-DD HH:mm" 형태가 안정적
    return fmt.format(d).replace("T", " ");
  } catch {
    // Intl/timeZone 미지원 환경 대비(UTC 기준 +9시간으로 처리)
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
    } catch {
      return String(iso);
    }
  }
}

function formatNumberWithComma(value: unknown): string {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return String(value ?? "-");
  return new Intl.NumberFormat("ko-KR").format(n);
}

function formatListPreview(items: string[], maxItems = 6): string {
  const arr = (items || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (arr.length === 0) return "-";
  const head = arr.slice(0, maxItems).join(", ");
  if (arr.length <= maxItems) return head;
  return `${head} 외 ${arr.length - maxItems}개`;
}

function formatKoreanPhone(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;

  // 서울(02) 예외 처리
  if (digits.startsWith("02")) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // 일반 휴대폰(010 등)
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;

  return raw;
}

export default function AdminUserDetailReadonlyScreen() {
  const { target, actor } = useLocalSearchParams<{ target?: string; actor?: string }>();

  const colors = useMemo(
    () => ({
      background: "#fff",
      card: "#fff",
      text: "#111",
      subText: "#666",
      border: "#000",
      primary: "#4A6CF7",
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!target || !actor) {
      Alert.alert("오류", "파라미터가 올바르지 않습니다.");
      router.back();
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await AdminUsers.getDetail(String(target), String(actor));
        if (res.status === 3) {
          Alert.alert("권한 없음", "권한이 없습니다.");
          router.back();
          return;
        }
        if (res.status !== 0) {
          Alert.alert("오류", "회원 정보를 불러올 수 없습니다.");
          router.back();
          return;
        }
        setData(res);
      } finally {
        setLoading(false);
      }
    })();
  }, [target, actor]);

  const user = data?.user ?? null;
  const restrictions: { post_type: number; restricted_until: string | null }[] = Array.isArray(data?.restrictions)
    ? data.restrictions
    : [];
  const referredItems: Array<{
    id: number;
    referred_username: string;
    referred_referral_code?: string | null;
    created_at: string | null;
  }> = Array.isArray(data?.referred_items) ? data.referred_items : [];
  const postItems = (data?.post_items ?? null) as
    | {
        type1: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
        type3: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
        type4: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
      }
    | null;

  const referredByLabel = useMemo(() => {
    const name = String(user?.referred_by_username ?? "").trim();
    if (name) return name;
    const id = user?.referred_by_user_id;
    if (typeof id === "number" && Number.isFinite(id)) return `ID ${id}`;
    return "-";
  }, [user?.referred_by_username, user?.referred_by_user_id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>회원 열람</Text>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
          <Text style={{ fontWeight: "900", color: colors.primary }}>닫기</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: colors.subText }}>불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <Card title="기본 정보">
            <Row label="닉네임" value={String(user?.nickname ?? target ?? "")} />
            <Row label="가입일" value={user?.signup_date ?? "-"} />
            <Row label="등급" value={getUserGradeLabel(user?.user_grade ?? -1)} />
            <Row label="휴대폰" value={formatKoreanPhone(user?.phone_number ?? "")} />
            <Row label="오너 여부" value={(user?.is_owner ?? false) ? "여" : "부"} />
            <Row label="관리자 여부" value={(user?.admin_acknowledged ?? false) ? "여" : "부"} />
          </Card>

          <Card title="잔액">
            <Row label="포인트" value={formatNumberWithComma(user?.point_balance ?? 0)} />
            <Row label="캐시" value={formatNumberWithComma(user?.cash_balance ?? 0)} />
          </Card>

          <Card title="추천">
            <Row label="추천인코드" value={String(user?.referral_code ?? "-")} />
            <Row label="추천한 사람" value={referredByLabel} />
            <Row label="추천인 수" value={`${formatNumberWithComma(user?.referral_count ?? 0)}명`} />
          </Card>

          <Card title="제재(작성 제한)">
            {restrictions.length === 0 ? (
              <Text style={{ color: colors.subText }}>설정된 제재가 없습니다.</Text>
            ) : (
              restrictions.map((r, idx) => (
                <View
                  key={`${r.post_type}-${idx}`}
                  style={{
                    paddingVertical: 10,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: "rgba(0,0,0,0.12)",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: colors.text }}>
                    {r.post_type === 1 ? "구인글" : r.post_type === 3 ? "수다글" : r.post_type === 4 ? "광고글" : `post_type ${r.post_type}`}
                  </Text>
                  <Text style={{ marginTop: 4, color: colors.subText }}>
                    제한기간: {formatKstToMinute(r.restricted_until)}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <Card title="작성 글(읽기 전용)">
            <PostSection
              title="구인글"
              items={postItems?.type1 ?? []}
            />
            <PostSection
              title="수다글"
              items={postItems?.type3 ?? []}
            />
            <PostSection
              title="광고글"
              items={postItems?.type4 ?? []}
            />
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#000",
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "900", marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: "rgba(0,0,0,0.7)", fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: "#111", fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

function PostSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontWeight: "900", color: "#111" }}>{title}</Text>
      {items.length === 0 ? (
        <Text style={{ marginTop: 6, color: "rgba(0,0,0,0.6)" }}>글이 없습니다.</Text>
      ) : (
        items.map((p) => (
          <Pressable
            key={String(p.id)}
            onPress={() => router.push({ pathname: "/[id]", params: { id: String(p.id) } })}
            style={{
              marginTop: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              borderRadius: 12,
              backgroundColor: "#fff",
            }}
          >
            <Text numberOfLines={1} style={{ fontWeight: "900", color: "#111" }}>
              {p.title || "(제목 없음)"}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
              #{p.id} · {p.created_at ?? "-"} {p.status ? `· ${p.status}` : ""}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

