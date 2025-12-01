import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import OnboardingModal from '../components/OnboardingModal';

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  Login: undefined;
  Register: undefined;
  WasteCheck: undefined;
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

  useEffect(() => {
    checkOnboardingStatus();
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

  const handleCalculateTax = () => {
    // TODO: Implement tax calculation
    console.log('Calculate Tax pressed');
  };

  const handleAIAgent = () => {
    // TODO: Implement AI Agent
    console.log('AI Agent pressed');
  };

  const handleComplaints = () => {
    // TODO: Implement complaints
    console.log('Complaints pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
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
    backgroundColor: '#E8F5E8', // Light green background
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
    backgroundColor: '#2E7D32', // Dark green
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
    color: '#2E7D32', // Dark green
    letterSpacing: 1,
  },
  buttonGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 20,
  },
  button: {
    backgroundColor: '#F1F8E9', // Light yellow-green
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32', // Dark green
    textAlign: 'center',
    lineHeight: 22,
  },
});
