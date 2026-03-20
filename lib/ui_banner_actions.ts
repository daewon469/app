export type UIBannerClickAction = "link" | "referral_modal";

// 서버가 아직 click_action을 저장/반환하지 못하는 환경에서도 동작하도록,
// link_url에 저장 가능한 "액션 전용" 특수 값(스킴)을 지원합니다.
export const REFERRAL_MODAL_ACTION_LINK = "action:referral_modal";
// 레거시/오타 호환(서버/관리자 화면에서 이미 저장된 값이 있을 수 있음)
export const REFERRAL_MODAL_ACTION_LINK_LEGACY = "action:referal_modal";

export const normalizeBannerClickAction = (value: any): UIBannerClickAction => {
  return String(value || "").trim() === "referral_modal" ? "referral_modal" : "link";
};

export const isReferralModalAction = (value: any): boolean => {
  return normalizeBannerClickAction(value) === "referral_modal";
};

export const isReferralModalLinkUrl = (value: any): boolean => {
  const v = String(value || "").trim().toLowerCase();
  return v === REFERRAL_MODAL_ACTION_LINK || v === REFERRAL_MODAL_ACTION_LINK_LEGACY;
};

