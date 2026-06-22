import { AxiosError, isAxiosError } from "axios";

export const LOGIN_FAIL_MESSAGE = "아이디 또는 비밀번호를 확인하세요.";
export const NETWORK_FAIL_MESSAGE = "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
export const SERVER_FAIL_MESSAGE = "서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";

export const SIGNUP_STATUS_MESSAGES: Record<number, string> = {
  1: "이미 등록된 닉네임[ID]이 있습니다!",
  2: "비밀번호가 일치하지 않습니다!",
  3: "성함을 입력해 주세요!",
  4: "전화번호를 입력해 주세요!",
  5: "거주지역을 입력해 주세요!",
  6: "추천인코드가 올바르지 않습니다!",
  7: "추천인코드는 1회만 적용할 수 있습니다.",
  8: "추천인 처리 중 DB 오류가 발생했습니다.",
  9: "휴대폰 인증이 필요합니다.",
  10: "이미 등록된 휴대폰 번호가 있습니다.",
};

export const USER_UPDATE_STATUS_MESSAGES: Record<number, string> = {
  3: "비밀번호 확인이 필요합니다.",
  4: "비밀번호와 비밀번호 확인이 일치하지 않습니다.",
  9: "휴대폰 인증이 필요합니다.",
};

export const PHONE_VERIFY_STATUS_MESSAGES: Record<number, string> = {
  2: "인증번호가 만료되었습니다. 다시 발송해주세요.",
  3: "인증 시도 횟수를 초과했습니다. 다시 발송해주세요.",
  4: "인증번호가 올바르지 않습니다.",
};

export function resolveSignupMessage(status: number, detail?: string | null): string {
  if (detail?.trim()) return detail.trim();
  return SIGNUP_STATUS_MESSAGES[status] ?? "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
}

export function resolveUserUpdateMessage(status: number, detail?: string | null): string {
  if (detail?.trim()) return detail.trim();
  return USER_UPDATE_STATUS_MESSAGES[status] ?? "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
}

export function resolvePhoneVerifyMessage(status: number): string | null {
  return PHONE_VERIFY_STATUS_MESSAGES[status] ?? null;
}

function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = String(detail[0] ?? "").trim();
    return first || null;
  }
  return null;
}

export function isNetworkError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    const msg = String((error as { message?: string })?.message ?? "").trim();
    return msg === "Network Error";
  }
  return !error.response;
}

export function getApiErrorMessage(error: unknown, fallback = SERVER_FAIL_MESSAGE): string {
  if (isNetworkError(error)) return NETWORK_FAIL_MESSAGE;

  if (!isAxiosError(error)) {
    const msg = String((error as { message?: string })?.message ?? "").trim();
    return msg && msg !== "Network Error" ? msg : fallback;
  }

  const ax = error as AxiosError;
  const detail = extractDetail(ax.response?.data);
  if (detail && detail !== "Network Error") return detail;

  const status = ax.response?.status;
  if (status === 400) return "입력 정보를 확인해 주세요.";
  if (status === 401) return LOGIN_FAIL_MESSAGE;
  if (status === 409) {
    if (detail?.includes("referral_code")) {
      return "추천인 코드 생성에 실패했습니다. 관리자에게 문의해주세요.";
    }
    return "처리 중 충돌이 발생했습니다. 다시 시도해 주세요.";
  }
  if (status && status >= 500) return SERVER_FAIL_MESSAGE;

  return fallback;
}
