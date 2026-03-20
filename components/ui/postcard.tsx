import { Link } from "expo-router";
import React from "react";
import { Image, Pressable, Text as RNText, StyleSheet, View } from "react-native";
import type { Post } from "../../lib/api";
import Heart from "./heart";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const styles = StyleSheet.create({
  card: {
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "white",
    borderRadius: 8,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 }, // 하단 그림자
    elevation: 4, // Android
  },
});

export default function Postcard({ post, disableImageZoom = false }: { post: Post; disableImageZoom?: boolean }) {
  // 목록 카드에서는 이미지 확대 모달을 사용하지 않습니다.
  void disableImageZoom;

  // 지역(산업/지역) 라벨: 업종/지역 도시 (ex: 아파트/경기 고양시)
  const industryProvinceCity = `${post.job_industry}/${formatProvinceCity(post.province, (post as any)?.city)}`;

  return (
    <>
      <Link href={{ pathname: "/[id]", params: { id: post.id } }} asChild>
        <Pressable style={styles.card}>

          <Heart
            postId={post.id}
            postLiked={post.liked}
            style={{
              position: "absolute",
              top: 50,
              right: 3,
              zIndex: 10,
            }}
          />
          <View style={{ flexDirection: "row" }}>
            {post.image_url && (
              <Image
                source={{ uri: post.image_url }}
                style={{ width: 100, height: 100, borderRadius: 4, margin: 6, marginBottom: 0 }}
              />
            )}
            <View style={{ flex: 1 }}>
              {/* 제목은 2줄 높이를 항상 확보해서(1줄/2줄) 파란줄 시작 위치를 동일하게 유지 */}
              <View style={{ paddingTop: 6, minHeight: 55, justifyContent: "flex-start" }}>
                <Text
                  style={{ fontWeight: "bold", fontSize: 18, color: "black" }}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {post.title}
                </Text>
              </View>

              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 15,
                  color: "#003366",
                  fontWeight: "bold",
                  lineHeight: 17,
                  marginBottom: 1,
                  marginTop: 6,
                }}
                numberOfLines={1}
              >
                {industryProvinceCity}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  // 파란/빨간 줄 사이를 살짝 띄움
                  marginTop: 1,
                }}
              >
                <Text style={{ fontSize: 15, color: "#8B0000", fontWeight: "bold", marginTop: 0, lineHeight: 17 }} numberOfLines={1}>
                  {[
                    post.total_use ? "총괄" : null,
                    post.branch_use ? "본부장" : null,
                    post.hq_use ? "본부" : null,
                    post.leader_use ? "팀장" : null,
                    post.member_use ? "팀원" : null,
                    post.team_use ? "팀" : null,
                    post.each_use ? "각개" : null,
                    post.other_role_name ? String(post.other_role_name) : null,
                  ]
                    .filter(Boolean)
                    .join("/") || "미정"}
                  {post.total_use ? "/" + formatFeeForList(post.total_fee) : ""}
                  {post.branch_use ? "/" + formatFeeForList(post.branch_fee) : ""}
                  {post.hq_use ? "/" + formatFeeForList(post.hq_fee) : ""}
                  {post.leader_use ? "/" + formatFeeForList(post.leader_fee) : ""}
                  {post.member_use ? "/" + formatFeeForList(post.member_fee) : ""}
                  {post.team_use ? "/" + formatFeeForList(post.team_fee) : ""}
                  {post.each_use ? "/" + formatFeeForList(post.each_fee) : ""}
                  {post.other_role_name
                    ? (() => {
                        // 기타 수수료는 포맷팅하지 않고 그대로 노출
                        const t = String(post.other_role_fee ?? "").trim();
                        return t ? "/" + t : "";
                      })()
                    : ""}
                </Text>
              </View>
            </View>
          </View>
          <Text style={{ color: post.highlight_color, fontSize: 14, fontWeight: "bold", marginStart: 5 }}
            numberOfLines={1}
          >
            {post.highlight_content}
          </Text>

        </Pressable>
      </Link >
    </>
  );
}
function formatFeeForList(value?: string) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  // 모집 수수료는 자유텍스트를 그대로 노출(기타와 동일 정책)
  return s;
}
function simpleProvince(p?: string) {
  if (!p) return "";

  const map: Record<string, string> = {
    "충청북도": "충북",
    "충청남도": "충남",
    "경상북도": "경북",
    "경상남도": "경남",
    "전라북도": "전북",
    "전라남도": "전남",
    "강원도": "강원"
  };
  if (map[p]) return map[p];

  return p.replace(/(특별시|광역시|자치시|자치도|특별자치도|도|특별자치시)$/g, "");
}

function formatProvinceCity(province: any, city: any) {
  const prov = simpleProvince(String(province ?? "").trim());
  const rawCity = city == null ? "" : String(city).trim();
  const c = rawCity.toLowerCase() === "null" ? "" : rawCity;
  const cityOk = !!c && c !== "전체";
  return [prov, cityOk ? c : ""].filter(Boolean).join(" ");
}