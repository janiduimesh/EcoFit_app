import { getApiUrl } from '../utils/config';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  SafeAreaView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE = getApiUrl();
const WASTE_TYPES = ["Organic", "Inorganic", "Recyclable"];

const PricingPortal = () => {
  // Form State
  const [wasteType, setWasteType] = useState('');
  const [price, setPrice] = useState('');
  const [collectorId, setCollectorId] = useState('');
  const [date, setDate] = useState(new Date());

  // UI State
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [currentDbPrice, setCurrentDbPrice] = useState(null);

  // --- 1. Fetch Current Price when Waste Type Changes ---
  useEffect(() => {
    if (wasteType) {
      fetchCurrentPrice(wasteType);
    } else {
      setCurrentDbPrice(null);
    }
  }, [wasteType]);

  const fetchCurrentPrice = async (type) => {
    setFetchingPrice(true);
    try {
      const response = await fetch(`${API_BASE}/pricing/get_price/${type}`);
      if (response.ok) {
        const data = await response.json();
        // data.current_base_price might be 0 if not set
        setCurrentDbPrice(data.current_base_price);
      }
    } catch (e) {
      console.log("Error fetching price", e);
    } finally {
      setFetchingPrice(false);
    }
  };

  // --- 2. Date Picker Handlers ---
  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const confirmIosDate = () => {
    setShowPicker(false);
  };

  // --- 3. Submit Handler ---
  const handleSetPrice = async () => {
    Keyboard.dismiss();

    if (!wasteType || !price || !collectorId) {
      Alert.alert('Missing Info', 'Please select a Waste Type, enter Price, and Collector ID.');
      return;
    }

    setLoading(true);

    const payload = {
      waste_type: wasteType,
      price: parseFloat(price),
      collector_id: collectorId,
      effective_date: date.toISOString().split('T')[0],
    };

    try {
      const response = await fetch(`${API_BASE}/pricing/set_price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `Price for ${wasteType} updated to Rs. ${price}`);
        // Refresh the "Current Price" display
        fetchCurrentPrice(wasteType);
        setPrice(''); // Clear price input but keep other fields for easy multi-entry
      } else {
        Alert.alert('Error', data.detail || 'Failed to update price');
      }
    } catch (error) {
      Alert.alert('Connection Error', `Could not reach server.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Collector Pricing</Text>
            <Text style={styles.headerSubtitle}>Manage weekly base rates</Text>
          </View>

          <View style={styles.card}>

            {/* --- WASTE TYPE SELECTOR (Chips) --- */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Waste Type</Text>
              <View style={styles.chipContainer}>
                {WASTE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, wasteType === type && styles.chipActive]}
                    onPress={() => setWasteType(type)}
                  >
                    <Text style={[styles.chipText, wasteType === type && styles.chipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Show Current Database Price */}
              {wasteType !== '' && (
                <View style={styles.priceInfoBox}>
                  {fetchingPrice ? (
                    <ActivityIndicator size="small" color="#666" />
                  ) : (
                    <Text style={styles.priceInfoText}>
                      Current System Price: <Text style={{fontWeight: 'bold', color:'#2e7d32'}}>
                        {currentDbPrice !== null ? `Rs. ${currentDbPrice}` : 'Not Set'}
                      </Text>
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* --- PRICE INPUT --- */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Base Price (per kg)</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rs.</Text>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* --- COLLECTOR ID --- */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Collector ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. admin_01"
                value={collectorId}
                onChangeText={setCollectorId}
                autoCapitalize="none"
              />
            </View>

            {/* --- DATE PICKER --- */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Effective Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowPicker(true)}
              >
                <Text style={styles.dateButtonText}>{date.toDateString()}</Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
            </View>

            {/* --- SUBMIT BUTTON --- */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSetPrice}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Update Price</Text>
              )}
            </TouchableOpacity>

          </View>
        </ScrollView>

        {/* --- IOS DATE PICKER MODAL --- */}
        {Platform.OS === 'ios' && (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showPicker}
            onRequestClose={() => setShowPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select Effective Date</Text>
                  <TouchableOpacity onPress={confirmIosDate}>
                    <Text style={styles.modalDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  minimumDate={new Date(2023, 0, 1)}
                  textColor="black"
                />
              </View>
            </View>
          </Modal>
        )}

        {Platform.OS === 'android' && showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date(2023, 0, 1)}
          />
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
  container: { flex: 1 },
  scrollContainer: { padding: 20, paddingBottom: 50 },

  header: { marginBottom: 20, marginTop: 10 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#102a43' },
  headerSubtitle: { fontSize: 14, color: '#627d98', marginTop: 4 },

  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#486581', marginBottom: 8, textTransform:'uppercase' },

  // Chips
  chipContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f4f8'
  },
  chipActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3'
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#627d98' },
  chipTextActive: { color: '#102a43', fontWeight: 'bold' },

  // Price Info
  priceInfoBox: { marginTop: 10, alignItems: 'flex-end' },
  priceInfoText: { fontSize: 12, color: '#486581' },

  // Inputs
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#102a43',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 50,
    paddingHorizontal: 15
  },
  currencyPrefix: { fontSize: 16, fontWeight: 'bold', color: '#829ab1', marginRight: 10 },
  inputFlex: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#102a43', height: '100%' },

  // Date Button
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
  },
  dateButtonText: { fontSize: 16, color: '#102a43' },
  calendarIcon: { fontSize: 18 },

  // Submit
  submitButton: {
    backgroundColor: '#102a43',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 2
  },
  submitButtonDisabled: { backgroundColor: '#9aa5b1' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // iOS Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4f8',
    backgroundColor: '#f9f9f9',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  modalCancel: { color: '#ef5350', fontSize: 16 },
  modalDone: { color: '#2196f3', fontWeight: 'bold', fontSize: 16 },
});

export default PricingPortal;