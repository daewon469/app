import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PreferredRegion = {
  province: string; // 서버/게시글과 동일한 값(예: "서울특별시"). "전체" 가능
  city: string; // 예: "강남구" | "전체"
};

export type PreferencesState = {
  selectedIndustries: string[];
  selectedRegions: PreferredRegion[];
};

export const PREFERENCES_STORAGE_KEY = "prefs:v1";

const initialState: PreferencesState = {
  selectedIndustries: [],
  selectedRegions: [],
};

const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

const regionKey = (r: PreferredRegion) => `${r.province}__${r.city}`;

const uniqRegions = (regions: PreferredRegion[]) => {
  const map = new Map<string, PreferredRegion>();
  for (const r of regions) {
    const province = (r.province || "").trim();
    const city = (r.city || "").trim() || "전체";
    if (!province) continue;
    map.set(regionKey({ province, city }), { province, city });
  }
  return Array.from(map.values());
};

const preferencesSlice = createSlice({
  name: "preferences",
  initialState,
  reducers: {
    hydratePreferences(_state, action: PayloadAction<PreferencesState>) {
      return {
        selectedIndustries: uniq(action.payload?.selectedIndustries || []),
        selectedRegions: uniqRegions(action.payload?.selectedRegions || []),
      };
    },

    setSelectedIndustries(state, action: PayloadAction<string[]>) {
      state.selectedIndustries = uniq(action.payload || []);
    },

    toggleIndustry(state, action: PayloadAction<string>) {
      const v = (action.payload || "").trim();
      if (!v) return;
      if (state.selectedIndustries.includes(v)) {
        state.selectedIndustries = state.selectedIndustries.filter((x) => x !== v);
      } else {
        state.selectedIndustries = uniq([...state.selectedIndustries, v]);
      }
    },

    clearIndustries(state) {
      state.selectedIndustries = [];
    },

    setSelectedRegions(state, action: PayloadAction<PreferredRegion[]>) {
      state.selectedRegions = uniqRegions(action.payload || []);
    },

    clearRegions(state) {
      state.selectedRegions = [];
    },

    clearAllPreferences(state) {
      state.selectedIndustries = [];
      state.selectedRegions = [];
    },
  },
});

export const {
  hydratePreferences,
  setSelectedIndustries,
  toggleIndustry,
  clearIndustries,
  setSelectedRegions,
  clearRegions,
  clearAllPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;

