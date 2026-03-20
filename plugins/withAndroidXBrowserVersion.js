const { withProjectBuildGradle, createRunOncePlugin } = require("@expo/config-plugins");

const DEFAULT_VERSION = "1.8.0";
const TAG = "withAndroidXBrowserVersion";

function ensureForcedAndroidXBrowserVersion(src, version) {
  const v = String(version || DEFAULT_VERSION).trim() || DEFAULT_VERSION;
  if (src.includes(`force "androidx.browser:browser:${v}"`)) return src;
  if (src.includes("androidx.browser:browser:1.9.0") || src.includes("androidx.browser:browser")) {
    // Still force; don't early-return.
  }
  if (src.includes(TAG)) return src;

  return (
    src +
    `\n\n// ${TAG}: Force androidx.browser to avoid compileSdk/AGP mismatch\n` +
    `allprojects {\n` +
    `  configurations.all {\n` +
    `    resolutionStrategy {\n` +
    `      force "androidx.browser:browser:${v}"\n` +
    `    }\n` +
    `  }\n` +
    `}\n`
  );
}

function withAndroidXBrowserVersion(config, props = {}) {
  const version = props?.version ?? DEFAULT_VERSION;
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    config.modResults.contents = ensureForcedAndroidXBrowserVersion(
      config.modResults.contents,
      version
    );
    return config;
  });
}

module.exports = createRunOncePlugin(
  withAndroidXBrowserVersion,
  "with-androidx-browser-version",
  "1.0.0"
);

