import { configureStore } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";
import auth from "./authSlice";
import location from "./LocationSlice";
import preferences, {
  PREFERENCES_STORAGE_KEY,
  hydratePreferences,
  type PreferencesState,
} from "./preferencesSlice";
import region from "./regionSlice";
export const store = configureStore({
  reducer: { auth, location, region, preferences },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// --- Preferences persistence (local) ---
let _prefsLastSaved = "";
let _prefsHydrated = false;

async function loadPreferencesFromStorage() {
  try {
    const raw = await SecureStore.getItemAsync(PREFERENCES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PreferencesState;
    store.dispatch(hydratePreferences(parsed));
  } catch {
    // ignore
  }
}

void loadPreferencesFromStorage().finally(() => {
  _prefsHydrated = true;
});

store.subscribe(() => {
  if (!_prefsHydrated) return;
  try {
    const prefs = (store.getState() as RootState).preferences;
    const raw = JSON.stringify(prefs);
    if (raw === _prefsLastSaved) return;
    _prefsLastSaved = raw;
    void SecureStore.setItemAsync(PREFERENCES_STORAGE_KEY, raw);
  } catch {
    // ignore
  }
});
