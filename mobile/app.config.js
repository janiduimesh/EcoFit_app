export default {
  expo: {
    name: "EcoFit",
    slug: "ecofit-mobile",
    version: "1.0.0",
    orientation: "portrait",
    platforms: ["ios", "android"],
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#4CAF50"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.ecofit.mobile"
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#4CAF50"
      },
      package: "com.ecofit.mobile"
    },
    extra: {
      apiUrl: process.env.API_URL || "http://localhost:3000/api"
    }
  }
};
