import { KAKAO_MAP_JS_KEY } from "@/constants/keys";
import { getSession } from "@/utils/session";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { ScrollView as RNScrollView } from "react-native";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  Text as RNText,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Card } from "react-native-paper";
import { Auth, type Post } from "../../lib/api";
import BusinessIddPicker from "../BusinessIdPicker";
import ScrollNavigator from "../ScrollNavigator";
import WorkIdPicker from "../workIdPicker";
import NaverMap from "./navermap";
import ZoomableImage from "./ZoomableImage";

const Text = (props: ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const screenWidth = Dimensions.get("window").width;

export default function Postcard_detail({ post }: { post: Post }) {
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [showBizModal, setShowBizModal] = useState(false);
  const [imageZoomVisible, setImageZoomVisible] = useState(false);
  const BASE_ACTION_BAR_HEIGHT = 56;
  const EDIT_ROW_HEIGHT = 46; // 40(height) + 6(gap)
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const actionBarHeight = BASE_ACTION_BAR_HEIGHT + (canEdit ? EDIT_ROW_HEIGHT : 0);
  const [showActionBar, setShowActionBar] = useState(false);
  const lastScrollYRef = useRef(0);
  const draggingRef = useRef(false);
  const actionBarTranslateY = useRef(new Animated.Value(actionBarHeight)).current;
  const hideActionBarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<RNScrollView | null>(null);
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);

  const colors = {
    background: "#fff",
    card: "#f9f9f9",
    text: "#000",
    border: "#000",
    primary: "#4A6CF7",
    link: "blue",
  };
  const valueDark = { color: "#000" } as const;

  const sectionCard = {
    borderRadius: 8,
    marginTop: 5,
    backgroundColor: colors.card,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#000",
  } as const;


  const sectionCard2 = {
    borderRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: 0,
    backgroundColor: colors.card,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#000",
  } as const;


  const label = { fontSize: 16, color: colors.text } as const;
  const sub = { color: "#000" } as const;
  const welfareItems: { label: string; value?: string }[] = [];

  const wonOrSupport = (v?: string | null) => {
    const s = String(v ?? "").trim();
    if (!s) return "지원";
    return s; // 입력값 그대로 표시
  };
  const wonOrBlank = (v?: string | null) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    return s; // 입력값 그대로 표시
  };
  const feeLineText = (v?: string | null) => {
    const s = String(v ?? "").trim();
    if (!s) return "유선문의";
    return s;
  };

  if (post.pay_use) {
    welfareItems.push({
      label: "일비",
      value: wonOrSupport(post.pay_sup),
    });
  }

  if (post.meal_use) {
    welfareItems.push({
      label: "케터링",
      value: post.meal_sup ? "지원" : "미지원",
    });
  }

  if (post.house_use) {
    welfareItems.push({
      label: "숙소",
      value: post.house_sup || "지원",
    });
  }

  if (post.item1_use && post.item1_type) {
    welfareItems.push({
      label: post.item1_type,
      // 지원1~4: 값이 비어있으면 "항목만" 표시
      value: wonOrBlank(post.item1_sup),
    });
  }

  if (post.item2_use && post.item2_type) {
    welfareItems.push({
      label: post.item2_type,
      value: wonOrBlank(post.item2_sup),
    });
  }

  if (post.item3_use && post.item3_type) {
    welfareItems.push({
      label: post.item3_type,
      value: wonOrBlank(post.item3_sup),
    });
  }

  if (post.item4_use && post.item4_type) {
    welfareItems.push({
      label: post.item4_type,
      value: wonOrBlank(post.item4_sup),
    });
  }

  const contactDigits = (post.agency_call ?? "").replace(/[^0-9]/g, "");
  const openPhone = async () => {
    if (!contactDigits) {
      alert("연락처가 없습니다.");
      return;
    }
    const url = `tel:${contactDigits}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert("전화 앱을 열 수 없습니다.");
      return;
    }
    await Linking.openURL(url);
  };

  const openSms = async () => {
    if (!contactDigits) {
      alert("연락처가 없습니다.");
      return;
    }
    const url = `sms:${contactDigits}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert("문자 앱을 열 수 없습니다.");
      return;
    }
    await Linking.openURL(url);
  };

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
      // 비로그인/닉네임 없으면 관리자 아님
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
    const author = (post as any)?.author?.username ? String((post as any).author.username) : null;
    const ok = !!me && (isAdmin || (!!author && me === author));
    setCanEdit(ok);
  }, [me, isAdmin, post]);

  // 액션바 높이가 바뀌면(권한 로드 후) 숨김 위치를 동기화
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

  // showActionBar 상태 변경 시 애니메이션 적용
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
    // 여유값(너무 정확히 바닥에 닿아야만 보이면 불편해서 24px 정도 여유)
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
      // 드래그가 끝났을 때: 바닥이 아니면 잠깐(일시적으로) 보여주고 숨김
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
      // 모멘텀 종료 시에도: 바닥이 아니면 잠깐(일시적으로) 보여주고 숨김
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

      // 맨 아래에 닿으면 항상 노출(고정)
      if (isNearBottom(e)) {
        if (!showActionBar) setShowActionBar(true);
        return;
      }

      // 손가락 스크롤 동작 중에만 처리
      if (!draggingRef.current) return;

      const dy = y - prev;
      // 내려가다가(스크롤 다운) 다시 위로 올릴 때(스크롤 업, dy<0) 하단 탭을 보이게
      if (dy < -4) {
        if (!showActionBar) setShowActionBar(true);
        if (hideActionBarTimerRef.current) {
          clearTimeout(hideActionBarTimerRef.current);
          hideActionBarTimerRef.current = null;
        }
      }
      // 스크롤 다운 중에는 방해되지 않게 숨김 (바닥 고정 노출은 위에서 처리)
      if (dy > 6) {
        if (showActionBar) setShowActionBar(false);
      }
    },
    [isNearBottom, showActionBar]
  );

  const getMetrics = useCallback(
    () => ({
      contentHeight,
      layoutHeight,
    }),
    [contentHeight, layoutHeight]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, position: "relative" }}>
      <Animated.ScrollView
        ref={scrollRef as any}
        style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}
        contentContainerStyle={{ paddingBottom: actionBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={(_, h) => setContentHeight(Math.ceil(h))}
        onLayout={(e) => setLayoutHeight(Math.floor(e.nativeEvent.layout.height))}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: onScroll,
        })}
        scrollEventThrottle={16}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
          }}
        >
            <View
              style={{
                backgroundColor: colors.card,
                padding: 12,
                borderColor: "#000",
                borderWidth: 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "600", fontSize: 15, color: colors.text }}>
                  {post.author.username}
                </Text>
                <Text style={{ fontSize: 14, ...sub }}>
                  {new Date(post.created_at).toLocaleString()}
                </Text>
              </View>
            </View>


            {post.image_url && (
              <DynamicImage
                uri={post.image_url}
                onPress={(e) => {
                  // 이미지 탭은 모달만 열기
                  setImageZoomVisible(true);
                }}
              />
            )}

            <Card mode="elevated" style={sectionCard2}>
              <Card.Content>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
                  {post.title}
                </Text>
              </Card.Content>
            </Card>

            <WorkIdPicker
              visible={showWorkModal}
              onClose={() => setShowWorkModal(false)}
              clientId={KAKAO_MAP_JS_KEY}
              initial={{
                address: post.workplace_address || "",
                lat: post.workplace_lat,
                lng: post.workplace_lng,
                zoom: 15,
              }}
            />
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

            <Card mode="elevated" style={sectionCard}>
              <Card.Content>
                <Text style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: post.highlight_color === "white" || post.highlight_color === "black" ?
                    valueDark.color : post.highlight_color
                }}>
                  {post.highlight_content}
                </Text>
              </Card.Content>
            </Card>

            {/* 업종/지역 */}
            <Card mode="elevated" style={sectionCard}>
              <Card.Content>
                <Text style={label}>
                  업종 : <Text style={valueDark}>{post.job_industry ?? "-"}</Text>
                </Text>
                <Text style={[label, { paddingTop: 15 }]}>
                  지역 : <Text style={valueDark}>{post.province} {post.city}</Text>
                </Text>
              </Card.Content>
            </Card>

            {/* 모집/금액 */}
            <Card mode="elevated" style={sectionCard}>
              <Card.Content>
                <Text style={label}>
                  모집 :{" "}
                  <Text style={valueDark}>
                    {[
                      post.total_use ? "총괄" : null,
                      post.branch_use ? "본부장" : null,
                      post.hq_use ? "본부" : null,
                      post.leader_use ? "팀장" : null,
                      post.member_use ? "팀원" : null,
                      post.team_use ? "팀" : null,
                      post.each_use ? "각개" : null,
                      post.other_role_name ? String(post.other_role_name) : null,
                    ]
                      .filter(Boolean)
                      .join("/") || "미정"}
                  </Text>
                </Text>
                {post.total_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    총괄 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.total_fee)}
                    </Text>
                  </Text>
                )}
                {/* 본부장(기존 branch_*) */}
                {post.branch_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    본부장 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.branch_fee)}
                    </Text>
                  </Text>
                )}

                {/* 본부(hq_*) */}
                {post.hq_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    본부 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.hq_fee)}
                    </Text>
                  </Text>
                )}

                {/* 팀장 */}
                {post.leader_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    팀장 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.leader_fee)}
                    </Text>
                  </Text>
                )}

                {/* 팀원 */}
                {post.member_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    팀원 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.member_fee)}
                    </Text>
                  </Text>
                )}

                {/* 팀 */}
                {post.team_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    팀 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.team_fee)}
                    </Text>
                  </Text>
                )}

                {/* 각개 */}
                {post.each_use && (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    각개 :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.each_fee)}
                    </Text>
                  </Text>
                )}

                {/* 기타(직접입력) */}
                {post.other_role_name ? (
                  <Text style={{ fontSize: 15, paddingTop: 15, color: colors.text }}>
                    {String(post.other_role_name)} :{" "}
                    <Text style={valueDark}>
                      {feeLineText(post.other_role_fee)}
                    </Text>
                  </Text>
                ) : null}

              </Card.Content>
            </Card>

            {/* 회사 정보 */}
            <Card mode="elevated" style={sectionCard}>
              <Card.Content>
                <Text style={label}>
                  시행사 : <Text style={valueDark}>{post.company_developer ?? "-"}</Text>
                </Text>
                <Text style={[label, { paddingTop: 15 }]}>
                  시공사 : <Text style={valueDark}>{post.company_constructor ?? "-"}</Text>
                </Text>
                <Text style={[label, { paddingTop: 15 }]}>
                  신탁사 : <Text style={valueDark}>{post.company_trustee ?? "-"}</Text>
                </Text>
                <Text style={[label, { paddingTop: 15 }]}>
                  대행사 : <Text style={valueDark}>{post.company_agency ?? "-"}</Text>
                </Text>
              </Card.Content>
            </Card>

            {/* 근무후생 */}
            <Card mode="elevated" style={sectionCard}>
              <Card.Content>
                {welfareItems.length === 0 ? (
                  <Text style={[label]}>
                    <Text style={valueDark}>근무후생 : 유선문의</Text>
                  </Text>
                ) : (
                  welfareItems.map((item, index) => (
                    <Text
                      key={index}
                      style={[label, { paddingTop: index === 0 ? 0 : 15 }]}
                    >
                      {item.value ? (
                        <>
                          {item.label} : <Text style={valueDark}>{item.value}</Text>
                        </>
                      ) : (
                        <Text style={valueDark}>{item.label}</Text>
                      )}
                    </Text>
                  ))
                )}
              </Card.Content>
            </Card>

            {/* 상세 내용 (본문은 라벨/값 구조가 아니라 기존 유지) */}
            <Card mode="elevated" style={sectionCard}>
              <Card.Content>
                <Text
                  style={{
                    fontSize: 16,
                    marginBottom: 0,
                    lineHeight: 30,
                    color: colors.text,
                  }}
                >
                  {post.content ? String(post.content) : ""}
                </Text>
              </Card.Content>
            </Card>

            {/* 연락처 */}
            <Card mode="elevated" style={{ ...sectionCard, borderRadius: 4, marginBottom: 5 }}>
              <Card.Content>
                <Text style={label}>
                  {post.agent} : <Text style={valueDark}>{formatPhone(post.agency_call) ?? "-"}</Text>
                </Text>
              </Card.Content>
            </Card>

            {/* 근무지 주소 */}
            <View
              style={{
                marginBottom: 5,
                borderRadius: 8,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: "#000",
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
                모델하우스 주소
              </Text>

              <NaverMap
                title=""
                placeholder="근무지 주소"
                address={post.workplace_address}
                lat={post.workplace_lat}
                lng={post.workplace_lng}
                onOpenModal={() => setShowWorkModal(true)}
              />
            </View>

            {/* 사업지 주소 */}
            <View
              style={{
                marginBottom: 5,
                borderRadius: 8,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: "#000",
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
                현장사업지 주소
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
        </View>
      </Animated.ScrollView>

      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() => scrollRef.current?.scrollTo?.({ y: 0, animated: true })}
        onBottom={() =>
          scrollRef.current?.scrollTo?.({
            y: Math.max(Math.ceil(contentHeight - layoutHeight), 0),
            animated: true,
          })
        }
        topOffset={0}
        bottomOffset={actionBarHeight + 8}
        trackOpacity={0.35}
        thumbOpacity={1}
        thumbColor="#FF0000"
        barWidth={4}
        showButtons={true}
      />

      {/* 이미지 줌(핀치) 모달 */}
      <Modal
        visible={imageZoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageZoomVisible(false)}
      >
        {/* RN Modal은 별도 루트로 렌더링되므로, 모달 내부에서 제스처가 안정적으로 잡히도록 별도 RootView로 감쌉니다. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}>
            {/* backdrop: 핀치 줌 멀티터치를 방해하지 않도록 content와 분리 */}
            <Pressable
              onPress={() => setImageZoomVisible(false)}
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            />

            {/* content (gesture-friendly) */}
            <View style={{ flex: 1, padding: 12 }}>
              <View style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
                {post.image_url ? (
                  <View style={{ flex: 1 }}>
                    <ZoomableImage uri={post.image_url} />
                    {/* 워터마크: 제스처/탭 방해 X */}
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 40,
                          lineHeight: 44,
                          fontWeight: "900",
                          color: "rgba(255,255,255,0.85)",
                          textAlign: "center",
                        
                          textShadowColor: "rgba(0,0,0,0.38)",
                          textShadowOffset: { width: 1, height: 1 },
                          textShadowRadius: 4,
                          includeFontPadding: false,
                        }}
                      >
                        {"분양\n프로"}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => setImageZoomVisible(false)}
                style={{
                  position: "absolute",
                  top: 18,
                  right: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* 스크롤해도 사라지지 않는 하단 전화/문자 버튼 */}
      <Animated.View
        pointerEvents={showActionBar ? "auto" : "none"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: actionBarHeight,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: "#000",
          paddingHorizontal: 12,
          paddingVertical: 3,
          justifyContent: "center",
          transform: [{ translateY: actionBarTranslateY }],
        }}
      >
        <View style={{ gap: 6 }}>
          {canEdit ? (
            <Pressable
              onPress={() => router.push({ pathname: "/write", params: { id: String(post.id) } })}
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
          ) : null}

          <View style={{ flexDirection: "row" }}>
            <Pressable
              onPress={openPhone}
              disabled={!contactDigits}
              style={({ pressed }) => ({
                flex: 1,
                marginRight: 8,
                height: 40,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#000",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: !contactDigits ? "#999" : "#2E7D32",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "700", letterSpacing: 2, fontSize: 16 }}>
                전  화
              </Text>
            </Pressable>

            <Pressable
              onPress={openSms}
              disabled={!contactDigits}
              style={({ pressed }) => ({
                flex: 1,
                height: 40,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#000",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: !contactDigits ? "#999" : "#1565C0",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "700", letterSpacing: 2, fontSize: 16 }}>
                문  자
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );

}

function DynamicImage({ uri, onPress }: { uri: string; onPress?: (e: any) => void }) {
  const [height, setHeight] = useState(200);
  const horizontalPadding = 10; // 
  const cardWidth = screenWidth - horizontalPadding * 2;

  useEffect(() => {
    Image.getSize(uri, (width, height) => {
      const scale = cardWidth / width; // 
      setHeight(height * scale);
    });
  }, [uri]);

  return (
    <Pressable
      onPress={onPress}
      style={{ alignSelf: "center" }}
    >
      <View
        style={{
          width: cardWidth,
          height,
          alignSelf: "center",
          position: "relative",
        }}
      >
        <Image
          source={{ uri }}
          style={{
            width: "100%",
            height: "100%",
            resizeMode: "cover",
            alignSelf: "center",
          }}
        />

        {/* 워터마크: 이미지 위에 오버레이 */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: Math.max(22, Math.floor(cardWidth * 0.09)),
              lineHeight: Math.ceil(Math.max(22, Math.floor(cardWidth * 0.09)) * 1.06),
              fontWeight: "300",
              color: "rgba(255,255,255,0.55)",
              textAlign: "center",
              textShadowColor: "rgba(0,0,0,0.38)",
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 4,
              includeFontPadding: false,
            }}
          >
            {"분양\n프로"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const formatPhone = (num?: string) => {
  if (!num) return "-";
  const digits = num.replace(/[^0-9]/g, "");

  // 대표번호(1588/1577/1566 등): 1xxx-xxxx
  if (/^1(?:5|6|8)\d{2}\d{4}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // 서울(02): 02-xxx-xxxx(9) / 02-xxxx-xxxx(10)
  if (digits.startsWith("02")) {
    if (digits.length === 9) return digits.replace(/^(02)(\d{3})(\d{4})$/, "$1-$2-$3");
    if (digits.length === 10) return digits.replace(/^(02)(\d{4})(\d{4})$/, "$1-$2-$3");
    return digits; // 길이가 애매하면 원본 숫자만 반환
  }

  // 휴대폰(01x)
  if (digits.startsWith("01")) {
    if (digits.length === 10) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
    if (digits.length === 11) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
    return digits;
  }

  // 기타 지역번호(0xx)
  if (digits.startsWith("0")) {
    if (digits.length === 10) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
    if (digits.length === 11) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
    return digits;
  }

  return digits;
};

function divideFee(str: string, divisor: number): string {
  const num = Number(str.replace(/,/g, ""));
  const result = num / divisor;
  return result.toLocaleString("ko-KR");
}
