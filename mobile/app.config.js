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
      bundleIdentifier: "com.ecofit.mobile",
      infoPlist: {
        NSCameraUsageDescription: "This app needs access to camera to take photos of waste items for classification.",
        NSPhotoLibraryUsageDescription: "This app needs access to photo library to select images of waste items for classification."
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#4CAF50"
      },
      package: "com.ecofit.mobile",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    extra: {
      apiUrl: process.env.API_URL || "http://192.168.43.164:8000/api/v1"
    }
  }
};
