export const buildKakaoMapUrl = (lat: number, lng: number, name = "위치") =>
  `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;

export const openExternalKakaoMap = async (lat: number, lng: number, name = "위치") => {
  const { Linking } = await import("react-native");
  const appUrl = `kakaomap://look?p=${lat},${lng}`;
  const webUrl = buildKakaoMapUrl(lat, lng, name);
  const canOpen = await Linking.canOpenURL(appUrl);
  return Linking.openURL(canOpen ? appUrl : webUrl);
};

// 호환 유지(기존 코드가 import 중인 경우를 위해 남김)
export const buildNaverMapUrl = buildKakaoMapUrl;
export const openExternalNaverMap = openExternalKakaoMap;
  