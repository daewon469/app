// store/regionSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Province =
  | "전체" | "서울특별시" | "경기도" | "인천광역시" | "강원특별자치도"
  | "충청북도" | "충청남도" | "대전광역시" | "세종특별자치시"
  | "경상북도" | "경상남도" | "부산광역시" | "대구광역시"
  | "전북특별자치도" | "전라남도" | "광주광역시" | "울산광역시" | "제주특별자치도";

export type RegionSelection = { province: Province; city: string };

type RegionState = {
  selectedProvince: Province;
  selectedCity: string;
  selectedRegions: RegionSelection[];
};

const initialState: RegionState = {
  selectedProvince: "전체",
  selectedCity: "전체",
  selectedRegions: [{ province: "전체", city: "전체" }],
};

const normalizeRegions = (regions?: Array<{ province: Province; city?: string }>): RegionSelection[] => {
  const raw = (regions || [])
    .map((r) => ({
      province: (r?.province || "전체") as Province,
      city: (r?.city || "전체").trim() || "전체",
    }))
    .filter((r) => !!r.province);

  // 전체는 단독
  if (raw.some((r) => r.province === "전체")) {
    return [{ province: "전체", city: "전체" }];
  }

  // 중복 제거
  const uniq = Array.from(new Map(raw.map((r) => [`${r.province}__${r.city}`, r] as const)).values());

  // 아무 것도 없으면 전국
  if (uniq.length === 0) {
    return [{ province: "전체", city: "전체" }];
  }

  return uniq;
};

const regionSlice = createSlice({
  name: "region",
  initialState,
  reducers: {
    setProvince(state, action: PayloadAction<Province>) {
      state.selectedProvince = action.payload;
      state.selectedCity = "전체";
      state.selectedRegions =
        action.payload === "전체"
          ? [{ province: "전체", city: "전체" }]
          : [{ province: action.payload, city: "전체" }];
    },
    setCity(state, action: PayloadAction<string>) {
      state.selectedCity = action.payload;
      if (state.selectedProvince === "전체") {
        state.selectedRegions = [{ province: "전체", city: "전체" }];
      } else {
        state.selectedRegions = [{ province: state.selectedProvince, city: action.payload || "전체" }];
      }
    },

    setRegions(state, action: PayloadAction<RegionSelection[]>) {
      const normalized = normalizeRegions(action.payload);
      state.selectedRegions = normalized;

      // 기존 단일 필드 호환: 첫 번째 선택을 대표값으로 유지
      const first = normalized[0] ?? { province: "전체" as Province, city: "전체" };
      state.selectedProvince = first.province;
      state.selectedCity = first.city || "전체";
    },

    resetProvince(state) {
      state.selectedProvince = "전체";
      state.selectedCity = "전체";
      state.selectedRegions = [{ province: "전체", city: "전체" }];
    },
  },
});

export const { setProvince, setCity, setRegions, resetProvince } = regionSlice.actions;
export default regionSlice.reducer;
