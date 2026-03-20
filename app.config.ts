import type { ExpoConfig } from '@expo/config';
import 'dotenv/config';

const projectId = "7e453f68-12ca-4c44-97ae-06a0b7178649";
const APP_ENV = process.env.APP_ENV ?? "preview";
const DEFAULT_PROD_API = "https://api.daewon469.com";
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID ?? "eifczgze0p";
const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? "6b463e22639b1f1c21a652838d95a99f";
const API_BASE_URL =
  process.env.API_BASE_URL ?? DEFAULT_PROD_API;

const config: ExpoConfig = {
  name: "분양프로",
  slug: "mvp",
  version: "1.1.1",
  orientation: "portrait",
  icon: "./assets/images/logo10.png",
  // TossPayments WebView 결제 성공/실패 딥링크 수신용
  // 기존 스킴도 유지(기존 링크 호환)
  scheme: ["bunyangpro", "smartgauge"],
  // 다크모드 비활성화: 항상 라이트 고정
  userInterfaceStyle: "light",
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.smartgauge.bunyangpro",
  },
  android: {
    googleServicesFile: "./google-services.json",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.smartgauge.bunyangpro",
    permissions: ["POST_NOTIFICATIONS"],

  },
  notification: {
    "icon": "./assets/images/notification-icon.png",
    "color": "#ffffff",
    "androidMode": "default",
    "androidCollapsedTitle": "알림"
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      }
    ],
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",
          kotlinVersion: "2.0.21"
        }
      }
    ],
    "./plugins/withAndroidXBrowserVersion",
    "expo-dev-client",
    "expo-secure-store"
  ],
  experiments: {
    typedRoutes: true
  },
  updates: {
    url: `https://u.expo.dev/${projectId}`
  },
  runtimeVersion: "1.0.0",
  extra: {
    router: {},
    eas: { projectId },
    env: APP_ENV,
    apiBaseUrl: API_BASE_URL,
    naverClientId: NAVER_CLIENT_ID,
    kakaoMapJsKey: KAKAO_MAP_JS_KEY
  }
};

export default config;
