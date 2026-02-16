import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import OnboardingModal from '../components/OnboardingModal';
import { getOverflowPredict } from '../api/overflow';
import { getBinImage } from '../utils/binImages';
import api from '../api/Tax';

// 5 bins matching backend BinCategory (core/constants.py) — colors match bin types (yellow, blue, green, black, red)
const BIN_LIST = [
  { id: 'yellow_bin', label: 'General', color: '#FFC107', title: 'Yellow Bin – General Waste', description: 'Non-recyclable items like chip bags, used tissues, broken items', tagColor: '#FFF9C4' },
  { id: 'blue_bin', label: 'Recycle', color: '#2196F3', title: 'Blue Bin – Recyclables', description: 'Paper, cardboard, clean plastic bottles, glass, metal cans', tagColor: '#BBDEFB' },
  { id: 'green_bin', label: 'Organic', color: '#4CAF50', title: 'Green Bin – Organic', description: 'Food scraps, fruit peels, garden waste, coffee grounds', tagColor: '#C8E6C9' },
  { id: 'black_bin', label: 'Hazard', color: '#424242', title: 'Black Bin – Hazardous', description: 'Batteries, paint, medicine, chemicals — handle with care', tagColor: '#E0E0E0' },
  { id: 'red_bin', label: 'Electronic', color: '#F44336', title: 'Red Bin – Electronic', description: 'E-waste, cables, old devices — recycle at designated points', tagColor: '#FFCDD2' },
];

const ECO_TIPS = [
  'Rinse before recycling! Always rinse food containers before placing them in the recycling bin.',
  'Flatten cardboard boxes to save space and make collection easier.',
  'Keep a small bin in the kitchen for food scraps to make organic recycling effortless.',
  'Separate batteries and electronics — they need special recycling and should not go in general waste.',
  'Use reusable bags and containers to reduce single-use plastic waste.',
  'Compost fruit and vegetable peels at home if you have space, or use your organic bin.',
];

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  Login: undefined;
  Register: undefined;
  WasteCheck: undefined;
  AIAgent: undefined;
  Tax: { email: string };
  Tax_Household: { email: string };
  Result: { data: any };
};

type MainScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

type Props = {
  navigation: MainScreenNavigationProp;
};

const { width } = Dimensions.get('window');
const buttonWidth = (width - 60) / 2; // 2 buttons per row with padding

export default function Main({ navigation }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [binConnected, setBinConnected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    const loadBinStatus = async () => {
      const status: Record<string, boolean> = {};
      for (const bin of BIN_LIST) {
        try {
          const res = await getOverflowPredict(bin.id);
          status[bin.id] = res.success === true;
        } catch {
          status[bin.id] = false;
        }
      }
      setBinConnected(status);
    };
    loadBinStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      // Dynamically import AsyncStorage to handle cases where it's not installed
      let AsyncStorage;
      try {
        AsyncStorage = require('@react-native-async-storage/async-storage').default;
      } catch (e) {
        console.warn('AsyncStorage not available. Please install: npm install @react-native-async-storage/async-storage');
        return;
      }

      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      const storedUserId = await AsyncStorage.getItem('user_id');
      
      // If onboarding not completed, show the modal
      if (onboardingCompleted !== 'true') {
        setShowOnboarding(true);
        if (storedUserId) {
          setUserId(storedUserId);
        }
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleCheckWasteType = () => {
    navigation.navigate('WasteCheck');
  };

  const handleCalculateTax = async () => {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        let email = await AsyncStorage.getItem('user_email');

    if (!email) {
      Alert.alert("Error", "No email found. Please log in again.");
      return;
    }

    // FORCE LOWERCASE AND REMOVE SPACES
    const sanitizedEmail = email.trim().toLowerCase();
    console.log("Checking household for:", sanitizedEmail);

    const response = await api.get(`/household/check_by_email/${sanitizedEmail}`);

    if (response.data.exists) {
      navigation.navigate('Tax', { email: sanitizedEmail });
    } else {
      navigation.navigate('Tax_Household', { email: sanitizedEmail });
    }
  } catch (error) {
    console.error('Household check failed:', error);
  }
};


  const handleAIAgent = () => {
    //console.log('AI Agent pressed');
    navigation.navigate('AIAgent');
  };

  const handleComplaints = () => {
    // TODO: Implement complaints
    console.log('Complaints pressed');
  };

  const connectedCount = BIN_LIST.filter((b) => binConnected[b.id]).length;
  const tipIndex = Math.floor((Date.now() / 86400000) % ECO_TIPS.length);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>♻️</Text>
            </View>
            <Text style={styles.logoText}>EcoFit</Text>
          </View>
        </View>

        <View style={styles.buttonGrid}>
          <TouchableOpacity
            style={[styles.button, { width: buttonWidth }]}
            onPress={handleCheckWasteType}
          >
            <Text style={styles.buttonText}>Check Waste Type and Bin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { width: buttonWidth }]}
            onPress={handleCalculateTax}
          >
            <Text style={styles.buttonText}>Calculate My Tax</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { width: buttonWidth }]}
            onPress={handleAIAgent}
          >
            <Text style={styles.buttonText}>AI Agent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { width: buttonWidth }]}
            onPress={handleComplaints}
          >
            <Text style={styles.buttonText}>Any Complains?</Text>
          </TouchableOpacity>
        </View>

        {/* CONNECTED BINS */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>CONNECTED BINS</Text>
        <Text style={styles.binsLive}>
          • {connectedCount === BIN_LIST.length ? 'All Bins Live' : `${connectedCount} of ${BIN_LIST.length} connected`}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.binsScroll}
          style={styles.binsScrollView}
        >
          {BIN_LIST.map((bin) => {
            const connected = binConnected[bin.id] === true;
            return (
              <View key={bin.id} style={styles.binCard}>
                <Image source={getBinImage(bin.id)} style={styles.binCardImage} resizeMode="contain" />
                <Text style={styles.binLabel}>{bin.label}</Text>
                <Text style={[styles.binStatus, { color: connected ? '#2E7D32' : '#9E9E9E' }]}>
                  {connected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* NEXT PICKUP */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>NEXT PICKUP</Text>
        <View style={styles.pickupCard}>
          <Text style={styles.pickupTruck}>🚛</Text>
          <View style={styles.pickupContent}>
            <Text style={styles.pickupLabel}>SCHEDULED PICKUP</Text>
            <Text style={styles.pickupMain}>Tomorrow, Friday</Text>
            <Text style={styles.pickupTime}>Feb 14 · 7:00 AM – 9:00 AM</Text>
          </View>
          <View style={styles.pickupTag}>
            <Text style={styles.pickupTagText}>2 days</Text>
          </View>
        </View>

        {/* QUICK BIN GUIDE — 5 bins */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>QUICK BIN GUIDE</Text>
        {BIN_LIST.map((bin) => (
          <View key={bin.id} style={styles.guideCard}>
            <Image source={getBinImage(bin.id)} style={styles.guideBinImage} resizeMode="contain" />
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideTitle}>{bin.title}</Text>
              <Text style={styles.guideDescription}>{bin.description}</Text>
            </View>
            <View style={[styles.guideTag, { backgroundColor: bin.tagColor }]}>
              <Text style={styles.guideTagText}>{bin.label}</Text>
            </View>
          </View>
        ))}

        {/* WEATHER & WASTE */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>WEATHER & WASTE</Text>
        <View style={styles.weatherCard}>
          <Text style={styles.weatherIcon}>☀️</Text>
          <View style={styles.weatherContent}>
            <Text style={styles.weatherMain}>Good day to recycle!</Text>
            <Text style={styles.weatherDesc}>Dry weather — bins stay odour-free longer</Text>
          </View>
          <View style={styles.weatherRight}>
            <Text style={styles.weatherTemp}>29°C</Text>
            <Text style={styles.weatherLocation}>Negombo, LK</Text>
          </View>
        </View>

        {/* TODAY'S ECO TIP */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>TODAY'S ECO TIP</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipHeader}>💡 TIP OF THE DAY • {tipIndex + 1} OF {ECO_TIPS.length}</Text>
          <Text style={styles.tipText}>{ECO_TIPS[tipIndex]}</Text>
        </View>
      </ScrollView>

      <OnboardingModal
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        userId={userId || undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  icon: {
    fontSize: 24,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    letterSpacing: 1,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 20,
  },
  button: {
    backgroundColor: '#F1F8E9',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#2E7D32',
    marginHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: -10,
    backgroundColor: '#E8F5E8',
    alignSelf: 'center',
    paddingHorizontal: 12,
  },
  binsLive: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  binsScrollView: {
    marginHorizontal: 20,
  },
  binsScroll: {
    paddingRight: 20,
    gap: 12,
  },
  binCard: {
    width: 100,
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  binCardImage: {
    width: 44,
    height: 44,
    marginBottom: 8,
  },
  binLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  binStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  tipCard: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },
  tipHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  tipText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },
  pickupTruck: {
    fontSize: 36,
    marginRight: 12,
  },
  pickupContent: {
    flex: 1,
  },
  pickupLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pickupMain: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  pickupTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  pickupTag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pickupTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  guideBinImage: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  guideTextWrap: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  guideDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  guideTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  guideTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  weatherIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  weatherContent: {
    flex: 1,
  },
  weatherMain: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2E7D32',
    marginBottom: 4,
  },
  weatherDesc: {
    fontSize: 13,
    color: '#666',
  },
  weatherRight: {
    alignItems: 'flex-end',
  },
  weatherTemp: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2E7D32',
  },
  weatherLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
