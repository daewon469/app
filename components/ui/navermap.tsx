import React from "react";
import { Pressable, Text as RNText, TextInput as RNTextInput, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { KAKAO_MAP_JS_KEY } from "@/constants/keys";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} allowFontScaling={false} />
);

type Props = {
  title: string;               
  placeholder?: string;       
  placeholderTextColor?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  under?:number | null;
  onOpenModal: () => void;              
};

export default function AddressSection({
  title,
  placeholder = "주소",
  placeholderTextColor,
  address,
  lat,
  lng,
  under,
  onOpenModal,
}: Props) {
  const colors = {
    text: "#000000",
    background: "#FFFFFF",
    border: "#000",
    // write/list 등 다른 입력칸 placeholder 톤과 맞춤
    placeholder: "#666",
  };
  
  return (
    <View style={{ gap:2 }}>
      <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: under, color: colors.text}}>{title}</Text>
      <TouchableOpacity onPress={onOpenModal}>
        <TextInput
          placeholder={placeholder}
          value={address ?? ""}
          editable={false}
          pointerEvents="none"
          placeholderTextColor={placeholderTextColor ?? colors.placeholder}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#fff",
            color: "#000000",
          }}
        />
      </TouchableOpacity>
      {lat && lng && (
        <Pressable
          onPress={onOpenModal}
          style={{
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#000",
            backgroundColor: "#fff",
          }}
        >
          <View style={{ height: 200 }}>
            <WebView
              style={{ width: "100%", height: "100%" }}
              originWhitelist={["*"]}
              source={{
                html: `
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body,#map{margin:0;height:100%}</style>
<script>
  function send(type,p){try{window.ReactNativeWebView.postMessage(JSON.stringify({type,...(p||{})}))}catch(e){}}
  window.onerror=function(msg){send('error',{message:String(msg)})}
</script>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_JS_KEY}&autoload=false"
  onload="send('sdk',{status:'loaded'})"
  onerror="send('sdk',{status:'failed'})"></script>
</head><body><div id="map"></div>
<script>
  (function(){
    function levelFromZoom(z){
      if(typeof z !== 'number' || !isFinite(z)) return 3;
      var lvl = Math.round(21 - z);
      if(lvl < 1) lvl = 1;
      if(lvl > 14) lvl = 14;
      return lvl;
    }

    if(!window.kakao || !kakao.maps || !kakao.maps.load){ send('error',{message:'Kakao SDK 로드 실패'}); return; }
    kakao.maps.load(function(){
      var center = new kakao.maps.LatLng(${lat}, ${lng});
      var map = new kakao.maps.Map(document.getElementById('map'), {
        center: center,
        level: levelFromZoom(16)
      });

      // 미니맵: 상호작용 최소화
      map.setDraggable(false);
      map.setZoomable(false);

      var marker = new kakao.maps.Marker({ position: center });
      marker.setMap(map);
    });
  })();
</script></body></html>
                `,
                baseUrl:"https://api.smartgauge.co.kr",
              }}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}
