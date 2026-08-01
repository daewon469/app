export type SlideMeshTheme = "dark" | "light";

const STORAGE_KEY = "slide_mesh_theme:v1";

export function getSlideMeshTheme(): SlideMeshTheme {
  try {
    const SecureStore = require("../utils/secureStorage");
    // sync read is not available; default dark until screen loads
    return "dark";
  } catch {
    return "dark";
  }
}

export async function getSlideMeshThemeAsync(): Promise<SlideMeshTheme> {
  try {
    const SecureStore = (await import("../utils/secureStorage")).default;
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export async function setSlideMeshTheme(theme: SlideMeshTheme) {
  const SecureStore = (await import("../utils/secureStorage")).default;
  await SecureStore.setItemAsync(STORAGE_KEY, theme);
}

export function slideMeshStyles(theme: SlideMeshTheme) {
  if (theme === "light") {
    return {
      meshColor: "rgba(255,255,255,0.5)",
      textColor: "#111",
    };
  }
  return {
    meshColor: "rgba(0,0,0,0.5)",
    textColor: "#fff",
  };
}
