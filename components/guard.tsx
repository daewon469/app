import React from "react";
import { Pressable, View } from "react-native";

export default function GuardedTouch({
  enabled,
  children,
  onRequireLogin,
}: {
  enabled: boolean;
  children: React.ReactNode;
  onRequireLogin?: () => void;
}) {
  return (
    <View style={{ position: "relative" }}>
      {/* children은 그대로 터치 가능 영역에 둔다 */}
      {children}

      {/* enabled=true이면 오버레이가 터치를 가로챔 */}
      {enabled && (
        <Pressable
          onPress={onRequireLogin}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          }}
        />
      )}
    </View>
  );
}
