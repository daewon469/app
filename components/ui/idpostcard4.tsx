import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    SafeAreaView,
    Text as RNText,
    View,
} from "react-native";
import { Card } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getSession } from "@/utils/session";
import { Auth, type Post } from "../../lib/api";
import BusinessIddPicker from "../BusinessIdPicker";

import { KAKAO_MAP_JS_KEY } from "@/constants/keys";
import ScrollNavigator from "../ScrollNavigator";
import NaverMap from "./navermap";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  post: Post;
};

// 전화번호 포맷(02/1588 포함) - write4.tsx와 동일 규칙
const formatPhone = (value?: string | null) => {
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

export default function IdPostCard4({ post }: Props) {
  const [showBizModal, setShowBizModal] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(
    () => ({ contentHeight, layoutHeight }),
    [contentHeight, layoutHeight]
  );

  // 수정 권한: (관리자) 또는 (작성자 본인)
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s.isLogin || !s.username) {
        setMe(null);
        setIsAdmin(false);
        return;
      }
      setMe(s.username);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!me) {
        setIsAdmin(false);
        return;
      }
      try {
        const res = await Auth.getMyPageSummary(me);
        setIsAdmin(res.status === 0 && !!res.admin_acknowledged);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [me]);

  useEffect(() => {
    const author = (post as any)?.author?.username
      ? String((post as any).author.username)
      : null;
    const ok = !!me && (isAdmin || (!!author && me === author));
    setCanEdit(ok);
  }, [me, isAdmin, post]);

  const ACTION_BAR_HEIGHT = 56;
  const actionBarHeight = canEdit ? ACTION_BAR_HEIGHT + insets.bottom : 0;

  // 제스처(스크롤) 동작에 따라 하단 "수정" 액션바를 노출/숨김
  const [showActionBar, setShowActionBar] = useState(false);
  const lastScrollYRef = useRef(0);
  const draggingRef = useRef(false);
  const actionBarTranslateY = useRef(new Animated.Value(actionBarHeight)).current;
  const hideActionBarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = {
    // write4.tsx와 동일 톤
    background: "#fff",
    card: "#fff",
    text: "#000",
    border: "#000",
    primary: "#4A6CF7",
    subText: "#666",
    badge: "#eef2ff",
  };

  const cardBase = {
    marginHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  const sectionCard = {
    marginHorizontal: 10,
    marginTop: 10,

    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  const createdAtText = post.created_at
    ? new Date(post.created_at).toLocaleString("ko-KR")
    : undefined;

  // 액션바 높이가 바뀌면(권한 로드/인셋) 숨김 위치를 동기화
  useEffect(() => {
    if (!showActionBar) actionBarTranslateY.setValue(actionBarHeight);
  }, [actionBarHeight, showActionBar, actionBarTranslateY]);

  const animateActionBar = useCallback(
    (nextVisible: boolean) => {
      Animated.timing(actionBarTranslateY, {
        toValue: nextVisible ? 0 : actionBarHeight,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [actionBarTranslateY, actionBarHeight]
  );

  useEffect(() => {
    animateActionBar(showActionBar);
  }, [animateActionBar, showActionBar]);

  useEffect(() => {
    return () => {
      if (hideActionBarTimerRef.current) clearTimeout(hideActionBarTimerRef.current);
    };
  }, []);

  const isNearBottom = useCallback((e: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = e?.nativeEvent ?? {};
    const y = Number(contentOffset?.y ?? 0);
    const h = Number(layoutMeasurement?.height ?? 0);
    const ch = Number(contentSize?.height ?? 0);
    return y + h >= ch - 24;
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    draggingRef.current = true;
    if (hideActionBarTimerRef.current) {
      clearTimeout(hideActionBarTimerRef.current);
      hideActionBarTimerRef.current = null;
    }
  }, []);

  const onScrollEndDrag = useCallback(
    (e: any) => {
      draggingRef.current = false;
      if (isNearBottom(e)) {
        setShowActionBar(true);
        return;
      }
      if (hideActionBarTimerRef.current) clearTimeout(hideActionBarTimerRef.current);
      hideActionBarTimerRef.current = setTimeout(() => {
        setShowActionBar(false);
      }, 1200);
    },
    [isNearBottom]
  );

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      if (isNearBottom(e)) {
        setShowActionBar(true);
        return;
      }
      if (hideActionBarTimerRef.current) clearTimeout(hideActionBarTimerRef.current);
      hideActionBarTimerRef.current = setTimeout(() => {
        setShowActionBar(false);
      }, 1200);
    },
    [isNearBottom]
  );

  const onScroll = useCallback(
    (e: any) => {
      const y = Number(e?.nativeEvent?.contentOffset?.y ?? 0);
      const prev = lastScrollYRef.current;
      lastScrollYRef.current = y;

      if (isNearBottom(e)) {
        if (!showActionBar) setShowActionBar(true);
        return;
      }

      if (!draggingRef.current) return;

      const dy = y - prev;
      if (dy < -4) {
        if (!showActionBar) setShowActionBar(true);
        if (hideActionBarTimerRef.current) {
          clearTimeout(hideActionBarTimerRef.current);
          hideActionBarTimerRef.current = null;
        }
      }
      if (dy > 6) {
        if (showActionBar) setShowActionBar(false);
      }
    },
    [isNearBottom, showActionBar]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 120 + actionBarHeight }}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: onScroll,
        })}
        scrollEventThrottle={16}
      >
        <Card
          mode="elevated"
          style={{
            marginHorizontal: 10,
            marginTop: 10,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden", // ⭐ 핵심
          }}
        >
          {/* 1️⃣ 저자 + 날짜 */}
          {(post.author?.username || createdAtText) && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  fontSize: 15,
                  color: colors.text,
                }}
              >
                {post.author?.username ?? "광고"}
              </Text>

              {createdAtText && (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.subText,
                  }}
                >
                  {createdAtText}
                </Text>
              )}
            </View>
          )}

          {post.image_url && <DynamicImage uri={post.image_url} />}

          {/* 3️⃣ 제목 + 현장 한마디 */}
          <View style={{ padding: 16 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "bold",
                color: colors.text,
                lineHeight: 30,
                marginBottom: post.highlight_content ? 6 : 0,
              }}
            >
              {post.title}
            </Text>

            {post.highlight_content && (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.primary,
                }}
              >
                {post.highlight_content}
              </Text>
            )}
          </View>
        </Card>

        <Card mode="elevated" style={{
          marginHorizontal: 10,
          marginTop: 10,
          borderRadius: 8,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Card.Content>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: colors.text,
                marginBottom: 12,
              }}
            >
              광고 정보
            </Text>

            {/* 상호명 */}
            {post.company_agency && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                상호명 : {post.company_agency}
              </Text>
            )}

            {/* 담당자 */}
            {post.agent && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                담당자 : {post.agent}
              </Text>
            )}

            {/* 연락처 */}
            {post.agency_call && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                연락처 : {formatPhone(post.agency_call)}
              </Text>
            )}

            {/* 업무 */}
            {post.job_industry && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                업무 분류 : {post.job_industry}
              </Text>
            )}

            {/* 업무1*/}
            {post.item1_use && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                업무1 : {post.item1_sup}
              </Text>
            )}

            {/* 업무2*/}
            {post.item2_use && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                업무2 : {post.item2_sup}
              </Text>
            )}

            {/* 업무3*/}
            {post.item3_use && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                업무3 : {post.item3_sup}
              </Text>
            )}

            {/* 업무4*/}
            {post.item4_use && (
              <Text
                style={{
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                업무4 : {post.item4_sup}
              </Text>
            )}

          </Card.Content>
        </Card>

        {/* 상세 내용 */}
        <Card mode="elevated" style={{ ...sectionCard }}>
          <Card.Content>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 12,
              }}
            >
              상세 내용
            </Text>
            <Text style={{ color: colors.text, lineHeight: 22, fontSize: 16, }}>
              {post.content}
            </Text>
          </Card.Content>
        </Card>


        {/* 사업지 주소 (광고 상세도 현장 상세와 동일 레이아웃) */}
        <View
          style={{
            marginHorizontal: 10,
            marginTop: 10,
            borderRadius: 8,
            backgroundColor: colors.card,
            borderWidth: 1,
            marginBottom: 10,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              marginBottom: -10,
              fontWeight: "bold",
              fontSize: 18,
              paddingHorizontal: 16,
              marginTop: 16,
              color: colors.text,
            }}
          >
            사업지 주소
          </Text>

          <NaverMap
            title=""
            placeholder="사업지 주소"
            address={post.business_address}
            lat={post.business_lat}
            lng={post.business_lng}
            under={2}
            onOpenModal={() => setShowBizModal(true)}
          />
        </View>

        <BusinessIddPicker
          visible={showBizModal}
          onClose={() => setShowBizModal(false)}
          clientId={KAKAO_MAP_JS_KEY}
          initial={{
            address: post.business_address || "",
            lat: post.business_lat,
            lng: post.business_lng,
            zoom: 15,
          }}
        />
      </Animated.ScrollView>

      {/* 커스텀 스크롤(우측 스크롤바 + 상/하 이동 버튼) - ScrollView 밖에서 고정 */}
      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        onBottom={() =>
          scrollRef.current?.scrollTo({
            y: Math.max(Math.ceil(contentHeight - layoutHeight), 0),
            animated: true,
          })
        }
        bottomOffset={actionBarHeight + 8}
        topOffset={0}
        trackOpacity={0.22}
        thumbOpacity={0.9}
        thumbColor="#FF0000"
        barWidth={4}
        showButtons={true}
      />

      {/* 하단 액션바: 제스처 동작에 따라 "수정" 노출 */}
      {canEdit ? (
        <Animated.View
          pointerEvents={showActionBar ? "auto" : "none"}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: actionBarHeight,
            paddingBottom: insets.bottom,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: "#000",
            paddingHorizontal: 12,
            justifyContent: "center",
            transform: [{ translateY: actionBarTranslateY }],
          }}
        >
          <Pressable
            onPress={() => router.push({ pathname: "/write4", params: { id: String(post.id) } })}
            style={({ pressed }) => ({
              width: "100%",
              height: 40,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#000",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "white", fontWeight: "800", letterSpacing: 2, fontSize: 16 }}>
              수  정
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}
function DynamicImage({ uri }: { uri: string }) {
  const [height, setHeight] = useState(200);

  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => {
        const screenWidth = Dimensions.get("window").width;
        const cardHorizontalMargin = 10 * 2; // Card marginHorizontal
        const cardWidth = screenWidth - cardHorizontalMargin;

        const scale = cardWidth / width;
        setHeight(height * scale);
      },
      () => {
        // 실패 시 fallback
        setHeight(200);
      }
    );
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={{
        width: "100%",
        height,
      }}
    />
  );
}




