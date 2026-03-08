import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { getBinImage } from '../utils/binImages';
import TipsModal from '../components/TipsModal';
import { getTips, TipsResponse } from '../api/tips';

type RootStackParamList = {
  Home: undefined;
  Result: { data: any };
};

type ResultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Result'>;
type ResultScreenRouteProp = RouteProp<RootStackParamList, 'Result'>;

type Props = {
  navigation: ResultScreenNavigationProp;
  route: ResultScreenRouteProp;
};

export default function Result({ navigation, route }: Props) {
  const { data } = route.params;
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [tipsData, setTipsData] = useState<TipsResponse | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const storedUserId = await AsyncStorage.getItem('user_id');
        if (storedUserId) {
          setUserId(storedUserId);
        }
      } catch (error) {
        console.warn('Could not load user_id:', error);
      }
    };
    loadUserId();
  }, []);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleNewEntry = () => {
    navigation.navigate('Home');
  };

  const handleGetTips = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please log in to get personalized recommendations');
      return;
    }

    setLoadingTips(true);
    setShowTipsModal(true);
    
    try {
      const tips = await getTips({
        user_id: userId,
        waste_type: data.waste_type,
      });
      setTipsData(tips);
    } catch (error) {
      console.error('Error fetching tips:', error);
      Alert.alert('Error', 'Failed to get recommendations. Please try again.');
      setShowTipsModal(false);
    } finally {
      setLoadingTips(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Results</Text>
        
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Classification Results:</Text>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultItemLabel}>Waste Type:</Text>
            <Text style={styles.resultItemValue}>{data.waste_type || 'Unknown'}</Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={styles.resultItemLabel}>Bin Type:</Text>
            <Text style={styles.resultItemValue}>{data.bin_type || 'Unknown'}</Text>
          </View>

          {data.bin_type && (
            <View style={styles.binImageContainer}>
              <Image 
                source={getBinImage(data.bin_type)} 
                style={styles.binImage}
                resizeMode="contain"
              />
            </View>
          )}
          
          {data.fit_status && data.fit_status !== 'unknown' && (
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>Fit Status:</Text>
              <Text style={[styles.resultItemValue, 
                data.fit_status === 'fits' ? styles.fitsText : 
                data.fit_status === 'does_not_fit' ? styles.noFitText : 
                styles.partialFitText]}>
                {data.fit_status}
              </Text>
            </View>
          )}
          
          {data.fit_message && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>{data.fit_message}</Text>
            </View>
          )}
                    
          {data.bin_volume_ml && (
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>Bin Volume:</Text>
              <Text style={styles.resultItemValue}>
                {data.bin_volume_ml} ml ({data.bin_volume_liters} L)
              </Text>
            </View>
          )}
                    
          <View style={styles.resultItem}>
            <Text style={styles.resultItemLabel}>Confidence:</Text>
            <Text style={styles.resultItemValue}>
              {data.confidence ? `${Math.round(data.confidence * 100)}%` : 'Unknown'}
            </Text>
          </View>
          
        </View>

        {/* Recommend Disposal Button */}
        <TouchableOpacity
          style={styles.recommendButton}
          onPress={handleGetTips}
        >
          <Text style={styles.recommendButtonText}>💡 Recommend me disposal method</Text>
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleGoBack}
          >
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleNewEntry}
          >
            <Text style={styles.buttonText}>New Entry</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tips Modal */}
      <TipsModal
        visible={showTipsModal}
        onClose={() => setShowTipsModal(false)}
        tips={tipsData}
        userId={userId}
        isLoading={loadingTips}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 30,
  },
  resultContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  resultItemValue: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  fitsText: {
    color: '#4CAF50',
  },
  noFitText: {
    color: '#F44336',
  },
  partialFitText: {
    color: '#FF9800',
  },
  messageContainer: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  recommendButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  recommendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  button: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  binImageContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
  },
  binImage: {
    width: 200,
    height: 200,
  },
});
