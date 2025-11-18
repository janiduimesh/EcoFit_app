import React, { useEffect } from 'react';
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

const { width, height } = Dimensions.get('window');

export default function Logo({ navigation }: Props) {
  useEffect(() => {
    // Navigate to main page after 2 seconds
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconContainer}>
          <Image 
            source={require('../src/waste_logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8', // Light green background
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    backgroundColor: '#FFFFFF', // White background
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  icon: {
    fontSize: 40,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
});
