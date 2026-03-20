import RegionSelectModal from "@/components/RegionSelectModal";
import { KAKAO_MAP_JS_KEY } from "@/constants/keys";
import { useFocusEffect } from "@react-navigation/native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text as RNText, TextInput as RNTextInput, SafeAreaView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import BusinessPicker from "../components/BusinessMapPicker";
import ScrollNavigator from "../components/ScrollNavigator";
import NaverMap from "../components/ui/navermap";
import WorkPicker from "../components/WorkMapPicker";
import { API_URL, Posts } from "../lib/api";
import { RootState } from "../store";
import { setBusinessLocation, setWorkLocation } from "../store/LocationSlice";
import { buildKakaoMapUrl } from "../utils/map";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);
type LocationSel = {
  lat: number;
  lng: number;
  address?: string;
};

function formatKstToMinute(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(d).replace("T", " ");
  } catch {
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

function normalizeRestrictionExpiryMessageToKstMinute(msg: string): string {
  // 서버(_enforce_user_post_restriction) 에러 형식:
  // "작성 제한 중입니다. post_type=1, 제한 만료: 2026-01-22T05:00:00+00:00"
  if (!msg.includes("제한 만료")) return msg;
  const m = msg.match(/제한 만료:\s*([0-9TZ:\-+.]+)\s*/);
  if (!m) return msg;
  const iso = m[1];
  const kst = formatKstToMinute(iso);
  // 보기 좋게 (UTC+9) 표기 + 초 제거(분까지만)
  return msg.replace(iso, `${kst} (한국시간)`);
}
const mobile = (value: string) => {
  // 입력 중 하이픈 자동 삽입 (02/1588 포함)
  const digits = value.replace(/[^0-9]/g, "");
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
    // 02-xxx-xxxx (총 9자리) / 02-xxxx-xxxx (총 10자리)
    if (rest.length <= 7) return `02-${rest.slice(0, 3)}-${rest.slice(3, 7)}`;
    return `02-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }

  // 휴대폰/기타 지역번호(0xx)
  const head = digits.slice(0, 3);
  const rest = digits.slice(3);
  if (digits.length <= 3) return digits;
  if (rest.length <= 3) return `${head}-${rest}`;
  // 3-3-4(10자리) / 3-4-4(11자리)
  if (rest.length <= 7) return `${head}-${rest.slice(0, 3)}-${rest.slice(3, 7)}`;
  return `${head}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
};
const comma = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatAmountInput = (value: string) => {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // 숫자/콤마만으로 구성된 경우에만 콤마 포맷팅 적용 (자유텍스트는 그대로)
  const digits = trimmed.replace(/,/g, "");
  if (/^\d+$/.test(digits)) {
    if (digits.length < 4) return digits;
    return comma(digits);
  }
  return raw;
};

// 이미지 미선택 시 기본 이미지
const DEFAULT_IMAGE = require("../assets/images/Imagedefault.png");

export default function PostWrite() {
  const dispatch = useDispatch();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { work_lat, work_lng, work_address, business_address, business_lat, business_lng } = useSelector((state: RootState) => state.location);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);
  const getMetrics = useCallback(
    () => ({ contentHeight, layoutHeight }),
    [contentHeight, layoutHeight]
  );

  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedCardType, setSelectedCardType] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // -------------------- 임시저장(휘발성) --------------------
  // - 글 작성 중 화면을 잠시 나가도(최대 5분) 입력 내용 복원
  // - 5분이 지나면 자동 폐기(삭제)
  // - 신규 작성(id 없음)에서만 동작
  const DRAFT_TTL_MS = 5 * 60 * 1000;
  const draftKeyRef = useRef<string>("draft:write");
  const draftLoadedRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [contractFee, setContractFee] = useState<string | undefined>(undefined);
  const [onetoking, setOneToking] = useState<string | undefined>(undefined);
  const [textColor, setTextColor] = useState("#111111");

  const [showWorkModal, setShowWorkModal] = useState(false);
  const [showBizModal, setShowBizModal] = useState(false);

  const [workplaceAddress, setWorkplaceAddress] = useState<string | undefined>(undefined);
  const [workplaceMapUrl, setWorkplaceMapUrl] = useState<string | undefined>(undefined);
  const [businessAddress, setBusinessAddress] = useState<string | undefined>(undefined);
  const [businessMapUrl, setBusinessMapUrl] = useState<string | undefined>(undefined);

  const [jobIndustry, setJobIndustry] = useState<string | undefined>(undefined);
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [jobCategory, setJobCategory] = useState<string | undefined>(undefined);

  const [companyDeveloper, setCompanyDeveloper] = useState<string | undefined>(undefined);
  const [companyConstructor, setCompanyConstructor] = useState<string | undefined>(undefined);
  const [companyTrustee, setCompanyTrustee] = useState<string | undefined>(undefined);
  const [companyAgency, setCompanyAgency] = useState<string | undefined>(undefined);

  const [agencyMan, setAgencyMan] = useState<string | undefined>(undefined);
  const [agencyCall, setAgencyCall] = useState<string | undefined>(undefined);

  const [paySupport, setPaySupport] = useState(false);
  const [mealSupport, setMealSupport] = useState(false);
  const [houseSupport, setHouseSupport] = useState(false);

  const INDUSTRIES = [
    "아파트/상가/오피스",
    "오피스텔/도시형생활주택/레지던스",
    "호텔/리조트/지식산업센터",
    "타운하우스/토지/기타",
  ] as const;

  const INDUSTRY_ITEMS = [
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

  // 업종 모달 사용 위한 상태
  const [industryModalVisible, setIndustryModalVisible] = useState(false);
  const [industryTempSelected, setIndustryTempSelected] = useState<Set<string>>(new Set()); // 임시 선택 저장
  const [otherIndustryName, setOtherIndustryName] = useState(""); // 업종(기타) 직접 입력

  // 모집 항목(요구사항 배치)
  // 1줄: 총괄 / 본부장 / 팀장 / 팀원
  // 2줄: 본부 / 팀 / 각개 / 기타
  const ROLES = ["총괄", "본부장", "팀장", "팀원", "본부", "팀", "각개", "기타"] as const;
  type Role = typeof ROLES[number];

  // UI 표시 라벨(버튼 텍스트)
  const roleLabel: Record<Role, string> = {
    총괄: "총괄",
    본부장: "본부장",
    팀장: "팀장",
    팀원: "팀원",
    본부: "본부",
    팀: "팀",
    각개: "각개",
    기타: "기타",
  };

const normalizeRegionValue = (province: any, city: any) => {
  const p = String(province ?? "").trim();
  const rawCity = city == null ? "" : String(city).trim();
  const c = rawCity.toLowerCase() === "null" ? "" : rawCity;
  return { province: p, city: c };
};

const formatRegionLabel = (region: { province: string; city: string } | null | undefined) => {
  const p = String(region?.province ?? "").trim();
  const c0 = String(region?.city ?? "").trim();
  const c = c0.toLowerCase() === "null" ? "" : c0;
  if (!p) return "";
  if (!c || c === "전체") return p;
  return `${p} ${c}`;
};

  // NOTE: roleValue는 현재 사용처가 없어 제거 가능

  const ROLES2 = ["일비", "케터링", "숙소", "지원1", "지원2", "지원3", "지원4"] as const;
  type Role2 = typeof ROLES2[number];

  const EXTRA_ROLES = ["지원1", "지원2", "지원3", "지원4"] as const;
  type ExtraRole = typeof EXTRA_ROLES[number];

  const [otherRoleName, setOtherRoleName] = useState("");

  const [fees2, setFees2] = useState<Record<"일비", string>>({ 일비: "" });
  const [House, setHouse] = useState<Record<"숙소", string>>({ 숙소: "" });
  const [cateringYes, setCateringYes] = useState<"예" | "아니오" | null>(null);

  const [extraSupport, setExtraSupport] = useState<
    Record<ExtraRole, { item: string; amount: string }>
  >({
    지원1: { item: "", amount: "" },
    지원2: { item: "", amount: "" },
    지원3: { item: "", amount: "" },
    지원4: { item: "", amount: "" },
  });

  // -------------------- 모집/후생 선택 상태 --------------------
  const [selected, setSelected] = useState<Set<Role>>(new Set());
  const [fees, setFees] = useState<Record<Role, string>>({
    총괄: "",
    본부장: "",
    팀장: "",
    팀원: "",
    본부: "",
    팀: "",
    각개: "",
    기타: "",
  });

  const [selected2, setSelected2] = useState<Set<Role2>>(new Set());

  const toggleRole = (role: Role) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const toggleRole2 = (role: Role2) => {
    setSelected2((prev2) => {
      const next = new Set(prev2);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  // 모집(총괄/본부장/팀장/팀원/본부/팀/각개) 수수료는 자유텍스트를 그대로 유지
  // - "기타"와 동일하게 입력값 그대로 저장/표시
  const onChangeFee = (role: Role, v: string) =>
    setFees((prev) => ({ ...prev, [role]: v }));

  const onChangeDailyFee = (v: string) =>
    // 일비는 콤마 포맷팅 없이 입력값 그대로 유지
    setFees2((prev) => ({ ...prev, 일비: v }));

  const onChangeHouse = (v: string) =>
    setHouse((prev) => ({ ...prev, 숙소: v }));

  const onChangeExtraItem = (role: ExtraRole, v: string) =>
    setExtraSupport((prev) => ({ ...prev, [role]: { ...prev[role], item: v } }));

  const onChangeExtraAmount = (role: ExtraRole, v: string) =>
    // 지원1~4 금액은 콤마 포맷팅 없이 입력값 그대로 유지
    setExtraSupport((prev) => ({ ...prev, [role]: { ...prev[role], amount: v } }));

  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{
    province: string;
    city: string;
  } | null>(null);

  const colors = {
    background: "#fff",
    card: "#fff",
    text: "#000",
    subText: "#666",
    border: "#000",
    primary: "#4A6CF7",
    link: "blue",
  };
  const inputStyle = {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
    color: colors.text,
  } as const;

  const baseColors = [
    "black", "#E11D48", "#2563EB", "#14B8A6",
    "#F97316", "#A855F7", "#71717A",
  ];
  const tokingcolors = baseColors;

  const normalizeTokingColor = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "#111111";
    const lower = raw.toLowerCase();
    // 팔레트에서 "하얀색" 제거 정책: 기존 데이터/임시저장에 남아있으면 기본색으로 치환
    if (lower === "white" || lower === "#fff" || lower === "#ffffff") return "#111111";
    return raw;
  };

  const label = { fontSize: 16, fontWeight: "bold", color: colors.text } as const;
  // 모집/근무후생(선택 후 노출되는 입력 라벨)만 파란색으로
  const blueLabel = { ...label, color: colors.primary } as const;

  const placeholder = "#666";

  const getLocalDateKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // local timezone 기준
  };

  const clearDraft = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(draftKeyRef.current);
    } catch {
      // ignore
    }
  }, []);

  const saveDraftNow = useCallback(async () => {
    if (id) return; // 수정 화면은 임시저장 미사용
    const key = draftKeyRef.current;

    // 입력이 거의 없으면 저장하지 않음(불필요한 복원 방지)
    const hasAnyData =
      Boolean(title?.trim()) ||
      Boolean(content?.trim()) ||
      Boolean(onetoking?.trim()) ||
      Boolean(imageUri) ||
      Boolean(contractFee?.trim?.()) ||
      Boolean(workplaceAddress?.trim?.()) ||
      Boolean(businessAddress?.trim?.()) ||
      Boolean(jobIndustry?.trim?.()) ||
      Boolean(jobCategory?.trim?.()) ||
      Boolean(companyDeveloper?.trim?.()) ||
      Boolean(companyConstructor?.trim?.()) ||
      Boolean(companyTrustee?.trim?.()) ||
      Boolean(companyAgency?.trim?.()) ||
      Boolean(agencyMan?.trim?.()) ||
      Boolean(agencyCall?.trim?.()) ||
      Boolean(selectedRegion?.province) ||
      Boolean(selectedRegion?.city);
    if (!hasAnyData) {
      await clearDraft();
      return;
    }

    let actor: string | null = null;
    try {
      actor = await SecureStore.getItemAsync("username");
    } catch {
      actor = null;
    }

    const payload = {
      savedAt: Date.now(),
      username: actor, // 다른 계정 로그인 시 복원 방지용
      // --- 기본 텍스트 ---
      title: title ?? "",
      content: content ?? "",
      onetoking: onetoking ?? "",
      textColor: textColor ?? "#111111",

      // --- 이미지/금액 ---
      imageUri: imageUri ?? null,
      contractFee: contractFee ?? "",

      // --- 지도/주소 ---
      workplaceAddress: workplaceAddress ?? "",
      workplaceMapUrl: workplaceMapUrl ?? "",
      businessAddress: businessAddress ?? "",
      businessMapUrl: businessMapUrl ?? "",
      // redux location(좌표)도 함께 저장(복원 시 지도로 돌아왔을 때 유지)
      work_lat: work_lat ?? null,
      work_lng: work_lng ?? null,
      work_address: work_address ?? null,
      business_lat: business_lat ?? null,
      business_lng: business_lng ?? null,

      // --- 업종/카테고리 ---
      jobIndustry: jobIndustry ?? "",
      selectedIndustries: Array.from(selectedIndustries ?? []),
      jobCategory: jobCategory ?? "",

      // --- 회사 정보 ---
      companyDeveloper: companyDeveloper ?? "",
      companyConstructor: companyConstructor ?? "",
      companyTrustee: companyTrustee ?? "",
      companyAgency: companyAgency ?? "",

      // --- 담당자 ---
      agencyMan: agencyMan ?? "",
      agencyCall: agencyCall ?? "",

      // --- 지원/후생 ---
      paySupport: !!paySupport,
      mealSupport: !!mealSupport,
      houseSupport: !!houseSupport,
      cateringYes: cateringYes ?? null,
      fees2: fees2 ?? { 일비: "" },
      house: House ?? { 숙소: "" },
      selected2: Array.from(selected2 ?? []),
      extraSupport: extraSupport ?? {},

      // --- 모집 ---
      selected: Array.from(selected ?? []),
      fees: fees ?? {},
      otherRoleName: otherRoleName ?? "",

      // --- 지역 ---
      selectedRegion: selectedRegion ?? null,
    };

    try {
      await SecureStore.setItemAsync(key, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    House,
    agencyCall,
    agencyMan,
    businessAddress,
    business_lat,
    business_lng,
    businessMapUrl,
    clearDraft,
    companyAgency,
    companyConstructor,
    companyDeveloper,
    companyTrustee,
    content,
    contractFee,
    cateringYes,
    extraSupport,
    fees,
    fees2,
    id,
    imageUri,
    jobCategory,
    jobIndustry,
    onetoking,
    otherRoleName,
    paySupport,
    mealSupport,
    houseSupport,
    selected,
    selected2,
    selectedIndustries,
    selectedRegion,
    textColor,
    title,
    work_lat,
    work_lng,
    work_address,
    workplaceAddress,
    workplaceMapUrl,
  ]);

  // 최초 진입 시: 5분 이내 임시저장 복원
  useEffect(() => {
    if (id) return; // 수정 화면은 서버 데이터만 사용
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;

    (async () => {
      try {
        const currentUser = await SecureStore.getItemAsync("username");
        const raw = await SecureStore.getItemAsync(draftKeyRef.current);
        if (!raw) return;
        const parsed = JSON.parse(raw) as any;
        const savedAt = Number(parsed?.savedAt ?? 0);
        if (!savedAt || Date.now() - savedAt > DRAFT_TTL_MS) {
          await clearDraft();
          return;
        }

        // 다른 계정으로 저장된 드래프트면 폐기
        const savedUser = parsed?.username ?? null;
        if (currentUser && savedUser && String(currentUser) !== String(savedUser)) {
          await clearDraft();
          return;
        }

        // 사용자가 이미 입력한 값이 있으면 덮어쓰지 않음(초기 진입 보호)
        if (!title && !content && !onetoking) {
          setTitle(String(parsed?.title ?? ""));
          setContent(String(parsed?.content ?? ""));
          setOneToking(String(parsed?.onetoking ?? ""));
          setTextColor(normalizeTokingColor(parsed?.textColor ?? "#111111"));

          // 이미지/금액
          setImageUri(parsed?.imageUri ?? null);
          setContractFee(String(parsed?.contractFee ?? "") || undefined);

          // 지도/주소
          setWorkplaceAddress(String(parsed?.workplaceAddress ?? "") || undefined);
          setWorkplaceMapUrl(String(parsed?.workplaceMapUrl ?? "") || undefined);
          setBusinessAddress(String(parsed?.businessAddress ?? "") || undefined);
          setBusinessMapUrl(String(parsed?.businessMapUrl ?? "") || undefined);

          // redux 좌표 복원(best-effort)
          try {
            const wl = {
              work_lat: parsed?.work_lat ?? null,
              work_lng: parsed?.work_lng ?? null,
              work_address: parsed?.work_address ?? null,
            };
            if (wl.work_lat && wl.work_lng) {
              dispatch(setWorkLocation({ lat: Number(wl.work_lat), lng: Number(wl.work_lng), address: wl.work_address || "" } as any));
            }
            const bl = {
              business_lat: parsed?.business_lat ?? null,
              business_lng: parsed?.business_lng ?? null,
              business_address: parsed?.businessAddress ?? null,
            };
            if (bl.business_lat && bl.business_lng) {
              dispatch(setBusinessLocation({ lat: Number(bl.business_lat), lng: Number(bl.business_lng), address: bl.business_address || "" } as any));
            }
          } catch {
            // ignore
          }

          // 업종/카테고리
          const inds = Array.isArray(parsed?.selectedIndustries) ? parsed.selectedIndustries.map((s: any) => String(s).trim()).filter(Boolean) : [];
          setSelectedIndustries(new Set(inds));
          setIndustryTempSelected(new Set(inds));
          setJobIndustry(String(parsed?.jobIndustry ?? "") || undefined);
          setJobCategory(String(parsed?.jobCategory ?? "") || undefined);

          // 회사 정보
          setCompanyDeveloper(String(parsed?.companyDeveloper ?? "") || undefined);
          setCompanyConstructor(String(parsed?.companyConstructor ?? "") || undefined);
          setCompanyTrustee(String(parsed?.companyTrustee ?? "") || undefined);
          setCompanyAgency(String(parsed?.companyAgency ?? "") || undefined);

          // 담당자
          setAgencyMan(String(parsed?.agencyMan ?? "") || undefined);
          setAgencyCall(String(parsed?.agencyCall ?? "") || undefined);

          // 지원/후생
          setPaySupport(!!parsed?.paySupport);
          setMealSupport(!!parsed?.mealSupport);
          setHouseSupport(!!parsed?.houseSupport);
          setCateringYes((parsed?.cateringYes === "예" || parsed?.cateringYes === "아니오") ? parsed.cateringYes : null);
          try {
            if (parsed?.fees2 && typeof parsed.fees2 === "object") setFees2(parsed.fees2);
          } catch {}
          try {
            if (parsed?.house && typeof parsed.house === "object") setHouse(parsed.house);
          } catch {}
          try {
            const s2 = Array.isArray(parsed?.selected2) ? parsed.selected2 : [];
            setSelected2(new Set(s2));
          } catch {}
          try {
            if (parsed?.extraSupport && typeof parsed.extraSupport === "object") setExtraSupport(parsed.extraSupport);
          } catch {}

          // 모집
          try {
            const s1 = Array.isArray(parsed?.selected) ? parsed.selected : [];
            setSelected(new Set(s1));
          } catch {}
          try {
            if (parsed?.fees && typeof parsed.fees === "object") setFees(parsed.fees);
          } catch {}
          setOtherRoleName(String(parsed?.otherRoleName ?? ""));

          // 지역
          const sr = parsed?.selectedRegion ?? null;
          if (sr && typeof sr === "object" && "province" in (sr as any)) {
            const next = normalizeRegionValue((sr as any).province, (sr as any).city);
            if (next.province) setSelectedRegion(next);
          }
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 입력 변경 시: 디바운스 저장(500ms)
  useEffect(() => {
    if (id) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 500);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    };
  }, [id, title, content, onetoking, textColor, saveDraftNow]);

  // 화면 이탈(언마운트) 시: 즉시 저장
  useEffect(() => {
    return () => {
      if (id) return;
      // cleanup은 async 불가 → fire-and-forget
      void saveDraftNow();
    };
  }, [id, saveDraftNow]);

  // 화면 포커스가 이동(blur)해도 즉시 저장(언마운트 되지 않는 경우 대비)
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (id) return;
        void saveDraftNow();
      };
    }, [id, saveDraftNow])
  );

  useEffect(() => {
    if (id) {
      (async () => {
        try {
          const data = await Posts.get(Number(id));
          setTitle(data.title);
          setContent(data.content);
          setSelectedCardType((Number(data.card_type) === 1 || Number(data.card_type) === 2 || Number(data.card_type) === 3) ? (Number(data.card_type) as 1 | 2 | 3) : 3);
          setContractFee(data.contract_fee ?? undefined);
          setWorkplaceAddress(data.workplace_address ?? undefined);
          setWorkplaceMapUrl(data.workplace_map_url ?? undefined);
          setBusinessAddress(data.business_address ?? undefined);
          setBusinessMapUrl(data.business_map_url ?? undefined);
          setJobIndustry(data.job_industry ?? undefined);
          // 업종이 쉼표로 구분된 문자열인 경우 배열로 변환
          if (data.job_industry) {
            const industries = data.job_industry.split(",").map(s => s.trim()).filter(Boolean);
            setSelectedIndustries(new Set(industries));
            setIndustryTempSelected(new Set(industries));
          } else {
            setSelectedIndustries(new Set());
            setIndustryTempSelected(new Set());
          }
          setJobCategory(data.job_category ?? undefined);
          setCompanyDeveloper(data.company_developer ?? undefined);
          setCompanyConstructor(data.company_constructor ?? undefined);
          setCompanyTrustee(data.company_trustee ?? undefined);
          setCompanyAgency(data.company_agency ?? undefined);
          setAgencyCall(data.agency_call ?? undefined);
          setPaySupport(!!data.pay_support);
          setMealSupport(!!data.meal_support);
          setHouseSupport(!!data.house_support);
          setOneToking(data.highlight_content ?? undefined);
          setTextColor(normalizeTokingColor(data.highlight_color ?? "#111111"));
          setAgencyMan(data.agent ?? undefined);
          setSelectedRegion(normalizeRegionValue((data as any).province, (data as any).city));
          // mapping for internal role keys
          const nextSelected = new Set<Role>();
          const nextFees: Record<Role, string> = {
            총괄: "",
            본부장: "",
            팀장: "",
            팀원: "",
            본부: "",
            팀: "",
            각개: "",
            기타: "",
          };

          if (data.total_use) {
            nextSelected.add("총괄");
            nextFees["총괄"] = String(data.total_fee ?? "");
          }
          if (data.branch_use) {
            nextSelected.add("본부장");
            nextFees["본부장"] = String(data.branch_fee ?? "");
          }
          if ((data as any).hq_use) {
            nextSelected.add("본부");
            nextFees["본부"] = String((data as any).hq_fee ?? "");
          }
          if (data.leader_use) {
            nextSelected.add("팀장");
            nextFees["팀장"] = String(data.leader_fee ?? "");
          }
          if (data.member_use) {
            nextSelected.add("팀원");
            nextFees["팀원"] = String(data.member_fee ?? "");
          }
          if ((data as any).team_use) {
            nextSelected.add("팀");
            nextFees["팀"] = String((data as any).team_fee ?? "");
          }
          if ((data as any).each_use) {
            nextSelected.add("각개");
            nextFees["각개"] = String((data as any).each_fee ?? "");
          }

          // 모집(기타) 항목
          const otherName = (data as any)?.other_role_name ?? "";
          const otherFee = (data as any)?.other_role_fee ?? "";
          if (otherName && String(otherName).trim()) {
            nextSelected.add("기타");
            setOtherRoleName(String(otherName));
            nextFees["기타"] = String(otherFee ?? "");
          } else {
            setOtherRoleName("");
            nextFees["기타"] = "";
          }

          setSelected(nextSelected);
          setFees(nextFees);

          const nextSelected2 = new Set<Role2>();
          const nextFees2: Record<"일비", string> = { 일비: "" };
          let nextHouse: Record<"숙소", string> = { 숙소: "" };
          let nextCatering: "예" | "아니오" | null = null;
          const nextExtra: Record<ExtraRole, { item: string; amount: string }> = {
            지원1: { item: "", amount: "" },
            지원2: { item: "", amount: "" },
            지원3: { item: "", amount: "" },
            지원4: { item: "", amount: "" },
          };

          if (data.pay_use) {
            nextSelected2.add("일비");
            nextFees2.일비 = String(data.pay_sup ?? "");
          }

          if (data.meal_use) {
            nextSelected2.add("케터링");
            if (typeof data.meal_sup === "boolean") {
              nextCatering = data.meal_sup ? "예" : "아니오";
            }
          }

          if (data.house_use) {
            nextSelected2.add("숙소");
            nextHouse.숙소 = data.house_sup ?? "";
          }

          if (data.item1_use) {
            nextSelected2.add("지원1");
            nextExtra["지원1"] = {
              item: data.item1_type ?? "",
              amount: String(data.item1_sup ?? ""),
            };
          }
          if (data.item2_use) {
            nextSelected2.add("지원2");
            nextExtra["지원2"] = {
              item: data.item2_type ?? "",
              amount: String(data.item2_sup ?? ""),
            };
          }
          if (data.item3_use) {
            nextSelected2.add("지원3");
            nextExtra["지원3"] = {
              item: data.item3_type ?? "",
              amount: String(data.item3_sup ?? ""),
            };
          }
          if (data.item4_use) {
            nextSelected2.add("지원4");
            nextExtra["지원4"] = {
              item: data.item4_type ?? "",
              amount: String(data.item4_sup ?? ""),
            };
          }

          setSelected2(nextSelected2);
          setFees2(nextFees2);
          setHouse(nextHouse);
          setCateringYes(nextCatering);
          setExtraSupport(nextExtra);

          dispatch(setWorkLocation({
            work_lat: data.workplace_lat ?? undefined,
            work_lng: data.workplace_lng ?? undefined,
            work_address: data.workplace_address ?? undefined,
            work_zoom: 15,
          }));

          dispatch(setBusinessLocation({
            business_lat: data.business_lat ?? undefined,
            business_lng: data.business_lng ?? undefined,
            business_address: data.business_address ?? undefined,
            business_zoom: 15,
          }));
          if (data.image_url) setImageUri(data.image_url);
        } catch (e) {
          Alert.alert("불러오기 실패", "게시글 데이터를 가져올 수 없습니다.");
        }
      })();
    }
  }, [id]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  };

  const submit = async (cardType: 1 | 2 | 3) => {
    if (submitting) return;
    setSubmitting(true);
    const [isLoginStr, username] = await Promise.all([
      SecureStore.getItemAsync("isLogin"),
      SecureStore.getItemAsync("username"),
    ]);

    try {
      if (isLoginStr !== "true") {
        Alert.alert("로그인이 필요합니다");
        return;
      }
      if (!username) {
        Alert.alert("로그인이 필요합니다");
        return;
      }

      let imageUrl: string | undefined;

      if (!imageUri) {
        // 기본 이미지도 서버에 업로드해서 image_url로 저장
        const asset = Asset.fromModule(DEFAULT_IMAGE);
        try {
          await asset.downloadAsync();
        } catch {
          // ignore (asset.uri가 바로 사용 가능할 수 있음)
        }
        const uri = asset.localUri ?? asset.uri;
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        const upload = await fetch(`${API_URL}/upload/base64`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filename: `default_${Date.now()}.png`, base64: b64 }),
        });
        const data = await upload.json();
        imageUrl = data.url;
      } else if (imageUri && !imageUri.startsWith("http")) {
        const b64 = await FileSystem.readAsStringAsync(imageUri, { encoding: "base64" });
        const upload = await fetch(`${API_URL}/upload/base64`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filename: `img_${Date.now()}.jpg`, base64: b64 }),
        });
        const data = await upload.json();
        imageUrl = data.url;
      } else if (imageUri) {
        imageUrl = imageUri;
      }
      const payload = {
        title, content,
        image_url: imageUrl,
        contract_fee: contractFee,
        workplace_address: workplaceAddress || undefined,
        workplace_map_url: workplaceMapUrl || undefined,

        workplace_lat: work_lat || undefined,
        workplace_lng: work_lng || undefined,
        business_lat: business_lat || undefined,
        business_lng: business_lng || undefined,

        business_address: businessAddress || undefined,
        business_map_url: businessMapUrl || undefined,

        job_industry: selectedIndustries.size > 0 ? Array.from(selectedIndustries).join(",") : undefined,
        job_category: jobCategory || undefined,

        pay_support: !!paySupport,
        meal_support: !!mealSupport,
        house_support: !!houseSupport,

        company_developer: companyDeveloper || undefined,
        company_constructor: companyConstructor || undefined,
        company_trustee: companyTrustee || undefined,
        company_agency: companyAgency || undefined,

        agency_call: agencyCall || undefined,
        status: "published",

        highlight_color: textColor || undefined,
        highlight_content: onetoking || undefined,

        total_use: selected.has("총괄"),
        total_fee: fees["총괄"] || undefined,

        // 기존 branch_*는 본부장으로 사용 중
        branch_use: selected.has("본부장"),
        branch_fee: fees["본부장"] || undefined,

        // 신규 본부
        hq_use: selected.has("본부"),
        hq_fee: fees["본부"] || undefined,

        // 기존 팀장/팀원
        leader_use: selected.has("팀장"),
        leader_fee: fees["팀장"] || undefined,

        member_use: selected.has("팀원"),
        member_fee: fees["팀원"] || undefined,

        // 신규 팀/각개
        team_use: selected.has("팀"),
        team_fee: fees["팀"] || undefined,

        each_use: selected.has("각개"),
        each_fee: fees["각개"] || undefined,

        // 모집(기타): 이름이 있을 때만 저장 (수수료는 텍스트 허용)
        // 수정 모드에서 "기타" 체크 해제 시에는 서버 값이 남지 않도록 null로 clear
        other_role_name: selected.has("기타") ? (otherRoleName.trim() || undefined) : id ? null : undefined,
        other_role_fee: selected.has("기타") ? ((fees["기타"] || "").trim() || undefined) : id ? null : undefined,

        pay_use: selected2.has("일비"),
        pay_sup: fees2.일비 || undefined,

        meal_use: selected2.has("케터링"),
        meal_sup:
          selected2.has("케터링") && cateringYes !== null
            ? cateringYes === "예"
            : undefined,

        house_use: selected2.has("숙소"),
        house_sup: House.숙소 || undefined,

        item1_use: selected2.has("지원1"),
        item1_type: extraSupport["지원1"].item || undefined,
        item1_sup: extraSupport["지원1"].amount || undefined,

        item2_use: selected2.has("지원2"),
        item2_type: extraSupport["지원2"].item || undefined,
        item2_sup: extraSupport["지원2"].amount || undefined,

        item3_use: selected2.has("지원3"),
        item3_type: extraSupport["지원3"].item || undefined,
        item3_sup: extraSupport["지원3"].amount || undefined,

        item4_use: selected2.has("지원4"),
        item4_type: extraSupport["지원4"].item || undefined,
        item4_sup: extraSupport["지원4"].amount || undefined,

        province: selectedRegion?.province || undefined,
        city: selectedRegion?.city || undefined,

        agent: agencyMan || undefined,
        card_type: cardType,

      };

      if (id) {
        await Posts.update(Number(id), payload);
      } else {
        await Posts.create(payload, username);
      }
      // 임시저장 제거(성공 시에만)
      if (!id) {
        await clearDraft();
      }
      // 알림은 "등록/수정 성공" 이후에만 노출
      if (id) {
        Alert.alert("수정 완료", "수정이 완료되었습니다.", [
          { text: "확인", onPress: () => router.back() },
        ]);
      } else {
        // ✅ 하루 1회 등록 제한(Topbar에서 체크)용 로컬 플래그 저장
        try {
          await SecureStore.setItemAsync("lastPostCreateDate", getLocalDateKey());
        } catch {
          // ignore
        }
        Alert.alert("등록 완료", "신규등록이 완료되었습니다.", [
          { text: "확인", onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        "잠시 후 다시 시도해주세요";
      let normalized: string =
        typeof msg === "string" && msg.includes("하루") && msg.includes("등록")
          ? "하루에 한번 등록 가능합니다.\n자정 12시가 지나면 등록 가능합니다."
          : String(msg);

      if (typeof msg === "string") {
        normalized = normalizeRestrictionExpiryMessageToKstMinute(normalized);
      }

      Alert.alert("업로드 실패", normalized);
    } finally {
      setSubmitting(false);
    }
  };

  const openCardTypeSheet = async () => {
    if (!title.trim()) {
      Alert.alert("확인", "제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      Alert.alert("확인", "상세 내용을 입력해주세요.");
      return;
    }
    const isLoginStr = await SecureStore.getItemAsync("isLogin");
    if (isLoginStr !== "true") {
      Alert.alert("로그인이 필요합니다");
      return;
    }
    // 구인글 등록은 캐시/결제 로직 없이 바로 등록
    if (id) {
      void submit(selectedCardType);
      return;
    }
    setSelectedCardType(1);
    void submit(1);
  };

  const onPickWork = ({ address, lat, lng }: LocationSel) => {
    setWorkplaceAddress(address);
    setWorkplaceMapUrl(buildKakaoMapUrl(lat, lng));
    setShowWorkModal(false);
  };

  const onPickBiz = ({ address, lat, lng }: LocationSel) => {
    setBusinessAddress(address);
    setBusinessMapUrl(buildKakaoMapUrl(lat, lng));
    setShowBizModal(false);
  };

  // --- Start of RELEVANT UI Rewrite ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: "height" }) as any}
        keyboardVerticalOffset={100}
      >
        <Animated.ScrollView 
          ref={scrollRef}
          contentContainerStyle={{ 
            padding: 16, 
            paddingBottom: 100,
            gap: 0, 
            backgroundColor: colors.background 
          }}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >

          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10, color: "#666" }}>
            ※ 구인등록은 하루 1회 가능합니다.
          </Text>

          {/* 소개 이미지 */}
          <View>
            <Text style={[label, { marginBottom: 12, marginTop: 10 }]}>소개 이미지</Text>
            <View style={{ marginBottom: 8 }}>
              <Image
                source={imageUri ? { uri: imageUri } : DEFAULT_IMAGE}
                style={{
                  width: "100%",
                  height: imageUri ? 180 : 260,
                  borderRadius: 12,
                }}
                resizeMode="cover"
              />

              {/* X 버튼: 사용자가 선택한 이미지가 있을 때만 */}
              {imageUri ? (
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
              ) : null}
            </View>
            <TouchableOpacity
              onPress={pickImage}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>이미지를 선택해주세요. ( 클 릭 ) </Text>
            </TouchableOpacity>
          </View>

          {/* 제목 */}
          <View>
            <Text style={[label, { marginTop: 10, marginBottom: 10 }]}>제목 (필수)</Text>
            <TextInput
              placeholderTextColor={placeholder}
              value={title}
              onChangeText={setTitle}
              style={inputStyle}
            />
          </View>

          {/* 현장 한마디 */}
          <View style={{ marginTop: 20 }}>
            <Text style={[label, { fontWeight: "700", fontSize: 16, marginBottom: 8 }]}>
              현장 한마디
            </Text>

            {/* 색상 팔레트 */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 10,
              }}
            >
              {tokingcolors.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTextColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: textColor === c ? 2 : 0,
                    borderColor: "#000",
                  }}
                />
              ))}
            </View>

            {/* 입력창 */}
            <TextInput
              placeholderTextColor={placeholder}
              value={onetoking}
              maxLength={31}
              onChangeText={setOneToking}
              style={[inputStyle, { color: textColor }]}
            />
          </View>

          {/* 업종 */}
          <View style={{ marginTop: 10 }}>
            <Text style={label}>업종</Text>
            <TouchableOpacity
              onPress={() => {
                // 현재 선택 복사 + "기타(직접입력)" 복원
                const current = new Set(selectedIndustries);
                const presetSet = new Set(INDUSTRY_ITEMS as unknown as string[]);

                // 기존 저장값에 "기타"가 문자열로 들어간 레거시 케이스도 지원
                const hasLegacyEtc = current.has("기타");

                // 프리셋 목록에 없는 값은 "직접 입력 업종"으로 간주(첫 1개만)
                const custom = Array.from(current).find((v) => v && !presetSet.has(v));
                setOtherIndustryName(custom ? String(custom) : "");

                const nextTemp = new Set<string>();
                for (const v of current) {
                  if (presetSet.has(v) && v !== "기타") nextTemp.add(v);
                }
                if (hasLegacyEtc || !!custom) nextTemp.add("기타");

                setIndustryTempSelected(nextTemp);
                setIndustryModalVisible(true);
              }}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                backgroundColor: colors.card,
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 45
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: selectedIndustries.size > 0 ? colors.text : placeholder }}>
                {selectedIndustries.size > 0
                  ? Array.from(selectedIndustries).join(", ")
                  : "업종을 선택하세요"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 업종 모달 */}
          <Modal
            transparent={true}
            visible={industryModalVisible}
            animationType="fade"
            onRequestClose={() => setIndustryModalVisible(false)}
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.4)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => setIndustryModalVisible(false)}
            >
              <Pressable
                style={{
                  width: "85%",
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  padding: 16,
                }}
                onPress={(e) => e.stopPropagation()}
              >
                {/* 헤더 */}
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    업종 선택
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.subText, marginTop: 4, marginBottom: 12 }}>
                    여러 개를 선택할 수 있습니다
                  </Text>
                </View>

                {/* 버튼 그리드 - 3x4 */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                  }}
                >
                  {INDUSTRY_ITEMS.map((industry) => {
                    const active = industryTempSelected.has(industry);
                    return (
                      <Pressable
                        key={industry}
                        onPress={() => {
                          setIndustryTempSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(industry)) {
                              next.delete(industry);
                              if (industry === "기타") setOtherIndustryName("");
                            } else {
                              next.add(industry);
                            }
                            return next;
                          });
                        }}
                        style={{
                          width: "30%",
                          paddingVertical: 12,
                          marginBottom: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 48,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                          style={{
                            fontSize: 13,
                            color: active ? "#fff" : colors.text,
                            fontWeight: active ? "700" : "400",
                            textAlign: "center",
                          }}
                        >
                          {industry}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* 기타 선택 시 직접 입력 */}
                {industryTempSelected.has("기타") && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 }}>
                      기타 업종 직접입력
                    </Text>
                    <TextInput
                      value={otherIndustryName}
                      onChangeText={setOtherIndustryName}
                      placeholder="예) 공장, 물류센터, 연립/빌라..."
                      placeholderTextColor={placeholder}
                      style={[
                        inputStyle,
                        {
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 10,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: "#fff",
                        },
                      ]}
                    />
                    <Text style={{ fontSize: 12, color: colors.subText, marginTop: 6 }}>
                      쉼표(,)는 저장 시 공백으로 변환됩니다.
                    </Text>
                  </View>
                )}

                {/* 버튼 */}
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
                  <Pressable
                    onPress={() => setIndustryModalVisible(false)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>취소</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      // "기타"는 화면용 토글. 저장은 직접 입력값으로 치환
                      const picked = new Set(industryTempSelected);
                      const next = new Set<string>();
                      for (const v of picked) {
                        if (v && v !== "기타") next.add(v);
                      }

                      if (picked.has("기타")) {
                        const customRaw = (otherIndustryName || "").trim();
                        const custom = customRaw.replace(/,/g, " ").trim();
                        if (!custom) {
                          Alert.alert("알림", "기타 업종을 입력해 주세요.");
                          return;
                        }
                        next.add(custom);
                      }

                      setSelectedIndustries(next);
                      setIndustryModalVisible(false);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 8,
                      backgroundColor: colors.primary,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>확인</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* 지역 선택 */}
          <View style={{ marginTop: 10 }}>
            <Text style={label}>지역</Text>

            <Pressable
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                backgroundColor: colors.card,
                marginTop: 10,
              }}
              onPress={() => setRegionModalVisible(true)}
            >
              <Text style={{ fontSize: 14, color: selectedRegion ? colors.text : placeholder }}>
                {selectedRegion
                  ? formatRegionLabel(selectedRegion)
                  : "지역을 선택하세요"}
              </Text>
            </Pressable>
          </View>

          <RegionSelectModal
            visible={regionModalVisible}
            onClose={() => setRegionModalVisible(false)}
            onSelect={(province, city) => {
              setSelectedRegion({
                province,
                city,
              });
            }}
          />

          {/* 모집 섹션: 2줄(고정 배치) */}
          <View style={{ flex: 1 }}>
            <Text style={[label, { marginBottom: 8, marginTop: 10 }]}>모집</Text>
            {([["총괄", "본부장", "팀장", "팀원"], ["본부", "팀", "각개", "기타"]] as const).map((row, rowIdx) => (
              <View key={`row-${rowIdx}`} style={{ flexDirection: "row", gap: 8, marginBottom: rowIdx === 0 ? 8 : 12 }}>
                {row.map((role) => {
                  const active = selected.has(role);
                  return (
                    <TouchableOpacity
                      key={role}
                      onPress={() => toggleRole(role)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? colors.primary : colors.card,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                        {roleLabel[role]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* 2) 선택된 항목만 입력창, 본부장일 경우 "본부장 수수료"로 라벨 */}
            {ROLES.map((role) =>
              selected.has(role) ? (
                role === "기타" ? (
                  <View key={role} style={{ marginBottom: 12 }}>
                    <Text style={[blueLabel, { marginBottom: 6 }]}>직접입력</Text>
                    <TextInput
                      placeholder="예) 층별, 기본급"
                      placeholderTextColor={placeholder}
                      value={otherRoleName}
                      onChangeText={setOtherRoleName}
                      style={inputStyle}
                    />

                    <Text style={[blueLabel, { marginBottom: 6, marginTop: 10 }]}>
                      수수료
                    </Text>
                    <TextInput
                      placeholder="예) 300~500, 3%"
                      placeholderTextColor={placeholder}
                      value={fees["기타"]}
                      onChangeText={(v) => setFees((prev) => ({ ...prev, 기타: v }))}
                      style={inputStyle}
                      keyboardType="default"
                      editable={otherRoleName.trim().length > 0}
                    />
                  </View>
                ) : (
                  <View key={role} style={{ marginBottom: 12 }}>
                    <Text style={[blueLabel, { marginBottom: 6 }]}>
                      {role === "본부장"
                        ? "본부장 수수료"
                        : role === "본부"
                          ? "본부 수수료"
                          : role === "팀"
                            ? "팀 수수료"
                            : role === "각개"
                              ? "각개 수수료"
                          : `${roleLabel[role]} 수수료`}
                    </Text>
                    <TextInput
                      placeholder="예) 300~500, 3%"
                      placeholderTextColor={placeholder}
                      value={fees[role]}
                      onChangeText={(v) => onChangeFee(role, v)}
                      style={inputStyle}
                      keyboardType="default"
                    />
                  </View>
                )
              ) : null
            )}
          </View>

          <View>
            <Text style={[label, { marginBottom: 12 }]}>시행사</Text>
            <TextInput
              placeholder="예) ○ ○ 시 행"
              placeholderTextColor={placeholder}
              value={companyDeveloper}
              onChangeText={setCompanyDeveloper}
              style={[inputStyle]}
            />
          </View>

          <View>
            <Text style={[label, { marginBottom: 12, marginTop: 10 }]}>시공사</Text>
            <TextInput
              placeholder="예) ○ ○ 건 설"
              placeholderTextColor={placeholder}
              value={companyConstructor}
              onChangeText={setCompanyConstructor}
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={[label, { marginBottom: 12, marginTop: 10 }]}>신탁사</Text>
            <TextInput
              placeholder="예) ○ ○ 신 탁"
              placeholderTextColor={placeholder}
              value={companyTrustee}
              onChangeText={setCompanyTrustee}
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={[label, { marginBottom: 12, marginTop: 10 }]}>대행사</Text>
            <TextInput
              placeholder="예) 대원파트너스"
              placeholderTextColor={placeholder}
              value={companyAgency}
              onChangeText={setCompanyAgency}
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={[label, { marginBottom: 8, marginTop: 10 }]}>근무후생</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {(["일비", "케터링", "숙소"] as const).map((role) => {
                const active = selected2.has(role);
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => toggleRole2(role)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {(["지원1", "지원2", "지원3", "지원4"] as const).map((role) => {
                const active = selected2.has(role);
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => toggleRole2(role)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View>
              {selected2.has("일비") && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[blueLabel, { marginBottom: 6 }]}>일비 지원</Text>
                  <TextInput
                    placeholder="예) 1만, 2만"
                    placeholderTextColor={placeholder}
                    value={fees2.일비}
                    onChangeText={onChangeDailyFee}
                    style={inputStyle}
                    keyboardType="default"
                  />
                </View>
              )}
              {selected2.has("케터링") && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[blueLabel, { marginBottom: 6 }]}>케터링 지원</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["예", "아니오"] as const).map(opt => {
                      const active = cateringYes === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setCateringYes(opt)}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary : colors.card,
                          }}
                        >
                          <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "600" }}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}</View>

            {selected2.has("숙소") && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[blueLabel, { marginBottom: 6 }]}>숙소 지원</Text>

                <TextInput
                  placeholder="예) 지원비 30만"
                  placeholderTextColor="#888"
                  value={House.숙소}
                  onChangeText={(text) => setHouse({ 숙소: text })} // ✅ 상태 업데이트
                  style={inputStyle}
                  keyboardType="default"
                />
              </View>
            )}
            <View>
              {/* 지원1~3: 항목 + 금액 */}
              {EXTRA_ROLES.map((role) =>
                selected2.has(role) ? (
                  <View key={role} style={{ marginBottom: 12 }}>
                    <Text style={[blueLabel, { marginBottom: 6 }]}>{role}</Text>
                    <View style={{ gap: 8 }}>
                      <TextInput
                        placeholder="항목 [예) 교통비]"
                        placeholderTextColor={placeholder}
                        value={extraSupport[role].item}
                        onChangeText={v => onChangeExtraItem(role, v)}
                        style={inputStyle}
                        keyboardType="default"
                      />
                      <TextInput
                        placeholder="금액 [예) 20만, 30만]"
                        placeholderTextColor={placeholder}
                        value={extraSupport[role].amount}
                        onChangeText={v => onChangeExtraAmount(role, v)}
                        style={inputStyle}
                        keyboardType="default"
                      />
                    </View>
                  </View>
                ) : null
              )}
            </View></View>

          {/* 상세 내용 */}
          <View>
            <Text style={[label, { marginBottom: 12 }]}>상세 내용 (필수)</Text>
            <TextInput
              placeholder="내용을 입력하세요"
              placeholderTextColor={placeholder}
              value={content}
              onChangeText={setContent}
              multiline
              style={[
                inputStyle,
                { minHeight: 200, textAlignVertical: "top" },
              ]}
            />
          </View>

          {/* 담당자/연락처 */}
          <View>
            <Text style={[label, { marginBottom: 12, marginTop: 10 }]}>담당자</Text>
            <TextInput
              placeholder="예) 김대원 이사"
              placeholderTextColor={placeholder}
              value={agencyMan}
              onChangeText={setAgencyMan}
              style={inputStyle}
            />
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={[label, { marginBottom: 12 }]}>연락처</Text>
            <TextInput
              placeholder="예) 010-1234-5678"
              placeholderTextColor={placeholder}
              value={agencyCall}
              onChangeText={(v) => setAgencyCall(mobile(v))}
              keyboardType="phone-pad"
              style={[inputStyle, { marginBottom: 10 }]}
            />
          </View>

          <View style={{ marginTop: 5, marginBottom: 10 }}>
            <NaverMap
              title="모델하우스 주소"
              placeholder="주소 입력 또는 지도를 터치하세요"
              placeholderTextColor={placeholder}
              address={work_address}
              lat={work_lat}
              lng={work_lng}
              under={10}
              onOpenModal={() => setShowWorkModal(true)}
            />
          </View>

          <View style={{ marginTop: 10, marginBottom: 10 }}>
            <NaverMap
              title="현장사업지 주소"
              placeholder="주소 입력 또는 지도를 터치하세요"
              placeholderTextColor={placeholder}
              address={business_address}
              lat={business_lat}
              lng={business_lng}
              under={10}
              onOpenModal={() => setShowBizModal(true)}
            />
          </View>

          <TouchableOpacity
            onPress={openCardTypeSheet}
            disabled={submitting}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
              marginBottom: 50,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 20 }}>
              {submitting ? (id ? "수정 중..." : "등록 중...") : (id ? "수  정" : "게\u00A0\u00A0시")}
            </Text>
          </TouchableOpacity>
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
          bottomOffset={insets.bottom + 8}
          topOffset={0}
          trackOpacity={0.6}
          thumbOpacity={1.0}
          barWidth={4}
        />

        <WorkPicker
          visible={showWorkModal}
          onClose={() => setShowWorkModal(false)}
          onPick={onPickWork}
          clientId={KAKAO_MAP_JS_KEY}
          initial={{
            address: workplaceAddress || "",
            lat: work_lat,
            lng: work_lng,
          }}
          business={{ address: business_address, lat: business_lat, lng: business_lng }}
        />

        <BusinessPicker
          visible={showBizModal}
          onClose={() => setShowBizModal(false)}
          onPick={onPickBiz}
          clientId={KAKAO_MAP_JS_KEY}
          initial={{ address: businessAddress || "" }}
          work={{ address: work_address, lat: work_lat, lng: work_lng }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView >
  );
}
