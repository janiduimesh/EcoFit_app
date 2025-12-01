import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
  userId?: string;
}

// Dropdown options
const WASTE_AMOUNTS = [
  'Low',
  'Medium',
  'High',
];

const RESIDENCE_TYPES = [
  'Single-family home',
  'Multi-family home',
  'Apartment building',
  'Condo/Townhouse',
  'Mobile home',
  'Other',
];

const HOUSEHOLD_SIZES = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7+',
];

export default function OnboardingModal({
  visible,
  onComplete,
  userId,
}: OnboardingModalProps) {
  // Question 1: Waste amount (dropdown)
  const [wasteAmount, setWasteAmount] = useState<string>('');
  const [showWasteAmountDropdown, setShowWasteAmountDropdown] = useState(false);

  // Question 2: Recycling bin (yes/no)
  const [hasRecyclingBin, setHasRecyclingBin] = useState<string>('');

  // Question 3: Compost bin (yes/no)
  const [hasCompostBin, setHasCompostBin] = useState<string>('');

  // Question 4: Weekly waste collection (yes/no)
  const [hasWeeklyCollection, setHasWeeklyCollection] = useState<string>('');

  // Question 5: Residence type (dropdown)
  const [residenceType, setResidenceType] = useState<string>('');
  const [showResidenceTypeDropdown, setShowResidenceTypeDropdown] = useState(false);

  // Question 6: Household size (dropdown)
  const [householdSize, setHouseholdSize] = useState<string>('');
  const [showHouseholdSizeDropdown, setShowHouseholdSizeDropdown] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!wasteAmount) {
      Alert.alert('Error', 'Please select the amount of waste your household generates');
      return;
    }
    if (!hasRecyclingBin) {
      Alert.alert('Error', 'Please answer if you have a recycling bin');
      return;
    }
    if (!hasCompostBin) {
      Alert.alert('Error', 'Please answer if you have a compost bin');
      return;
    }
    if (!hasWeeklyCollection) {
      Alert.alert('Error', 'Please answer if your area has weekly waste collection');
      return;
    }
    if (!residenceType) {
      Alert.alert('Error', 'Please select your residence type');
      return;
    }
    if (!householdSize) {
      Alert.alert('Error', 'Please select household size');
      return;
    }

    setIsLoading(true);

    try {
      const profileData = {
        waste_amount: wasteAmount.toLowerCase(),
        has_recycling_bin: hasRecyclingBin === 'yes',
        has_compost_bin: hasCompostBin === 'yes',
        has_weekly_collection: hasWeeklyCollection === 'yes',
        residence_type: residenceType,
        household_size: householdSize,
        onboarding_completed: true,
      };

      // Import API function dynamically
      const { updateUserProfile } = await import('../api/user');
      await updateUserProfile(userId || '', profileData);
      
      // Mark as completed in local storage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('onboarding_completed', 'true');
        if (userId) {
          await AsyncStorage.setItem('user_id', userId);
        }
      } catch (storageError) {
        console.warn('AsyncStorage not available:', storageError);
      }

      Alert.alert('Success', 'Thank you! Your information has been saved.', [
        {
          text: 'OK',
          onPress: onComplete,
        },
      ]);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save information. Please try again.');
      setIsLoading(false);
    }
  };

  const renderDropdown = (
    value: string,
    options: string[],
    onSelect: (value: string) => void,
    showDropdown: boolean,
    setShowDropdown: (show: boolean) => void,
    placeholder: string
  ) => {
    return (
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
            {value || placeholder}
          </Text>
          <Text style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showDropdown && (
          <View style={styles.dropdownList}>
            <ScrollView nestedScrollEnabled={true}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownOption}
                  onPress={() => {
                    onSelect(option);
                    setShowDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderYesNoButtons = (
    value: string,
    onSelect: (value: string) => void,
    label: string
  ) => {
    return (
      <View style={styles.yesNoContainer}>
        <TouchableOpacity
          style={[
            styles.yesNoButton,
            value === 'yes' && styles.yesNoButtonActive,
          ]}
          onPress={() => onSelect('yes')}
        >
          <Text
            style={[
              styles.yesNoButtonText,
              value === 'yes' && styles.yesNoButtonTextActive,
            ]}
          >
            Yes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.yesNoButton,
            value === 'no' && styles.yesNoButtonActive,
          ]}
          onPress={() => onSelect('no')}
        >
          <Text
            style={[
              styles.yesNoButtonText,
              value === 'no' && styles.yesNoButtonTextActive,
            ]}
          >
            No
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {}} 
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.header}>
                  <Text style={styles.title}>Welcome to EcoFit! 🎉</Text>
                  <Text style={styles.subtitle}>
                    Help us personalize your experience
                  </Text>
                </View>

                <View style={styles.form}>
                  {/* Question 1: Waste Amount */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      1. How would you describe the amount of waste your household generates each week? *
                    </Text>
                    {renderDropdown(
                      wasteAmount,
                      WASTE_AMOUNTS,
                      setWasteAmount,
                      showWasteAmountDropdown,
                      setShowWasteAmountDropdown,
                      'Select waste amount'
                    )}
                  </View>

                  {/* Question 2: Recycling Bin */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      2. Do you have a recycling bin available at your home? *
                    </Text>
                    {renderYesNoButtons(hasRecyclingBin, setHasRecyclingBin, 'recycling')}
                  </View>

                  {/* Question 3: Compost Bin */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      3. Do you have a compost bin at home? *
                    </Text>
                    {renderYesNoButtons(hasCompostBin, setHasCompostBin, 'compost')}
                  </View>

                  {/* Question 4: Weekly Collection */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      4. Does your area have weekly waste collection service? *
                    </Text>
                    {renderYesNoButtons(
                      hasWeeklyCollection,
                      setHasWeeklyCollection,
                      'collection'
                    )}
                  </View>

                  {/* Question 5: Residence Type */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      5. Which type of residence do you currently live in? *
                    </Text>
                    {renderDropdown(
                      residenceType,
                      RESIDENCE_TYPES,
                      setResidenceType,
                      showResidenceTypeDropdown,
                      setShowResidenceTypeDropdown,
                      'Select residence type'
                    )}
                  </View>

                  {/* Question 6: Household Size */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      6. How many people live in your household? *
                    </Text>
                    {renderDropdown(
                      householdSize,
                      HOUSEHOLD_SIZES,
                      setHouseholdSize,
                      showHouseholdSizeDropdown,
                      setShowHouseholdSizeDropdown,
                      'Select household size'
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 12,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1,
  },
  dropdownButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
  yesNoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  yesNoButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  yesNoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  yesNoButtonTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

