# EcoFit_app
Here are the complete steps to run your Expo mobile app for someone who clones your repository:

## 📱 **Steps to Run the EcoFit Mobile App**

### **Prerequisites**
1. **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
2. **Expo CLI** - Install globally: `npm install -g @expo/cli`
3. **Expo Go app** on your phone (iOS/Android) - [Download from App Store/Play Store](https://expo.dev/client)

### **Setup Steps**

#### **1. Clone and Navigate**
```bash
git clone <your-repo-url>
cd EcoFit_app/mobile
```

#### **2. Install Dependencies**
```bash
npm install
```

#### **3. Start the Development Server**
```bash
npx expo start
```

#### **4. Run on Device/Emulator**

**Option A: Run on Physical Device (Recommended)**
- Install **Expo Go** app on your phone
- Scan the QR code that appears in terminal/browser
- The app will load on your phone

**Option B: Run on Android Emulator**
```bash
npx expo start --android
```

**Option C: Run on iOS Simulator** (Mac only)
```bash
npx expo start --ios
```

**Option D: Run in Web Browser**
```bash
npx expo start --web
```

### **Troubleshooting**

#### **If you get Metro bundler errors:**
```bash
npx expo start --clear
```

#### **If dependencies are outdated:**
```bash
npm install
npx expo install --fix
```

#### **If you get network issues:**
- Make sure your phone and computer are on the same WiFi network
- Try using tunnel mode: `npx expo start --tunnel`


The app will start with the logo screen, then show the main menu with 4 buttons, and the "Check Waste Type" button will take you to the waste classification interface for now!


