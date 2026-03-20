// app/newswebview.tsx
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";

export default function NewsWebView() {
  const { url } = useLocalSearchParams<{ url: string }>();

  if (!url) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <WebView
        source={{ uri: decodeURIComponent(url) }}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={{ marginTop: 40 }} />}
      />
    </SafeAreaView>
  );
}
