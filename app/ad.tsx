// app/AdScreen.tsx  (파일 이름은 원하는 걸로 바꿔도 됨)

import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
} from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

const { width } = Dimensions.get("window");

type Category =
  | "모든업종"
  | "시행/건설업"
  | "대출업"
  | "행사/인력대행"
  | "분양";

interface AdItem {
  id: string;
  title: string;
  agencyName: string;
  description: string;
  tags: string[];
  bannerImage: any; // require(...) 형태
}

const CATEGORIES: Category[] = [
  "모든업종",
  "시행/건설업",
  "대출업",
  "행사/인력대행",
  "분양",
];

// 샘플 데이터 (나중에 API 데이터로 교체하면 됨)
const AD_ITEMS: AdItem[] = [
  {
    id: "1",
    title: "분양 종합광고대행사 분양플랜",
    agencyName: "분양플랜",
    description:
      "타겟메시지, 숏츠 및 릴스제작, 메타광고부터 인플루언서 광고에 각종 프로모션 혜택까지",
    tags: ["홈페이지", "포탈광고", "유튜브광고", "언론홍보"],
    bannerImage: require("../assets/images/brend1.png"), 
  },
  {
    id: "2",
    title: "커피 값으로 누리는 현장 홍보",
    agencyName: "현장프로",
    description:
      "소액 예산으로도 현장 맞춤형 홍보 세팅, 영상/카드뉴스까지 한 번에 진행해드립니다.",
    tags: ["영상제작", "SNS광고"],
    bannerImage: require("../assets/images/brend1.png"),
  },
    {
    id: "3",
    title: "전국 사이드로 계약 많이 쓰고 있어요",
    agencyName: "구해줘아파트닷컴 주식회사",
    description:
      "사이드 및 비사이드 광고 모두 가능 (상담 환영)",
    tags: ["사이드", "포탈광고", "유튜브광고", "블로그"],
      bannerImage: require("../assets/images/brend1.png"),
  },
];     

export default function AdScreen() {
  const [activeCategory, setActiveCategory] = useState<Category>("모든업종");
  const filteredItems = AD_ITEMS;

  return (
    <View style={styles.container}>

      <CategoryTabs
        active={activeCategory}
        onChange={setActiveCategory}
      />

      {/* [AD] 안내 배너 */}
      <View style={styles.noticeBar}>
        <Text style={styles.noticePrefix}>[AD]</Text>
        <Text
          style={styles.noticeText}
          numberOfLines={1}
        >
          수수료 대폭인상!! 10.15 풍선효과!! 광고비 50% 지원!!! 김포 · · ·
        </Text>
      </View>

      {/* 스크롤 전체 영역 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
       

        {/* 광고 카드 리스트 */}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => <AdCard item={item} />}
        />
      </ScrollView>
    </View>
  );
}

/* ────────────────────── 서브 컴포넌트들 ────────────────────── */

interface CategoryTabsProps {
  active: Category;
  onChange: (c: Category) => void;
}

function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <View style={styles.tabsWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {CATEGORIES.map((c) => {
          const isActive = c === active;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => onChange(c)}
              style={[
                styles.tabItem,
                isActive && styles.tabItemActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface BannerCarouselProps {
  items: AdItem[];
}

function BannerCarousel({ items }: BannerCarouselProps) {
  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.bannerScroll}
    >
      {items.map((item) => (
        <View
          key={item.id}
          style={styles.bannerSlide}
        >
          <Image
            source={item.bannerImage}
            style={styles.bannerImage}
          />
          {/* 오른쪽 상단 모서리 북마크/즐겨찾기 아이콘 자리 */}
          <View style={styles.bannerBookmark}>
            <Text style={{ color: "white", fontSize: 18 }}>♥</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

interface AdCardProps {
  item: AdItem;
}

function AdCard({ item }: AdCardProps) {
  return (
    <View style={styles.card}>
      {/* 카드 상단 이미지 영역 */}
      <Image
        source={item.bannerImage}
        style={styles.cardImage}
      />

      {/* 카드 텍스트 영역 */}
      <View style={styles.cardContent}>
        <Text style={styles.cardAgency}>{item.agencyName}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text
          style={styles.cardDescription}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        {/* 태그 버튼들 */}
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <View
              key={tag}
              style={styles.tagChip}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────── 스타일 ───────────────────────── */

const PRIMARY = "#0099FF";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },

  /* 탭 */
  tabsWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E1E4EA",
    backgroundColor: "white",
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  tabText: {
    fontSize: 15,
    color: "#666",
  },
  tabTextActive: {
    color: PRIMARY,
    fontWeight: "600",
  },

  /* 상단 AD 안내 바 */
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#005AC1",
  },
  noticePrefix: {
    color: "white",
    fontWeight: "700",
    marginRight: 6,
  },
  noticeText: {
    color: "white",
    flex: 1,
    fontSize: 12,
  },

  scroll: {
    flex: 1,
  },

  /* 배너 캐러셀 */
  bannerScroll: {
    marginTop: 10,
  },
  bannerSlide: {
    width,
    paddingHorizontal: 10,
  },
  bannerImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#CCC",
  },
  bannerBookmark: {
    position: "absolute",
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* 카드 */
  card: {
    marginTop: 14,
    marginHorizontal: 10,
    backgroundColor: "white",
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
  },
  cardImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#DDD",
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardAgency: {
    fontSize: 13,
    color: PRIMARY,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    color: "#222",
  },
  cardDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E6F3FF",
    marginRight: 8,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "600",
  },
});
