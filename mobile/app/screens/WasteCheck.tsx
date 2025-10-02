import React, { useState } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

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

export default function WasteCheck({ navigation }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [volume, setVolume] = useState('');
  const [inputMethod, setInputMethod] = useState<'image' | 'description'>('image');

  const handleImageSelect = () => {
    // TODO: Implement image picker
    Alert.alert('Image Selection', 'Image picker will be implemented here');
  };

  const handleSubmit = () => {
    if (inputMethod === 'image' && !selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }
    if (inputMethod === 'description' && !description.trim()) {
      Alert.alert('Error', 'Please describe your waste');
      return;
    }
    if (!volume.trim()) {
      Alert.alert('Error', 'Please enter the waste volume');
      return;
    }

    // TODO: Send data to FastAPI backend
    const wasteData = {
      image: selectedImage,
      description: description,
      volume: parseInt(volume),
      inputMethod: inputMethod,
    };
    
    console.log('Waste data:', wasteData);
    Alert.alert('Success', 'Data will be sent to backend for classification');
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
              onPress={() => setInputMethod('image')}
            >
              <Text style={[styles.methodButtonText, inputMethod === 'image' && styles.methodButtonTextActive]}>
                📷 Image
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.methodButton, inputMethod === 'description' && styles.methodButtonActive]}
              onPress={() => setInputMethod('description')}
            >
              <Text style={[styles.methodButtonText, inputMethod === 'description' && styles.methodButtonTextActive]}>
                ✏️ Description
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

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>and</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Volume Input */}
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

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>🔍 Check Waste Type</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
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
});
