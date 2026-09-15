const { withAndroidManifest, createRunOncePlugin } = require("@expo/config-plugins");

const TAG = "withDisablePredictiveBack";

function setFlag(node) {
  if (!node?.$) return;
  node.$["android:enableOnBackInvokedCallback"] = "false";
}

function withDisablePredictiveBack(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) {
      throw new Error(`${TAG}: <application> not found`);
    }

    setFlag(application);
    for (const activity of application.activity || []) {
      setFlag(activity);
    }
    return config;
  });
}

module.exports = createRunOncePlugin(
  withDisablePredictiveBack,
  "with-disable-predictive-back",
  "1.0.0"
);
