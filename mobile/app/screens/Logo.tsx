import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  Login: undefined;
  Register: undefined;
  Result: { data: any };
};

type LogoScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Logo'>;

type Props = {
  navigation: LogoScreenNavigationProp;
};

const COUNTDOWN_SECONDS = 3;
const APP_VERSION = 'v 2.1.0';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOADING_BAR_WIDTH = Math.min(SCREEN_WIDTH - 96, 260);

export default function Logo({ navigation }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(timer);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      navigation.replace('Login');
    }
  }, [secondsLeft, navigation]);

  const progress = 1 - secondsLeft / COUNTDOWN_SECONDS;

  return (
    <View style={styles.container}>
      {/* Subtle background shapes */}
      <View style={styles.bgShape1} />
      <View style={styles.bgShape2} />
      <View style={styles.bgShape3} />

      <View style={styles.content}>
        {/* Logo card: light green border, white fill, bin + EcoFit */}
        <View style={styles.logoCard}>
          <View style={styles.logoRow}>
            <Image
              source={require('../src/waste_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.title}>Smart Waste Management</Text>
        <Text style={styles.tagline}>Clean city · Greener future</Text>

        {/* Loading bar: gray track + green progress */}
        <View style={[styles.loadingTrackWrap, { width: LOADING_BAR_WIDTH }]}>
          <View style={styles.loadingTrack}>
            <View
              style={[
                styles.loadingFill,
                { width: LOADING_BAR_WIDTH * progress },
              ]}
            />
          </View>
        </View>
      </View>

      <Text style={styles.version}>{APP_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5F2E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgShape1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(184, 219, 184, 0.35)',
    top: -80,
    right: -60,
  },
  bgShape2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(200, 230, 200, 0.3)',
    bottom: 120,
    left: -50,
  },
  bgShape3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(190, 220, 190, 0.25)',
    bottom: -40,
    right: 40,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#A5D6A7',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 32,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  logoRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 220,
    height: 140,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: '#66BB6A',
    marginBottom: 32,
  },
  loadingTrackWrap: {
    height: 5,
    marginTop: 8,
  },
  loadingTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#9E9E9E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadingFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    minWidth: 0,
    backgroundColor: '#2E7D32',
    borderRadius: 3,
  },
  version: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    fontSize: 11,
    color: '#9E9E9E',
  },
});
