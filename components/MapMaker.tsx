// components/MapMaker.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { BackHandler, Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { API_URL } from "../lib/api";

type Marker = { id: string; lat: number; lng: number; title?: string; desc?: string; selected?: boolean };
type MapViewState = { lat: number; lng: number; level: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  markers: Marker[];
  /** 마커 선택/해제. 지도 빈 곳 클릭 시 null로 호출 */
  onSelectMarker?: (id: string | null) => void;
  onMapStateChange?: (state: MapViewState) => void;
  /** 외부에서 지도 뷰(센터/레벨)를 강제로 설정하고 싶을 때 사용 */
  externalViewState?: MapViewState | null;
  /** WebView가 재로드되면 이전 위치로 복원하기 위한 getter */
  getRestoreViewState?: () => MapViewState | null;
  baseUrl?: string;
  allowedOrigins?: string[];
  initial?: { lat?: number; lng?: number; zoom?: number };
  /** 마커 클릭 시 인포윈도우(위치창) 표시 여부 */
  showMarkerInfoWindow?: boolean;
  /**
   * modal: 기존처럼 네이티브 Modal로 전체 화면 오버레이
   * inline: 부모 레이아웃 안에 그대로 렌더(상/하단 툴바 유지용)
   */
  presentation?: "modal" | "inline";
  /** modal 헤더 표시 여부 */
  showHeader?: boolean;
};

export default function MapMaker({
  visible,
  onClose,
  clientId,
  markers,
  onSelectMarker,
  onMapStateChange,
  externalViewState,
  getRestoreViewState,
  baseUrl = API_URL,
  allowedOrigins = [],
  initial,
  showMarkerInfoWindow = true,
  presentation = "modal",
  showHeader = true,
}: Props) {
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (presentation === "modal" && visible) { onClose(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [visible, onClose, presentation]);

  const html = useMemo(() => {
    const initLat = initial?.lat ?? 36.5;
    const initLng = initial?.lng ?? 127.9;
    const initZoom = initial?.zoom ?? 7;

    return `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html,body{margin:0;height:100%;font-family:system-ui, -apple-system, sans-serif}
    #map{height:100%}
    .iw{padding:6px 8px;font-size:13px;line-height:1.4}
    .iw b{display:block;margin-bottom:4px}
    /* 선택 마커 강조(파란 마커는 유지하고, 오버레이로만 강조) */
    .selDot{
      width:12px;height:12px;border-radius:999px;
      background: rgba(239,68,68,0.98); /* red */
      box-shadow:
        0 0 0 2px rgba(255,255,255,0.95),
        0 6px 18px rgba(0,0,0,0.28);
      /* 기본 카카오 마커(끝점이 좌표) 기준으로 머리 쪽으로 올림 */
      transform: translate(0.8px, -21px);
    }
  </style>
  <script>
    const RN = window.ReactNativeWebView;
    function send(obj){ try{ RN.postMessage(JSON.stringify(obj)) }catch(e){} }
    window.onerror = function(msg){ send({type:'error', message: String(msg)}) };

    // ✅ 환경별 호환: window + document 모두에 message 리스너 부착
    function attachMessageListener(handler){
      window.addEventListener('message', handler);
      document.addEventListener('message', handler);
    }
  </script>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${clientId}&autoload=false&libraries=services"></script>
  </head><body>
    <div id="map"></div>
    <script>
      (function(){
        const SHOW_INFO_WINDOW = ${showMarkerInfoWindow ? "true" : "false"};
        function levelFromZoom(z){
          if(typeof z !== 'number' || !isFinite(z)) return 7;
          var lvl = Math.round(21 - z);
          if(lvl < 1) lvl = 1;
          if(lvl > 14) lvl = 14;
          return lvl;
        }

        if(!window.kakao || !kakao.maps || !kakao.maps.load){ send({type:'error', message:'Kakao SDK load failed'}); return; }

        kakao.maps.load(function(){
          const map = new kakao.maps.Map(document.getElementById('map'), {
            center: new kakao.maps.LatLng(${initLat}, ${initLng}),
            level: levelFromZoom(${initZoom})
          });

          // 현재 렌더된 마커/오버레이 상태(선택만 바뀌면 전체 재렌더/fitBounds를 피하기 위함)
          let markers = [];      // kakao.maps.Marker[]
          let infoWins = [];     // kakao.maps.InfoWindow[]
          let overlays = [];     // kakao.maps.CustomOverlay[]
          let lastSignature = ""; // id@lat,lng 시그니처
          let suppressNextMapClick = false;
        
        // ✅ 지도 상태 저장(뒤로가기 복원용)
        kakao.maps.event.addListener(map, 'idle', function(){
          try{
            const c = map.getCenter();
            send({ type:'state', lat: c.getLat(), lng: c.getLng(), level: map.getLevel() });
          }catch(e){}
        });

        // ✅ 지도 빈 곳 클릭 시: 선택 해제(카드 닫기) 용도
        kakao.maps.event.addListener(map, 'click', function(){
          if(suppressNextMapClick){
            suppressNextMapClick = false;
            return;
          }
          try{
            infoWins.forEach(i => i.close());
          }catch(e){}
          send({ type:'map_click' });
        });

        function clearAll(){
          markers.forEach(m => m.setMap(null));
          markers = [];
          infoWins.forEach(i => i.close());
          infoWins = [];
          overlays.forEach(o => o.setMap(null));
          overlays = [];
          lastSignature = "";
        }

        function escapeHtml(s){
          return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        }

        function buildSignature(list){
          // id + 좌표 기준으로 렌더링 동일성 판단(선택 토글만 바뀌면 signature는 유지됨)
          return (list || []).map(m => String(m.id) + "@" + String(m.lat) + "," + String(m.lng)).join("|");
        }

        function updateSelectionOverlays(list){
          // 선택 오버레이만 갱신(파란 마커는 그대로 유지)
          overlays.forEach(o => o.setMap(null));
          overlays = [];

          (list || []).forEach(m => {
            if(!m || !m.selected) return;
            const pos = new kakao.maps.LatLng(m.lat, m.lng);
            const overlay = new kakao.maps.CustomOverlay({
              position: pos,
              content: '<div class="selDot"></div>',
              xAnchor: 0.5,
              yAnchor: 1.0,
              zIndex: 10
            });
            overlay.setMap(map);
            overlays.push(overlay);
          });
        }

        function renderMarkers(list){
          if(!Array.isArray(list)) list = [];

          // ✅ 좌표 형 변환(문자열 → 숫자) 및 유효성 필터
          list = list.map(m => ({
            ...m,
            lat: typeof m.lat === 'string' ? parseFloat(m.lat) : m.lat,
            lng: typeof m.lng === 'string' ? parseFloat(m.lng) : m.lng,
          })).filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lng));

          if(list.length === 0) return;

          const sig = buildSignature(list);
          const sameSignature = (sig === lastSignature) && markers.length === list.length;

          // 선택만 바뀐 케이스면: 마커 재생성/fitBounds 없이 오버레이만 갱신
          if(sameSignature){
            updateSelectionOverlays(list);
            return;
          }

          clearAll();

          const bounds = new kakao.maps.LatLngBounds();
          list.forEach(m => {
            const pos = new kakao.maps.LatLng(m.lat, m.lng);
            const marker = new kakao.maps.Marker({ position: pos });
            marker.setMap(map);
            const info = (SHOW_INFO_WINDOW && (m.title || m.desc)) ? new kakao.maps.InfoWindow({
              content: '<div class="iw">' +
                        (m.title ? ('<b>'+escapeHtml(m.title)+'</b>') : '') +
                        (m.desc ? ('<div>'+escapeHtml(m.desc)+'</div>') : '') +
                       '</div>'
            }) : null;
            kakao.maps.event.addListener(marker, 'click', () => {
              suppressNextMapClick = true;
              setTimeout(() => { suppressNextMapClick = false; }, 0);
              if(SHOW_INFO_WINDOW && info){
                infoWins.forEach(i => i.close());
                info.open(map, marker);
              }
              send({ type:'marker_click', id: m.id });
            });
            markers.push(marker);
            if(info) infoWins.push(info);
            bounds.extend(pos);
          });

          // 선택 오버레이 렌더(마커 위 강조)
          updateSelectionOverlays(list);
          lastSignature = sig;

          if(list.length===1){
            map.setCenter(new kakao.maps.LatLng(list[0].lat, list[0].lng));
            map.setLevel(4);
          } else {
            map.setBounds(bounds);
          }
        }

        // ✅ RN → WebView 메시지(이중 리스너)
        attachMessageListener((e) => {
          try {
            const msg = JSON.parse(e.data);
            if(msg.type === 'set_markers'){ renderMarkers(msg.payload || []); }
            if(msg.type === 'fit_bounds' && Array.isArray(msg.payload)){
              const b = new kakao.maps.LatLngBounds();
              msg.payload.forEach(([lat,lng]) => b.extend(new kakao.maps.LatLng(lat,lng)));
              map.setBounds(b);
            }
            if(msg.type === 'set_view' && msg.payload){
              const lat = parseFloat(msg.payload.lat);
              const lng = parseFloat(msg.payload.lng);
              const level = parseInt(msg.payload.level, 10);
              if(isFinite(lat) && isFinite(lng)){
                map.setCenter(new kakao.maps.LatLng(lat, lng));
              }
              if(isFinite(level)){
                map.setLevel(level);
              }
            }
          } catch(_) {}
        });

        // 준비 완료 신호
        send({ type:'ready' });
        });
      })();
    </script>
  </body></html>`;
  }, [clientId, initial, showMarkerInfoWindow]);

  const source = useMemo(() => ({ html, baseUrl }), [html, baseUrl]);

  // WebView → RN 메시지
  const handleMessage = (e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "ready") {
        // ✅ ready 시 마커 재전송
        webRef.current?.postMessage(JSON.stringify({ type: "set_markers", payload: markers }));
        const restore = getRestoreViewState?.();
        if (restore) {
          webRef.current?.postMessage(JSON.stringify({ type: "set_view", payload: restore }));
        }
      } else if (data.type === "marker_click") {
        onSelectMarker?.(data.id);
      } else if (data.type === "map_click") {
        onSelectMarker?.(null);
      } else if (data.type === "state") {
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        const level = Number(data.level);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(level)) {
          onMapStateChange?.({ lat, lng, level });
        }
      }
    } catch {}
  };

  // ✅ 모달 열릴 때도 안전하게 1회 전송 (ready 미수신 대비)
  useEffect(() => {
    if (visible) {
      webRef.current?.postMessage(JSON.stringify({ type: "set_markers", payload: markers }));
    }
  }, [visible, markers]);

  // ✅ 외부에서 줌/센터 제어(예: + / - 버튼)
  useEffect(() => {
    if (!visible) return;
    if (!externalViewState) return;
    webRef.current?.postMessage(JSON.stringify({ type: "set_view", payload: externalViewState }));
  }, [visible, externalViewState]);

  return (
    presentation === "inline" ? (
      visible ? (
        <View style={{ flex: 1 }}>
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={source}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            onShouldStartLoadWithRequest={(req) => {
              const url = req.url || "";
              const allow = (
                url.startsWith("about:blank") ||
                url.startsWith("data:text/html") ||
                (baseUrl && url.startsWith(baseUrl)) ||
                (allowedOrigins || []).some((o) => url.startsWith(o))
              );
              return allow;
            }}
            style={{ flex: 1 }}
          />
        </View>
      ) : null
    ) : (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1 }}>
          {showHeader ? (
            <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "600" }}>지도검색</Text>
              <Pressable onPress={onClose} style={{ marginRight: 6 }}>
                <Text style={{ color: "#007aff" }}>닫기</Text>
              </Pressable>
            </View>
          ) : null}
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={source}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            onShouldStartLoadWithRequest={(req) => {
              const url = req.url || "";
              const allow = (
                url.startsWith("about:blank") ||
                url.startsWith("data:text/html") ||
                (baseUrl && url.startsWith(baseUrl)) ||
                (allowedOrigins || []).some((o) => url.startsWith(o))
              );
              return allow;
            }}
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    )
  );
}
