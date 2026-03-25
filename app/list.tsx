// app/list.tsx
import { KAKAO_MAP_JS_KEY } from "@/constants/keys";
import type { RootState } from "@/store";
import { setRegions, type Province } from "@/store/regionSlice";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { Image as ExpoImage } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, FlatList, Image, Linking, Modal, Platform, Pressable, RefreshControl, Text as RNText, Share, ToastAndroid, TouchableOpacity, useWindowDimensions, View, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import CustomFilterModal, { type CustomFilterValue } from "../components/customfilter";
import CustomRegionMultiSelectModal, { type RegionObj } from "../components/CustomRegionMultiSelectModal";
import MapMaker from "../components/MapMaker";
import ScrollNavigator from "../components/ScrollNavigator";
import BottomBar from "../components/ui/BottomBar";
import NewsPreviewSection from "../components/ui/newspreview";
import PostCard from "../components/ui/postcard";
import PostCard2 from "../components/ui/postcard2";
import PostCard3 from "../components/ui/postcard3";
import { Auth, Points, Posts, resolveMediaUrl, UIConfig, type Post, type UIConfigBannerItem } from "../lib/api";
import { isReferralModalAction, isReferralModalLinkUrl, normalizeBannerClickAction } from "../lib/ui_banner_actions";
import { getSession } from "../utils/session";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

// 첫화면 체감 성능 최적화:
// - 기본은 333개로 시작
// - 맞춤필터 활성 시에도 동일한 333개 기준으로 로드
const PAGE_SIZE = 333;
const FILTER_PAGE_SIZE = 333;
const MAP_PAGE_SIZE = 500;
const MAP_CHUNK_SIZE = 100;
const PREFETCH_TRIGGER_PX = 2200;
const PREFETCH_CHECK_INTERVAL_MS = 180;
const LONG_LIST_THRESHOLD = 700;
// 출석체크(출첵) 버튼/팝업 강제 노출 스위치
// - 서버 출석 상태(미출석/출석완료)와 무관하게 버튼을 항상 보이게 합니다.
// - 배포 전에는 false로 되돌리세요.
const FORCE_ATTENDANCE_CTA = false; 
// 관리자 설정 팝업(UIConfig.popup) 임시 강제 노출 스위치
// - "오늘 다시 보지 않기"를 눌러도 무조건 다시 노출합니다(날짜 체크 무시).
// - 배포 전에는 false로 되돌리세요.
const FORCE_UI_POPUP = false;

const toProvinceShort = (name?: string) => {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  if (raw === "전체" || raw === "전국") return "전체";

  // API/DB에 "서울시", "서울특별시", "서울" 등 포맷이 혼재될 수 있어 공통 축약으로 정규화
  let short = raw.replace(/\s+/g, "");
  short = short
    .replace(/특별시|광역시|특별자치시|특별자치도|자치시|자치도|도/g, "")
    .replace(/시$/, "");
  short = short.replace(/^충청/, "충").replace(/^경상/, "경").replace(/^전라/, "전");
  return short.trim();
};

const normalizeProvinceShort = (name?: string) => toProvinceShort(name);

// 파란띠 표시용: 한 글자씩 띄워쓰기 (예: "경기" -> "경 기")
// - 기존 공백은 유지하되, 과도한 연속 공백은 1개로 정리합니다.
const spreadLabel = (s: string) => (s || "")
  .split("")
  .join(" ")
  .replace(/\s+/g, " ")
  .trim();

// 맞춤.JPG 스타일 "표" 지역(복수) 빠른 선택 옵션 (상단 파란띠 아래 노출)
// - 서버/DB/기존 지역모달과 동일하게 축약형(서울/경기/충북...)을 사용합니다.
const QUICK_REGION_OPTIONS = [
  "전국",
  "서울",
  "경기",
  "인천",
  "강원",
  "제주",
  "부산",
  "울산",
  "대구",
  "광주",
  "대전",
  "세종",
  "경남",
  "경북",
  "전남",
  "전북",
  "충남",
  "충북",
] as const;

function TableGrid<T extends string>({
  items,
  columns,
  isActive,
  onToggle,
}: {
  items: readonly T[];
  columns: number;
  isActive: (v: T) => boolean;
  onToggle: (v: T) => void;
}) {
  const GRID_BORDER_WIDTH = 1;
  const GRID_BORDER_COLOR = "#000";

  const rows = Math.max(1, Math.ceil(items.length / columns));
  const rowSlices = Array.from({ length: rows }, (_, i) =>
    items.slice(i * columns, i * columns + columns)
  );

  return (
    <View
      style={{
        marginTop: 6,
        borderWidth: GRID_BORDER_WIDTH,
        borderColor: GRID_BORDER_COLOR,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {rowSlices.map((slice, rowIdx) => (
        <View key={`row-${rowIdx}`}>
          {(() => {
            const lastRow = rowIdx === rowSlices.length - 1;
            return (
          <View style={{ flexDirection: "row" }}>
            {Array.from({ length: columns }, (_, colIdx) => {
              const v = slice[colIdx];
              const lastCol = colIdx === columns - 1;
              const borderBottomWidth = lastRow ? 0 : GRID_BORDER_WIDTH;

              if (!v) {
                return (
                  <View
                    key={`empty-${rowIdx}-${colIdx}`}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRightWidth: lastCol ? 0 : GRID_BORDER_WIDTH,
                      borderRightColor: GRID_BORDER_COLOR,
                      borderBottomWidth,
                      borderBottomColor: GRID_BORDER_COLOR,
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                );
              }

              const active = isActive(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => onToggle(v)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? "#2F6BFF" : "#FFFFFF",
                    borderRightWidth: lastCol ? 0 : GRID_BORDER_WIDTH,
                    borderRightColor: GRID_BORDER_COLOR,
                    borderBottomWidth,
                    borderBottomColor: GRID_BORDER_COLOR,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={{
                      fontWeight: "900",
                      color: active ? "#FFFFFF" : "#111",
                      fontSize: 13,
                      includeFontPadding: false,
                    }}
                  >
                    {v}
                  </Text>
                </Pressable>
              );
            })}
          </View>
            );
          })()}
        </View>
      ))}
    </View>
  );
}

// 서버/DB는 province를 "경기/서울/충북" 같은 축약형으로 저장/필터링하는 경우가 있어
// 지역검색 쿼리 전송 시 축약형으로 normalize 합니다.
const normalizeProvinceForServer = (province?: string) => {
  const short = toProvinceShort(province);
  if (!short || short === "전체") return undefined;
  return short;
};

const regionToCode = (r: { province: string; city: string }) => {
  const p = normalizeProvinceForServer(r?.province) ?? "";
  const c = (r?.city || "").trim() || "전체";
  if (!p || p === "전체") return "전체";
  return c === "전체" ? p : `${p} ${c}`;
};

// RegionSelectModal의 축약형을 Redux의 전체명으로 변환
const convertShortToFullProvince = (short: string): Province => {
  const map: Record<string, Province> = {
    전체: "전체",
    서울: "서울특별시",
    경기: "경기도",
    인천: "인천광역시",
    강원: "강원특별자치도",
    충북: "충청북도",
    충남: "충청남도",
    대전: "대전광역시",
    세종: "세종특별자치시",
    경북: "경상북도",
    경남: "경상남도",
    부산: "부산광역시",
    대구: "대구광역시",
    전북: "전북특별자치도",
    전남: "전라남도",
    광주: "광주광역시",
    울산: "울산광역시",
    제주: "제주특별자치도",
  };
  return map[short] || "전체";
};

const toLocalYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const DEFAULT_SYMBOL_FONT_FAMILY = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: undefined,
});

function OutlinedText({
  text,
  containerStyle,
  textStyle,
  outlineColor = "#000",
  outlineWidth = 1,
}: {
  text: string;
  containerStyle?: ViewStyle;
  textStyle: TextStyle;
  outlineColor?: string;
  outlineWidth?: number;
}) {
  const outlineStyle: TextStyle = {
    ...(textStyle as TextStyle),
    position: "absolute",
    left: 0,
    top: 0,
    color: outlineColor,
  };

  const dx = outlineWidth;
  const dy = outlineWidth;

  return (
    <View style={[{ position: "relative" }, containerStyle]}>
      <Text style={[outlineStyle, { transform: [{ translateX: -dx }, { translateY: 0 }] }]}>
        {text}
      </Text>
      <Text style={[outlineStyle, { transform: [{ translateX: dx }, { translateY: 0 }] }]}>
        {text}
      </Text>
      <Text style={[outlineStyle, { transform: [{ translateX: 0 }, { translateY: -dy }] }]}>
        {text}
      </Text>
      <Text style={[outlineStyle, { transform: [{ translateX: 0 }, { translateY: dy }] }]}>
        {text}
      </Text>
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

export default function Postlist() {
  const { width: windowWidth } = useWindowDimensions();
  const dispatch = useDispatch();
  const { openMap, openRegion } = useLocalSearchParams<{ openMap?: string; openRegion?: string }>();
  const insets = useSafeAreaInsets();
  const IS_IOS = Platform.OS === "ios";
  const didInitMapFromParamRef = useRef(false);
  const prevUiPopupEnabledRef = useRef<boolean | null>(null);
  const prevUiPopupImageUrlRef = useRef<string | null>(null);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const [storedIsLogin, setStoredIsLogin] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Post[]>([]);
  // "맞춤 보기" 임시 필터(저장 X)
  const [customFilterVisible, setCustomFilterVisible] = useState(false);
  const [customFilter, setCustomFilter] = useState<CustomFilterValue>({
    provinces: [],
    industries: [],
    roles: [],
  });
  const resetCustomFilter = useCallback(() => {
    setCustomFilter({ provinces: [], industries: [], roles: [] });
  }, []);
  const isCustomViewActive = useMemo(() => {
    const f = customFilter || { provinces: [], industries: [], roles: [] };
    const provs = (f.provinces || []).map((s) => String(s ?? "").trim()).filter(Boolean);
    const inds = (f.industries || []).map((s) => String(s ?? "").trim()).filter(Boolean);
    const roles = (f.roles || []).map((s) => String(s ?? "").trim()).filter(Boolean);
    const hasProvFilter = provs.length > 0 && !provs.includes("전체");
    const hasIndFilter = inds.length > 0;
    const hasRoleFilter = roles.length > 0;
    return hasProvFilter || hasIndFilter || hasRoleFilter;
  }, [customFilter]);
  // 지도검색(오버레이)은 지역검색 필터와 무관하게 항상 "전국" 데이터로 렌더링
  const [mapItems, setMapItems] = useState<Post[]>([]);
  const mapLoadingRef = useRef(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [pageCursors, setPageCursors] = useState<Map<number, string>>(new Map()); // 페이지별 cursor 저장
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);
  const { selectedProvince, selectedCity, selectedRegions } = useSelector(
    (s: RootState) => s.region
  );
  const isNationwide = useMemo(
    () => (selectedRegions || []).some((r) => r.province === "전체"),
    [selectedRegions]
  );
  const selectedProvinceShortsForQuickTable = useMemo(() => {
    const regs = (selectedRegions || []).filter((r) => r.province !== "전체");
    const shorts = regs.map((r) => convertRegionName(r.province));
    return Array.from(new Set(shorts));
  }, [selectedRegions]);

  const toggleQuickRegion = useCallback(
    (label: (typeof QUICK_REGION_OPTIONS)[number]) => {
      // "전국"은 Redux의 "전체"로 매핑
      if (label === "전국") {
        dispatch(setRegions([{ province: "전체", city: "전체" }]));
        return;
      }

      // 지역보기 설정 시: 맞춤보기 필터는 해제
      resetCustomFilter();

      const full = convertShortToFullProvince(label);
      const regs = (selectedRegions || []).filter((r) => r.province !== "전체");
      const sameProv = regs.filter((r) => r.province === full);

      // 동작 규칙:
      // - 미선택: 해당 시/도를 "전체"로 추가
      // - 선택(시/군/구만): 해당 시/도를 "전체" 1개로 승격
      // - 선택(이미 전체): 해당 시/도 전체 해제
      if (sameProv.length === 0) {
        dispatch(setRegions([...regs, { province: full, city: "전체" }]));
        return;
      }
      if (sameProv.some((r) => (r.city || "전체") === "전체")) {
        const next = regs.filter((r) => r.province !== full);
        // 모두 해제되면 전국(전체)로 normalize
        dispatch(next.length === 0 ? setRegions([{ province: "전체", city: "전체" }]) : setRegions(next));
        return;
      }
      const others = regs.filter((r) => r.province !== full);
      dispatch(setRegions([...others, { province: full, city: "전체" }]));
    },
    [dispatch, resetCustomFilter, selectedRegions]
  );
  const selectedRegionsKey = useMemo(() => {
    const list = selectedRegions || [];
    return list.map((r) => `${r.province}__${r.city}`).join("|");
  }, [selectedRegions]);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const selectedRegionsForModal = useMemo<RegionObj[]>(() => {
    // store는 정식명(서울특별시 등) → 모달은 축약형(서울 등)
    const list =
      selectedRegions && selectedRegions.length > 0
        ? selectedRegions
        : [{ province: selectedProvince, city: selectedCity }];

    if (list.some((r) => r.province === "전체")) return [{ province: "전체", city: "전체" }];
    return list.map((r) => ({
      province: convertRegionName(r.province),
      city: r.city || "전체",
    }));
  }, [selectedProvince, selectedCity, selectedRegions]);
  const applyRegionsFromModal = useCallback(
    (regions: RegionObj[]) => {
      const picked = (regions || []).filter(Boolean);
      const isApplyingNationwide =
        picked.length === 0 || picked.some((r) => String(r?.province ?? "").trim() === "전체");
      // 빈 선택/전체 선택은 전국(전체)로 normalize
      if (isApplyingNationwide) {
        dispatch(setRegions([{ province: "전체", city: "전체" }]));
        return;
      }
      // 지역보기 설정 시: 맞춤보기 필터는 해제
      resetCustomFilter();
      const mapped = picked.map((r) => ({
        province: convertShortToFullProvince(r.province),
        city: (r.city || "전체").trim() || "전체",
      }));
      dispatch(setRegions(mapped));
    },
    [dispatch, resetCustomFilter]
  );
  const BOTTOM_BAR_HEIGHT = 61;
  const FLOATING_EXTRA_GAP = 16; // 12~20 권장
  const floatingBottom = useMemo(() => {
    if (!IS_IOS) return 0;
    // iOS: bottom = tabBarHeight + safeAreaBottom + extraGap
    return BOTTOM_BAR_HEIGHT + (insets?.bottom ?? 0) + FLOATING_EXTRA_GAP;
  }, [BOTTOM_BAR_HEIGHT, FLOATING_EXTRA_GAP, IS_IOS, insets?.bottom]);
  const scrollNavBottomOffset = useMemo(() => {
    // 스크롤 트랙도 iOS에서는 홈 인디케이터/탭바를 침범하지 않도록 safe area를 포함
    return BOTTOM_BAR_HEIGHT + (IS_IOS ? (insets?.bottom ?? 0) : 0) + 2;
  }, [BOTTOM_BAR_HEIGHT, IS_IOS, insets?.bottom]);
  const isScrollable = useMemo(() => contentHeight > layoutHeight + 20, [contentHeight, layoutHeight]);
  const [mapSearchOpen, setMapSearchOpen] = useState(false);
  const [mapSelectedPostId, setMapSelectedPostId] = useState<string | null>(null);
  // 지도검색 진입 시 디폴트는 "모델하우스 기준"
  const [mapMarkerMode, setMapMarkerMode] = useState<"business" | "workplace">("workplace");
  const mapViewRef = useRef<{ lat: number; lng: number; level: number } | null>(null);
  const getRestoreViewState = useCallback(() => mapViewRef.current, []);
  const onMapStateChange = useCallback((s: { lat: number; lng: number; level: number }) => {
    mapViewRef.current = s;
  }, []);
  const [loading, setLoading] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);
  const lastBackPressed = useRef<number>(0);
  const [uiConfig, setUiConfig] = useState<{
    banner: {
      enabled: boolean;
      interval_posts: number;
      items: UIConfigBannerItem[];
      height?: number;
      resize_mode?: "contain" | "cover" | "stretch";
    };
    top_banner?: {
      enabled: boolean;
      items: UIConfigBannerItem[];
      height?: number;
      resize_mode?: "contain" | "cover" | "stretch";
    };
    popup: {
      enabled: boolean;
      image_url: string | null;
      link_url: string | null;
      width_percent?: number;
      height?: number;
      resize_mode?: "contain" | "cover" | "stretch";
    };
  } | null>(null);
  const [uiConfigLoaded, setUiConfigLoaded] = useState(false);
  const [uiPopupVisible, setUiPopupVisible] = useState(false);
  const [referralModalVisible, setReferralModalVisible] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [attendanceCtaVisible, setAttendanceCtaVisible] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSupported, setAttendanceSupported] = useState(true);
  const [attendanceAmount, setAttendanceAmount] = useState(200);
  const [attendanceEffectVisible, setAttendanceEffectVisible] = useState(false);
  const [attendancePopTextVisible, setAttendancePopTextVisible] = useState(false);
  const attendanceBtnScale = useRef(new Animated.Value(1)).current;
  const attendanceRingScale = useRef(new Animated.Value(0.2)).current;
  const attendanceRingOpacity = useRef(new Animated.Value(0)).current;
  const attendancePopY = useRef(new Animated.Value(0)).current;
  const attendancePopOpacity = useRef(new Animated.Value(0)).current;
  // 세로 티커: 한 줄을 "정중앙"에 안정적으로 배치하려면
  // Text에 lineHeight/height를 직접 강제하기보다, 고정 높이 래퍼(View) + justifyContent:center가 안정적입니다.
  // 상단에서 위로 올라가는 텍스트(세로 티커) 글씨 크기 조절은 여기만 변경하면 됩니다.
  // 파란띠(지역검색 안내 문구) 글씨체(크기)와 통일
  const BLUE_STRIP_FONT_SIZE = 15;
  // 파란띠 높이(요청): 전 화면 통일
  const BLUE_STRIP_HEIGHT = 22;
  const BLUE_STRIP_LINE_HEIGHT = Math.ceil(BLUE_STRIP_FONT_SIZE * 1.25);
  // 파란띠(Text) 스타일 통일(기준: "전체지역 보기")
  const BLUE_STRIP_TEXT_STYLE = {
    fontSize: BLUE_STRIP_FONT_SIZE,
    lineHeight: BLUE_STRIP_LINE_HEIGHT,
    color: "#FFFFFF",
    fontWeight: "800" as const,
    textAlign: "center" as const,
    zIndex: 2,
    includeFontPadding: false,
  };
  // 전국검색 파란띠 티커 문구만 예외로 왼쪽 정렬
  const BLUE_STRIP_TICKER_TEXT_STYLE = {
    ...BLUE_STRIP_TEXT_STYLE,
    textAlign: "left" as const,
  };
  // 티커 레이아웃(높이/이동량)은 파란띠 높이에 맞춰 고정
  const TICKER_FONT_SIZE = BLUE_STRIP_FONT_SIZE;
  const TICKER_HEIGHT = BLUE_STRIP_HEIGHT;
  // 첫 화면 파란 띠(세로 티커) 속도 조절
  // - transition(이동 시간): 텍스트가 위로 올라가는 속도
  // - dwell(머무는 시간): 한 줄이 화면에 "서있는" 시간
  // JS 타이머(setInterval/setTimeout)는 간헐적으로 타이밍이 어긋나
  // 빈 프레임처럼 보일 수 있어, 네이티브 드라이버 루프(Animated.loop)로 운용합니다.
  const TICKER_TRANSITION_MS = 3500;
  const TICKER_DWELL_MS = 4500;
  const tickerY = useRef(new Animated.Value(0)).current;
  const tickerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const tickerLines = useMemo(
    () => [
      "포인트는 유료전환 시 캐시처럼 사용됩니다.",
      "추천인 인맥 100명 달성 시 1,000,000p 지급.",
    ],
    []
  );
  // 티커는 "두 문장만" 교대로 노출(빈 줄 방지)
  const tickerA = tickerLines[0] ?? "";
  const tickerB = tickerLines[1] ?? tickerLines[0] ?? "";

  const buildTickerLoop = useCallback(() => {
    // 두 문장 교대:
    // - 0(A) -> -H(B) -> -2H(A복제) 로 "계속 위로" 올린 뒤
    // - 화면에 보이는 문장이 A일 때(복제 A), 0으로 순간 리셋하면 시각적으로 튀지 않습니다.
    if (tickerLines.length <= 1) return null;

    const steps: Animated.CompositeAnimation[] = [
      // 시작 상태 보정
      Animated.timing(tickerY, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
      // A 머무른 뒤 B로 올라감
      Animated.timing(tickerY, {
        toValue: -TICKER_HEIGHT,
        duration: TICKER_TRANSITION_MS,
        delay: TICKER_DWELL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // B 머무른 뒤 A(복제)로 한 번 더 위로 올라감
      Animated.timing(tickerY, {
        toValue: -TICKER_HEIGHT * 2,
        duration: TICKER_TRANSITION_MS,
        delay: TICKER_DWELL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // A(복제)가 보이는 상태에서 0으로 순간 리셋(내용 동일이라 튀지 않음)
      Animated.timing(tickerY, {
        toValue: 0,
        duration: 0,
        delay: TICKER_DWELL_MS,
        useNativeDriver: true,
      }),
    ];

    return Animated.loop(Animated.sequence(steps));
  }, [tickerLines.length, tickerY, TICKER_HEIGHT, TICKER_TRANSITION_MS, TICKER_DWELL_MS]);
  useFocusEffect(
    useCallback(() => {
      // 로그인 상태는 isLogin 기준으로만 유지 (토큰/Redux 기반 판정 X)
      let alive = true;
      (async () => {
        const s = await getSession();
        if (!alive) return;
        setStoredIsLogin(s.isLogin);
        setUsername(s.username ?? undefined);
      })();

      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        const now = Date.now();

        // 지도검색 오버레이가 열려있으면 먼저 닫기
        if (mapSearchOpen) {
          setMapSearchOpen(false);
          setMapSelectedPostId(null);
          return true;
        }

        // 2초 안에 두 번이면 종료
        if (now - lastBackPressed.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPressed.current = now;

        // 첫 번째는 안내 토스트
        ToastAndroid.showWithGravity(
          "두 번 누르면 종료됩니다.",
          ToastAndroid.SHORT,
          ToastAndroid.BOTTOM
        );

        return true; // 기본 뒤로가기 막기
      });

      return () => {
        alive = false;
        sub.remove();
      };
    }, [mapSearchOpen])
  );
  const colors = {
    background: "#fff",
    card: "#f9f9f9",
    text: "#000",
    border: "#ddd",
    primary: "#4A6CF7",
    link: "blue",
  };
  // 세션 복원(자동로그인)은 isLogin/username 기준으로만 동작합니다.

  // 외부 화면(맞춤현장/관심현장 등)에서 "지도검색" 버튼으로 진입 시
  // /list?openMap=1 형태로 들어오면 지도검색 오버레이를 자동으로 엽니다.
  useEffect(() => {
    if (didInitMapFromParamRef.current) return;
    const shouldOpen =
      openMap === "1" || openMap === "true" || openMap === "yes";
    if (!shouldOpen) return;
    didInitMapFromParamRef.current = true;
    setMapSearchOpen(true);
  }, [openMap]);

  const shouldAutoOpenRegion = useMemo(() => {
    return (
      openRegion === "1" || openRegion === "true" || openRegion === "yes"
    );
  }, [openRegion]);

  const loadNationwideForMap = useCallback(async () => {
    if (mapLoadingRef.current) return;
    mapLoadingRef.current = true;
    setMapLoading(true);
    try {
      // 500개를 한 번에 가져오면 응답이 커져 타임아웃/실패 가능성이 있어
      // 100개씩 커서 페이징으로 누적 로드합니다.
      setMapItems([]);
      let nextCursor: string | undefined = undefined;
      let loaded = 0;
      while (loaded < MAP_PAGE_SIZE) {
        const { items: chunk = [], next_cursor } = await Posts.list({
          username,
          cursor: nextCursor,
          status: "published",
          limit: Math.min(MAP_CHUNK_SIZE, MAP_PAGE_SIZE - loaded),
          // 지역 파라미터(province/city/regions)를 주지 않으면 서버에서 전국으로 조회됩니다.
        });

        if (!chunk || chunk.length === 0) break;
        loaded += chunk.length;
        nextCursor = next_cursor;

        // id 기준 중복 제거하며 누적
        setMapItems((prev) => {
          const byId = new Map<number, Post>();
          [...prev, ...chunk].forEach((p) => byId.set(p.id, p));
          return Array.from(byId.values());
        });

        if (!nextCursor) break;
      }
    } catch (e) {
      console.warn("지도검색(전국) 로드 실패:", e);
      setMapItems([]);
    } finally {
      mapLoadingRef.current = false;
      setMapLoading(false);
    }
  }, [username]);

  // 지도검색이 열릴 때마다 "전국" 데이터를 로드(지역검색 선택과 무관)
  useEffect(() => {
    if (!mapSearchOpen) return;
    if (mapItems.length > 0) return;
    loadNationwideForMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSearchOpen, loadNationwideForMap]);

  // 지도검색에서 마커가 0개면 모드 자동 전환(사업지/근무지 좌표 중 있는 쪽)
  const markerCounts = useMemo(() => {
    const business = (mapItems || []).filter((p) => p.business_lat && p.business_lng).length;
    const workplace = (mapItems || []).filter((p) => p.workplace_lat && p.workplace_lng).length;
    return { business, workplace };
  }, [mapItems]);

  useEffect(() => {
    if (!mapSearchOpen) return;
    if (mapMarkerMode === "business" && markerCounts.business === 0 && markerCounts.workplace > 0) {
      setMapMarkerMode("workplace");
      return;
    }
    if (mapMarkerMode === "workplace" && markerCounts.workplace === 0 && markerCounts.business > 0) {
      setMapMarkerMode("business");
    }
  }, [mapSearchOpen, mapMarkerMode, markerCounts.business, markerCounts.workplace]);

  const INSTALL_URL = "https://play.google.com/store/apps/details?id=com.smartgauge.bunyangpro";

  const buildReferralMessage = useCallback(
    (code: string | null) => {
      const codeText = (String(code ?? "52330").trim() || "52330");
      return `분양프로 설치 링크
${INSTALL_URL}

내 추천인코드: ${codeText}

안녕하세요! (__) (^.^)

<분양프로>는 분양상담사 구인구직에 최적화된 어플입니다.

무료로 구인등록 하시고, 다양한 포인트 혜택도 누려보세요!

지금 '플레이스토어'에서 <분양프로>를 다운 받아보세요^^
`;
    },
    []
  );

  const handleRecommendKakao = useCallback(async () => {
    try {
      await Share.share({ message: buildReferralMessage(referralCode) });
    } catch (e) {
      Alert.alert("오류", "공유를 실행할 수 없습니다.");
    } finally {
      setReferralModalVisible(false);
    }
  }, [Alert, Share, buildReferralMessage, referralCode]);

  const handleRecommendSms = useCallback(async () => {
    try {
      const body = encodeURIComponent(buildReferralMessage(referralCode));
      const url = Platform.OS === "ios" ? `sms:&body=${body}` : `sms:?body=${body}`;
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("오류", "문자 앱을 열 수 없습니다.");
    } finally {
      setReferralModalVisible(false);
    }
  }, [Alert, Linking, Platform, buildReferralMessage, referralCode]);

  const handleCopyReferralMessage = useCallback(async () => {
    const message = buildReferralMessage(referralCode);
    try {
      await Clipboard.setStringAsync(message);
      Alert.alert("복사 완료", "추천 문구가 클립보드에 복사되었습니다.");
    } catch (e) {
      Alert.alert("오류", "추천 문구 복사에 실패했습니다.");
    }
  }, [Alert, buildReferralMessage, referralCode]);

  const handleOpenKakaoOpenChat = useCallback(async () => {
    const url = "https://open.kakao.com/o/gWwAD7bi";
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("오류", "해당 링크를 열 수 없습니다.");
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("오류", "링크를 열 수 없습니다.");
    }
  }, [Alert, Linking]);

  const openReferralModalFromBanner = useCallback(async () => {
    if (!storedIsLogin || !username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (referralLoading) return;

    // 이미 조회된 코드가 있으면 바로 모달
    if (referralCode) {
      setReferralModalVisible(true);
      return;
    }

    try {
      setReferralLoading(true);
      const res = await Auth.getMyPageSummary(String(username));
      const code = (res as any)?.referral_code ?? null;
      setReferralCode(String(code ?? "52330").trim() || "52330");
      setReferralModalVisible(true);
    } catch (e) {
      // 조회 실패 시에도 추천하기는 가능하도록 기본 코드로 열어줍니다.
      setReferralCode("52330");
      setReferralModalVisible(true);
    } finally {
      setReferralLoading(false);
    }
  }, [storedIsLogin, username, referralLoading, referralCode]);

  const syncAttendanceCta = useCallback(async () => {
    // 강제 노출 모드: 서버 상태와 무관하게 출첵 버튼을 보여줌
    if (FORCE_ATTENDANCE_CTA) {
      const s = await getSession();
      if (!s.isLogin || !s.username) {
        setAttendanceCtaVisible(false);
        return;
      }
      setAttendanceSupported(true);
      setAttendanceAmount(200);
      setAttendanceCtaVisible(true);
      return;
    }
    // 로그인 상태가 아니면 버튼을 숨김 (오늘 미출석 여부를 안정적으로 판별 불가)
    // - storedIsLogin이 stale일 수 있어, SecureStore 세션을 한 번 더 확인합니다.
    const s = await getSession();
    if (!s.isLogin || !s.username) {
      setAttendanceCtaVisible(false);
      return;
    }

    try {
      setAttendanceLoading(true);
      const res = await Points.attendanceStatus(String(s.username));

      if (res?.status === 0) {
        const claimed = Boolean(res.claimed);
        setAttendanceAmount(res.amount ?? 200);
        setAttendanceSupported(true);
        setAttendanceCtaVisible(!claimed);
        return;
      }

      // 상태 코드가 애매하면 우선 버튼은 노출(서버가 최종 방어)
      setAttendanceSupported(true);
      setAttendanceCtaVisible(true);
    } catch (e) {
      const status = (e as any)?.response?.status;
      if (status === 404) {
        setAttendanceSupported(false);
        setAttendanceCtaVisible(false);
        return;
      }
      // 네트워크 실패 시에는 버튼을 보여주되, 누르면 서버가 막아줌
      setAttendanceSupported(true);
      setAttendanceCtaVisible(true);
    } finally {
      setAttendanceLoading(false);
    }
  }, [storedIsLogin, username]);

  // 홈 화면 포커스/로그인 정보 변경 시 출석 버튼 노출 여부 동기화
  useFocusEffect(
    useCallback(() => {
      syncAttendanceCta();
      return undefined;
    }, [syncAttendanceCta])
  );

  useEffect(() => {
    setCursor(undefined);
    setPageCursors(new Map());
    setItems([]);
  }, [selectedRegionsKey]);

  // 서버 UI 설정 로드 (배너/팝업)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setUiConfigLoaded(false);
      (async () => {
        try {
          const res = await UIConfig.get();
          if (!alive) return;
          if (res?.status === 0) {
            setUiConfig(res.config);
          }
        } catch {
          // ignore
        } finally {
          if (!alive) return;
          setUiConfigLoaded(true);
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  // 관리자 팝업 "오늘 다시 보지 않기" 초기화 규칙
  // - 팝업을 비활성(OFF)하면: 오늘 숨김 상태를 지워서, 다시 ON 했을 때 즉시 다시 뜨게 함
  // - 이미지가 바뀌면: 새로운 팝업으로 판단하여 오늘 숨김 상태를 지움
  useEffect(() => {
    const enabled = uiConfig?.popup?.enabled;
    const imageUrl = uiConfig?.popup?.image_url ?? null;

    const prevEnabled = prevUiPopupEnabledRef.current;
    const prevImageUrl = prevUiPopupImageUrlRef.current;

    prevUiPopupEnabledRef.current = typeof enabled === "boolean" ? enabled : null;
    prevUiPopupImageUrlRef.current = imageUrl;

    // uiConfig가 아직 없으면 스킵
    if (typeof enabled !== "boolean") return;

    // OFF로 바뀌는 순간(또는 이미 OFF인 상태로 첫 로드)에는 숨김 플래그를 삭제
    if (enabled === false) {
      (async () => {
        try {
          await SecureStore.deleteItemAsync("uiPopupDontShowDate");
        } catch {
          // ignore
        }
      })();
      return;
    }

    // 이미지가 변경되면(새 팝업) 오늘 숨김 플래그 삭제
    if (prevImageUrl && imageUrl && prevImageUrl !== imageUrl) {
      (async () => {
        try {
          await SecureStore.deleteItemAsync("uiPopupDontShowDate");
        } catch {
          // ignore
        }
      })();
      return;
    }

    // OFF -> ON 전환이면 숨김 플래그 삭제 (같은 날 재노출 보장)
    if (prevEnabled === false && enabled === true) {
      (async () => {
        try {
          await SecureStore.deleteItemAsync("uiPopupDontShowDate");
        } catch {
          // ignore
        }
      })();
    }
  }, [uiConfig?.popup?.enabled, uiConfig?.popup?.image_url]);

  // 팝업(관리자 설정) 노출: 로컬 기준 하루 1회
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const cfg = uiConfig?.popup;
          if (!cfg?.enabled) return;
          if (!cfg?.image_url) return;

          // 임시 강제 노출: "오늘 다시 보지 않기" 무시
          if (FORCE_UI_POPUP) {
            if (!alive) return;
            setUiPopupVisible(true);
            return;
          }

          const today = toLocalYmd(new Date());
          const dontShowDate = await SecureStore.getItemAsync("uiPopupDontShowDate");
          if (!alive) return;
          if (dontShowDate === today) return;
          setUiPopupVisible(true);
        } catch {
          // ignore
        }
      })();
      return () => {
        alive = false;
      };
    }, [uiConfig?.popup?.enabled, uiConfig?.popup?.image_url])
  );

  const playAttendancePressEffect = useCallback(() => {
    setAttendancePopTextVisible(false);
    setAttendanceEffectVisible(true);

    attendanceRingScale.setValue(0.25);
    attendanceRingOpacity.setValue(0.85);
    attendancePopOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(attendanceRingScale, {
        toValue: 1.35,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(attendanceRingOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 성공 이펙트(팝 텍스트)가 이어서 실행되면 여기서 끄지 않음
      setAttendanceEffectVisible(false);
    });
  }, [attendanceRingOpacity, attendanceRingScale, attendancePopOpacity]);

  const playAttendanceEffect = useCallback((amount: number) => {
    setAttendanceAmount(amount);
    setAttendancePopTextVisible(true);
    setAttendanceEffectVisible(true);

    attendanceRingScale.setValue(0.2);
    attendanceRingOpacity.setValue(0.9);
    attendancePopY.setValue(0);
    attendancePopOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(attendanceRingScale, {
        toValue: 1.6,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(attendanceRingOpacity, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(attendancePopY, {
        toValue: -26,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(attendancePopOpacity, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAttendanceEffectVisible(false);
      setAttendancePopTextVisible(false);
    });
  }, [attendancePopOpacity, attendancePopY, attendanceRingOpacity, attendanceRingScale]);

  const onPressAttendanceCta = useCallback(async () => {
    if (!attendanceSupported) return;
    // 버튼 클릭 시점 기준으로 SecureStore 세션을 다시 확인(최신 로그인 상태 보장)
    const s = await getSession();
    if (!s.isLogin || !s.username) {
      Alert.alert("알림", "로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (attendanceLoading) return;

    // 누르는 순간 바로 이펙트(링) 표시
    playAttendancePressEffect();

    Animated.sequence([
      Animated.timing(attendanceBtnScale, {
        toValue: 0.94,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(attendanceBtnScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      setAttendanceLoading(true);
      const res = await Points.attendanceClaim(String(s.username));
      if (res?.status === 0) {
        const amount = res.amount ?? 200;
        setAttendanceCtaVisible(false);
        playAttendanceEffect(amount);
        Alert.alert("출석체크 완료", `포인트 ${amount}점이 지급되었습니다.`);
        return;
      }
      if (res?.status === 2) {
        setAttendanceCtaVisible(false);
        Alert.alert("알림", "오늘은 이미 출석체크를 완료했습니다.");
        return;
      }
      Alert.alert("오류", "출석체크 처리에 실패했습니다.");
    } catch (e) {
      const status = (e as any)?.response?.status;
      if (status === 404) {
        setAttendanceSupported(false);
        setAttendanceCtaVisible(false);
        Alert.alert("안내", "출석체크 기능이 서버에 아직 반영되지 않았습니다. (서버 업데이트 필요)");
        return;
      }
      if (status === 401) {
        Alert.alert("알림", "로그인이 필요합니다.");
        router.push("/login");
        return;
      }
      Alert.alert("오류", "출석체크 처리에 실패했습니다.");
    } finally {
      setAttendanceLoading(false);
    }
  }, [
    attendanceBtnScale,
    attendanceLoading,
    attendanceSupported,
    playAttendancePressEffect,
    playAttendanceEffect,
    storedIsLogin,
    username,
  ]);

  const load = useCallback(
    async (pageNum: number, reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);

      try {
        // 서버 측 지역 필터링 사용 (단일/복수 지원)
        let province: string | undefined = undefined;
        let city: string | undefined = undefined;
        let regions: string | undefined = undefined;

        const regs = (selectedRegions || []).filter(Boolean);
        const nationwide = regs.some((r) => r.province === "전체");
        if (!nationwide && regs.length > 0) {
          if (regs.length === 1) {
            // Redux에는 "경기도/서울특별시" 같은 정식명이 들어올 수 있어
            // 서버에는 "경기/서울" 축약형으로 전송
            province = normalizeProvinceForServer(regs[0].province);
            city = regs[0].city === "전체" ? undefined : regs[0].city;
          } else {
            regions = regs.map(regionToCode).filter(Boolean).join(",");
          }
        }

        // 페이지별 cursor 가져오기
        let pageCursor: string | undefined = undefined;
        if (pageNum > 1) {
          // 이전 페이지들의 cursor를 순차적으로 사용하여 현재 페이지까지 이동
          // 단순화: 첫 페이지부터 순차적으로 로드
          const prevCursor = pageCursors.get(pageNum - 1);
          if (prevCursor) {
            pageCursor = prevCursor;
          } else {
            // 이전 페이지의 데이터가 없으면 첫 페이지부터 로드
            pageCursor = undefined;
          }
        }

        const requestLimit = isCustomViewActive ? FILTER_PAGE_SIZE : PAGE_SIZE;
        const { items: fetchedItems = [], next_cursor } = await Posts.list({
          username,
          cursor: reset ? undefined : pageCursor,
          status: "published",
          limit: requestLimit,
          province,
          city,
          regions,
        });

        // 서버가 next_cursor를 "항상" 내려주는 경우가 있어서,
        // 실제로 다음 페이지가 존재하는지(=limit 만큼 꽉 찼는지)로 보정합니다.
        const effectiveNextCursor =
          fetchedItems.length >= requestLimit ? next_cursor : undefined;

        if (reset || pageNum === 1) {
          setItems(fetchedItems);
          setPageCursors(new Map());
          if (effectiveNextCursor) {
            setPageCursors(new Map([[1, effectiveNextCursor]]));
          }
        } else {
          // 기존 아이템에 추가
          setItems((prev) => [...prev, ...fetchedItems]);
          if (effectiveNextCursor) {
            setPageCursors((prev) => new Map(prev).set(pageNum, effectiveNextCursor));
          }
        }
        setCursor(effectiveNextCursor);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [selectedRegionsKey, selectedRegions, username, pageCursors, isCustomViewActive]
  );

  // 무한스크롤: 다음 cursor가 있으면 다음 페이지를 이어서 로드
  const hasNextPage = !!cursor;
  const pendingNextPageRef = useRef<number | null>(null);
  const lastPrefetchCheckAtRef = useRef(0);
  const requestNextPage = useCallback(async () => {
    if (!hasNextPage) return false;
    if (loadingRef.current) return false;
    const nextPageNum = pageCursors.size + 1; // 1부터 순차 로드
    if (pendingNextPageRef.current === nextPageNum) return false;
    pendingNextPageRef.current = nextPageNum;
    try {
      await load(nextPageNum, false);
      return true;
    } finally {
      if (pendingNextPageRef.current === nextPageNum) {
        pendingNextPageRef.current = null;
      }
    }
  }, [hasNextPage, load, pageCursors.size]);
  const loadMore = useCallback(async () => {
    if (!hasNextPage) return;
    if (loadingRef.current) return;
    await requestNextPage();
  }, [hasNextPage, requestNextPage]);
  const maybePrefetchNextPage = useCallback(
    (evt: any) => {
      if (!hasNextPage) return;
      if (loadingRef.current) return;
      const now = Date.now();
      if (now - lastPrefetchCheckAtRef.current < PREFETCH_CHECK_INTERVAL_MS) return;
      lastPrefetchCheckAtRef.current = now;

      const ne = evt?.nativeEvent;
      const contentHeight = Number(ne?.contentSize?.height ?? 0);
      const viewportHeight = Number(ne?.layoutMeasurement?.height ?? 0);
      const offsetY = Number(ne?.contentOffset?.y ?? 0);
      if (contentHeight <= 0 || viewportHeight <= 0) return;

      const remain = contentHeight - (offsetY + viewportHeight);
      if (remain > PREFETCH_TRIGGER_PX) return;

      // onEndReached 전에 한 박자 먼저 다음 페이지를 준비
      void requestNextPage();
    },
    [hasNextPage, requestNextPage]
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // 지도검색 오버레이가 열린 상태로 상세로 갔다가 돌아오면,
        // 목록/마커를 다시 로드하지 않아 지도 화면이 "새로고침"처럼 보이지 않게 함
        if (mapSearchOpen) return;
        setRefreshing(true);
        await load(1, true);
        setRefreshing(false);
      })();
    }, [load, mapSearchOpen])
  );

  // card_type별 정렬 (type1, type2, type3 순서)
  const orderedItemsRaw = useMemo(() => {
    if (!items || items.length === 0) {
      return [];
    }
    const type1Items = items.filter((p) => p.card_type === 1);
    const type2Items = items.filter((p) => p.card_type === 2);
    const type3Items = items.filter((p) => p.card_type === 3);
    return [...type1Items, ...type2Items, ...type3Items];
  }, [items]);

  const orderedItems = useMemo(() => {
    const f = customFilter || { provinces: [], industries: [], roles: [] };
    const provs = (f.provinces || []).map((s) => String(s ?? "").trim()).filter(Boolean);
    const inds = (f.industries || []).map((s) => String(s ?? "").trim()).filter(Boolean);
    const roles = (f.roles || []).map((s) => String(s ?? "").trim()).filter(Boolean);

    const hasProvFilter = provs.length > 0 && !provs.includes("전체");
    const hasIndFilter = inds.length > 0;
    const hasRoleFilter = roles.length > 0;

    if (!hasProvFilter && !hasIndFilter && !hasRoleFilter) return orderedItemsRaw;

    const parseRoleFlag = (v: any) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v === 1;
      const s = String(v ?? "").trim().toLowerCase();
      if (!s) return false;
      return s === "1" || s === "true" || s === "y" || s === "yes" || s === "on";
    };

    const hasRoleData = (useValue: any, feeValue: any) => {
      // write.tsx 저장 기준:
      // - *_use=true 이면 해당 모집이 선택된 것
      // - 레거시 데이터 호환: *_fee 값만 남아도 선택으로 간주
      return parseRoleFlag(useValue) || Boolean(String(feeValue ?? "").trim());
    };

    const matchRole = (p: Post) => {
      if (!hasRoleFilter) return true;
      const wants = new Set(roles);
      const hasTotal = hasRoleData((p as any).total_use, (p as any).total_fee);
      // "본부장" 필터는 write.tsx 저장 기준에 맞춰 branch_*만 본부장으로 인정
      // (hq_*는 "본부" 전용이므로 본부장 필터에서 제외)
      const hasBranchOnly = parseRoleFlag((p as any).branch_use);
      // 서버(/community/posts/custom)와 동일 기준으로 확장 매칭
      // - 팀장: 팀장(leader_use) + 팀(team_use)
      // - 팀원: 팀원(member_use) + 각개(each_use)
      const hasLeaderOrTeam =
        hasRoleData((p as any).leader_use, (p as any).leader_fee) ||
        hasRoleData((p as any).team_use, (p as any).team_fee);
      const hasMemberOrEach =
        hasRoleData((p as any).member_use, (p as any).member_fee) ||
        hasRoleData((p as any).each_use, (p as any).each_fee);
      const ok =
        (wants.has("총괄") && hasTotal) ||
        (wants.has("본부장") && hasBranchOnly) ||
        (wants.has("팀장") && hasLeaderOrTeam) ||
        (wants.has("팀원") && hasMemberOrEach) ||
        (wants.has("기타") && Boolean(String((p as any).other_role_name ?? "").trim()));
      return ok;
    };

    return (orderedItemsRaw || []).filter((p) => {
      if (hasProvFilter) {
        const sp = normalizeProvinceShort((p as any).province);
        if (!sp) return false;
        if (!provs.includes(sp)) return false;
      }
      if (hasIndFilter) {
        const indRaw = String((p as any).job_industry ?? "").trim();
        if (!indRaw) return false;
        // write.tsx는 업종을 "아파트,상가" 형태로 저장할 수 있어 CSV 분해 후 비교
        const indList = indRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (indList.length === 0) return false;
        const hasAnyIndustry = indList.some((ind) => inds.includes(ind));
        if (!hasAnyIndustry) return false;
      }
      if (!matchRole(p)) return false;
      return true;
    });
  }, [customFilter, orderedItemsRaw]);

  // 특정 위치에 서버 설정 배너를 끼워넣기 위한 리스트 데이터
  // - FlatList 가상화 때문에 renderItem에서 index 기반으로 처리하면 위치가 틀어질 수 있어
  //   data 자체를 가공해서 안정적으로 삽입합니다.
  type ListBannerItem = {
    kind: "image_banner";
    key: string;
    image_url: string;
    link_url?: string | null;
    width_px?: number | null;
    width_percent?: number;
    height?: number;
    resize_mode?: "contain" | "cover";
  };
  type ListFeedItem = Post | ListBannerItem;

  const listFeedItems = useMemo<ListFeedItem[]>(() => {
    if (!orderedItems || orderedItems.length === 0) return [];
    const bannerEnabled = Boolean(uiConfig?.banner?.enabled);
    const interval = Math.max(1, Math.min(200, Number(uiConfig?.banner?.interval_posts ?? 10) || 10));
    const bannerItems = Array.isArray(uiConfig?.banner?.items) ? uiConfig!.banner.items : [];
    const kinds = bannerEnabled ? bannerItems.filter((b) => Boolean(b?.image_url)).length : 0;

    const out: ListFeedItem[] = [];
    let postCount = 0; // 전체 글(카드 유형 포함) 카운트

    for (const p of orderedItems) {
      out.push(p);
      postCount += 1;

      // interval 개마다 배너 삽입 + 업로드된 배너 종류 수만큼 순환
      if (kinds > 0 && postCount % interval === 0) {
        const slot = ((postCount / interval - 1) % kinds + kinds) % kinds;
        const b = bannerItems.filter((x) => Boolean(x?.image_url))[slot];
        if (b?.image_url) {
          out.push({
            kind: "image_banner",
            key: `image_banner_${postCount}_${slot}`,
            image_url: b.image_url,
            link_url: (b as any)?.link_url ?? null,
            width_px: (b as any)?.width_px ?? null,
            width_percent: (b as any)?.width_percent ?? undefined,
            height: (b as any)?.height ?? undefined,
            resize_mode: ((b as any)?.resize_mode ?? undefined) as any,
          });
        }
      }
    }
    return out;
  }, [orderedItems, uiConfig]);

  const mapMarkers = useMemo(() => {
    const isBiz = mapMarkerMode === "business";
    return (mapItems || [])
      .filter((p) =>
        isBiz ? (p.business_lat && p.business_lng) : (p.workplace_lat && p.workplace_lng)
      )
      .map((p) => ({
        id: String(p.id),
        lat: (isBiz ? p.business_lat : p.workplace_lat)!,
        lng: (isBiz ? p.business_lng : p.workplace_lng)!,
        title: p.title,
        desc: (isBiz ? p.business_address : p.workplace_address) ?? "",
        selected: String(p.id) === String(mapSelectedPostId ?? ""),
      }));
  }, [mapItems, mapMarkerMode, mapSelectedPostId]);

  const mapSelectedPost = useMemo(() => {
    if (!mapSelectedPostId) return null;
    return (mapItems || []).find((p) => String(p.id) === mapSelectedPostId) ?? null;
  }, [mapItems, mapSelectedPostId]);

  const renderListCard = useCallback((post: Post) => {
    if (post.card_type === 3) return <PostCard3 post={post} />;
    // list.tsx에서는 이미지 탭으로 "확대(줌) 모달"로 연결되지 않게 처리
    if (post.card_type === 2) return <PostCard2 post={post} disableImageZoom />;
    return <PostCard post={post} disableImageZoom />;
  }, []);

  // 유형 경계선(구인글): 1유형-2유형, 2유형-3유형 사이
  const typeMeta = useMemo(() => {
    let has1 = false;
    let has2 = false;
    let has3 = false;
    let first2 = -1;
    let first3 = -1;

    for (let i = 0; i < orderedItems.length; i++) {
      const t = Number(orderedItems[i]?.card_type ?? 0);
      if (t === 1) has1 = true;
      if (t === 2) {
        has2 = true;
        if (first2 < 0) first2 = i;
      }
      if (t === 3) {
        has3 = true;
        if (first3 < 0) first3 = i;
      }
    }

    return { has1, has2, has3, first2, first3 };
  }, [orderedItems]);

  // 배너 삽입으로 FlatList index가 바뀌어도 경계선이 정확히 나오도록
  // "첫 3유형 글"을 index가 아닌 id로 추적합니다.
  const firstType3PostId = useMemo(() => {
    if (!typeMeta?.has3) return null;
    if (typeMeta.first3 < 0) return null;
    const p = orderedItems?.[typeMeta.first3];
    return p ? String((p as any).id) : null;
  }, [orderedItems, typeMeta.first3, typeMeta?.has3]);

  const blueStripMode = useMemo<"custom" | "region" | "nationwide">(() => {
    if (isCustomViewActive) return "custom";
    if (!isNationwide) return "region";
    return "nationwide";
  }, [isCustomViewActive, isNationwide]);

  useEffect(() => {
    // 전국검색일 때만 노출
    if (!isNationwide) return;
    // 맞춤보기 활성화 시에는 전국검색 티커를 숨기므로, 애니메이션도 돌리지 않음
    if (isCustomViewActive) return;

    // 진입/변경 시 위치 리셋
    tickerY.setValue(0);

    if (tickerLines.length <= 1) return;
    tickerLoopRef.current?.stop();
    tickerLoopRef.current = buildTickerLoop();
    tickerLoopRef.current?.start();

    return () => {
      tickerLoopRef.current?.stop();
      tickerLoopRef.current = null;
      tickerY.stopAnimation();
    };
  }, [isNationwide, isCustomViewActive, buildTickerLoop, tickerLines.length, tickerY]);

  const getMetrics = useCallback(() => ({
    contentHeight,
    layoutHeight,
  }), [contentHeight, layoutHeight]);

  const listKeyExtractor = useCallback((it: any) => {
    // Post(id) 또는 배너(key) 모두 고유 key 보장
    const key = it?.key ?? it?.id;
    return String(key);
  }, []);

  const renderFeedItem = useCallback(({ item }: { item: any; index: number }) => {
    if (item?.kind === "image_banner") {
      const link = String(item?.link_url ?? "").trim();
      const clickAction = normalizeBannerClickAction(item?.click_action);
      const isReferral = isReferralModalAction(clickAction) || isReferralModalLinkUrl(link);
      const hasLink = Boolean(link);
      const bannerHeight = Math.max(
        60,
        Math.min(
          260,
          Number(item?.height ?? uiConfig?.banner?.height ?? 110) || 110
        )
      );
      const bannerResizeMode = (() => {
        const rm = String(item?.resize_mode ?? (uiConfig?.banner as any)?.resize_mode ?? "contain");
        return rm === "cover" || rm === "stretch" ? rm : "contain";
      })();

      const bannerWidthPxRaw = Number((item as any)?.width_px ?? NaN);
      const hasWidthPx = Number.isFinite(bannerWidthPxRaw) && bannerWidthPxRaw > 0;
      const bannerWidthPx = hasWidthPx
        ? Math.max(120, Math.min(windowWidth - 24, bannerWidthPxRaw))
        : null;

      const bannerWidthPercent = Math.max(40, Math.min(100, Number(item?.width_percent ?? 100) || 100));
      return (
        <Pressable
          onPress={async () => {
            if (isReferral) {
              await openReferralModalFromBanner();
              return;
            }
            if (!hasLink) return;
            try {
              const ok = await Linking.canOpenURL(link);
              if (!ok) {
                Alert.alert("오류", "해당 링크를 열 수 없습니다.");
                return;
              }
              await Linking.openURL(link);
            } catch {
              Alert.alert("오류", "링크를 열 수 없습니다.");
            }
          }}
          disabled={!isReferral && !hasLink}
          style={{
            backgroundColor: "#fff",
            borderRadius: 0,
            marginBottom: 6,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#000",
            width: bannerWidthPx ?? `${bannerWidthPercent}%`,
            alignSelf: "center",
          }}
        >
          <ExpoImage
            source={{ uri: String(resolveMediaUrl(item?.image_url) ?? item?.image_url) }}
            style={{ width: "100%", height: bannerHeight, backgroundColor: "#f2f2f2" }}
            cachePolicy="memory-disk"
            contentFit={bannerResizeMode === "stretch" ? "fill" : bannerResizeMode}
          />
        </Pressable>
      );
    }

    const post = item as Post;
    const shouldShowType3Separator =
      typeMeta.has2 &&
      typeMeta.has3 &&
      firstType3PostId &&
      String((post as any).id) === String(firstType3PostId);

    return (
      <View>
        {shouldShowType3Separator ? (
          <View
            style={{
              height: 2,
              backgroundColor: "#000",
              marginVertical: 8,
              borderRadius: 2,
            }}
          />
        ) : null}

        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 15,
            marginBottom: 4,
            overflow: "hidden",
            padding: 1,
            borderWidth: 1,
            borderColor: "black",
          }}
        >
          <GuardedTouch
            enabled={!Boolean(storedIsLogin)}
            onRequireLogin={() => {
              Alert.alert("알림", "로그인이 필요합니다.");
            }}
          >
            {renderListCard(post)}
          </GuardedTouch>
        </View>
      </View>
    );
  }, [
    firstType3PostId,
    openReferralModalFromBanner,
    renderListCard,
    storedIsLogin,
    typeMeta.has2,
    typeMeta.has3,
    uiConfig?.banner,
    windowWidth,
  ]);

  const listHeaderComponent = useMemo(() => (
    <View>
      {(() => {
        if (!uiConfigLoaded) return null;
        const tb: any = (uiConfig as any)?.top_banner ?? null;
        // top_banner가 없거나(enabled가 누락) 아직 서버가 구버전일 때도,
        // 이미지가 설정되어 있으면 우선 노출되도록 기본값은 ON으로 처리합니다.
        const enabled = tb?.enabled !== false;
        const topItems = Array.isArray(tb?.items) ? tb.items.filter((x: any) => Boolean(x?.image_url)) : [];
        const slot1 = topItems[0] ?? null;
        const slot2 = topItems[1] ?? null;
        const height = Math.max(60, Math.min(260, Number(tb?.height ?? 70) || 70));
        const resizeMode = (() => {
          const rm = String(tb?.resize_mode ?? "contain");
          return rm === "cover" || rm === "stretch" ? rm : "contain";
        })();
        const renderTopBanner = (it: any) => {
          if (!enabled || !it?.image_url) return null;
          const link = String(it?.link_url ?? "").trim();
          const hasLink = Boolean(link);
          const clickAction = normalizeBannerClickAction(it?.click_action);
          const isReferral = isReferralModalAction(clickAction) || isReferralModalLinkUrl(link);
          const itemHeight = Math.max(60, Math.min(260, Number(it?.height ?? height) || height));
          const itemResizeMode = (() => {
            const rm = String(it?.resize_mode ?? resizeMode);
            return rm === "cover" || rm === "stretch" ? rm : "contain";
          })();
          const wpxRaw = Number(it?.width_px);
          const hasWidthPx = Number.isFinite(wpxRaw) && wpxRaw > 0;
          // 화면을 넘어가는 px 고정 너비는 "고정처럼" 보이므로, 현재 화면 폭에 맞춰 상한을 둡니다.
          const widthPx = hasWidthPx ? Math.max(120, Math.min(windowWidth - 24, Math.floor(wpxRaw))) : null;
          const wpRaw = Number(it?.width_percent);
          const widthPercent =
            Number.isFinite(wpRaw) && wpRaw > 0 ? Math.max(40, Math.min(100, Math.floor(wpRaw))) : 100;
          const containerWidth: any = widthPx ?? `${widthPercent}%`;
          return (
            <Pressable
              onPress={async () => {
                if (isReferral) {
                  await openReferralModalFromBanner();
                  return;
                }
                if (!hasLink) return;
                try {
                  const ok = await Linking.canOpenURL(link);
                  if (!ok) {
                    Alert.alert("오류", "해당 링크를 열 수 없습니다.");
                    return;
                  }
                  await Linking.openURL(link);
                } catch {
                  Alert.alert("오류", "링크를 열 수 없습니다.");
                }
              }}
              disabled={!isReferral && !hasLink}
              style={{
                width: containerWidth,
                alignSelf: "center",
                height: itemHeight,
                backgroundColor: "#FFF6D2",
                borderWidth: 1,
                borderColor: "black",
                zIndex: 20,
                justifyContent: "center",
                alignItems: "center",
                elevation: 4,
                shadowColor: "#000",
                borderRadius: 0,
                shadowOpacity: 0.2,
                marginBottom: 5,
                shadowRadius: 4,
                overflow: "hidden",
              }}
            >
              <ExpoImage
                source={{ uri: String(resolveMediaUrl(it.image_url) ?? it.image_url) }}
                style={{ width: "100%", height: "100%", backgroundColor: "#f2f2f2" }}
                cachePolicy="memory-disk"
                contentFit={itemResizeMode === "stretch" ? "fill" : itemResizeMode}
              />
            </Pressable>
          );
        };

        return (
          <View>
            {renderTopBanner(slot1)}
            {renderTopBanner(slot2)}
          </View>
        );
      })()}

      <NewsPreviewSection />

      {/* 분양 뉴스 카드 아래: 지역패널(항상 노출) */}
      <View style={{ paddingTop: 6, paddingBottom: 0 }}>
        <View
          style={{
            backgroundColor: "#f9f9f9",
            borderWidth: 1,
            borderColor: "#000",
            borderRadius: 14,
            paddingHorizontal: 6,
            paddingTop: 0,
            paddingBottom: 3,
            marginBottom: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 4,
              minHeight: 35,
            }}
          >
            <Text
              style={{
                color: "black",
                fontSize: 16,
                paddingLeft: 8,
                fontWeight: "600",
                lineHeight: 32,
                height: 32,
                textAlignVertical: "center",
                includeFontPadding: false,
              }}
            >
              지역 보기
            </Text>

            <Pressable
              onPress={() => setRegionModalOpen(true)}
              style={{
                height: 32,
                minHeight: 32,
                paddingHorizontal: 0,
                backgroundColor: "transparent",
                borderRadius: 0,
                borderWidth: 0,
                justifyContent: "center",
                alignItems: "center",
              }}
              hitSlop={8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginEnd: 5 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#4A6CF7",
                    marginRight: 2,
                  }}
                >
                  세부보기
                </Text>
                <Ionicons name="chevron-forward" size={16} color={"#4A6CF7"} />
              </View>
            </Pressable>
          </View>
          <View style={{ marginTop: -8 }}>
            <TableGrid
              items={QUICK_REGION_OPTIONS}
              columns={6}
              isActive={(v) =>
                v === "전국" ? isNationwide : selectedProvinceShortsForQuickTable.includes(v)
              }
              onToggle={(v) => toggleQuickRegion(v)}
            />
          </View>
        </View>
      </View>
    </View>
  ), [
    isNationwide,
    openReferralModalFromBanner,
    selectedProvinceShortsForQuickTable,
    toggleQuickRegion,
    uiConfig,
    uiConfigLoaded,
    windowWidth,
  ]);
  const isLongList = listFeedItems.length >= LONG_LIST_THRESHOLD;
  const maxToRenderPerBatch = isLongList ? 4 : 6;
  const windowSizeValue = isLongList ? 5 : 7;
  const updateCellsBatchingPeriodValue = isLongList ? 80 : 50;

  return (
    <View style={{ flex: 1 }}>
      {/* 파란띠: 맞춤보기 / 지역보기 / 전국(티커) 모드 */}
      {blueStripMode !== "nationwide" ? (
        <View
          style={{
            height: BLUE_STRIP_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 0,
            backgroundColor: "#4A6CF7",
          }}
        >
          <Text allowFontScaling={false} style={BLUE_STRIP_TEXT_STYLE}>
            {blueStripMode === "custom"
              ? "※ '맞 춤 보 기' 중 입니다."
              : "※ '지 역 보 기' 중 입니다."}
          </Text>

          {/* 우측: 지역보기/맞춤보기에서 복귀 버튼 노출(동작 동일, 텍스트만 다름) */}
          {blueStripMode === "region" || blueStripMode === "custom" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                onPress={() => {
                  // 동일 동작: 첫화면(기본)으로 복귀
                  resetCustomFilter();
                  dispatch(setRegions([{ province: "전체", city: "전체" }]));
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 0,
                  backgroundColor: "transparent",
                  borderWidth: 0,
                  borderRadius: 0,
                  minHeight: undefined,
                  minWidth: undefined,
                  elevation: 0,
                  justifyContent: "center",
                }}
              >
                <Text allowFontScaling={false} style={BLUE_STRIP_TEXT_STYLE}>
                  {blueStripMode === "region" ? "전체지역 보기" : "첫화면 보기"}
                </Text>
              </Pressable>
            </View>
          ) : (
            // 우측 여백 유지(레이아웃 흔들림 방지)
            <View style={{ width: 86 }} />
          )}
        </View>
      ) : (
        <View
          style={{
            height: BLUE_STRIP_HEIGHT,
            position: "relative",
            backgroundColor: "#4A6CF7",
            paddingHorizontal: 16,
            paddingVertical: 0,
            justifyContent: "center",
          }}
        >
          {/* 세로 티커 영역 */}
          <View
            style={{
              flex: 1,
              height: TICKER_HEIGHT,
              overflow: "hidden",
              // 내부(2줄) 컨텐츠를 중앙정렬하면 두 줄이 한 줄 영역에 "겹쳐" 보일 수 있어
              // 상단 정렬로 고정합니다.
              justifyContent: "flex-start",
            }}
          >
            <Animated.View
              style={{
                transform: [{ translateY: tickerY }],
              }}
            >
              <View>
                <View style={{ height: TICKER_HEIGHT, justifyContent: "center" }}>
                  <Text
                    allowFontScaling={false}
                    style={BLUE_STRIP_TICKER_TEXT_STYLE}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    ※ {tickerA}
                  </Text>
                </View>
                <View style={{ height: TICKER_HEIGHT, justifyContent: "center" }}>
                  <Text
                    allowFontScaling={false}
                    style={BLUE_STRIP_TICKER_TEXT_STYLE}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    ※ {tickerB}
                  </Text>
                </View>
                {/* A를 한 번 더 복제해서 (B -> A) 전환도 위로 올라가며 자연스럽게 보이도록 함 */}
                <View style={{ height: TICKER_HEIGHT, justifyContent: "center" }}>
                  <Text
                    allowFontScaling={false}
                    style={BLUE_STRIP_TICKER_TEXT_STYLE}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    ※ {tickerA}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      )}

      <CustomRegionMultiSelectModal
        visible={regionModalOpen}
        presentation="modal"
        cardBorderWidth={1}
        cardBorderColor={"#000"}
        onClose={() => setRegionModalOpen(false)}
        selectedRegions={selectedRegionsForModal}
        onApply={(vals) => applyRegionsFromModal(vals)}
        titleText="지역 세부보기 (복수선택 가능)"
        applyButtonText="보기"
      />

      <FlatList
        onContentSizeChange={(_, h) => {
          // 소수점/반올림 오차로 maxScroll이 1~2px 부족해지는 문제 방지
          // contentHeight는 올림 처리해서 "바닥"에 정확히 닿도록 보정
          setContentHeight(Math.ceil(h));
        }}

        onLayout={(e) => {
          // layoutHeight는 "실제 FlatList 레이아웃 높이" 그대로 써야
          // contentHeight - layoutHeight (=실제 스크롤 가능 범위)와 정확히 맞습니다.
          // 하단 바(BottomBar) 보정은 contentContainerStyle.paddingBottom / ScrollNavigator.bottomOffset로 처리.
          setLayoutHeight(Math.floor(e.nativeEvent.layout.height));
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "#fff", paddingHorizontal: 10, paddingTop: 3 }}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + 2 }}
        data={listFeedItems}
        ref={listRef}
        keyExtractor={listKeyExtractor}
        onEndReached={() => {
          if (!hasNextPage) return;
          if (loading) return;
          loadMore();
        }}
        onEndReachedThreshold={0.45}
        initialNumToRender={6}
        maxToRenderPerBatch={maxToRenderPerBatch}
        updateCellsBatchingPeriod={updateCellsBatchingPeriodValue}
        windowSize={windowSizeValue}
        removeClippedSubviews={Platform.OS === "android"}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: maybePrefetchNextPage,
          }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeaderComponent}
        renderItem={renderFeedItem}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setCursor(undefined);
              setPageCursors(new Map());
              setRefreshing(true);
              await load(1, true);
              setRefreshing(false);
            }}
          />
        }
        ListFooterComponent={
          loading && orderedItems.length > 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        rightOffset={0}
        onTop={() =>
          listRef.current?.scrollToOffset({
            offset: 0,
            animated: true,
          })
        }
        onBottom={() =>
          listRef.current?.scrollToOffset({
            // FlatList의 실제 최대 오프셋 = contentHeight - layoutHeight
            offset: Math.max(Math.ceil(contentHeight - layoutHeight), 0),
            animated: true,
          })
        }
        bottomOffset={scrollNavBottomOffset}
        topOffset={0}
        trackOpacity={0.6}
        thumbOpacity={1.0}
        thumbColor={"#FF0000"}
        barWidth={4}
        showButtons={!IS_IOS}
      />

      {/* iOS 우측 플로팅 버튼군(맞춤보기/출첵/스크롤 위/아래) 공통 스택:
          - bottom = tabBarHeight + safeAreaBottom + extraGap
          - 개별 버튼 bottom 하드코딩 금지 */}
      {IS_IOS && !mapSearchOpen ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: 23,
            bottom: floatingBottom,
            zIndex: 95,
            alignItems: "center",
          }}
        >
          {/* 맞춤 보기 */}
          <View style={{ marginBottom: 12 }} pointerEvents="box-none">
            <Pressable
              onPress={() => setCustomFilterVisible(true)}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#2F6BFF",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.25)",
                opacity: pressed ? 0.9 : 1,
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              })}
              accessibilityRole="button"
              accessibilityLabel="맞춤 보기"
            >
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "900",
                    fontFamily: "PlusFont1",
                    color: "#fff",
                    fontSize: 13,
                    lineHeight: 14,
                    includeFontPadding: false,
                    textShadowColor: "rgba(0,0,0,0.35)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 1,
                  }}
                >
                  맞춤
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "900",
                    fontFamily: "PlusFont1",
                    color: "#fff",
                    fontSize: 13,
                    lineHeight: 14,
                    includeFontPadding: false,
                    marginTop: 0,
                    textShadowColor: "rgba(0,0,0,0.35)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 1,
                  }}
                >
                  보기
                </Text>
              </View>
            </Pressable>
          </View>

          {/* 출석체크(출첵) */}
          {attendanceCtaVisible ? (
            <View style={{ marginBottom: 12 }} pointerEvents="box-none">
              {/* 이펙트(링 + +포인트) */}
              {attendanceEffectVisible ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: -11,
                    top: -11,
                    width: 70,
                    height: 70,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Animated.View
                    style={{
                      position: "absolute",
                      width: 58,
                      height: 58,
                      borderRadius: 29,
                      borderWidth: 3,
                      borderColor: "#FFD400",
                      opacity: attendanceRingOpacity,
                      transform: [{ scale: attendanceRingScale }],
                    }}
                  />
                  <Animated.View
                    style={{
                      transform: [{ translateY: attendancePopY }],
                      opacity: attendancePopOpacity,
                    }}
                  >
                    {attendancePopTextVisible ? (
                      <Text
                        style={{
                          fontWeight: "900",
                          color: "#FFD400",
                          textShadowColor: "rgba(0,0,0,0.4)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2,
                        }}
                      >
                        +{attendanceAmount}P
                      </Text>
                    ) : null}
                  </Animated.View>
                </View>
              ) : null}

              <Animated.View style={{ transform: [{ scale: attendanceBtnScale }] }}>
                <Pressable
                  onPress={onPressAttendanceCta}
                  disabled={!attendanceSupported || attendanceLoading}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#E53935", // 빨간 배경
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.25)",
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: "#000",
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  })}
                >
                  <View style={{ alignItems: "center" }}>
                    <OutlinedText
                      text={"출첵"}
                      outlineColor={"#000"}
                      outlineWidth={1}
                      containerStyle={{ marginLeft: -1 }}
                      textStyle={{
                        textAlign: "center",
                        fontWeight: "900",
                        fontFamily: "PlusFont1",
                        color: "#FFD400", // 노란 텍스트
                        fontSize: 14,
                        lineHeight: 15,
                        includeFontPadding: false,
                      }}
                    />
                    <OutlinedText
                      text={
                        attendanceLoading
                          ? "..."
                          : `${attendanceAmount.toLocaleString("ko-KR")}`
                      }
                      outlineColor={"#000"}
                      outlineWidth={1}
                      containerStyle={{ marginTop: 1 }}
                      textStyle={{
                        textAlign: "center",
                        fontWeight: "900",
                        fontFamily: "PlusFont1",
                        color: "#FFD400",
                        fontSize: 12,
                        lineHeight: 13,
                        includeFontPadding: false,
                      }}
                    />
                  </View>
                </Pressable>
              </Animated.View>
            </View>
          ) : null}

          {/* 스크롤 위/아래 */}
          {isScrollable ? (
            <View pointerEvents="box-none" style={{ alignItems: "center" }}>
              <Pressable
                onPress={() =>
                  listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                  })
                }
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.6)",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="맨 위로"
              >
                <Ionicons name="chevron-up" size={20} color="#111" />
              </Pressable>

              <View style={{ height: 10 }} />

              <Pressable
                onPress={() =>
                  listRef.current?.scrollToOffset({
                    offset: Math.max(Math.ceil(contentHeight - layoutHeight), 0),
                    animated: true,
                  })
                }
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.6)",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="맨 아래로"
              >
                <Ionicons name="chevron-down" size={20} color="#111" />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}



      <Modal
        visible={exitConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitConfirmVisible(false)}
      >
        {/* 배경 클릭 시 닫기(원하면 제거 가능) */}
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setExitConfirmVisible(false)}
        >
          {/* 카드 클릭은 닫히지 않게 */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "82%",
              backgroundColor: "white",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 10 }}>
              종료하시겠습니까?
            </Text>

            <Text style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
              뒤로가기를 한 번 더 누르면 앱이 종료됩니다.
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setExitConfirmVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#ddd",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700" }}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => BackHandler.exitApp()}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#4A6CF7",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "800", color: "white" }}>종료</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 관리자 설정 팝업(이미지) */}
      <Modal
        visible={uiPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUiPopupVisible(false)}
      >
        <Pressable
          onPress={() => setUiPopupVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              // 설정된 너비(%): 화면(패딩 제외) 기준
              width: Math.max(
                240,
                Math.min(
                  Math.floor((windowWidth - 32) * (Number((uiConfig?.popup as any)?.width_percent ?? 92) / 100)),
                  windowWidth - 32
                )
              ),
              borderRadius: 0,
              overflow: "hidden",
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#000",
            }}
          >
            {uiConfig?.popup?.image_url ? (
              <Pressable
                onPress={async () => {
                  const link = String(uiConfig?.popup?.link_url ?? "").trim();
                  if (!link) return;
                  try {
                    const ok = await Linking.canOpenURL(link);
                    if (!ok) {
                      Alert.alert("오류", "해당 링크를 열 수 없습니다.");
                      return;
                    }
                    await Linking.openURL(link);
                  } catch {
                    Alert.alert("오류", "링크를 열 수 없습니다.");
                  }
                }}
              >
                <Image
                  source={{ uri: String(resolveMediaUrl(uiConfig.popup.image_url) ?? uiConfig.popup.image_url) }}
                  style={{
                    width: "100%",
                    height: Math.max(200, Math.min(900, Number((uiConfig?.popup as any)?.height ?? 360) || 360)),
                    backgroundColor: "#f2f2f2",
                  }}
                  resizeMode={(() => {
                    const rm = String((uiConfig?.popup as any)?.resize_mode ?? "contain");
                    return rm === "cover" || rm === "stretch" ? rm : "contain";
                  })()}
                />
              </Pressable>
            ) : null}

            <View style={{ padding: 8, paddingTop: 6 }}>
              <Pressable
                onPress={async () => {
                  try {
                    const today = toLocalYmd(new Date());
                    await SecureStore.setItemAsync("uiPopupDontShowDate", today);
                  } catch {
                    // ignore
                  } finally {
                    setUiPopupVisible(false);
                  }
                }}
                style={{
                  width: "100%",
                  paddingVertical: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 0,
                    borderWidth: 1,
                    borderColor: "#000",
                    backgroundColor: "transparent",
                    marginRight: 8,
                  }}
                />
                <Text
                  allowFontScaling={false}
                  style={{
                    fontWeight: "700",
                    color: "#000",
                    fontSize: 14,
                  }}
                >
                  오늘 다시 보지 않기
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 추천하기 모달 (카톡/문자) - 내 페이지와 동일 동작 */}
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
                color: "#666",
                marginBottom: 12,
                lineHeight: 18,
              }}
            >
              추천인코드가 함께 전송됩니다.
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

      {/* Android: 기존 absolute 플로팅 버튼 배치 유지 (iOS는 공통 스택으로 통합) */}
      {!IS_IOS ? (
        <>
          {/* 출석체크(출첵) 플로팅 버튼: 오늘 미출석일 때만 노출 */}
          {attendanceCtaVisible && !mapSearchOpen ? (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                right: 23,
                bottom: BOTTOM_BAR_HEIGHT + 14 + 50 + 30 + 3,
                zIndex: 80,
              }}
            >
              {/* 이펙트(링 + +포인트) */}
              {attendanceEffectVisible ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: -11,
                    top: -11,
                    width: 70,
                    height: 70,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Animated.View
                    style={{
                      position: "absolute",
                      width: 58,
                      height: 58,
                      borderRadius: 29,
                      borderWidth: 3,
                      borderColor: "#FFD400",
                      opacity: attendanceRingOpacity,
                      transform: [{ scale: attendanceRingScale }],
                    }}
                  />
                  <Animated.View
                    style={{
                      transform: [{ translateY: attendancePopY }],
                      opacity: attendancePopOpacity,
                    }}
                  >
                    {attendancePopTextVisible ? (
                      <Text
                        style={{
                          fontWeight: "900",
                          color: "#FFD400",
                          textShadowColor: "rgba(0,0,0,0.4)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2,
                        }}
                      >
                        +{attendanceAmount}P
                      </Text>
                    ) : null}
                  </Animated.View>
                </View>
              ) : null}

              <Animated.View style={{ transform: [{ scale: attendanceBtnScale }] }}>
                <Pressable
                  onPress={onPressAttendanceCta}
                  disabled={!attendanceSupported || attendanceLoading}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#E53935", // 빨간 배경
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.25)",
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: "#000",
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  })}
                >
                  <View style={{ alignItems: "center" }}>
                    <OutlinedText
                      text={"출첵"}
                      outlineColor={"#000"}
                      outlineWidth={1}
                      containerStyle={{ marginLeft: -1 }}
                      textStyle={{
                        textAlign: "center",
                        fontWeight: "900",
                        fontFamily: "PlusFont1",
                        color: "#FFD400", // 노란 텍스트
                        fontSize: 14,
                        lineHeight: 15,
                        includeFontPadding: false,
                      }}
                    />
                    <OutlinedText
                      text={
                        attendanceLoading
                          ? "..."
                          : `${attendanceAmount.toLocaleString("ko-KR")}`
                      }
                      outlineColor={"#000"}
                      outlineWidth={1}
                      containerStyle={{ marginTop: 1 }}
                      textStyle={{
                        textAlign: "center",
                        fontWeight: "900",
                        fontFamily: "PlusFont1",
                        color: "#FFD400",
                        fontSize: 12,
                        lineHeight: 13,
                        includeFontPadding: false,
                      }}
                    />
                  </View>
                </Pressable>
              </Animated.View>
            </View>
          ) : null}

          {/* 맞춤 보기(임시 필터) 플로팅 버튼: 출첵 버튼 위 고정 */}
          {!mapSearchOpen ? (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                right: 23,
                bottom: BOTTOM_BAR_HEIGHT + 10 + 50 + 30 + 66,
                zIndex: 81,
              }}
            >
              <Pressable
                onPress={() => setCustomFilterVisible(true)}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#2F6BFF",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.25)",
                  opacity: pressed ? 0.9 : 1,
                  shadowColor: "#000",
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                })}
                accessibilityRole="button"
                accessibilityLabel="맞춤 보기"
              >
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      textAlign: "center",
                      fontWeight: "900",
                      fontFamily: "PlusFont1",
                      color: "#fff",
                      fontSize: 13,
                      lineHeight: 14,
                      includeFontPadding: false,
                      textShadowColor: "rgba(0,0,0,0.35)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 1,
                    }}
                  >
                    맞춤
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      fontWeight: "900",
                      fontFamily: "PlusFont1",
                      color: "#fff",
                      fontSize: 13,
                      lineHeight: 14,
                      includeFontPadding: false,
                      marginTop: 0,
                      textShadowColor: "rgba(0,0,0,0.35)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 1,
                    }}
                  >
                    보기
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      <CustomFilterModal
        visible={customFilterVisible}
        value={customFilter}
        onClose={() => setCustomFilterVisible(false)}
        onApply={(v) => {
          setCustomFilter(v);

          const provs = (v?.provinces || []).map((s) => String(s ?? "").trim()).filter(Boolean);
          const inds = (v?.industries || []).map((s) => String(s ?? "").trim()).filter(Boolean);
          const roles = (v?.roles || []).map((s) => String(s ?? "").trim()).filter(Boolean);
          const hasProvFilter = provs.length > 0 && !provs.includes("전체");
          const hasIndFilter = inds.length > 0;
          const hasRoleFilter = roles.length > 0;
          const active = hasProvFilter || hasIndFilter || hasRoleFilter;

          // 맞춤보기 설정 시: 지역보기 필터는 해제(전국)
          if (active) {
            dispatch(setRegions([{ province: "전체", city: "전체" }]));
          }
        }}
      />

      {/* 지도검색 오버레이: 상단 TopBar/하단 BottomBar를 가리지 않도록 list 화면 안에서 inline 렌더 */}
      {mapSearchOpen ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: BOTTOM_BAR_HEIGHT,
            zIndex: 50,
          }}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <MapMaker
              visible={true}
              onClose={() => {
                setMapSearchOpen(false);
                setMapSelectedPostId(null);
              }}
              presentation="inline"
              showHeader={false}
              showMarkerInfoWindow={false}
              clientId={KAKAO_MAP_JS_KEY}
              markers={mapMarkers}
              onSelectMarker={(id) => {
                setMapSelectedPostId(id);
              }}
              onMapStateChange={onMapStateChange}
              getRestoreViewState={getRestoreViewState}
            />

            {/* 전국 데이터 로딩 중 표시(지역검색 필터와 무관) */}
            {mapLoading && mapItems.length === 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 18,
                  right: 0,
                  left: 0,
                  alignItems: "center",
                  zIndex: 65,
                }}
              >
                <ActivityIndicator />
              </View>
            ) : null}

            {/* 사업지/근무지 토글: 지도 화면 위 오버레이 */}
            <View
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 60,
                flexDirection: "row",
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                backgroundColor: "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <Pressable
                onPress={() => {
                  setMapMarkerMode("workplace");
                  setMapSelectedPostId(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  backgroundColor: mapMarkerMode === "workplace" ? "#2F6BFF" : "#FFFFFF",
                }}
              >
                <Text
                  style={{
                    color: mapMarkerMode === "workplace" ? "#FFFFFF" : "#111827",
                    fontWeight: "900",
                    fontSize: 13,
                  }}
                >
                  모델하우스 기준
                </Text>
              </Pressable>

              <View style={{ width: 1, backgroundColor: "#E5E7EB" }} />

              <Pressable
                onPress={() => {
                  setMapMarkerMode("business");
                  setMapSelectedPostId(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  backgroundColor: mapMarkerMode === "business" ? "#2F6BFF" : "#FFFFFF",
                }}
              >
                <Text
                  style={{
                    color: mapMarkerMode === "business" ? "#FFFFFF" : "#111827",
                    fontWeight: "900",
                    fontSize: 13,
                  }}
                >
                  현장사업지 기준
                </Text>
              </Pressable>
            </View>

            {/* 마커 선택 시: 목록 카드 프리뷰 */}
            {mapSelectedPost ? (
              <View
                pointerEvents="box-none"
                style={{
                  position: "absolute",
                  left: 10,
                  right: 10,
                  bottom: 10,
                }}
              >
                <View
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#000",
                  }}
                >
                  {/* 목록과 동일한 카드 렌더(선택하면 상세로 이동) */}
                  {renderListCard(mapSelectedPost)}
                </View>
                <Pressable
                  onPress={() => setMapSelectedPostId(null)}
                  style={{
                    alignSelf: "flex-end",
                    marginTop: 10,
                    marginRight: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: "#2F6BFF",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>카드 닫기</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <BottomBar
        openRegionOnMount={shouldAutoOpenRegion}
        onPressRegionSearch={
          mapSearchOpen
            ? () => {
                setMapSearchOpen(false);
                setMapSelectedPostId(null);
              }
            : undefined
        }
        onToggleMapSearch={() => {
          setMapSearchOpen((prev) => {
            const next = !prev;
            if (!next) setMapSelectedPostId(null);
            return next;
          });
        }}
      />
    </View>



  );
}

function GuardedTouch({
  enabled,
  children,
  onRequireLogin,
}: {
  enabled: boolean;
  children: React.ReactNode;
  onRequireLogin?: () => void;
}) {
  return (
    <View style={{ position: "relative" }}>
      <View pointerEvents={enabled ? "none" : "auto"}>
        {children}
      </View>

      {enabled ? (
        <Pressable
          onPress={onRequireLogin}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          }}
        />
      ) : null}
    </View>
  );
}
const convertRegionName = (name: string) => {
  let short = name.replace(/특별시|광역시|특별자치시|특별자치도|도/g, "");
  short = short
    .replace(/^충청/, "충")
    .replace(/^경상/, "경")
    .replace(/^전라/, "전");

  return short;
};