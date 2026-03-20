import { setWorkLocation } from "@/store/LocationSlice";
import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Modal, Pressable, SafeAreaView, Text as RNText, View } from "react-native";
import { WebView } from "react-native-webview";
import { useDispatch } from "react-redux";
import { LocationSel } from "../utils/type";
import { API_URL } from "../lib/api";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick?: (sel: LocationSel) => void;
  clientId: string;
  baseUrl?: string;
  allowedOrigins?: string[];
  initial?: { address?: string; lat?: number; lng?: number; zoom?: number };
};

export default function BusinessIdPicker({
  visible,
  onClose,
  onPick,
  clientId,
  baseUrl = API_URL,
  allowedOrigins = [],
  initial,
}: Props) {
  const dispatch = useDispatch();
  const [webViewKey, setWebViewKey] = useState(0);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) setWebViewKey((k) => k + 1);
  }, [visible]);

  const html = useMemo(() => {
    const initLat = initial?.lat;
    const initLng =  initial?.lng;
    const initZoom = initial?.zoom;
    const initAddr = initial?.address??"";


    return `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html,body{margin:0;height:100%;font-family:sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%}
    #top{padding:12px;display:flex;gap:8px}
    #q{flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:16px}
    #btn{padding:10px 14px;border:0;border-radius:8px;background:#1ec800;color:#fff;font-size:16px}
    #map{height:calc(100% - 60px)}
  </style>
  <script>
    function send(type,p){try{window.ReactNativeWebView.postMessage(JSON.stringify({type,...(p||{})}))}catch(e){}}
    window.onerror=function(msg){send('error',{message:String(msg)})}
  </script>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${clientId}&autoload=false&libraries=services"
    onload="send('sdk',{status:'loaded'})"
    onerror="send('sdk',{status:'failed'})"></script>
  </head><body>
    <div id="top">
      <input id="q" placeholder="주소를 입력하세요" value="${initAddr.replace(/"/g, '&quot;')}" />
      <button id="btn">검색</button>
    </div>
    <div id="map"></div>
  <script>
  (function init(){
    function levelFromZoom(z){
      if(typeof z !== 'number' || !isFinite(z)) return 3;
      var lvl = Math.round(21 - z);
      if(lvl < 1) lvl = 1;
      if(lvl > 14) lvl = 14;
      return lvl;
    }

    if(!window.kakao||!kakao.maps||!kakao.maps.load){send('error',{message:'Kakao SDK 로드 실패'});return;}

    kakao.maps.load(function(){
      var center = new kakao.maps.LatLng(${initLat}, ${initLng});
      var map = new kakao.maps.Map(document.getElementById('map'), { center: center, level: levelFromZoom(${initZoom}) });
      var marker = new kakao.maps.Marker({ position: center });
      marker.setMap(map);

      var ps = new kakao.maps.services.Places();

      function moveTo(lat, lng, zoom){
        var coord = new kakao.maps.LatLng(lat, lng);
        marker.setPosition(coord);
        map.setCenter(coord);
        if (typeof zoom === 'number') map.setLevel(levelFromZoom(zoom));
      }

      function runSearch(){
        var query = (document.getElementById('q').value || '').trim();
        if(!query){ send('warn',{message:'주소를 입력하세요'}); return; }

        ps.keywordSearch(query, function(data, status){
          if(status !== kakao.maps.services.Status.OK){
            send('warn',{message:'검색 결과 없음'}); return;
          }
          if(!data || !data.length){
            send('warn',{message:'검색 결과 없음'}); return;
          }

          var p = data[0];
          var lat = parseFloat(p.y);
          var lng = parseFloat(p.x);
          if(!isFinite(lat) || !isFinite(lng)){
            send('error',{message:'좌표 파싱 실패'}); return;
          }

          moveTo(lat, lng, 17);

          var addr = p.road_address_name || p.address_name || query;
          send('pick',{ address: addr, lat: lat, lng: lng });
        });
      }

      document.getElementById('btn').onclick = runSearch;
      document.getElementById('q').addEventListener('keydown', function(e){
        if(e.key==='Enter') runSearch();
      });
    });
  })();
  </script>
  </body></html>`;
  }, [clientId, initial]);

  const handleMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "pick") {
        const { address, lat, lng } = msg;
        dispatch(setWorkLocation({ work_lat: lat, work_lng: lng, work_address: address, work_zoom: 17 }));
        onPick?.({ lat, lng, address });
        onClose?.();
      }
    } catch { }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>주소 검색 & 위치 선택</Text>
          <Pressable onPress={onClose}><Text style={{ color: "#007aff" }}>닫기</Text></Pressable>
        </View>
        <WebView
          key={webViewKey}
          originWhitelist={["*"]}
          source={{ html, baseUrl }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          textZoom={100}

          onShouldStartLoadWithRequest={(req) => {
            const url = req.url || "";
            const allow = (
              url.startsWith("about:blank") ||
              url.startsWith("data:text/html") ||
              (baseUrl && url.startsWith(baseUrl)) ||
              allowedOrigins.some((o) => url.startsWith(o))
            );
            return allow;
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}