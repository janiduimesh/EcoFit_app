import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import { getApiUrl } from '../utils/config';
import DateTimePicker from '@react-native-community/datetimepicker';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_BASE = getApiUrl();

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  accent: '#74C69D',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  error: '#D90429',
  border: '#E0EAE5'
};

const CardManager = ({ householdId, onCardsUpdated }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cvc, setCvc] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [cardType, setCardType] = useState('Visa');


  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await axios.get(`${API_BASE}/cards/${householdId}`);
      setCards(res.data);
    } catch (e) {
      console.error("Fetch Cards Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      setExpiryDate(selectedDate);
    }
  };

  const handleAddCard = async () => {
    if (!cardHolder || cardNumber.length < 16 || cvc.length < 3) {
      Alert.alert("Invalid Input", "Please check card details.");
      return;
    }

    const expiryStr = `${(expiryDate.getMonth() + 1).toString().padStart(2, '0')}/${expiryDate.getFullYear().toString().slice(-2)}`;
    setAdding(true);

    try {
      await axios.post(`${API_BASE}/cards`, {
        household_id: householdId,
        card_holder: cardHolder,
        card_number: cardNumber,
        expiry: expiryStr,
        cvv: cvc,
        card_type: cardType
      });

      Alert.alert("Success", "Card linked securely.");
      setCardNumber(''); setCvc(''); setCardHolder('');
      toggleAccordion();
      fetchCards();
      if (onCardsUpdated) onCardsUpdated();
    } catch (e) {
      Alert.alert("Error", "Failed to add card.");
    } finally {
      setAdding(false);
    }
  };

  const deleteCard = (id) => {
    Alert.alert("Remove Card", "Delete this payment method?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`${API_BASE}/cards/${id}`);
            fetchCards();
            if (onCardsUpdated) onCardsUpdated();
          } catch (e) { Alert.alert("Error", "Could not remove card."); }
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>Saved Methods</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
      ) : (
        cards.map((item) => (
          <View key={item.card_id} style={styles.cardItem}>
            <View style={styles.cardIconBox}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={1.5}>
                <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMainText}>{item.card_type} •••• {item.last4}</Text>
              <Text style={styles.cardSubText}>Expires: {item.expiry}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteCard(item.card_id)}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}


      <View style={styles.accordionContainer}>
        <TouchableOpacity style={styles.accordionHeader} onPress={toggleAccordion}>
          <Text style={styles.accordionTitle}>+ Add New Method</Text>
          <Text style={styles.accordionIcon}>{isExpanded ? '−' : '+'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.formContent}>
            <TextInput
              placeholder="Full Name on Card"
              style={styles.input}
              value={cardHolder}
              onChangeText={setCardHolder}
              placeholderTextColor={COLORS.textLight}
            />

            <TextInput
              placeholder="Card Number (16 Digits)"
              style={styles.input}
              maxLength={16}
              keyboardType="numeric"
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholderTextColor={COLORS.textLight}
            />

            <View style={styles.row}>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
                <Text style={styles.dateLabel}>Expiry</Text>
                <Text style={styles.dateValue}>
                  {(expiryDate.getMonth() + 1).toString().padStart(2, '0')}/{expiryDate.getFullYear().toString().slice(-2)}
                </Text>
              </TouchableOpacity>

              <TextInput
                placeholder="CVC"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                maxLength={3}
                keyboardType="numeric"
                secureTextEntry
                value={cvc}
                onChangeText={setCvc}
                placeholderTextColor={COLORS.textLight}
              />
            </View>

            <View style={styles.typeToggle}>
              {['Visa', 'Mastercard'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, cardType === type && styles.activeType]}
                  onPress={() => setCardType(type)}>
                  <Text style={[styles.typeBtnText, cardType === type && styles.activeTypeText]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAddCard} disabled={adding}>
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Securely Link Card</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showPicker}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Expiry Date</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>


              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                  textColor="#000000"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- ANDROID DATE PICKER --- */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={expiryDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, paddingBottom: 20 },
  headerLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  cardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 2 },
  cardIconBox: { width: 48, height: 48, backgroundColor: COLORS.background, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardMainText: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  cardSubText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  removeText: { color: COLORS.error, fontWeight: 'bold', fontSize: 12 },
  accordionContainer: { marginTop: 15, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, alignItems: 'center', backgroundColor: '#F9FCFA' },
  accordionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  accordionIcon: { fontSize: 18, color: COLORS.primary, fontWeight: 'bold' },
  formContent: { padding: 18, borderTopWidth: 1, borderTopColor: COLORS.border },
  input: { backgroundColor: COLORS.background, padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 15, color: COLORS.textDark, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateSelector: { flex: 2, backgroundColor: COLORS.background, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { color: COLORS.textLight, fontSize: 12, fontWeight: '600' },
  dateValue: { fontWeight: '600', color: COLORS.primary },
  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 2, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.white },
  activeType: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { color: COLORS.textLight, fontWeight: '600' },
  activeTypeText: { color: COLORS.white },
  addBtn: { backgroundColor: COLORS.primary, padding: 10, borderRadius: 20, alignItems: 'center', elevation: 3 },
  addBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 15 },

  // Updated Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontWeight: '800', fontSize: 16, color: COLORS.textDark },
  modalCancel: { color: COLORS.error, fontWeight: 'bold' },
  modalDone: { color: COLORS.primary, fontWeight: 'bold' },
  pickerContainer: { height: 215, backgroundColor: '#fff', justifyContent: 'center' }, // Fixed height for iOS
});

export default CardManager;