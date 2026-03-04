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
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  WasteCheck: undefined;
  Result: { data: any };
  complaint: undefined;
};

type ComplaintCreateScreenNavigationProp = StackNavigationProp<RootStackParamList, 'complaint'>;

type Props = {
  navigation: ComplaintCreateScreenNavigationProp;
};

const { width } = Dimensions.get('window');

export default function ComplaintCreate({ navigation }: Props) {
  // Ward is optional
  const [wardId, setWardId] = useState<string>('');

  // No default values (start empty)
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Contact is required (not optional)
  const [contact, setContact] = useState<string>('');

  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Dropdown options
  const wardOptions = [
    '', // empty = not selected (optional)
    'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10',
    'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20',
  ];

  const categoryOptions = [
    { value: '', label: 'Select category...' },
    { value: 'garbage', label: 'Garbage / Mixed Waste' },
    { value: 'overflow', label: 'Bin Overflow' },
    { value: 'illegal_dumping', label: 'Illegal Dumping' },
    { value: 'missed_collection', label: 'Missed Collection' },
    { value: 'burning_waste', label: 'Burning Waste' },
    { value: 'bad_odour', label: 'Bad Odour' },
    { value: 'hazardous_waste', label: 'Hazardous Waste' },
    { value: 'medical_waste', label: 'Medical Waste' },
    { value: 'construction_debris', label: 'Construction Debris' },
    { value: 'e_waste', label: 'E-waste' },
    { value: 'animal_carcass', label: 'Dead Animal' },
    { value: 'blocked_drain', label: 'Blocked Drain (Waste related)' },
    { value: 'other', label: 'Other' },
  ];

  const priorityOptions = [
    { value: '', label: 'Select priority...' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const storedUserId = await AsyncStorage.getItem('user_id');
        if (storedUserId) setUserId(storedUserId);
      } catch (error) {
        console.warn('Could not load user_id:', error);
      }
    };
    loadUserId();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to submit a complaint. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsLoading(true);

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);

      Alert.alert('Location Added', 'Your current location was added successfully.');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Required: description
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a complaint description');
      return;
    }

    // Required: category
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    // Required: priority
    if (!priority) {
      Alert.alert('Error', 'Please select a priority');
      return;
    }

    // Required: contact
    if (!contact.trim()) {
      Alert.alert('Error', 'Please enter your contact number');
      return;
    }

    // Required: location
    if (lat === null || lng === null) {
      Alert.alert('Error', 'Please add your current location first');
      return;
    }

    // Safety validation
    if (!['low', 'medium', 'high'].includes(priority)) {
      Alert.alert('Error', 'Priority must be low / medium / high');
      return;
    }

    try {
      setIsLoading(true);

      const { createComplaint } = await import('../api/complaint');

      const payload = {
        lat,
        lng,
        wardId: wardId.trim() || undefined, // optional
        category,
        description: description.trim(),
        priority: priority as 'low' | 'medium' | 'high',
        userId: userId || undefined,
        contact: contact.trim(), // required
      };

      console.log('Sending complaint payload:', payload);

      const res = await createComplaint(payload);

      if (res?.success) {
        Alert.alert('Success', 'Complaint submitted successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // reset form (no defaults)
              setWardId('');
              setCategory('');
              setDescription('');
              setPriority('');
              setContact('');
              setLat(null);
              setLng(null);
            },
          },
        ]);
      } else {
        Alert.alert('Error', res?.message || 'Failed to submit complaint');
      }
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      const msg = error?.message || 'Failed to submit complaint. Please try again.';
      Alert.alert('Error', msg);
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
          {/* Title */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Submit Complaint</Text>
            <Text style={styles.sectionSubtitle}>Report waste-related issues in your area</Text>
          </View>

          {/* Ward ID (Optional) */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Ward ID (Optional)</Text>
            <Text style={styles.sectionSubtitle}>Select if you know (otherwise leave empty)</Text>

            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={wardId}
                onValueChange={(value) => setWardId(String(value))}
              >
                <Picker.Item label="Select ward (optional)..." value="" />
                {wardOptions
                  .filter((w) => w !== '')
                  .map((w) => (
                    <Picker.Item key={w} label={w} value={w} />
                  ))}
              </Picker>
            </View>
          </View>

          {/* Category */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Category</Text>
            <Text style={styles.sectionSubtitle}>Select the closest category</Text>

            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={category}
                onValueChange={(value) => setCategory(String(value))}
              >
                {categoryOptions.map((c) => (
                  <Picker.Item key={c.value || 'empty'} label={c.label} value={c.value} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionSubtitle}>Explain the issue clearly</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Priority */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Priority</Text>
            <Text style={styles.sectionSubtitle}>Select priority level</Text>

            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={priority}
                onValueChange={(value) => setPriority(String(value))}
              >
                {priorityOptions.map((p) => (
                  <Picker.Item key={p.value || 'empty'} label={p.label} value={p.value} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Contact (Required) */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.sectionSubtitle}>Phone number (required)</Text>
            <TextInput
              style={styles.descriptionInput}
              value={contact}
              onChangeText={setContact}
              placeholder="077xxxxxxx"
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Location</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Location Button */}
          <View style={styles.inputSection}>
            <TouchableOpacity style={styles.imageUploadButton} onPress={getCurrentLocation}>
              <View style={styles.uploadPlaceholder}>
                <View style={styles.cameraIconContainer}>
                  <Text style={styles.cameraIcon}>📍</Text>
                </View>

                <Text style={styles.uploadText}>
                  {lat && lng ? 'Location Added ✅' : 'Add Current Location'}
                </Text>

                <Text style={styles.uploadSubtext}>
                  {lat && lng ? `Lat: ${lat.toFixed(5)} | Lng: ${lng.toFixed(5)}` : 'Tap to use GPS'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Submitting...' : '📨 Submit Complaint'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      <Modal visible={isLoading} transparent={true} animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Submitting...</Text>
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

  // NEW: picker wrapper uses the same “input” look
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  imageUploadButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    minHeight: 140,
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
  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 52,
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
});