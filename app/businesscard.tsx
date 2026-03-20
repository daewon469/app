import React, { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Switch, Text as RNText, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);
const DEFAULT = {
  name: "조 홍 래",
  titleLine1: "SmartGauge App 창업가",
  titleLine2: "앱 외주 개발사 스마트게이지 대표",
  email: "E-Mail : smartgauge@smartgauge.co.kr",
  phone: "Mobile : 010-2487-9329",
  web: "Web : www.smartgauge.co.kr",
  address: "Office : 경기도 평택시 고덕중앙로 322, 에이스 S-TOWER 지식산업센터 7층 726호"
};

export default function BusinessCardScreen() {
  const LOGO = require("../assets/images/logo7.png");
  const [name, setName] = useState(DEFAULT.name);
  const [title1, setTitle1] = useState(DEFAULT.titleLine1);
  const [title2, setTitle2] = useState(DEFAULT.titleLine2);
  const [email, setEmail] = useState(DEFAULT.email);
  const [phone, setPhone] = useState(DEFAULT.phone);
  const [web, setWeb] = useState(DEFAULT.web);
  const [address, setAdress] = useState(DEFAULT.address);
  const [dark, setDark] = useState(false);

  const theme = useMemo(() => {
    if (dark) {
      return {
        bg: "#0f1115",
        panel: "#151922",
        text: "#f4f6fa",
        sub: "#aab3c5",
        accent: "#7aa2f7",
        divider: "#232935",
      };
    }
    return {
      bg: "#f7f7f9",
      panel: "#E5D7C4",
      text: "#1e2430",
      sub: "#334155",
      accent: "#007AFF",
      divider: "#eceff4",
    };
  }, [dark]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16 }}>
      {/* 다크 모드 스위치 */}
      <View style={styles.row}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>Business Card</Text>
        <View style={styles.row}>
          <Text style={{ color: theme.sub, marginRight: 8 }}>Dark</Text>
          <Switch value={dark} onValueChange={setDark} />
        </View>
      </View>
      {/* 명함 미리보기 */}
      <View style={{
        width: 360,
        height: 200,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.divider,
        padding: 20,
        marginTop: 20
      }}>

        <View
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            flexDirection: "row"
          }}
        >
          <Image
            source={LOGO}
            style={{ width: 40, height: 40, borderRadius: 8 }}
            resizeMode="contain"
          />
          <Text style={{ marginTop: 8, marginStart: 6, fontSize: 16, fontWeight: "600" }}>스마트게이지</Text>
        </View>


        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop:17 }}>
 
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "400", marginRight: 8 }}>
            {name}
          </Text>
          <Text style={{ color: theme.sub, fontSize: 14, marginStart: 4 }}>대표</Text>
        </View>
        <View style={{ height: 8 }} />
        <Text style={{ color: theme.sub, fontSize: 12 }}>Tel : 031-665-9329</Text>

        <Text style={{ color: theme.sub, fontSize: 12 }}>{phone}</Text>
        <Text style={{ color: theme.sub, fontSize: 12 }}>{web}</Text>

        <Text style={{ color: theme.sub, fontSize: 12 }}>{email}</Text>
        <Text style={{ color: theme.sub, fontSize: 12, marginBottom: 6 }}>{address}</Text>
      
        <View
          style={{
            borderTopWidth: 0.6,
            borderTopColor: "#4A4A4A", 
            paddingTop: 3,           
    
            width: '100%',
         
            marginEnd: -10,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '500',
              color: '#4A4A4A',
              letterSpacing: 0.5,
              textAlign: 'right',
            }}
          >
            웹 · 앱 서비스 개발 및 운영
          </Text>
        </View>
        
      </View>

      <View style={{
        width: 360,
        height: 200,
        backgroundColor: "#E5D7C4",
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: theme.divider,
        marginTop: 20
      }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
          <Image
            source={require('../assets/images/logo7.png')}
            style={{ width: 70, height: 70, borderRadius: 12 }}
            resizeMode="contain"
          />
          <Text style={{
            fontSize: 28,
            marginStart: 4,
            fontWeight: 'bold',
            letterSpacing: 1.5,
            color: 'black'
          }}>SMARTGAUGE</Text>
        </View>

        <View style={{ position: 'absolute', right: 20, bottom: 20, marginRight: 15 }}>
          <Text style={{ fontSize: 10, color: "#334155", textAlign: 'right', fontWeight: 400 }}>
           Strategic Thinking
          </Text>
          <Text style={{ fontSize: 10, color: "#334155", textAlign: 'right', fontWeight: 400 }}>
          Swift Execution
          </Text>
          <Text style={{ fontSize: 10, color: "#334155", textAlign: 'right', fontWeight: 400 }}>
          Structural Judgment
          </Text>
          <Text style={{ fontSize: 10, color: "#334155", textAlign: 'right', fontWeight: 400 }}>
          Systematic Expansion
          </Text>
        </View>

      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 6, fontSize: 14 },

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});
