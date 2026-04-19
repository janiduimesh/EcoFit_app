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
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Picker } from '@react-native-picker/picker';

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  WasteCheck: undefined;
  Result: { data: any };
  complaint: undefined;
};

type ComplaintCreateScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'complaint'
>;

type Props = {
  navigation: ComplaintCreateScreenNavigationProp;
};

type WardOption = {
  label: string;
  value: string;
};

export default function ComplaintCreate({ navigation }: Props) {
  const [wardId, setWardId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const wardOptions: WardOption[] = [
    { label: 'Select ward...', value: '' },
    { label: 'Fort', value: 'W01' },
    { label: 'Slave Island', value: 'W02' },
    { label: 'Kochchikade North', value: 'W03' },
    { label: 'Pettah', value: 'W04' },
    { label: 'Suduwella', value: 'W05' },
    { label: 'Kochchikade South', value: 'W06' },
    { label: 'St. Pauls', value: 'W07' },
    { label: 'Kotahena East', value: 'W08' },
    { label: 'Kotahena West', value: 'W09' },
    { label: 'Maradana', value: 'W10' },
    { label: 'New Bazaar', value: 'W11' },
    { label: 'Bloemendhal', value: 'W12' },
    { label: 'Wanathamulla', value: 'W13' },
    { label: 'Narahenpita', value: 'W14' },
    { label: 'Kirula', value: 'W15' },
    { label: 'Pamankada East', value: 'W16' },
    { label: 'Cinnamon Gardens', value: 'W17' },
    { label: 'Borella North', value: 'W18' },
    { label: 'Borella South', value: 'W19' },
    { label: 'Dematagoda', value: 'W20' },
    { label: 'Grandpass North', value: 'W21' },
    { label: 'Grandpass South', value: 'W22' },
    { label: 'Aluthkade East', value: 'W23' },
    { label: 'Aluthkade West', value: 'W24' },
    { label: 'Mutwal', value: 'W25' },
    { label: 'Mattakkuliya', value: 'W26' },
    { label: 'Modara', value: 'W27' },
    { label: 'Madampitiya', value: 'W28' },
    { label: 'Mahawatta', value: 'W29' },
    { label: 'Kuppiyawatta West', value: 'W30' },
    { label: 'Kuppiyawatta East', value: 'W31' },
    { label: 'Keselwatta', value: 'W32' },
    { label: 'Maligawatta East', value: 'W33' },
    { label: 'Maligawatta West', value: 'W34' },
    { label: 'Thimbirigasyaya', value: 'W35' },
    { label: 'Havelock Town', value: 'W36' },
    { label: 'Kirulapone', value: 'W37' },
    { label: 'Pamankada West', value: 'W38' },
    { label: 'Wellawatta North', value: 'W39' },
    { label: 'Wellawatta South', value: 'W40' },
    { label: 'Bambalapitiya', value: 'W41' },
    { label: 'Kollupitiya', value: 'W42' },
    { label: 'Kurunduwatta', value: 'W43' },
    { label: 'Hunupitiya', value: 'W44' },
    { label: 'Ginthupitiya', value: 'W45' },
    { label: 'Khettarama', value: 'W46' },
    { label: 'Maha Watta', value: 'W47' },
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
        const AsyncStorage =
          require('@react-native-async-storage/async-storage').default;
        const storedUserId = await AsyncStorage.getItem('user_id');
        if (storedUserId) setUserId(storedUserId);
      } catch (error) {
        console.warn('Could not load user_id:', error);
      }
    };
    loadUserId();
  }, []);

  const selectedWardLabel =
    wardOptions.find((w) => w.value === wardId)?.label || '';

  const handleSubmit = async () => {
    if (!wardId) {
      Alert.alert('Error', 'Please select a ward');
      return;
    }

    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a complaint description');
      return;
    }

    if (!priority) {
      Alert.alert('Error', 'Please select a priority');
      return;
    }

    if (!contact.trim()) {
      Alert.alert('Error', 'Please enter your contact number');
      return;
    }

    try {
      setIsLoading(true);

      const { createComplaint } = await import('../api/complaint');

      const payload = {
        wardId,
        wardName: selectedWardLabel,
        ward: {
          wardId,
          wardName: selectedWardLabel,
        },
        category,
        description: description.trim(),
        priority: priority as 'low' | 'medium' | 'high',
        userId: userId || undefined,
        contact: contact.trim(),
      };

      console.log('Sending complaint payload:', payload);

      const res = await createComplaint(payload);

      if (res?.success) {
        Alert.alert('Success', 'Complaint submitted successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setWardId('');
              setCategory('');
              setDescription('');
              setPriority('');
              setContact('');
            },
          },
        ]);
      } else {
        Alert.alert('Error', res?.message || 'Failed to submit complaint');
      }
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to submit complaint. Please try again.';
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
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Submit Complaint</Text>
            <Text style={styles.sectionSubtitle}>
              Report waste-related issues in your area
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Ward</Text>
            <Text style={styles.sectionSubtitle}>Select the complaint ward</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={wardId}
                onValueChange={(value) => setWardId(String(value))}
              >
                {wardOptions.map((w) => (
                  <Picker.Item
                    key={w.value || 'empty'}
                    label={w.label}
                    value={w.value}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Category</Text>
            <Text style={styles.sectionSubtitle}>Select the closest category</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={category}
                onValueChange={(value) => setCategory(String(value))}
              >
                {categoryOptions.map((c) => (
                  <Picker.Item
                    key={c.value || 'empty'}
                    label={c.label}
                    value={c.value}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionSubtitle}>Explain the issue clearly</Text>
            <TextInput
              style={[styles.descriptionInput, styles.multiLineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Priority</Text>
            <Text style={styles.sectionSubtitle}>Select priority level</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={priority}
                onValueChange={(value) => setPriority(String(value))}
              >
                {priorityOptions.map((p) => (
                  <Picker.Item
                    key={p.value || 'empty'}
                    label={p.label}
                    value={p.value}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.sectionSubtitle}>Phone number</Text>
            <TextInput
              style={styles.descriptionInput}
              value={contact}
              onChangeText={setContact}
              placeholder="077xxxxxxx"
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

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

      <Modal visible={isLoading} transparent animationType="fade">
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
  multiLineInput: {
    minHeight: 120,
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