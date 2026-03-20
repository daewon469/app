import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  uri: string;
  /** 초기 스케일(기본 1) */
  initialScale?: number;
  /** 최대 확대 배율(기본 3) */
  maxScale?: number;
  /** 더블탭 시 리셋(기본 true) */
  enableDoubleTapReset?: boolean;
  /** 더블탭 리셋 외에 외부에서 닫기 등 필요하면 */
  onResetToDefault?: () => void;
};

export default function ZoomableImage({
  uri,
  initialScale = 1,
  maxScale = 3,
  // 요청사항: 더블탭(두번 터치)로 되돌리기(리셋) 기능 제거
  // (호환성 유지를 위해 prop은 남기되, 내부 동작은 비활성화)
  enableDoubleTapReset: _enableDoubleTapReset = true,
  onResetToDefault,
}: Props) {
  void _enableDoubleTapReset;
  const scale = useSharedValue(initialScale);
  const savedScale = useSharedValue(initialScale);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // 컨테이너/이미지 메트릭(드래그 범위 clamp용)
  const containerW = useSharedValue(0);
  const containerH = useSharedValue(0);
  const baseW = useSharedValue(0); // scale=1일 때 contain 기준 실제 표시 폭
  const baseH = useSharedValue(0); // scale=1일 때 contain 기준 실제 표시 높이
  const [intrinsic, setIntrinsic] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // JS thread에서만 쓸 clamp (worklet에서 호출 금지)
  const clampJS = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const clampTranslate = (tx: number, ty: number, s: number) => {
    "worklet";
    const cw = containerW.value;
    const ch = containerH.value;
    const bw = baseW.value;
    const bh = baseH.value;
    if (cw <= 0 || ch <= 0 || bw <= 0 || bh <= 0 || s <= 1) return { x: 0, y: 0 };
    const maxX = Math.max((bw * s - cw) / 2, 0);
    const maxY = Math.max((bh * s - ch) / 2, 0);
    return {
      x: clamp(tx, -maxX, maxX),
      y: clamp(ty, -maxY, maxY),
    };
  };

  // worklet-safe reset: sharedValue를 UI thread에서 직접 초기화
  const resetAnimated = useMemo(() => {
    return () => {
      "worklet";
      scale.value = withTiming(initialScale, { duration: 180 });
      savedScale.value = initialScale;
      translateX.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
      savedX.value = 0;
      savedY.value = 0;
      // JS side-effect가 필요하면 worklet -> JS로만 넘김
      if (onResetToDefault) runOnJS(onResetToDefault)();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScale, onResetToDefault]);

  // 이미지 원본 크기 로드(contain 계산용)
  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (!alive) return;
        if (w > 0 && h > 0) setIntrinsic({ w, h });
      },
      () => {
        if (!alive) return;
        setIntrinsic(null);
      }
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  // JS에서도 쓸 clamp(원본 크기 로드 후 즉시 보정용)
  const clampTranslateJS = (tx: number, ty: number, s: number, cw: number, ch: number, bw: number, bh: number) => {
    if (cw <= 0 || ch <= 0 || bw <= 0 || bh <= 0 || s <= 1) return { x: 0, y: 0 };
    const maxX = Math.max((bw * s - cw) / 2, 0);
    const maxY = Math.max((bh * s - ch) / 2, 0);
    return {
      x: clampJS(tx, -maxX, maxX),
      y: clampJS(ty, -maxY, maxY),
    };
  };

  const recomputeBaseSize = (w: number, h: number, iw: number, ih: number) => {
    if (w <= 0 || h <= 0) return { bw: 0, bh: 0 };
    if (iw <= 0 || ih <= 0) return { bw: w, bh: h };
    const imageAR = iw / ih;
    const containerAR = w / h;
    if (imageAR > containerAR) return { bw: w, bh: w / imageAR };
    return { bw: h * imageAR, bh: h };
  };

  // 컨테이너 레이아웃 저장 (baseW/H는 effect에서 재계산)
  const onContainerLayout = (e: any) => {
    const w = Number(e?.nativeEvent?.layout?.width ?? 0);
    const h = Number(e?.nativeEvent?.layout?.height ?? 0);
    if (w <= 0 || h <= 0) return;
    containerW.value = w;
    containerH.value = h;
    setContainerSize({ w, h });
  };

  // 레이아웃/원본 크기 변화 시 contain 기준 baseW/H 재계산 + 현재 위치 즉시 보정
  useEffect(() => {
    const w = containerSize.w;
    const h = containerSize.h;
    if (w <= 0 || h <= 0) return;

    const iw = intrinsic?.w ?? 0;
    const ih = intrinsic?.h ?? 0;
    const { bw, bh } = recomputeBaseSize(w, h, iw, ih);
    baseW.value = bw;
    baseH.value = bh;

    const fixed = clampTranslateJS(translateX.value, translateY.value, scale.value, w, h, bw, bh);
    translateX.value = fixed.x;
    translateY.value = fixed.y;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.w, containerSize.h, intrinsic?.w, intrinsic?.h]);

  const pinch = useMemo(() => {
    return Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value;
      })
      .onUpdate((e) => {
        const next = savedScale.value * e.scale;
        const nextScale = clamp(next, 1, maxScale);
        scale.value = nextScale;
      })
      .onEnd(() => {
        // 너무 작게 끝나면 원상복구(스냅은 최소화)
        if (scale.value < 1) resetAnimated();
        if (scale.value > maxScale) {
          scale.value = withTiming(maxScale, { duration: 160 });
          savedScale.value = maxScale;
        }
      });
  }, [maxScale]);

  const pan = useMemo(() => {
    return Gesture.Pan()
      .onStart(() => {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      })
      .onUpdate((e) => {
        // 제약 풀기: 우선 드래그가 "무조건" 반응하도록(클램프/활성화 제약 제거)
        if (scale.value <= 1) return;
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      })
      .onEnd(() => {
        // 자동으로 원위치(0,0)로 되돌리지 않음
        // (요청사항: 줌/이동 중 손을 떼도 “돌아가지” 않게)
      });
  }, []);

  const composed = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      <GestureDetector gesture={composed}>
        <Animated.Image source={{ uri }} style={[styles.img, animatedStyle]} resizeMode="contain" />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  img: {
    width: "100%",
    height: "100%",
  },
});

