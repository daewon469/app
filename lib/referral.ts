import * as SecureStore from "../utils/secureStorage";

export const PLAY_STORE_APP_ID = "com.smartgauge.bunyangpro";
export const PLAY_STORE_BASE_URL =
  `https://play.google.com/store/apps/details?id=${PLAY_STORE_APP_ID}&hl=ko`;
export const REFERRAL_REFERRER_KEY = "referral_code";
export const PENDING_REFERRAL_CODE_KEY = "pending_referral_code";

/** 추천인코드가 포함된 Play Store 설치 링크 */
export function buildPlayStoreInstallUrl(referralCode: string | null | undefined) {
  const code = String(referralCode ?? "").trim();
  if (!code) return PLAY_STORE_BASE_URL;
  const referrer = `${REFERRAL_REFERRER_KEY}=${encodeURIComponent(code)}`;
  return `${PLAY_STORE_BASE_URL}&referrer=${encodeURIComponent(referrer)}`;
}

export function buildReferralMessage(referralCode: string | null | undefined) {
  const code = String(referralCode ?? "").trim() || "52330";
  const installUrl = buildPlayStoreInstallUrl(code);
  return `분양프로 설치 링크
${installUrl}

내 추천인코드: ${code}

안녕하세요! (__) (^.^)

<분양프로>는 분양상담사 구인구직에 최적화된 어플입니다.

무료로 구인등록 하시고, 다양한 포인트 혜택도 누려보세요!

지금 '플레이스토어'에서 <분양프로>를 다운 받아보세요^^
`;
}

/** Play Install Referrer 문자열에서 referral_code 추출 */
export function parseReferralCodeFromReferrer(referrer: string | null | undefined): string | null {
  const raw = String(referrer ?? "").trim();
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const params = new URLSearchParams(decoded.includes("=") ? decoded : `q=${decoded}`);
    const fromKey =
      params.get(REFERRAL_REFERRER_KEY) ||
      params.get("utm_content") ||
      params.get("ref");
    const code = String(fromKey ?? "").trim();
    return code || null;
  } catch {
    const m = raw.match(/(?:referral_code|utm_content|ref)=([^&]+)/i);
    if (!m?.[1]) return null;
    try {
      return decodeURIComponent(m[1]).trim() || null;
    } catch {
      return m[1].trim() || null;
    }
  }
}

export async function savePendingReferralCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return;
  await SecureStore.setItemAsync(PENDING_REFERRAL_CODE_KEY, trimmed);
}

export async function loadPendingReferralCode(): Promise<string | null> {
  const v = await SecureStore.getItemAsync(PENDING_REFERRAL_CODE_KEY);
  const code = String(v ?? "").trim();
  return code || null;
}

export async function clearPendingReferralCode() {
  await SecureStore.deleteItemAsync(PENDING_REFERRAL_CODE_KEY);
}

/**
 * Android Play Install Referrer 에서 추천인코드를 읽어 보관합니다.
 * (네이티브 모듈이 없거나 iOS면 조용히 스킵)
 */
export async function capturePlayInstallReferralCode(): Promise<string | null> {
  try {
    if (require("react-native").Platform.OS !== "android") return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlayInstallReferrer } = require("react-native-play-install-referrer");
    if (typeof PlayInstallReferrer?.getInstallReferrerInfo !== "function") return null;

    const referrerUrl: string | null = await new Promise((resolve) => {
      try {
        PlayInstallReferrer.getInstallReferrerInfo(
          (info: { installReferrer?: string } | null, error: unknown) => {
            if (error || !info) {
              resolve(null);
              return;
            }
            resolve(String(info.installReferrer ?? "") || null);
          },
        );
      } catch {
        resolve(null);
      }
    });

    const code = parseReferralCodeFromReferrer(referrerUrl);
    if (code) {
      await savePendingReferralCode(code);
      return code;
    }
  } catch {
    // Expo Go / 미링크 / iOS 등
  }
  return null;
}
