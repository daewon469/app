import React, { useState } from "react";
import { Text, View } from "react-native";
import { Appbar } from "react-native-paper";

export default function Bell() {
    const [showBadge, setShowBadge] = useState(false);

    return (
        <View
            style={{
                marginLeft: 14,
                borderWidth: 1,
                borderColor: "gray",
                borderRadius: 6,
                marginTop: -20,
                backgroundColor: "#fff",
                position: "relative",

            }}
        >
            <Appbar.Action
                icon="bell"
                onPress={() => setShowBadge(!showBadge)} // 토글
                style={{ marginVertical: -1 }}
            />

            {showBadge && (
                <>
                    {/* 빨간 말풍선 */}
                    <View
                        style={{
                            position: "absolute",
                            top: -8,
                            right: -8,
                            backgroundColor: "#ef4444",
                            borderRadius: 12,
                            minWidth: 20,
                            height: 20,
                            paddingHorizontal: 4,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                            2
                        </Text>
                    </View>

                    {/* 말풍선 꼬리 */}
                    <View
                        style={{
                            position: "absolute",
                            top: 6,
                            right: 2,
                            width: 6,
                            height: 6,
                            backgroundColor: "#ef4444",
                            transform: [{ rotate: "45deg" }],
                            borderRadius: 1,
                        }}
                    />
                </>
            )}
        </View>
    );
}
