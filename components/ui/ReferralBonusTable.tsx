import React, { useMemo, useState } from "react";
import { Text as RNText, View } from "react-native";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type BonusRow = { grade: string; count: string; bonus: string };

export type ReferralBonusTableColors = {
  text: string;
  subText: string;
  headerText: string;
  borderSoft: string;
};

type Props = {
  colors: ReferralBonusTableColors;
  rows?: BonusRow[];
  showBottomDividerAfterLastRow?: boolean;
};

export default function ReferralBonusTable({
  colors,
  rows,
  showBottomDividerAfterLastRow = false,
}: Props) {
  const [bonusTableWidth, setBonusTableWidth] = useState<number | null>(null);

  const bonusTableLayout = useMemo(
    () => ({
      markWidth: 18,
      colGap: -2, // 기존 PointEventModal과 동일
      gradeWidth: 90,
      countWidth: 84,
      bonusWidth: 110,
    }),
    []
  );

  const bonusTableCols = useMemo(() => {
    const markWidth = bonusTableLayout.markWidth;
    const colGap = bonusTableLayout.colGap;

    // 측정 전에는 기존 고정폭을 사용
    if (!bonusTableWidth || bonusTableWidth <= 0) return bonusTableLayout;

    // 3열(등급/추천인/추가지급) + 2개 gap 의 총 사용 가능 폭 계산
    const usable = Math.floor(bonusTableWidth - markWidth - colGap * 2);
    if (usable <= 0) return bonusTableLayout;

    // '추가지급'이 잘리지 않도록 bonus를 우선 확보
    const minGrade = 74;
    const minCount = 86; // '추천인 명수' 헤더가 ... 되지 않도록 최소폭 상향
    const minBonus = 118;

    let grade = Math.max(minGrade, Math.floor(usable * 0.34));
    let count = Math.max(minCount, Math.floor(usable * 0.22));
    let bonus = usable - grade - count;

    if (bonus < minBonus) {
      let need = minBonus - bonus;
      const takeFromGrade = Math.min(need, Math.max(0, grade - minGrade));
      grade -= takeFromGrade;
      bonus += takeFromGrade;
      need = minBonus - bonus;

      if (need > 0) {
        const takeFromCount = Math.min(need, Math.max(0, count - minCount));
        count -= takeFromCount;
        bonus += takeFromCount;
      }
    }

    // 남는 폭이 있으면 등급에 조금 더 배분(등급 줄임표 최소화)
    const used = grade + count + bonus;
    const remain = usable - used;
    if (remain > 0) grade += remain;

    return {
      ...bonusTableLayout,
      gradeWidth: grade,
      countWidth: count,
      bonusWidth: bonus,
    };
  }, [bonusTableLayout, bonusTableWidth]);

  const bonusRows = useMemo<BonusRow[]>(
    () =>
      rows ?? [
        { grade: "레전드", count: "100명", bonus: "1,000,000p" },
        { grade: "마스터", count: "50명", bonus: "500,000p" },
        { grade: "프로", count: "20명", bonus: "200,000p" },
        { grade: "세미프로", count: "10명", bonus: "100,000p" },
        { grade: "아마추어", count: "5명", bonus: "50,000p" },
        { grade: "일반회원", count: "-", bonus: "-" },
      ],
    [rows]
  );

  return (
    <View
      style={{ gap: 8 }}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (!Number.isFinite(w) || w <= 0) return;
        setBonusTableWidth((prev) => (prev === w ? prev : w));
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSoft,
        }}
      >
        <Text
          style={{
            width: bonusTableCols.markWidth,
            color: colors.subText,
            fontSize: 13,
            fontWeight: "700",
          }}
        />
        <Text
          style={{
            width: bonusTableCols.gradeWidth,
            color: colors.headerText,
            fontSize: 13,
            fontWeight: "900",
            textAlign: "left",
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          등급
        </Text>

        <Text
          style={{
            marginLeft: bonusTableCols.colGap,
            width: bonusTableCols.countWidth,
            textAlign: "right",
            color: colors.headerText,
            fontSize: 13,
            fontWeight: "900",
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          ellipsizeMode="tail"
        >
          추천인 명수
        </Text>

        <Text
          style={{
            // 기존 PointEventModal의 미세 조정값 유지(헤더 정렬)
            marginLeft: bonusTableCols.colGap - 10,
            width: bonusTableCols.bonusWidth,
            textAlign: "right",
            color: colors.headerText,
            fontSize: 13,
            fontWeight: "900",
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          추가지급
        </Text>
      </View>

      {bonusRows.map((row, idx) => {
        const isLast = idx === bonusRows.length - 1;
        return (
          <View key={row.grade}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: bonusTableCols.markWidth, alignItems: "center" }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>※</Text>
              </View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  width: bonusTableCols.gradeWidth,
                  color:
                    row.grade === "레전드"
                      ? "#A67C00" // gold
                      : row.grade === "마스터"
                        ? "#36454F" // charcoal
                        : row.grade === "프로"
                          ? "#E11D48" // red
                          : row.grade === "세미프로"
                            ? colors.headerText // blue
                            : row.grade === "아마추어"
                              ? "#1B8A3A" // green
                              : row.grade === "일반회원"
                                ? colors.subText // gray
                                : colors.text,
                  fontSize: 14,
                  fontWeight: "700",
                  textAlign: "left",
                }}
              >
                {row.grade}
              </Text>
              <Text
                style={{
                  marginLeft: bonusTableCols.colGap,
                  width: bonusTableCols.countWidth,
                  textAlign: "right",
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: "700",
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {row.count}
              </Text>
              <Text
                style={{
                  marginLeft: bonusTableCols.colGap,
                  width: bonusTableCols.bonusWidth,
                  textAlign: "right",
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: "700",
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {row.bonus}
              </Text>
            </View>

            {showBottomDividerAfterLastRow && isLast ? (
              <View
                style={{
                  marginTop: 10,
                  height: 1,
                  backgroundColor: "#111",
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

