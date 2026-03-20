import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";
import * as SecureStore from "expo-secure-store";
import { router, useLocalSearchParams } from "expo-router";
import { API_URL, Orders, Payments } from "../../lib/api";

type TossSuccess = { kind: "success"; paymentKey: string; orderId: string; amount: number };
type TossFail = { kind: "fail"; code?: string; message?: string; orderId?: string };

function parseQuery(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const qIndex = url.indexOf("?");
  if (qIndex < 0) return out;
  const query = url.slice(qIndex + 1);
  for (const part of query.split("&")) {
    if (!part) continue;
    const [k, v] = part.split("=", 2);
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

function parseTossDeepLink(url: string): TossSuccess | TossFail | null {
  // 예: smartgauge://toss/success?paymentKey=...&orderId=...&amount=...
  // 예: smartgauge://toss/fail?code=...&message=...&orderId=...
  if (!url.startsWith("smartgauge://") && !url.startsWith("bunyangpro://")) return null;
  if (!url.includes("://toss/")) return null;

  if (url.includes("://toss/success")) {
    const q = parseQuery(url);
    const paymentKey = q.paymentKey ?? "";
    const orderId = q.orderId ?? "";
    const amount = Number(q.amount ?? 0);
    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) return null;
    return { kind: "success", paymentKey, orderId, amount };
  }

  if (url.includes("://toss/fail")) {
    const q = parseQuery(url);
    return {
      kind: "fail",
      code: q.code,
      message: q.message,
      orderId: q.orderId,
    };
  }

  return null;
}

export default function TossPaymentScreen() {
  const params = useLocalSearchParams<{ amount?: string }>();
  const selectedAmount = useMemo(() => Number(params.amount ?? 50000), [params.amount]);

  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const username = (await SecureStore.getItemAsync("username")) ?? "";
        if (!username) {
          Alert.alert("알림", "로그인이 필요합니다.");
          router.back();
          return;
        }

        const order = await Orders.createTossCashOrder(username, selectedAmount);
        if (order.status !== 0) {
          Alert.alert("오류", "주문 생성에 실패했습니다.");
          router.back();
          return;
        }

        const url =
          `${API_URL}/pay/toss` +
          `?orderId=${encodeURIComponent(order.orderId)}` +
          `&amount=${encodeURIComponent(String(order.amount))}` +
          `&orderName=${encodeURIComponent(order.orderName)}` +
          `&customerName=${encodeURIComponent(order.customerName)}`;

        setPayUrl(url);
      } catch (e: any) {
        Alert.alert("오류", e?.response?.data?.detail ? String(e.response.data.detail) : "결제를 시작할 수 없습니다.");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedAmount]);

  if (loading || !payUrl) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: payUrl }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => setLoading(false)}
      onShouldStartLoadWithRequest={(req: WebViewNavigation) => {
        const url = req.url ?? "";
        const parsed = parseTossDeepLink(url);
        if (!parsed) return true;

        // 딥링크 이동은 반드시 막아야 무한 로딩 방지됨
        try {
          webViewRef.current?.stopLoading();
        } catch {}

        if (parsed.kind === "fail") {
          Alert.alert("결제 실패", parsed.message ? `${parsed.code ?? ""}\n${parsed.message}` : "결제가 취소되었거나 실패했습니다.");
          router.back();
          return false;
        }

        (async () => {
          try {
            setLoading(true);
            const res = await Payments.confirmToss({
              paymentKey: parsed.paymentKey,
              orderId: parsed.orderId,
              amount: parsed.amount,
            });

            if (res.status === 0) {
              Alert.alert("결제 완료", "캐시 충전이 완료되었습니다.", [
                {
                  text: "확인",
                  onPress: () => {
                    // 마이페이지로 돌아가면 useEffect로 최신 cash_balance를 다시 읽음
                    router.replace("/myboard");
                  },
                },
              ]);
            } else {
              Alert.alert("오류", "결제 승인 처리에 실패했습니다.");
              router.back();
            }
          } catch (e: any) {
            const msg =
              e?.response?.data?.detail
                ? typeof e.response.data.detail === "string"
                  ? e.response.data.detail
                  : JSON.stringify(e.response.data.detail)
                : e?.message ?? "결제 승인에 실패했습니다.";
            Alert.alert("오류", msg);
            router.back();
          } finally {
            setLoading(false);
          }
        })();

        return false;
      }}
    />
  );
}

