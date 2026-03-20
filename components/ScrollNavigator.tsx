import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

type Props = {
    scrollY: Animated.Value;
    getMetrics: () => { contentHeight: number; layoutHeight: number };
    onTop: () => void;
    onBottom: () => void;

    topOffset?: number;
    bottomOffset?: number;
    rightOffset?: number;   // 우측 여백
    barWidth?: number;      // 스크롤 너비(얇게: 3~4 추천)
    trackOpacity?: number;  // 트랙 투명도(더 투명하게: 0.15~0.25)
    thumbOpacity?: number;  // thumb 투명도
    thumbColor?: string;    // thumb 색상
    buttonOpacity?: number; // 버튼 투명도(더 투명하게: 0.25~0.4)
    showButtons?: boolean;  // 맨 위/아래 버튼 표시 여부
};

const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

export default function ScrollNavigator({
    scrollY,
    getMetrics,
    onTop,
    onBottom,

    topOffset = 0,
    bottomOffset = 0, // 기존 값 유지 (필요시 BottomBarHeight+여백으로 교체)
    rightOffset = 10,

    barWidth = 3,
    trackOpacity = 0.22,
    thumbOpacity = 0.65,
    thumbColor = "#FF0000",
    buttonOpacity = 1,
    showButtons = true,
}: Props) {
    // ✅ state로 높이 관리
    const [contentHeight, setContentHeight] = useState(0);
    const [layoutHeight, setLayoutHeight] = useState(0);
    const [trackHeight, setTrackHeight] = useState(1);

    // getMetrics를 통해 state 업데이트
    React.useEffect(() => {
        const metrics = getMetrics();
        setContentHeight(prev => {
            if (prev !== metrics.contentHeight) {
                return metrics.contentHeight;
            }
            return prev;
        });
        setLayoutHeight(prev => {
            if (prev !== metrics.layoutHeight) {
                return metrics.layoutHeight;
            }
            return prev;
        });
    }, [getMetrics]);

    // 모든 hooks를 early return 전에 호출해야 함
    const safeContent = Math.max(contentHeight, 0);
    const safeLayout = Math.max(layoutHeight, 1);
    const maxScroll = Math.max(safeContent - safeLayout, 0);
    
    // 트랙 높이 기반으로 thumb 계산
    const thumbHeight = useMemo(() => {
        // 트랙이 아직 측정 전이면 대충
        if (trackHeight <= 1) return 40;
        if (safeContent <= 0 || safeLayout <= 0) return 40;
        const ratio = clamp(safeLayout / safeContent, 0, 1);
        const h = trackHeight * ratio;
        return clamp(h, 28, trackHeight);
    }, [trackHeight, safeLayout, safeContent]);

    // thumb의 하단이 트랙의 하단에 정확히 붙도록 계산
    const maxTranslateY = useMemo(() => {
        if (trackHeight <= 1 || thumbHeight <= 0) return 0;
        return Math.max(trackHeight - thumbHeight, 0);
    }, [trackHeight, thumbHeight]);
    
    // 안전한 interpolate 생성
    const zeroValue = React.useRef(new Animated.Value(0)).current;
    const translateY = useMemo(() => {
        if (maxScroll > 0 && maxTranslateY > 0) {
            return scrollY.interpolate({
                inputRange: [0, maxScroll],
                outputRange: [0, maxTranslateY],
                extrapolate: "clamp",
            });
        }
        return zeroValue;
    }, [scrollY, maxScroll, maxTranslateY]);

    // early return은 모든 hooks 호출 후에
    const isScrollable = contentHeight > layoutHeight + 20;
    if (!isScrollable) return null;

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.wrapper,
                {
                    top: topOffset,
                    bottom: bottomOffset,
                    right: rightOffset,
                },
            ]}
        >
            {/* ✅ 트랙: 상/하단 툴바 사이를 "꽉" 채움 */}
            <View
                pointerEvents="none"
                style={[
                    styles.track,
                    { width: barWidth },
                ]}
                onLayout={(e) => setTrackHeight(e.nativeEvent.layout.height)}
            >
                {/* 트랙 배경만 반투명(thumb는 영향받지 않게) */}
                <View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: `rgba(255,255,255,${trackOpacity})`,
                            borderRadius: 999,
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.thumb,
                        {
                            width: barWidth,
                            height: thumbHeight,
                            opacity: thumbOpacity,
                            backgroundColor: thumbColor,
                            transform: [{ translateY }],
                        },
                    ]}
                />
            </View>

            {/* ✅ 버튼: 우측하단에 모아서 배치 + 더 투명 */}
            {showButtons && (
                <View style={styles.buttons} pointerEvents="box-none">
                    <Pressable
                        onPress={onTop}
                        style={[styles.fab, { opacity: buttonOpacity }]}
                        hitSlop={10}
                    >
                        <Ionicons name="chevron-up" size={20} color="#111" />
                    </Pressable>

                    <View style={{ height: 10 }} />

                    <Pressable
                        onPress={onBottom}
                        style={[styles.fab, { opacity: buttonOpacity }]}
                        hitSlop={10}
                    >
                        <Ionicons name="chevron-down" size={20} color="#111" />
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        right: 20,      // (2번에서 스크롤바 더 오른쪽으로 옮길 때 조정)

        width: 52,       // ✅ 34 -> 52 (공간 확보)
        alignItems: "flex-end", // ✅ center -> flex-end (트랙을 오른쪽 끝으로)
        justifyContent: "space-between",
        zIndex: 50,
    },
    arrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "black",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 0,

        marginRight: 20, // ✅ 버튼만 왼쪽으로 (값 커질수록 더 왼쪽)
    },
    track: {
        flex: 1,
        backgroundColor: "transparent",
        overflow: "hidden",
        borderRadius: 999,

    },
    thumb: {
        borderRadius: 999,
    },
    buttons: {
        position: "absolute",
        right: 32,
        bottom: 0, // ✅ 우측하단 고정
        alignItems: "center",
    },
    fab: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.9)",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
});
