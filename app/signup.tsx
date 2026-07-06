import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "../utils/secureStorage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, KeyboardAvoidingView, Platform, Pressable, Text as RNText, TextInput as RNTextInput, TouchableOpacity, View } from "react-native";
import RegionSelectModal from "../components/RegionSelectModal";
import ScrollNavigator from "../components/ScrollNavigator";
import { Auth } from "../lib/api";
import {
  getApiErrorMessage,
  resolvePhoneVerifyMessage,
  resolveSignupMessage,
  resolveUserUpdateMessage,
} from "../lib/authErrors";
import { inputFontWeightStyle } from "../utils/inputStyle";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);
// 전화번호 포맷
const mobile = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

const phoneDigits = (value: string) => (value || "").replace(/[^0-9]/g, "");

export default function SignupScreen() {
  const [password, setPassword] = useState("");
  const [password_confirm, setPassword_confirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [username, setUserName] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [originalPhoneNumber, setOriginalPhoneNumber] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [region, setRegion] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const params = useLocalSearchParams<{ mode?: string; username?: string; marketing_consent?: string }>();
  const isEditMode = params.mode === "edit";
  const originalUsername = params.username as string | undefined;
  const marketingConsent = params.marketing_consent === "1";
  const [loading, setLoading] = useState(false);
  const today = new Date();
  const signup_date = today.toISOString().slice(0, 10);

  const phoneChanged =
    isEditMode &&
    phoneDigits(phoneNumber) !== phoneDigits(originalPhoneNumber);
  const canPhoneVerify = !isEditMode || phoneChanged;

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const [contentHeight, setContentHeight] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState(1);

  const getMetrics = useCallback(
    () => ({
      contentHeight,
      layoutHeight,
    }),
    [contentHeight, layoutHeight]
  );

  useEffect(() => {
    if (!isEditMode || !originalUsername) return;

    (async () => {
      try {
        setLoading(true);
        const res = await Auth.getUser(originalUsername);
        if (res.status === 0 && res.user) {
          setUserName(res.user.username);
          setName(res.user.name || "");
          setOriginalPhoneNumber(res.user.phone_number || "");
          setPhoneNumber(mobile(res.user.phone_number || ""));
          // 수정모드에서는 기존 번호를 "검증 완료"로 취급하지 않음(회원가입만 인증 강제)
          setPhoneVerificationId(null);
          setPhoneCode("");
          setPhoneSent(false);
          setPhoneVerified(false);
          setRegion(res.user.region || "");
        } else {
          Alert.alert("오류", "회원 정보를 불러올 수 없습니다.");
        }
      } catch (e: unknown) {
        Alert.alert("오류", getApiErrorMessage(e, "회원 정보를 불러오는데 실패했습니다."));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditMode, originalUsername]);

  const sendPhoneCode = async () => {
    if (!canPhoneVerify) return;
    if (!phoneNumber.trim()) {
      Alert.alert("알림", "전화번호를 입력해 주세요.");
      return;
    }
    try {
      setSendingSms(true);
      const res = await Auth.sendPhoneVerification(phoneNumber.trim());
      if (res.status === 0 && res.verification_id) {
        setPhoneVerificationId(res.verification_id);
        setPhoneSent(true);
        setPhoneVerified(false);
        setPhoneCode("");
        Alert.alert("알림", "인증번호를 발송했습니다.");
        return;
      }
      Alert.alert("오류", "인증번호 발송에 실패했습니다.");
    } catch (e: unknown) {
      Alert.alert("발송 실패", getApiErrorMessage(e, "인증번호 발송에 실패했습니다."));
    } finally {
      setSendingSms(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!canPhoneVerify) return;
    if (!phoneVerificationId) {
      Alert.alert("알림", "먼저 인증번호를 발송해주세요.");
      return;
    }
    if (!phoneCode.trim()) {
      Alert.alert("알림", "인증번호를 입력해 주세요.");
      return;
    }
    try {
      setVerifyingCode(true);
      const res = await Auth.verifyPhoneCode(phoneVerificationId, phoneCode.trim());
      if (res.status === 0 && res.verified) {
        setPhoneVerified(true);
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
      setVerifyingCode(false);
    }
  };

  const submit = async () => {
    // 입력 검증
    if (!isEditMode) {
      if (!username.trim()) {
        Alert.alert("알림", "닉네임을 입력해 주세요.");
        return;
      }
      if (username.trim().length < 2) {
        Alert.alert("알림", "닉네임은 최소 2글자 이상이어야 합니다.");
        return;
      }
      if (!password || password.length < 2) {
        Alert.alert("알림", "비밀번호는 최소 2글자 이상이어야 합니다.");
        return;
      }
      if (password !== password_confirm) {
        Alert.alert("알림", "비밀번호가 일치하지 않습니다.");
        return;
      }
      if (!name.trim()) {
        Alert.alert("알림", "성함을 입력해 주세요.");
        return;
      }
      if (!phoneVerified) {
        Alert.alert("알림", "휴대폰 인증을 완료해주세요.");
        return;
      }
      if (!region.trim()) {
        Alert.alert("알림", "거주지역을 입력해 주세요!");
        return;
      }
    }

    if (isEditMode) {
      try {
        const payload: {
          username?: string;
          password?: string;
          password_confirm?: string;
          name?: string;
          phone_number?: string;
          phone_verification_id?: string;
          region?: string;
        } = {
          username: username.trim() || undefined,
          name: name.trim() || undefined,
          phone_number: phoneNumber.trim() || undefined,
          phone_verification_id: phoneChanged ? (phoneVerificationId ?? undefined) : undefined,
          region: region.trim() || undefined,
        };

        if (phoneChanged && !phoneVerified) {
          Alert.alert("알림", "전화번호 변경 시 휴대폰 인증을 완료해주세요.");
          return;
        }

        if (password || password_confirm) {
          if (!password || !password_confirm) {
            Alert.alert("알림", "비밀번호 변경 시 비밀번호와 확인을 모두 입력해 주세요.");
            return;
          }
          if (password.length < 2) {
            Alert.alert("알림", "비밀번호는 최소 2글자 이상이어야 합니다.");
            return;
          }
          if (password !== password_confirm) {
            Alert.alert("알림", "비밀번호가 일치하지 않습니다.");
            return;
          }
          payload.password = password;
          payload.password_confirm = password_confirm;
        }

        const res = await Auth.updateUser(originalUsername ?? username, payload);

        if (res.status === 0) {
          await SecureStore.setItemAsync("username", res.username);
          Alert.alert("알림", "내 정보가 수정되었습니다.", [
            { text: "확인", onPress: () => router.back() },
          ]);
          return;
        }

        Alert.alert("알림", resolveUserUpdateMessage(res.status, res.detail));
      } catch (e: unknown) {
        Alert.alert("수정 실패", getApiErrorMessage(e, "회원 정보 수정에 실패했습니다."));
      }

    } else {
      try {
        const res = await Auth.signUp(
          username.trim(),
          password,
          password_confirm,
          name.trim() || undefined,
          phoneNumber.trim() || undefined,
          phoneVerificationId ?? undefined,
          region.trim() || undefined,
          referralCode.trim() || undefined,
          marketingConsent,
        );
        if (res.status === 0) {
          const referralAmount = Number(res.referral_bonus_referred_amount ?? 0);
          const signupAmount = Number(res.signup_bonus_amount ?? 0);
          let msg = "회원가입 성공!";
          if (referralAmount > 0) {
            msg = `회원가입 성공!\n추천인 가입 포인트 ${referralAmount}점 지급`;
          } else if (signupAmount > 0) {
            msg = `회원가입 성공!\n가입 축하 포인트 ${signupAmount}점 지급`;
          }
          Alert.alert("알림", msg, [
            { text: "확인", onPress: () => router.replace("/login") },
          ]);
          return;
        }

        Alert.alert("알림", resolveSignupMessage(res.status, res.detail));
      } catch (e: unknown) {
        Alert.alert("회원가입 실패", getApiErrorMessage(e, "회원가입에 실패했습니다. 다시 시도해주세요."));
      }
    }
  };

  const colors = {
    background: "#fff",
    card: "#f9f9f9",
    text: "#000",
    border: "#000",
    primary: "#4A6CF7",
    link: "blue",
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.select({ ios: "padding", android: "height" }) as any}
      keyboardVerticalOffset={100}
    >
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: colors.background, paddingBottom: 40 }}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >

        <View>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 닉네임 (한글가능)</Text>
          <TextInput
            placeholder="닉네임을 입력해 주세요."
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUserName}
            style={[inputStyle, inputFontWeightStyle(username)]}
          />
        </View>

        <View>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 비밀번호</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="비밀번호를 입력해 주세요."
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{ flex: 1, padding: 12, color: colors.text, ...inputFontWeightStyle(password) }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 비밀번호 확인</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="비밀번호를 한번 더 입력해 주세요."
              placeholderTextColor="#666"
              value={password_confirm}
              onChangeText={setPassword_confirm}
              secureTextEntry={!showPasswordConfirm}
              style={{ flex: 1, padding: 12, color: colors.text, ...inputFontWeightStyle(password_confirm) }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPasswordConfirm((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 표시"}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showPasswordConfirm ? "eye-off" : "eye"} size={20} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 성함</Text>
          <TextInput
            placeholder="성함을 입력해 주세요."
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            style={[inputStyle, inputFontWeightStyle(name)]}
          />
        </View>

        <View>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 핸드폰</Text>
          <View style={inputRowStyle}>
            <TextInput
              placeholder="예) 010-1234-5678"
              placeholderTextColor="#666"
              value={phoneNumber}
              onChangeText={(v) => {
                setPhoneNumber(mobile(v));
                // 번호 변경 시 인증 상태 초기화
                setPhoneVerificationId(null);
                setPhoneCode("");
                setPhoneSent(false);
                setPhoneVerified(false);
              }}
              style={{ flex: 1, padding: 12, color: colors.text, ...inputFontWeightStyle(phoneNumber) }}
              keyboardType="phone-pad"
            />
            {canPhoneVerify && (
              <TouchableOpacity
                onPress={sendPhoneCode}
                disabled={sendingSms || !phoneNumber.trim()}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border,
                  opacity: sendingSms ? 0.6 : 1,
                }}
              >
                <Text style={{ color: phoneVerified ? "#2e7d32" : colors.primary, fontWeight: "bold" }}>
                  {phoneVerified ? "완료" : phoneSent ? "재전송" : "인증"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {canPhoneVerify && (
          <View>
            <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 인증번호</Text>
            <View style={inputRowStyle}>
              <TextInput
                placeholder="인증번호 6자리"
                placeholderTextColor="#666"
                value={phoneCode}
                onChangeText={(v) => setPhoneCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                style={{ flex: 1, padding: 12, color: colors.text, ...inputFontWeightStyle(phoneCode) }}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                onPress={verifyPhoneCode}
                disabled={verifyingCode || phoneVerified || !phoneCode.trim()}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border,
                  opacity: verifyingCode ? 0.6 : 1,
                }}
              >
                <Text style={{ color: phoneVerified ? "#2e7d32" : colors.primary, fontWeight: "bold" }}>
                  {phoneVerified ? "완료" : "확인"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View>
          <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 지역</Text>
          <Pressable onPress={() => setRegionModalOpen(true)}>
            <TextInput
              value={region}
              placeholder="지역 선택"
              placeholderTextColor="#666"
              editable={false}
              style={[inputStyle, inputFontWeightStyle(region)]}
              pointerEvents="none"
            />
          </Pressable>
        </View>

        {!isEditMode && (
          <View>
            <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>※ 추천인코드 (선택)</Text>
            <TextInput
              placeholder="코드번호 입력 (5자리)"
              placeholderTextColor="#666"
              value={referralCode}
              onChangeText={setReferralCode}
              style={[inputStyle, inputFontWeightStyle(referralCode)]}
              autoCapitalize="none"
            />
          </View>
        )}

        <RegionSelectModal
          visible={regionModalOpen}
          onClose={() => setRegionModalOpen(false)}
          singleStep
          onSelect={(province) => {
            setRegion(province);
          }}
        />

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            paddingVertical: 12,
            alignItems: "center",
            marginTop: 22,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
            {isEditMode ? "수정하기" : "등록"}
          </Text>
        </TouchableOpacity>
      </Animated.ScrollView>

      <ScrollNavigator
        scrollY={scrollY}
        getMetrics={getMetrics}
        onTop={() => scrollRef.current?.scrollTo?.({ y: 0, animated: true })}
        onBottom={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
        rightOffset={0}
        topOffset={0}
        bottomOffset={0}
        trackOpacity={0.45}
        thumbOpacity={1}
        barWidth={4}
        showButtons={false}
      />
    </KeyboardAvoidingView>
  );
}