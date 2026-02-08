import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { getBinImage } from '../utils/binImages';

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  WasteCheck: undefined;
  Result: { data: any };
};

type WasteCheckScreenNavigationProp = StackNavigationProp<RootStackParamList, 'WasteCheck'>;

type Props = {
  navigation: WasteCheckScreenNavigationProp;
};

const { width } = Dimensions.get('window');

// Hardcoded bin overflow data - will be replaced with time series model predictions later
const BIN_OVERFLOW_DATA = [
  {
    id: 'blue_bin',
    name: 'Recycling Bin',
    color: '#2196F3',
    overflowDate: 'January 12, 2026',
    daysUntil: 6,
    prediction: 'Based on current disposal patterns',
  },
  {
    id: 'yellow_bin',
    name: 'General Waste',
    color: '#FFC107',
    overflowDate: 'January 9, 2026',
    daysUntil: 3,
    prediction: 'Higher than usual activity detected',
  },
  {
    id: 'green_bin',
    name: 'Organic Waste',
    color: '#4CAF50',
    overflowDate: 'January 14, 2026',
    daysUntil: 8,
    prediction: 'Normal disposal rate',
  },
  {
    id: 'black_bin',
    name: 'Hazardous Waste',
    color: '#424242',
    overflowDate: 'February 2, 2026',
    daysUntil: 27,
    prediction: 'Low activity - safe capacity',
  },
  {
    id: 'red_bin',
    name: 'Electronic Waste',
    color: '#F44336',
    overflowDate: 'January 28, 2026',
    daysUntil: 22,
    prediction: 'Moderate disposal rate',
  },
];

export default function WasteCheck({ navigation }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [volume, setVolume] = useState('');
  const [inputMethod, setInputMethod] = useState<'image' | 'description' | 'overflow'>('image');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load user_id from AsyncStorage
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

  const handleImageSelect = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to select an image',
      [
        {
          text: 'Camera',
          onPress: () => pickImageFromCamera(),
        },
        {
          text: 'Gallery',
          onPress: () => pickImageFromGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const pickImageFromCamera = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take photos. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        // Store base64 data for API
        if (result.assets[0].base64) {
          setImageBase64(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImageFromGallery = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photo library permission is required to select images. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,  // Change to false
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        // Store base64 data for API
        if (result.assets[0].base64) {
          setImageBase64(result.assets[0].base64);
        }
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 3) return '#F44336';
    if (days <= 7) return '#FF9800';
    return '#4CAF50';
  };

  const getUrgencyLabel = (days: number) => {
    if (days <= 3) return 'CRITICAL';
    if (days <= 7) return 'SOON';
    return 'SAFE';
  };

  const handleSubmit = async () => {
    // Only allow submission for image or description methods
    if (inputMethod === 'overflow') {
      return;
    }

    if (inputMethod === 'image' && !selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }
    if (inputMethod === 'description' && !description.trim()) {
      Alert.alert('Error', 'Please describe your waste');
      return;
    }
 
    let volumeValue: number | undefined = undefined;
    if (volume.trim()) {
      volumeValue = parseFloat(volume);
      if (isNaN(volumeValue) || volumeValue <= 0) {
        Alert.alert('Error', 'Please enter a valid volume');
        return;
      }
    }

    try {
      setIsLoading(true);
      
      // Import API functions
      const { dispose } = await import('../api/dispose');
      
        // Prepare waste classification data
        // Type assertion is safe here because we've already checked inputMethod is not 'overflow'
        const wasteData = {
          user_id: userId || undefined,
          image_data: inputMethod === 'image' ? imageBase64 || undefined : undefined,
          description: inputMethod === 'description' ? description.trim() || undefined : undefined,
          volume: volumeValue ? parseInt(volume) : undefined, 
          input_method: inputMethod as 'image' | 'description',
        };
      
      console.log('Sending waste data:', wasteData);
      
      // Call both APIs in parallel
      const classificationResult = await dispose(wasteData);
      
      console.log('Classification result:', classificationResult);
      
      // Check if waste type is "other" or "unknown", or confidence is too low
      const wasteType = classificationResult.waste_type?.toLowerCase();
      const confidence = classificationResult.confidence || 0;
      const CONFIDENCE_THRESHOLD = 0.5; 
      
      const isUnknownType = wasteType === 'other' || wasteType === 'unknown';
      const isLowConfidence = confidence < CONFIDENCE_THRESHOLD;
      
      if (isUnknownType || isLowConfidence) {
        const message = isUnknownType
          ? 'Could not identify the waste type. Please add a clearer image or provide a more detailed description and try again.'
          : `Classification confidence is too low (${Math.round(confidence * 100)}%). Please add a clearer image or provide a more detailed description and try again.`;
        
        Alert.alert(
          'Classification Uncertain',
          message,
          [
            {
              text: 'Try Again',
              onPress: () => {
                if (inputMethod === 'image') {
                  setSelectedImage(null);
                  setImageBase64(null);
                }
              },
            },
          ]
        );
        return;
      }
      
      navigation.navigate('Result', { data: classificationResult });
      
    } catch (error: any) {
      console.error('Error processing waste:', error);
      
      let errorMessage = 'Failed to process waste. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.iconContainer}>
              <Image 
                source={require('../src/waste_logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>EcoFit</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Input Method Selection */}
          <View style={styles.methodSelector}>
            <TouchableOpacity 
              style={[styles.methodButton, inputMethod === 'image' && styles.methodButtonActive]}
              onPress={() => {
                setInputMethod('image');
                setDescription(''); // Clear description when switching to image
              }}
            >
              <Text style={[styles.methodButtonText, inputMethod === 'image' && styles.methodButtonTextActive]}>
                📷 Image
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.methodButton, inputMethod === 'description' && styles.methodButtonActive]}
              onPress={() => {
                setInputMethod('description');
                setSelectedImage(null); // Clear image when switching to description
                setImageBase64(null);
              }}
            >
              <Text style={[styles.methodButtonText, inputMethod === 'description' && styles.methodButtonTextActive]}>
                ✏️ Description
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.methodButton, inputMethod === 'overflow' && styles.methodButtonActive]}
              onPress={() => {
                setInputMethod('overflow');
                setSelectedImage(null);
                setImageBase64(null);
                setDescription('');
              }}
            >
              <Text style={[styles.methodButtonText, inputMethod === 'overflow' && styles.methodButtonTextActive]}>
                📊 Overflows
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Upload Area */}
          {inputMethod === 'image' && (
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Upload Waste Image</Text>
              <TouchableOpacity 
                style={styles.imageUploadButton}
                onPress={handleImageSelect}
              >
                {selectedImage ? (
                  <Image source={{ uri: selectedImage }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <View style={styles.cameraIconContainer}>
                      <Text style={styles.cameraIcon}>📷</Text>
                    </View>
                    <Text style={styles.uploadText}>Drop an image or take an image from Here</Text>
                    <Text style={styles.uploadSubtext}>Tap to select from gallery or camera</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Description Input Area */}
          {inputMethod === 'description' && (
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Describe Your Waste</Text>
              <Text style={styles.sectionSubtitle}>eg - How it looks, What it's made of</Text>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your waste item in detail..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Overflow Tab Content */}
          {inputMethod === 'overflow' && (
            <View style={styles.overflowContainer}>
              {/* Header */}
              <View style={styles.overflowHeader}>
                <View style={styles.overflowHeaderContent}>
                  <Text style={styles.overflowHeaderIcon}>📊</Text>
                  <View>
                    <Text style={styles.overflowTitle}>Bin Overflow Forecast</Text>
                    <Text style={styles.overflowSubtitle}>AI-Powered Predictions</Text>
                  </View>
                </View>
              </View>

              {/* Info Banner */}
              <View style={styles.overflowInfoBanner}>
                <Text style={styles.overflowInfoIcon}>🤖</Text>
                <Text style={styles.overflowInfoText}>
                  Predictions based on time series analysis of your disposal patterns
                </Text>
              </View>

              {/* Bin List */}
              <ScrollView 
                style={styles.overflowScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.overflowScrollContent}
              >
                {BIN_OVERFLOW_DATA.map((bin) => (
                  <View key={bin.id} style={styles.overflowBinCard}>
                    {/* Bin Image and Info */}
                    <View style={styles.overflowBinHeader}>
                      <View style={styles.overflowBinImageContainer}>
                        <Image
                          source={getBinImage(bin.id)}
                          style={styles.overflowBinImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.overflowBinInfo}>
                        <Text style={styles.overflowBinName}>{bin.name}</Text>
                        <View style={[styles.overflowUrgencyBadge, { backgroundColor: getUrgencyColor(bin.daysUntil) }]}>
                          <Text style={styles.overflowUrgencyText}>{getUrgencyLabel(bin.daysUntil)}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Overflow Date */}
                    <View style={styles.overflowDateSection}>
                      <View style={styles.overflowDateContainer}>
                        <Text style={styles.overflowDateIcon}>📅</Text>
                        <View>
                          <Text style={styles.overflowDateLabel}>Predicted Overflow</Text>
                          <Text style={styles.overflowDateText}>{bin.overflowDate}</Text>
                        </View>
                      </View>
                      <View style={[styles.overflowDaysContainer, { backgroundColor: getUrgencyColor(bin.daysUntil) }]}>
                        <Text style={styles.overflowDaysNumber}>{bin.daysUntil}</Text>
                        <Text style={styles.overflowDaysLabel}>days</Text>
                      </View>
                    </View>

                    {/* Prediction Note */}
                    <View style={styles.overflowPredictionNote}>
                      <Text style={styles.overflowPredictionIcon}>💡</Text>
                      <Text style={styles.overflowPredictionText}>{bin.prediction}</Text>
                    </View>
                  </View>
                ))}

                {/* Footer Note */}
                <View style={styles.overflowFooterNote}>
                  <Text style={styles.overflowFooterIcon}>⚡</Text>
                  <Text style={styles.overflowFooterText}>
                    Predictions update daily based on your disposal activity. Time series models analyze historical patterns to forecast overflow dates.
                  </Text>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Divider - Only show for image and description tabs */}
          {(inputMethod === 'image' || inputMethod === 'description') && (
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>and</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Volume Input - Only show for image and description tabs */}
          {(inputMethod === 'image' || inputMethod === 'description') && (
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Waste Volume</Text>
              <Text style={styles.sectionSubtitle}>Enter approximate volume in milliliters</Text>
              <View style={styles.volumeInputContainer}>
                <TextInput
                  style={styles.volumeInput}
                  value={volume}
                  onChangeText={setVolume}
                  placeholder="e.g., 500"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <Text style={styles.volumeUnit}>ml</Text>
              </View>
            </View>
          )}

          {/* Submit Button - Only show for image and description tabs */}
          {(inputMethod === 'image' || inputMethod === 'description') && (
            <TouchableOpacity 
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Processing...' : '🔍 Check Waste Type'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      <Modal
        visible={isLoading}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Analyzing waste...</Text>
            <Text style={styles.loadingSubtext}>Please wait</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FFFE', 
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E8',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  methodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F9F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  methodButtonTextActive: {
    color: '#2E7D32',
  },
  inputSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  imageUploadButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cameraIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#F0F9F0',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraIcon: {
    fontSize: 32,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  uploadedImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 20,
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    backgroundColor: '#F8FFFE',
    paddingHorizontal: 12,
  },
  volumeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  volumeInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  volumeUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.7,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  // Overflow Tab Styles
  overflowContainer: {
    flex: 1,
    marginBottom: 24,
  },
  overflowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    marginBottom: 12,
  },
  overflowHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overflowHeaderIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  overflowTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  overflowSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  overflowInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  overflowInfoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  overflowInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  overflowScrollView: {
    flex: 1,
    maxHeight: 500,
  },
  overflowScrollContent: {
    paddingBottom: 20,
  },
  overflowBinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  overflowBinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overflowBinImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  overflowBinImage: {
    width: 45,
    height: 45,
  },
  overflowBinInfo: {
    flex: 1,
  },
  overflowBinName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  overflowUrgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overflowUrgencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  overflowDateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  overflowDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overflowDateIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  overflowDateLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overflowDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  overflowDaysContainer: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 56,
  },
  overflowDaysNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  overflowDaysLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
  overflowPredictionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  overflowPredictionIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  overflowPredictionText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    flex: 1,
  },
  overflowFooterNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  overflowFooterIcon: {
    fontSize: 18,
    marginTop: 2,
    marginRight: 10,
  },
  overflowFooterText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
    lineHeight: 18,
  },
});
