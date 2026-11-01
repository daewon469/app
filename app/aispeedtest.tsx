import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Posts, type Post } from "../lib/api";
import { postToSiteAnalysisPayload, requestSiteAnalysis } from "../utils/siteAnalysis";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const VARIANTS = [
  { id: "1-1" as const, label: "1-1", detail: "5개 항목 · 각 4~5줄" },
  { id: "1-2" as const, label: "1-2", detail: "건축개요, 학군/교통, 투자가치 · 각 7~8줄" },
  { id: "1-3" as const, label: "1-3", detail: "5개 항목 · 각 7~8줄" },
];

type VariantId = (typeof VARIANTS)[number]["id"];

type ResultRow = {
  status: "idle" | "running" | "done" | "error";
  seconds?: number;
  text?: string;
  error?: string;
};

function emptyResults(): Record<VariantId, ResultRow> {
  return {
    "1-1": { status: "idle" },
    "1-2": { status: "idle" },
    "1-3": { status: "idle" },
  };
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}초`;
}

export default function AiSpeedTestScreen() {
  const insets = useSafeAreaInsets();
  const [ids, setIds] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [post, setPost] = useState<Post | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<VariantId, ResultRow>>(emptyResults);

  const loadPost = useCallback(async (id: number) => {
    setLoadingPost(true);
    setPostError(null);
    try {
      const full = await Posts.get(id);
      setPost(full);
    } catch {
      setPost(null);
      setPostError("게시글을 불러오지 못했습니다.");
    } finally {
      setLoadingPost(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPost(true);
      setPostError(null);
      try {
        const { items } = await Posts.listByType(1, { status: "published", limit: 15 });
        if (cancelled) return;
        const nextIds = items.map((item) => item.id).filter((id) => Number.isFinite(id));
        setIds(nextIds);
        setIndex(0);
        if (nextIds.length === 0) {
          setPost(null);
          setPostError("게시 중인 구인글이 없습니다.");
          setLoadingPost(false);
          return;
        }
        const full = await Posts.get(nextIds[0]);
        if (cancelled) return;
        setPost(full);
      } catch {
        if (!cancelled) {
          setPost(null);
          setPostError("게시글을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoadingPost(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickNext = () => {
    if (running || ids.length <= 1) return;
    const next = (index + 1) % ids.length;
    setIndex(next);
    setResults(emptyResults());
    void loadPost(ids[next]);
  };

  const runAll = async () => {
    if (!post || running) return;
    setRunning(true);
    setResults(emptyResults());
    const base = postToSiteAnalysisPayload(post);
    try {
      for (const variant of VARIANTS) {
        setResults((prev) => ({ ...prev, [variant.id]: { status: "running" } }));
        const started = Date.now();
        const res = await requestSiteAnalysis(
          { ...base, variant: variant.id },
          { timeout: 90_000 },
        );
        const seconds = (Date.now() - started) / 1000;
        setResults((prev) => ({
          ...prev,
          [variant.id]: res.ok
            ? { status: "done", seconds, text: res.analysis }
            : { status: "error", seconds, error: res.error },
        }));
      }
    } finally {
      setRunning(false);
    }
  };

  const title = post?.site_name?.trim() || post?.title || "";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 24 + insets.bottom,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "900", color: "#0B1B3A" }}>AI분석 테스트</Text>
     
      <View
        style={{
          borderWidth: 1,
          borderColor: "#000",
          borderRadius: 12,
          padding: 14,
          backgroundColor: "#f9f9f9",
          gap: 8,
        }}
      >
        {loadingPost ? (
          <ActivityIndicator color="#4A6CF7" />
        ) : postError ? (
          <Text style={{ color: "#c62828" }}>{postError}</Text>
        ) : (
          <>
            <Text style={{ fontSize: 12, color: "#666" }}>글 번호 {post?.id}</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#111" }}>{title}</Text>
          </>
        )}
        <Pressable
          onPress={pickNext}
          disabled={running || loadingPost || ids.length <= 1}
          style={{
            alignSelf: "flex-start",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#4A6CF7",
            opacity: running || loadingPost || ids.length <= 1 ? 0.45 : 1,
          }}
        >
          <Text style={{ color: "#4A6CF7", fontWeight: "700" }}>다른 글</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => void runAll()}
        disabled={!post || running || loadingPost}
        style={{
          backgroundColor: "#4A6CF7",
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          opacity: !post || running || loadingPost ? 0.55 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
          {running ? "측정 중" : "전체 측정"}
        </Text>
      </Pressable>

      {VARIANTS.map((variant) => {
        const row = results[variant.id];
        return (
          <View
            key={variant.id}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.15)",
              borderRadius: 12,
              padding: 14,
              backgroundColor: "#fff",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#0284c7" }}>
              {variant.label}
            </Text>
            <Text style={{ fontSize: 13, color: "#555" }}>{variant.detail}</Text>
            {row.status === "idle" ? (
              <Text style={{ color: "#888" }}>대기</Text>
            ) : null}
            {row.status === "running" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#4A6CF7" />
                <Text style={{ color: "#4A6CF7", fontWeight: "700" }}>측정 중</Text>
              </View>
            ) : null}
            {row.status === "done" || row.status === "error" ? (
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#0B1B3A" }}>
                {formatSeconds(row.seconds ?? 0)}
              </Text>
            ) : null}
            {row.status === "error" ? (
              <Text style={{ color: "#c62828" }}>{row.error}</Text>
            ) : null}
            {row.status === "done" && row.text ? (
              <Text style={{ fontSize: 15, lineHeight: 22, color: "#222" }}>{row.text}</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
