import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const extra: any =
  (Constants.expoConfig as any)?.extra ??
  (Constants as any)?.manifest?.extra ??
  {};

export const API_URL: string = (extra?.apiBaseUrl as string) ?? "https://api.daewon469.com";
export type PostInput = Omit<
  Post,
  "id" | "author" | "created_at" | "province" | "city" | "liked" | "other_role_name" | "other_role_fee"
> & {
  // write.tsx에서 "미선택 시 null로 내려 clear"를 지원
  other_role_name?: string | null;
  other_role_fee?: string | null;
};

export type PostPatch = Omit<Partial<Post>, "other_role_name" | "other_role_fee"> & {
  // write.tsx에서 "미선택 시 null로 내려 clear"를 지원
  other_role_name?: string | null;
  other_role_fee?: string | null;
};
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// 관리자/오너 API는 토큰 인증을 사용하지 않음(Authorization 헤더 미첨부)
export const adminApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// 토큰 기반 인증(서버가 Authorization을 요구하는 일부 엔드포인트용)
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = await SecureStore.getItemAsync("token");
    if (token && String(token).trim()) {
      // AxiosHeaders/Plain object 둘 다 케어
      if (!config.headers) config.headers = new AxiosHeaders();
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return config;
});

api.interceptors.response.use(
  (res: AxiosResponse): AxiosResponse => res,
  async (error: AxiosError): Promise<never> => {
    // 로그인 유지 정책: isLogin 기반으로만 유지, 네트워크 401 등으로 자동 로그아웃/토큰 복원하지 않음.
    return Promise.reject(error);
  }
);

export type AuthResponse = { user_id: number; token: string };
export type PhoneSendResponse = { status: number; verification_id?: string; expires_in_sec?: number };
export type PhoneVerifyResponse = { status: number; verified: boolean };
export type FindUsernameResponse = { status: number; items: string[] };
export type ResetPasswordResponse = { status: number; detail?: string | null };

const normalizePhoneDigits = (value: string) => (value || "").replace(/[^0-9]/g, "");

export type User = {
  username: string;
  name: string | null;
  phone_number: string | null;
  region: string | null;
  signup_date: string | null;
  point_balance: number;
  cash_balance: number;
  admin_acknowledged: boolean;
  referral_code: string | null;
  // community_users 신규 필드(2026-01)
  custom_industry_codes: string[];
  custom_region_codes: string[];
  // 지역현장: 선호지역(세부지역 포함)
  area_region_codes: string[];
  // 맞춤현장: 모집(총괄/본부장/팀장/팀원/기타) 필터(2026-02)
  custom_role_codes: string[];
  popup_last_seen_at: string | null;
  last_attendance_date: string | null;
  marketing_consent: boolean;
};

export type UserResponse = {
  status: number;
  user?: User;
};

export type ReferralListItem = {
  id: number;
  referred_username: string;
  created_at: string | null;
};

export type ReferralListResponse = {
  status: number;
  items: ReferralListItem[];
};

export type ReferralRankingItem = {
  rank: number;
  nickname: string;
  referral_count: number;
};

export type ReferralRankingResponse = {
  status: number;
  items: ReferralRankingItem[];
};

export type ReferralNetworkItem = {
  nickname: string;
  depth: number; // 1=1단계, 2=2단계 ...
  signup_date?: string | null;
  created_at?: string | null;
};

export type ReferralNetworkResponse = {
  status: number;
  total_count: number;
  items: ReferralNetworkItem[];
  next_cursor: string | null;
  reward?: { granted: boolean } | null;
};

export type ReferralStatusDayItem = {
  date: string;
  referral_count: number;
};

export type ReferralStatusDaysResponse = {
  status: number;
  items: ReferralStatusDayItem[];
};

export type ReferralStatusDetailItem = {
  A_username: string | null;
  B_username: string | null;
  A_phone_number: string | null;
  B_phone_number?: string | null;
  date: string;
};

export type ReferralStatusDetailResponse = {
  status: number;
  items: ReferralStatusDetailItem[];
};

export type PointLedgerItem = {
  id: number;
  reason: string;
  amount: number;
  created_at: string | null;
};

export type PointLedgerResponse = {
  status: number;
  items: PointLedgerItem[];
};

export type AttendanceStatusResponse = {
  status: number;
  claimed: boolean;
  amount?: number;
  point_balance?: number;
};

export type CashLedgerItem = {
  id: number;
  reason: string;
  amount: number;
  created_at: string | null;
};

export type CashLedgerResponse = {
  status: number;
  items: CashLedgerItem[];
};

export type MyPageSummaryResponse = {
  status: number;
  signup_date: string | null;
  user_grade?: number; // -1-일반회원 / 0-아마추어 / 1-세미프로 / 2-프로 / 3-마스터 / 4-레전드
  is_owner?: boolean;
  posts: {
    type1: number;
    type3: number;
    type4: number;
    type6?: number; // 내가 쓴 문의글 수
  };
  point_balance?: number;
  cash_balance?: number;
  admin_acknowledged?: boolean;
  referral_code?: string | null;
  referral_count?: number; // 내가 추천한 회원 수
};

export type Post = {
  id: number;
  author: { id: number; username: string; avatarUrl?: string };
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
  contract_fee?: string;
  workplace_address?: string;
  workplace_map_url?: string;
  workplace_lat?: number;
  workplace_lng?: number;
  business_address?: string;
  business_map_url?: string;
  business_lat?: number;
  business_lng?: number;
  job_industry?: string;
  job_category?: string;
  pay_support?: boolean;
  meal_support?: boolean;
  house_support?: boolean;
  company_developer?: string;
  company_constructor?: string;
  company_trustee?: string;
  company_agency?: string;
  agency_call?: string;
  province: string,
  city: string,
  status: string,
  liked: boolean,
  highlight_color?: string;
  highlight_content?: string;
  total_use?: boolean;
  branch_use?: boolean;
  // 신규 모집 항목: 본부
  hq_use?: boolean;
  leader_use?: boolean;
  member_use?: boolean;
  // 신규 모집 항목: 팀/각개
  team_use?: boolean;
  each_use?: boolean;
  total_fee?: string;
  branch_fee?: string;
  hq_fee?: string;
  leader_fee?: string;
  member_fee?: string;
  team_fee?: string;
  each_fee?: string;
  pay_use?: boolean;
  meal_use?: boolean;
  house_use?: boolean;
  pay_sup?: string;
  meal_sup?: boolean;
  house_sup?: string;
  item1_use?: boolean;
  item1_type?: string;
  item1_sup?: string;
  item2_use?: boolean;
  item2_type?: string;
  item2_sup?: string;
  item3_use?: boolean;
  item3_type?: string;
  item3_sup?: string;
  item4_use?: boolean;
  item4_type?: string;
  item4_sup?: string;
  agent?: string;
  // write.tsx에서 "미선택 시 null로 내려 clear"를 지원
  other_role_name?: string | null;
  other_role_fee?: string | null;
  post_type?: number;
  card_type?: number;
  // 서버가 추가로 내려주는 확장 필드(화면 조건 렌더링 용)
  is_owner?: boolean;
  community?: { is_owner?: boolean } | null;
};

export type LikedListResponse<T = any> = {
  items: T[];
  next_cursor?: string;
}

export const Auth = {
  logIn: async (username: string, password: string, pushToken?: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/community/login", {
       username,
       password,
       push_token:pushToken 
      });
    return data;
  },

  sendPhoneVerification: async (phone_number: string): Promise<PhoneSendResponse> => {
    const { data } = await api.post<PhoneSendResponse>("/community/phone/send", { phone_number: normalizePhoneDigits(phone_number) });
    return data;
  },

  verifyPhoneCode: async (verification_id: string, code: string): Promise<PhoneVerifyResponse> => {
    const { data } = await api.post<PhoneVerifyResponse>("/community/phone/verify", { verification_id, code });
    return data;
  },

  findUsernameByPhone: async (phone_number: string, phone_verification_id: string): Promise<FindUsernameResponse> => {
    const { data } = await api.post<FindUsernameResponse>("/community/account/find-username", {
      phone_number: normalizePhoneDigits(phone_number),
      phone_verification_id,
    });
    return data;
  },

  resetPasswordByPhone: async (
    username: string,
    phone_number: string,
    phone_verification_id: string,
    new_password: string,
    new_password_confirm: string,
  ): Promise<ResetPasswordResponse> => {
    const { data } = await api.post<ResetPasswordResponse>("/community/account/reset-password", {
      username,
      phone_number: normalizePhoneDigits(phone_number),
      phone_verification_id,
      new_password,
      new_password_confirm,
    });
    return data;
  },

  signUp: async (
    username: string,
    password: string,
    password_confirm: string,
    name?: string,
    phone_number?: string,
    phone_verification_id?: string,
    region?: string,
    referral_code?: string,
    marketing_consent?: boolean,
    custom_industry_codes?: string[],
    custom_region_codes?: string[],
    area_region_codes?: string[],
    custom_role_codes?: string[],
  ) => {
    const { data } = await api.post("/community/signup", {
      username,
      password,
      password_confirm,
      name,
      phone_number: phone_number ? normalizePhoneDigits(phone_number) : undefined,
      phone_verification_id,
      region,
      referral_code: referral_code?.trim() || undefined,
      marketing_consent: !!marketing_consent,
      custom_industry_codes: custom_industry_codes ?? [],
      custom_region_codes: custom_region_codes ?? [],
      area_region_codes: area_region_codes ?? [],
      custom_role_codes: custom_role_codes ?? [],
    });
    return data;
  },

  logOut: async () => {
    // 토큰/Redux 기반 로그아웃은 사용하지 않음. isLogin 플래그만 false로 설정.
    try {
      await SecureStore.setItemAsync("isLogin", "false");
    } catch {
      // ignore
    }
  },

  getUser: async (username: string): Promise<UserResponse> => {
    const { data } = await api.get(`/community/user/${encodeURIComponent(username)}`);
    return data;
  },

  updateUser: async (
    username: string,
    payload: {
      username?: string;
      password?: string;
      password_confirm?: string;
      name?: string;
      phone_number?: string;
      phone_verification_id?: string;
      region?: string;
      marketing_consent?: boolean;
      custom_industry_codes?: string[];
      custom_region_codes?: string[];
      area_region_codes?: string[];
      custom_role_codes?: string[];
    }
  ) => {
    const normalizedPayload = {
      ...payload,
      phone_number: payload.phone_number ? normalizePhoneDigits(payload.phone_number) : undefined,
      phone_verification_id: payload.phone_verification_id || undefined,
    };
    const { data } = await api.put(`/community/user/${encodeURIComponent(username)}`, normalizedPayload);
    return data;
  },

  deleteUser: async (username: string) => {
    const { data } = await api.delete(`/community/user/${encodeURIComponent(username)}`);
    return data;
  },

  getMyPageSummary: async (username: string): Promise<MyPageSummaryResponse> => {
    try {
      const { data } = await api.get(`/community/mypage/${encodeURIComponent(username)}`);
      // 응답 데이터가 없거나 형식이 맞지 않을 경우 기본값 반환
      if (!data) {
        console.warn("getMyPageSummary: empty response");
        return {
          status: 1,
          signup_date: null,
          user_grade: -1,
          is_owner: false,
          posts: { type1: 0, type3: 0, type4: 0, type6: 0 },
          point_balance: 0,
          cash_balance: 0,
          admin_acknowledged: false,
          referral_code: null,
          referral_count: 0,
        };
      }
      // 기본값 보장
      return {
        ...data,
        user_grade: data.user_grade ?? -1,
        is_owner: data.is_owner ?? (data as any).isOwner ?? false,
        point_balance: data.point_balance ?? 0,
        cash_balance: data.cash_balance ?? 0,
        admin_acknowledged: data.admin_acknowledged ?? false,
        referral_code: data.referral_code ?? null,
        referral_count: data.referral_count ?? 0,
      };
    } catch (error: any) {
      console.error("getMyPageSummary error:", error?.response?.data || error?.message || error);
      // 에러 발생 시 기본값 반환
      return {
        status: 1,
        signup_date: null,
        user_grade: -1,
        is_owner: false,
        posts: { type1: 0, type3: 0, type4: 0, type6: 0 },
        point_balance: 0,
        cash_balance: 0,
        admin_acknowledged: false,
        referral_code: null,
        referral_count: 0,
      };
    }
  },
};

export const Referral = {
  listByReferrer: async (username: string): Promise<ReferralListResponse> => {
    const { data } = await api.get(
      `/community/referrals/by-referrer/${encodeURIComponent(username)}`
    );
    return data ?? { status: 1, items: [] };
  },

  statusDays: async (opts?: { limit?: number }): Promise<ReferralStatusDaysResponse> => {
    try {
      const { data } = await api.get(`/community/referrals/status`, {
        params: { limit: opts?.limit ?? 30 },
      });
      return data ?? { status: 8, items: [] };
    } catch (e: any) {
      console.error("Referral.statusDays error:", e?.response?.data || e?.message || e);
      return { status: 8, items: [] };
    }
  },

  statusByDate: async (date: string): Promise<ReferralStatusDetailResponse> => {
    try {
      const d = String(date || "").trim();
      const { data } = await api.get(`/community/referrals/status/${encodeURIComponent(d)}`);
      return data ?? { status: 8, items: [] };
    } catch (e: any) {
      console.error("Referral.statusByDate error:", e?.response?.data || e?.message || e);
      return { status: 8, items: [] };
    }
  },

  // 추천인 인맥 "총 인원수"만 필요할 때 사용 (items는 최소로 가져옴)
  networkCount: async (username: string, opts?: { max_depth?: number }): Promise<number> => {
    const res = await Referral.network(username, { limit: 1, cursor: null, max_depth: opts?.max_depth ?? 20 });
    if (res?.status !== 0) return 0;
    return Number(res.total_count ?? 0);
  },

  network: async (
    username: string,
    opts?: { limit?: number; cursor?: string | null; max_depth?: number }
  ): Promise<ReferralNetworkResponse> => {
    const { data } = await api.get(
      `/community/referrals/network/${encodeURIComponent(username)}`,
      {
        params: {
          limit: opts?.limit ?? 50,
          cursor: opts?.cursor ?? undefined,
          max_depth: opts?.max_depth ?? 20,
        },
      }
    );
    return (
      data ?? {
        status: 1,
        total_count: 0,
        items: [],
        next_cursor: null,
        reward: null,
      }
    );
  },

  ranking: async (): Promise<ReferralRankingResponse> => {
    const { data } = await api.get(`/community/referrals/ranking`);
    return data ?? { status: 1, items: [] };
  },
};

export const Points = {
  list: async (username: string): Promise<PointLedgerResponse> => {
    const { data } = await api.get(`/community/points/${encodeURIComponent(username)}`);
    return data ?? { status: 1, items: [] };
  },

  attendanceStatus: async (username: string): Promise<AttendanceStatusResponse> => {
    const { data } = await api.get(
      `/community/points/attendance/status/${encodeURIComponent(username)}`
    );
    return data ?? { status: 1, claimed: false };
  },

  attendanceClaim: async (username: string): Promise<AttendanceStatusResponse> => {
    const { data } = await api.post(
      `/community/points/attendance/claim/${encodeURIComponent(username)}`
    );
    return data ?? { status: 1, claimed: false };
  },
};

export const Cash = {
  list: async (username: string): Promise<CashLedgerResponse> => {
    const { data } = await api.get(`/community/cash/${encodeURIComponent(username)}`);
    return data ?? { status: 1, items: [] };
  },
};

export const Popup = {
  markSeenToday: async (): Promise<{ status: number; popup_last_seen_at?: string | null }> => {
    const { data } = await api.post("/community/popup/seen");
    return data;
  },
};

// -------------------- UI Config (Banner/Popup) --------------------
export type UIConfigBannerItem = {
  image_url: string;
  link_url?: string | null;
  // 배너 클릭 액션
  // - link: link_url 외부 링크 오픈(기본값)
  // - referral_modal: "추천하기" 모달 오픈 (myboard.tsx와 동일 UX)
  click_action?: "link" | "referral_modal" | null;
  // width_px가 있으면 px(dp) 기반 고정 너비로 렌더링(권장).
  // 하위호환: width_percent도 유지(구버전 설정/클라이언트용).
  width_px?: number | null;
  width_percent?: number;
  height?: number;
  // contain: 비율 유지, 여백 가능(안 잘림)
  // cover: 비율 유지, 꽉 채움(잘릴 수 있음)
  // stretch: 비율 무시, 너비/높이 모두 맞춤(안 잘림, 왜곡 가능)
  resize_mode?: "contain" | "cover" | "stretch";
};

export type UIConfigResponse = {
  status: 0 | 1 | 3 | 8;
  config: {
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
    // 제목검색 화면 추천 현장(오너 관리)
    title_search?: {
      enabled: boolean;
      recommended_post_ids: number[];
    };
  };
};

export const UIConfig = {
  get: async (): Promise<UIConfigResponse> => {
    try {
      const { data } = await api.get("/community/ui-config");
      return (
        data ?? {
          status: 8,
          config: {
            banner: { enabled: true, interval_posts: 10, items: [], height: 110, resize_mode: "contain" },
            top_banner: { enabled: true, items: [], height: 70, resize_mode: "contain" },
            popup: { enabled: true, image_url: null, link_url: null, width_percent: 92, height: 360, resize_mode: "contain" },
            title_search: { enabled: true, recommended_post_ids: [] },
          },
        }
      );
    } catch (e: any) {
      console.error("UIConfig.get error:", e?.response?.data || e?.message || e);
      return {
        status: 8,
        config: {
          banner: { enabled: true, interval_posts: 10, items: [], height: 110, resize_mode: "contain" },
          top_banner: { enabled: true, items: [], height: 70, resize_mode: "contain" },
          popup: { enabled: true, image_url: null, link_url: null, width_percent: 92, height: 360, resize_mode: "contain" },
          title_search: { enabled: true, recommended_post_ids: [] },
        },
      };
    }
  },

  update: async (payload: UIConfigResponse["config"]): Promise<UIConfigResponse> => {
    try {
      // UI 설정 저장은 인증 없이 허용(서버 정책)
      // 관리자 전용으로 바꾸고 싶으면 서버에서 다시 토큰 체크로 되돌리면 됩니다.
      const { data } = await adminApi.put("/community/admin/ui-config", payload);
      return (
        data ?? {
          status: 8,
          config: payload,
        }
      );
    } catch (e: any) {
      console.error("UIConfig.update error:", e?.response?.data || e?.message || e);
      return { status: 8, config: payload };
    }
  },
};

export type TodayStatusResponse = {
  status: 0 | 1 | 3 | 8;
  date: string | null;
  new_users: number;
  total_users: number;
  total_visitors?: number;
  today_visitors?: number;
  total_job_posts?: number;
  today_job_posts?: number;
  total_ad_posts?: number;
  today_ad_posts?: number;
  total_chat_posts?: number;
  today_chat_posts?: number;
  // backward compatible aliases (서버가 구버전일 수 있어 optional로 유지)
  new_sites?: number;
  realtime_visitors?: number;
};

export const Stats = {
  today: async (): Promise<TodayStatusResponse> => {
    try {
      const { data } = await api.get("/community/stats/today");
      const raw = data ?? {};
      const status = (raw.status ?? 8) as TodayStatusResponse["status"];
      const date = (raw.date ?? null) as string | null;
      const total_users = Number(raw.total_users ?? 0) || 0;
      const new_users = Number(raw.new_users ?? 0) || 0;

      const today_visitors = Number(raw.today_visitors ?? raw.realtime_visitors ?? 0) || 0;
      const total_visitors = Number(raw.total_visitors ?? 0) || 0;

      const today_job_posts = Number(raw.today_job_posts ?? raw.new_sites ?? 0) || 0;
      const total_job_posts = Number(raw.total_job_posts ?? 0) || 0;

      const today_ad_posts = Number(raw.today_ad_posts ?? 0) || 0;
      const total_ad_posts = Number(raw.total_ad_posts ?? 0) || 0;

      const today_chat_posts = Number(raw.today_chat_posts ?? 0) || 0;
      const total_chat_posts = Number(raw.total_chat_posts ?? 0) || 0;

      return {
        status,
        date,
        total_users,
        new_users,
        total_visitors,
        today_visitors,
        total_job_posts,
        today_job_posts,
        total_ad_posts,
        today_ad_posts,
        total_chat_posts,
        today_chat_posts,
        // keep aliases (for any existing UI usage)
        new_sites: Number(raw.new_sites ?? today_job_posts) || 0,
        realtime_visitors: Number(raw.realtime_visitors ?? today_visitors) || 0,
      };
    } catch (e: any) {
      console.error("Stats.today error:", e?.response?.data || e?.message || e);
      return {
        status: 8,
        date: null,
        total_users: 0,
        new_users: 0,
        total_visitors: 0,
        today_visitors: 0,
        total_job_posts: 0,
        today_job_posts: 0,
        total_ad_posts: 0,
        today_ad_posts: 0,
        total_chat_posts: 0,
        today_chat_posts: 0,
        new_sites: 0,
        realtime_visitors: 0,
      };
    }
  },
};

// -------------------- Admin/Owner: 회원 관리 --------------------
export type AdminUserListItem = {
  id?: number | null;
  nickname: string;
  name?: string | null;
  signup_date?: string | null;
  admin_acknowledged?: boolean;
};

export type AdminUserListResponse = {
  status: 0 | 1 | 3 | 8;
  items: AdminUserListItem[];
  next_cursor: string | null;
};

export type UserRestrictionItem = {
  post_type: number;
  restricted_until?: string | null;
};

export type AdminUserDetailResponse = {
  status: 0 | 1 | 3 | 8;
  user?: {
    nickname: string;
    name?: string | null;
    phone_number?: string | null;
    signup_date?: string | null;
    point_balance?: number;
    cash_balance?: number;
    user_grade?: number;
    is_owner?: boolean;
    admin_acknowledged?: boolean;
    referral_code?: string | null;
    referral_count?: number;
    // (추가) 이 회원을 추천한 사람(추천인)
    referred_by_user_id?: number | null;
    referred_by_username?: string | null;
    referred_by_referrer_code?: string | null;
    referred_by_created_at?: string | null;
    posts?: { type1: number; type3: number; type4: number };
  };
  restrictions?: Array<{ post_type: number; restricted_until: string | null }>;
  // (추가) 해당 회원이 추천한 대상 목록
  referred_items?: Array<{
    id: number;
    referred_username: string;
    referred_referral_code?: string | null;
    created_at: string | null;
  }>;
  // (추가) 회원이 작성한 글 목록(읽기 전용)
  post_items?: {
    type1: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
    type3: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
    type4: Array<{ id: number; title: string; created_at: string | null; status?: string | null }>;
  };
};

export type SetRestrictionsResponse = {
  status: 0 | 1 | 3 | 8;
  restrictions?: Array<{ post_type: number; restricted_until: string | null }>;
};

export type AdminNotifyUserResponse = {
  status: 0 | 1 | 3 | 8;
  notification_id?: number;
};

export type GrantPointsResponse = {
  status: 0 | 1 | 3 | 8;
  point_balance?: number;
};

export type SetAdminAcknowledgedResponse = {
  status: 0 | 1 | 3 | 8;
  admin_acknowledged?: boolean;
};

export const AdminUsers = {
  list: async (cursor?: string | null, limit?: number, q?: string | null): Promise<AdminUserListResponse> => {
    try {
      const actor_nickname = (await SecureStore.getItemAsync("username")) || "";
      const { data } = await adminApi.get("/community/admin/users", {
        params: {
          actor_nickname,
          cursor: cursor ?? undefined,
          limit: limit ?? 50,
          q: q && String(q).trim() ? String(q).trim() : undefined,
        },
      });
      return data ?? { status: 8, items: [], next_cursor: null };
    } catch (e: any) {
      console.error("AdminUsers.list error:", e?.response?.data || e?.message || e);
      return { status: 8, items: [], next_cursor: null };
    }
  },

  notifyUser: async (
    targetNickname: string,
    actorNickname: string,
    title: string,
    body: string,
  ): Promise<AdminNotifyUserResponse> => {
    try {
      const { data } = await adminApi.post(`/community/admin/users/${encodeURIComponent(targetNickname)}/notify`, {
        actor_nickname: actorNickname,
        title: (title || "").trim(),
        body: (body || "").trim(),
      });
      return data ?? { status: 8 };
    } catch (e: any) {
      console.error("AdminUsers.notifyUser error:", e?.response?.data || e?.message || e);
      return { status: 8 };
    }
  },

  getDetail: async (targetNickname: string, actorNickname: string): Promise<AdminUserDetailResponse> => {
    try {
      const { data } = await adminApi.get(`/community/admin/users/${encodeURIComponent(targetNickname)}`, {
        params: { actor_nickname: actorNickname },
      });
      return data ?? { status: 8 };
    } catch (e: any) {
      console.error("AdminUsers.getDetail error:", e?.response?.data || e?.message || e);
      return { status: 8 };
    }
  },

  setRestrictions: async (
    targetNickname: string,
    actorNickname: string,
    changes: Array<{ post_type: number; days: number }>,
    reason?: string,
  ): Promise<SetRestrictionsResponse> => {
    try {
      const { data } = await adminApi.post(`/community/admin/users/${encodeURIComponent(targetNickname)}/restrictions`, {
        actor_nickname: actorNickname,
        changes,
        reason: reason?.trim() || undefined,
      });
      return data ?? { status: 8 };
    } catch (e: any) {
      console.error("AdminUsers.setRestrictions error:", e?.response?.data || e?.message || e);
      return { status: 8 };
    }
  },
};

export const OwnerUsers = {
  grantPoints: async (
    targetNickname: string,
    actorNickname: string,
    amount: number,
    reason: string,
  ): Promise<GrantPointsResponse> => {
    try {
      const { data } = await adminApi.post(`/community/owner/users/${encodeURIComponent(targetNickname)}/points`, {
        actor_nickname: actorNickname,
        amount,
        reason: (reason || "").trim(),
      });
      return data ?? { status: 8 };
    } catch (e: any) {
      console.error("OwnerUsers.grantPoints error:", e?.response?.data || e?.message || e);
      return { status: 8 };
    }
  },

  setAdminAcknowledged: async (
    targetNickname: string,
    actorNickname: string,
    admin_acknowledged: boolean,
  ): Promise<SetAdminAcknowledgedResponse> => {
    try {
      const { data } = await adminApi.post(
        `/community/owner/users/${encodeURIComponent(targetNickname)}/admin-acknowledged`,
        { actor_nickname: actorNickname, admin_acknowledged }
      );
      return data ?? { status: 8, admin_acknowledged: false };
    } catch (e: any) {
      console.error("OwnerUsers.setAdminAcknowledged error:", e?.response?.data || e?.message || e);
      return { status: 8, admin_acknowledged: false };
    }
  },
};

export type AppVersionCheckResponse = {
  status: number;
  platform: "android" | "ios";
  current_version?: string | null;
  latest_version: string;
  min_supported_version: string;
  force_update: boolean;
  store_url?: string | null;
  message?: string | null;
};

export const AppMeta = {
  checkVersion: async (platform: "android" | "ios", current_version: string): Promise<AppVersionCheckResponse> => {
    const { data } = await api.get<AppVersionCheckResponse>("/community/app/version", {
      params: { platform, current_version },
    });
    return data;
  },
};

// -------------------- TossPayments (SSOT) --------------------
export type TossOrderCreateResponse = {
  status: number;
  orderId: string;
  amount: number;
  orderName: string;
  customerName: string;
};

export const Orders = {
  createTossCashOrder: async (username: string, amount: number): Promise<TossOrderCreateResponse> => {
    const { data } = await api.post<TossOrderCreateResponse>("/orders/create", { username, amount });
    return data;
  },
};

export type TossConfirmResponse = {
  status: number;
  alreadyPaid?: boolean;
  orderId: string;
  amount: number;
  paymentKey?: string;
  approvedAt?: string | null;
  toss?: { method?: string; status?: string };
};

export const Payments = {
  confirmToss: async (payload: { paymentKey: string; orderId: string; amount: number }): Promise<TossConfirmResponse> => {
    const { data } = await api.post<TossConfirmResponse>("/payments/toss/confirm", payload);
    return data;
  },
};


export type StatusType = "published" | "closed";

export const Posts = {
  list: async (
    opts?: {
      username?: string;
      cursor?: string;
      status?: "published" | "closed";
      limit?: number;
      province?: string;
      city?: string;
      regions?: string; // 콤마로 구분된 복수 지역 코드
    }
  ): Promise<{ items: Post[]; next_cursor?: string }> => {
    const params: Record<string, any> = {};
    if (opts?.username) params.username = opts.username;
    if (opts?.cursor) params.cursor = opts.cursor;
    if (opts?.status) params.status = opts.status;
    params.limit = opts?.limit ?? 100; // 기본값 100
    if (opts?.province) params.province = opts.province;
    if (opts?.city) params.city = opts.city;
    if (opts?.regions) params.regions = opts.regions;
    try {
      const { data } = await api.get("/community/posts", { params });
      return data ?? { items: [], next_cursor: undefined };
    } catch (e: any) {
      // 401은 상위에서 세션 만료 처리할 수 있게 그대로 던짐
      if (e?.response?.status === 401) throw e;
      return { items: [], next_cursor: undefined };
    }
  },

  listByType: async (
    postType: number,
    opts?: {
      username?: string;
      cursor?: string;
      status?: "published" | "closed";
      limit?: number;
      province?: string;
      city?: string;
      regions?: string; // 콤마로 구분된 복수 지역 코드
    }
  ): Promise<{ items: Post[]; next_cursor?: string }> => {
    const params: Record<string, any> = {};

    if (opts?.username) params.username = opts.username;
    if (opts?.cursor) params.cursor = opts.cursor;
    if (opts?.status) params.status = opts.status;
    params.limit = opts?.limit ?? 100; // 기본값 100
    if (opts?.province) params.province = opts.province;
    if (opts?.city) params.city = opts.city;
    if (opts?.regions) params.regions = opts.regions;

    try {
      const { data } = await api.get(`/community/posts/type/${postType}`, { params });
      return data ?? { items: [], next_cursor: undefined };
    } catch (e: any) {
      // 401은 상위에서 세션 만료 처리할 수 있게 그대로 던짐
      if (e?.response?.status === 401) throw e;
      return { items: [], next_cursor: undefined };
    }
  },

  searchTitle: async (
    q: string,
    opts?: {
      post_type?: number;
      cursor?: string;
      limit?: number;
      status?: "published" | "closed";
      username?: string;
    },
  ): Promise<{ items: Post[]; next_cursor?: string }> => {
    const params: Record<string, any> = {
      q: (q || "").trim(),
      post_type: opts?.post_type ?? 1,
      limit: opts?.limit ?? 50,
    };
    if (opts?.cursor) params.cursor = opts.cursor;
    if (opts?.status) params.status = opts.status;
    if (opts?.username) params.username = opts.username;
    const { data } = await api.get(`/community/posts/search/title`, { params });
    return data ?? { items: [], next_cursor: undefined };
  },

  mylist: async (postType: number, username: string, params?: {
    cursor?: string;
    limit?: number;
    status?: string;
  }) => {
    try {
      const query = new URLSearchParams();

      if (params?.cursor) query.append("cursor", params.cursor);
      if (params?.limit) query.append("limit", String(params.limit));
      if (params?.status) query.append("status", params.status);

      const { data } = await api.get(
        `/community/posts/type/${postType}/my/${encodeURIComponent(username)}?${query.toString()}`
      );

      return data;
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },


  get: async (id: number): Promise<Post> => {
    const { data } = await api.get(`/community/posts/${id}`);
    return data;
  },

  // 구인글 관리: 재등록(기존 글 복제 후 새 글로 등록)
  recreate: async (postId: number, username: string): Promise<Post> => {
    const { data } = await api.post(
      `/community/posts/${postId}/recreate/${encodeURIComponent(username)}`
    );
    return data;
  },

  create: async (payload: PostInput, username: string): Promise<Post> => {
    const { data } = await api.post(`/community/posts/${encodeURIComponent(username)}`, payload);
    return data;
  },

  createByType: async (
    payload: PostInput,
    username: string,
    postType: number
  ): Promise<Post> => {
    const { data } = await api.post(
      `/community/posts/${encodeURIComponent(username)}/type/${postType}`,
      payload
    );
    return data;
  },

  update: async (id: number, patch: PostPatch): Promise<Post> => {
    const { data } = await api.put(`/community/posts/${id}`, patch);
    return data;
  },

  // 토큰 기반 인증/헤더를 사용하지 않습니다.
  changeStatus: async (id: number, status: StatusType): Promise<Post> => {
    const { data } = await api.put(`/community/posts/${id}`, { status });
    return data;
  },

  remove: async (id: number): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.delete(`/community/posts/${id}`);
    return data;
  },

  like: async (postId: number, username: string) => {
    try {
      const { data } = await api.post(
        `/community/posts/${postId}/like/${encodeURIComponent(username)}`
      );
      return data ?? { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  unlike: async (postId: number, username: string) => {
    try {
      const { data } = await api.delete(
        `/community/posts/${postId}/like/${encodeURIComponent(username)}`
      );
      return data ?? { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  listLiked: async <T = any>(opts: { username: string; cursor?: string; limit?: number }) => {
    const params: Record<string, any> = {};
    if (opts.cursor) params.cursor = opts.cursor;
    if (opts.limit) params.limit = opts.limit;

    const { data } = await api.get<LikedListResponse<T>>(
      `/community/posts/liked/${encodeURIComponent(opts.username)}`,
      { params }
    );
    return data ?? { items: [], next_cursor: undefined };
  },

  listCustom: async (opts?: { username?: string; cursor?: string; limit?: number; status?: "published" | "closed" }) => {
    const params: Record<string, any> = {};
    if (opts?.username) params.username = opts.username;
    if (opts?.cursor) params.cursor = opts.cursor;
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.status) params.status = opts.status;
    try {
      const { data } = await api.get(`/community/posts/custom`, { params });
      return data ?? { items: [], next_cursor: undefined };
    } catch (e: any) {
      // 401은 상위에서 로그인 만료 처리할 수 있게 그대로 던짐
      if (e?.response?.status === 401) throw e;
      return { items: [], next_cursor: undefined };
    }
  },
};

export type Comment = {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
  parent_id?: number | null;
  is_deleted?: boolean;
};

export const Comments = {
  list: (postId: number, cursor?: string, limit = 20) =>
    api
      .get(`/community/posts/${postId}/comments`, {
        params: { cursor, limit },
      })
      .then(
        (r) =>
          r.data as {
            items: Comment[];
            next_cursor?: string;
          },
      ),

  create: async (postId: number, username: string, content: string) => {
    try {
      const { data } = await api.post(
        `/community/posts/${postId}/comments/${encodeURIComponent(username)}`,
        { content }, // parent_id 없음 → 일반 댓글
      );
      return { ok: true, comment: data as Comment };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  reply: async (
    postId: number,
    parentCommentId: number,
    username: string,
    content: string,
  ) => {
    try {
      const { data } = await api.post(
        `/community/posts/${postId}/comments/${encodeURIComponent(username)}`,
        { content, parent_id: parentCommentId },
      );
      return { ok: true, comment: data as Comment };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  update: async (commentId: number, username: string, content: string) => {
    try {
      const { data } = await api.put(
        `/community/comments/${commentId}/${encodeURIComponent(username)}`,
        { content },
      );
      return { ok: true, comment: data as Comment };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  remove: async (commentId: number, username: string) => {
    try {
      await api.delete(
        `/community/comments/${commentId}/${encodeURIComponent(username)}`,
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

export const Notify = {
  notifyToUser: async (username: string, title: string, body: string, data: any = {}, type: string = "system") => {
    return api.post(`/notify/my/${encodeURIComponent(username)}`, {
      title,
      body,
      data,
      type,
    });
  },

  getAllNotifications: async (username: string) => {
    const { data } = await api.get(`/notify/my/${encodeURIComponent(username)}`);
    return data;
  },

  getUnreadNotifications: async (username: string) => {
    const { data } = await api.get(`/notify/my/${encodeURIComponent(username)}/unread`);
    return data;
  },

  getUnreadCount: async (username: string) => {
    const { data } = await api.get(`/notify/my/${encodeURIComponent(username)}/unread/count`);
    return data.unread_count;
  },

  markNotificationRead: async (notification_id: number) => {
    const { data } = await api.post(`/notify/read/${notification_id}`);
    return data;
  },

  markAllNotificationsReadByUser: async (username: string) => {
    const { data } = await api.post(`/notify/my/${encodeURIComponent(username)}/read-all`);
    return data;
  },

  getAdminSentNotifications: async (actorNickname: string, opts?: { limit?: number }) => {
    const { data } = await api.get(`/notify/sent/${encodeURIComponent(actorNickname)}`, {
      params: { limit: opts?.limit ?? 300 },
    });
    return data;
  },

  // 서버에 일괄 읽음 엔드포인트가 없어서, 클라이언트에서 id들을 순회 호출합니다.
  // - 실패한 항목은 무시하고 나머지는 계속 처리합니다.
  markAllNotificationsRead: async (notification_ids: number[]) => {
    const ids = Array.from(
      new Set(
        (notification_ids ?? [])
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v) && v > 0),
      ),
    );

    if (ids.length === 0) return { status: "ok", processed: 0 };

    const results = await Promise.allSettled(ids.map((id) => api.post(`/notify/read/${id}`)));
    const processed = results.filter((r) => r.status === "fulfilled").length;
    return { status: "ok", processed };
  },
};