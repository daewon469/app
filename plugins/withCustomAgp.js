const { withProjectBuildGradle, createRunOncePlugin } = require("@expo/config-plugins");

const DEFAULT_VERSION = "8.9.2";
const TAG = "withCustomAgp";

function ensureAgpVersion(src, version) {
  const v = String(version || DEFAULT_VERSION).trim() || DEFAULT_VERSION;
  const next = src.replace(
    /classpath\(['"]com\.android\.tools\.build:gradle(?::[^'"]+)?['"]\)/,
    `classpath('com.android.tools.build:gradle:${v}')`
  );
  if (next === src) {
    throw new Error(
      `${TAG}: could not find com.android.tools.build:gradle classpath to set AGP ${v}`
    );
  }
  return next;
}

function withCustomAgp(config, props = {}) {
  const version = props?.version ?? DEFAULT_VERSION;
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    config.modResults.contents = ensureAgpVersion(config.modResults.contents, version);
    return config;
  });
}

module.exports = createRunOncePlugin(withCustomAgp, "with-custom-agp", "1.0.0");
