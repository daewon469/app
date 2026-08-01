export type SlideMeshTheme = "dark" | "light" | "navy";

export type SlideMeshOpacityMap = Record<SlideMeshTheme, number>;

export type SlideMeshSettings = {
  theme: SlideMeshTheme;
  opacity: SlideMeshOpacityMap;
};

const STORAGE_KEY = "slide_mesh_theme:v2";
const LEGACY_STORAGE_KEY = "slide_mesh_theme:v1";

export const DEFAULT_MESH_OPACITY = 0.5;
export const MIN_MESH_OPACITY = 0.1;
export const MAX_MESH_OPACITY = 1;
export const MESH_OPACITY_STEP = 0.05;

const DEFAULT_OPACITY: SlideMeshOpacityMap = {
  dark: DEFAULT_MESH_OPACITY,
  light: DEFAULT_MESH_OPACITY,
  navy: DEFAULT_MESH_OPACITY,
};

type ThemeListener = () => void;
const listeners = new Set<ThemeListener>();

export function clampMeshOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MESH_OPACITY;
  const clamped = Math.min(MAX_MESH_OPACITY, Math.max(MIN_MESH_OPACITY, value));
  return Math.round(clamped / MESH_OPACITY_STEP) * MESH_OPACITY_STEP;
}

export function formatMeshOpacityPercent(opacity: number): string {
  return `${Math.round(clampMeshOpacity(opacity) * 100)}%`;
}

function parseTheme(v: string | null | undefined): SlideMeshTheme {
  if (v === "light" || v === "navy" || v === "dark") return v;
  return "dark";
}

function parseOpacityMap(raw: unknown): SlideMeshOpacityMap {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    dark: clampMeshOpacity(Number(src.dark ?? DEFAULT_MESH_OPACITY)),
    light: clampMeshOpacity(Number(src.light ?? DEFAULT_MESH_OPACITY)),
    navy: clampMeshOpacity(Number(src.navy ?? DEFAULT_MESH_OPACITY)),
  };
}

function defaultSettings(): SlideMeshSettings {
  return {
    theme: "dark",
    opacity: { ...DEFAULT_OPACITY },
  };
}

function notifyThemeListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

/** 슬라이드 매쉬 테마/투명도 변경 구독 */
export function subscribeSlideMeshTheme(listener: ThemeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function readSettings(): Promise<SlideMeshSettings> {
  try {
    const SecureStore = (await import("../utils/secureStorage")).default;
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SlideMeshSettings>;
      return {
        theme: parseTheme(parsed.theme),
        opacity: parseOpacityMap(parsed.opacity),
      };
    }
    const legacy = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
    if (legacy) {
      return {
        theme: parseTheme(legacy),
        opacity: { ...DEFAULT_OPACITY },
      };
    }
  } catch {
    // ignore
  }
  return defaultSettings();
}

async function writeSettings(settings: SlideMeshSettings) {
  const SecureStore = (await import("../utils/secureStorage")).default;
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(settings));
  notifyThemeListeners();
}

export function getSlideMeshTheme(): SlideMeshTheme {
  return "dark";
}

export async function getSlideMeshSettingsAsync(): Promise<SlideMeshSettings> {
  return readSettings();
}

export async function getSlideMeshThemeAsync(): Promise<SlideMeshTheme> {
  const settings = await readSettings();
  return settings.theme;
}

export async function setSlideMeshTheme(theme: SlideMeshTheme) {
  const prev = await readSettings();
  await writeSettings({ ...prev, theme: parseTheme(theme) });
}

export async function setSlideMeshOpacity(theme: SlideMeshTheme, opacity: number) {
  const prev = await readSettings();
  await writeSettings({
    ...prev,
    opacity: {
      ...prev.opacity,
      [theme]: clampMeshOpacity(opacity),
    },
  });
}

export async function setSlideMeshSettings(
  partial: Partial<SlideMeshSettings> & { theme?: SlideMeshTheme },
) {
  const prev = await readSettings();
  await writeSettings({
    theme: partial.theme ? parseTheme(partial.theme) : prev.theme,
    opacity: partial.opacity
      ? parseOpacityMap({ ...prev.opacity, ...partial.opacity })
      : prev.opacity,
  });
}

export function slideMeshStyles(
  theme: SlideMeshTheme,
  opacity: number = DEFAULT_MESH_OPACITY,
) {
  const a = clampMeshOpacity(opacity);
  if (theme === "light") {
    return {
      meshColor: `rgba(255,255,255,${a})`,
      textColor: "#111",
    };
  }
  if (theme === "navy") {
    return {
      meshColor: `rgba(11,27,58,${a})`,
      textColor: "#fff",
    };
  }
  return {
    meshColor: `rgba(0,0,0,${a})`,
    textColor: "#fff",
  };
}
