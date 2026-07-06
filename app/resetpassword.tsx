import { Auth } from "@/lib/api";
import { getApiErrorMessage, resolvePhoneVerifyMessage, resolveResetPasswordMessage } from "@/lib/authErrors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState, type ComponentProps } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";

const Text = (props: ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

const mobile = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

export default function ResetPasswordScreen() {
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewPw2, setShowNewPw2] = useState(false);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  const colors = {
    background: "#fff",
    card: "#f9f9f9",
    text: "#000",
    border: "#000",
    primary: "#4A6CF7",
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
    color: colors.text,
  } as const;

  const inputRowStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
  } as const;

  const sendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert("알림", "전화번호를 입력해주세요.");
      return;
    }
    try {
      setSending(true);
      const res = await Auth.sendPhoneVerification(phoneNumber.trim());
      if (res.status === 0 && res.verification_id) {
        setVerificationId(res.verification_id);
        setSent(true);
        setVerified(false);
        setPhoneCode("");
        Alert.alert("알림", "인증번호를 발송했습니다.");
        return;
      }
      Alert.alert("오류", "인증번호 발송에 실패했습니다.");
    } catch (e: unknown) {
      Alert.alert("발송 실패", getApiErrorMessage(e, "인증번호 발송에 실패했습니다."));
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationId) {
      Alert.alert("알림", "먼저 인증번호를 발송해주세요.");
      return;
    }
    if (!phoneCode.trim()) {
      Alert.alert("알림", "인증번호를 입력해주세요.");
      return;
    }
    try {
      setVerifying(true);
      const res = await Auth.verifyPhoneCode(verificationId, phoneCode.trim());
      if (res.status === 0 && res.verified) {
        setVerified(true);
        Alert.alert("알림", "휴대폰 인증이 완료되었습니다.");
        return;
      }
      const verifyMsg = resolvePhoneVerifyMessage(res.status);
      if (verifyMsg) {
        Alert.alert("알림", verifyMsg);
        return;
      }
      Alert.alert("오류", "인증에 실패했습니다. 다시 시도해주세요.");
    } catch (e: unknown) {
      Alert.alert("인증 실패", getApiErrorMessage(e, "인증에 실패했습니다. 다시 시도해주세요."));
    } finally {
      setVerifying(false);
    }
  };

  const resetPassword = async () => {
    if (submittingRef.current || saving) return;
    if (!username.trim()) {
      Alert.alert("알림", "아이디(닉네임)를 입력해주세요.");
      return;
    }
    if (!verified || !verificationId) {
      Alert.alert("알림", "휴대폰 인증을 완료해주세요.");
      return;
    }
    if (!newPw || newPw.length < 2) {
      Alert.alert("알림", "새 비밀번호는 최소 2글자 이상이어야 합니다.");
      return;
    }
    if (newPw !== newPw2) {
      Alert.alert("알림", "새 비밀번호가 일치하지 않습니다.");
      return;
    }
    submittingRef.current = true;
    try {
      setSaving(true);
      const res = await Auth.resetPasswordByPhone(
        username.trim(),
        phoneNumber.trim(),
        verificationId,
        newPw,
        newPw2,
      );
      if (res.status === 0) {
        Alert.alert("완료", "비밀번호가 재설정되었습니다.", [
          { text: "로그인으로", onPress: () => router.replace("/login") },
          { text: "닫기", style: "cancel" },
        ], { cancelable: true });
        return;
      }
      Alert.alert("알림", resolveResetPasswordMessage(res.status, res.detail));
    } catch (e: unknown) {
      Alert.alert("재설정 실패", getApiErrorMessage(e, "비밀번호 재설정에 실패했습니다. 다시 시도해주세요."));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.select({ ios: "padding", android: "height" }) as "padding" | "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}>비밀번호 찾기</Text>

        <View>
          <Text style={{ color: colors.text, marginBottom: 6 }}>아이디(닉네임)</Text>
          <TextInput
            placeholder="username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View>
          <Text style={{ color: colors.text, marginBottom: 6 }}>휴대폰 번호</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="010-1234-5678"
              placeholderTextColor="#666"
              value={phoneNumber}
              onChangeText={(v) => {
                setPhoneNumber(mobile(v));
                setVerificationId(null);
                setPhoneCode("");
                setSent(false);
                setVerified(false);
              }}
              keyboardType="phone-pad"
              style={{ flex: 1, padding: 12, color: colors.text }}
            />
            <TouchableOpacity
              onPress={sendCode}
              disabled={sending || !phoneNumber.trim()}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: colors.border, opacity: sending ? 0.6 : 1 }}
            >
              <Text style={{ color: verified ? "#2e7d32" : colors.primary, fontWeight: "bold" }}>
                {verified ? "완료" : sent ? "재전송" : "인증"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={{ color: colors.text, marginBottom: 6 }}>인증번호</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="인증번호 6자리"
              placeholderTextColor="#666"
              value={phoneCode}
              onChangeText={(v) => setPhoneCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              style={{ flex: 1, padding: 12, color: colors.text }}
            />
            <TouchableOpacity
              onPress={verifyCode}
              disabled={verifying || verified || !sent || !phoneCode.trim()}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
                opacity: verifying || !sent ? 0.6 : 1,
              }}
            >
              <Text style={{ color: verified ? "#2e7d32" : colors.primary, fontWeight: "bold" }}>
                {verified ? "완료" : "확인"}
              </Text>
            </TouchableOpacity>
          </View>
          {!sent && (
            <Text style={{ color: colors.text, fontSize: 13, marginTop: 6 }}>
              먼저 인증번호를 발송한 뒤 입력해 주세요.
            </Text>
          )}
        </View>

        <View>
          <Text style={{ color: colors.text, marginBottom: 6 }}>새 비밀번호</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="새 비밀번호"
              placeholderTextColor="#666"
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry={!showNewPw}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, padding: 12, color: colors.text }}
            />
            <TouchableOpacity
              onPress={() => setShowNewPw((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showNewPw ? "비밀번호 숨기기" : "비밀번호 표시"}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showNewPw ? "eye-off" : "eye"} size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={{ color: colors.text, marginBottom: 6 }}>새 비밀번호 확인</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="새 비밀번호 확인"
              placeholderTextColor="#666"
              value={newPw2}
              onChangeText={setNewPw2}
              secureTextEntry={!showNewPw2}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, padding: 12, color: colors.text }}
            />
            <TouchableOpacity
              onPress={() => setShowNewPw2((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showNewPw2 ? "비밀번호 확인 숨기기" : "비밀번호 확인 표시"}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showNewPw2 ? "eye-off" : "eye"} size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={resetPassword}
          disabled={saving || !verified}
          style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 12, alignItems: "center", opacity: saving || !verified ? 0.6 : 1, marginTop: 8 }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>비밀번호 재설정</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
