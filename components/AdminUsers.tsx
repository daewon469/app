import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform, Text, TouchableOpacity } from "react-native";
import { API_URL } from "../lib/api";

async function saveToAndroidDownloads(localUri: string, filename: string) {

  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) throw new Error("폴더 접근 권한이 필요합니다.");

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    filename,
    mime
  );
  await FileSystem.writeAsStringAsync(newUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return newUri;
}

export default function AndroidDownloadButton() {
  const onPress = async () => {
    try {
      const url = `${API_URL}/community/users/export`;
      const filename = `users_${Date.now()}.xlsx`;
      const localUri = FileSystem.documentDirectory + filename;

      const { uri } = await FileSystem.downloadAsync(
        url,
        localUri,
        {}
      );

      if (Platform.OS === "android") {
        await saveToAndroidDownloads(uri, filename);
        Alert.alert("저장 완료", "선택한 폴더에 엑셀 파일이 저장되었습니다.");
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "엑셀 파일 열기/공유",
        });
      }
    } catch (e: any) {
      Alert.alert("실패", e?.message ?? "파일 저장에 실패했습니다.");
    }
  };


  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: "#4A6CF7",
        borderRadius: 16,
        paddingVertical: 4,
        marginStart: 6,
        paddingHorizontal: 6,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>유저목록 다운로드</Text>
    </TouchableOpacity>);
}
