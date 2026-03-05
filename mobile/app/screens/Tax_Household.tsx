import { getApiUrl } from '../utils/config';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, Modal, FlatList, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';

import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';
import { REGIONAL_LOCATIONS } from '../components/Tax_Areas';

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  accent: '#74C69D',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  border: '#E0EAE5',
  error: '#D90429'
};

const WASTE_TYPES = ["Organic", "Inorganic", "Recyclable"];
const WASTE_TIERS = ["Low", "Medium", "High"];

const API_BASE = getApiUrl();
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

const getCurrentDateInfo = () => {
  const today = new Date();
  const year = today.getFullYear();
  const oneJan = new Date(today.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((today.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const currentWeek = Math.ceil((today.getDay() + 1 + numberOfDays) / 7);
  return { year, currentWeek };
};

export default function CreateHouseholdScreen({ navigation, route }) {
  const { email } = route.params || { email: "unknown@email.com" };

  const [householdId, setHouseholdId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [wasteTier, setWasteTier] = useState('');
  const [incomeTier, setIncomeTier] = useState('');
  const [idLoading, setIdLoading] = useState(false);
  const qrCodeRef = useRef(null);

  const [wasteData, setWasteData] = useState({ Organic: [], Inorganic: [], Recyclable: [] });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState("Organic");
  const [loading, setLoading] = useState(false);

  const filteredLocations = REGIONAL_LOCATIONS.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.district.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchNextId = async () => {
      if (!selectedLocation) return;
      setIdLoading(true);
      setHouseholdId("...");
      try {
        const response = await api.get(`/get_next_id`, { params: { location: selectedLocation } });
        setHouseholdId(response.data.next_id);
      } catch (error) {
        setHouseholdId("Error");
        Alert.alert("Connection Error", "Could not fetch Household ID.");
      } finally { setIdLoading(false); }
    };
    fetchNextId();
  }, [selectedLocation]);

  const generateWeights = (tier) => {
    if (!tier) return;
    const { year, currentWeek } = getCurrentDateInfo();
    const newData = { Organic: [], Inorganic: [], Recyclable: [] };
    const multipliers = { Low: 0.8, Medium: 1.0, High: 1.3 };
    const mult = multipliers[tier];

    for (let i = 12; i > 0; i--) {
      const weekNum = currentWeek - i > 0 ? currentWeek - i : 52 + (currentWeek - i);
      const yearNum = currentWeek - i > 0 ? year : year - 1;
      newData.Organic.push({ year: yearNum, week: weekNum, weight_kg: parseFloat(((1.5 + Math.random() * 2) * mult).toFixed(2)) });
      newData.Inorganic.push({ year: yearNum, week: weekNum, weight_kg: parseFloat(((0.3 + Math.random() * 0.5) * mult).toFixed(2)) });
      newData.Recyclable.push({ year: yearNum, week: weekNum, weight_kg: parseFloat(((0.5 + Math.random() * 1.0) * mult).toFixed(2)) });
    }
    setWasteData(newData);
  };

  const handleWasteTierSelect = (tier) => {
    setWasteTier(tier);
    setIncomeTier(tier);
    generateWeights(tier);
  };

  const updateWeight = (type, index, text) => {
    const updatedList = [...wasteData[type]];
    updatedList[index].weight_kg = text === '' ? '' : text;
    setWasteData((prev) => ({ ...prev, [type]: updatedList }));
  };

  const handleSubmit = async () => {

    if (!wasteTier) {
      Alert.alert("Selection Required", "Please select a Waste Generation Tier before submitting.");
      return;
    }

    if (!householdId || householdId === "..." || householdId === "Error") {
      Alert.alert("Error", "Please wait for a valid Household ID.");
      return;
    }

    setLoading(true);
    try {
      let qrBase64String = "";
      if (qrCodeRef.current) {
        qrCodeRef.current.toDataURL((data) => { qrBase64String = data; });
        await new Promise(r => setTimeout(r, 200));
      }

      const finalWasteData = JSON.parse(JSON.stringify(wasteData));
      WASTE_TYPES.forEach(t => {
        finalWasteData[t] = finalWasteData[t].map(item => ({
          ...item,
          weight_kg: item.weight_kg === '' ? 0 : parseFloat(item.weight_kg)
        }));
      });

      const payload = {
        email,
        household_id: householdId,
        income_tier: incomeTier, // Will now be 'Low', 'Medium', or 'High'
        waste_data: finalWasteData,
        qr_code: qrBase64String || "placeholder"
      };

      const response = await api.post('/create_user', payload);
      if (response.status === 200) {
        Alert.alert("Success", "Household Created!", [{ text: "Go to Dashboard", onPress: () => navigation.replace('Tax', { email }) }]);
      }
    } catch (error) {
      Alert.alert("Server Error", "Submission failed.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <View style={styles.headerSection}>
            <Text style={styles.welcomeLabel}>Account Setup</Text>
            <Text style={styles.header}>New Household</Text>
            <Text style={styles.subText}>Creating profile for: <Text style={{ fontWeight: 'bold' }}>{email}</Text></Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Resident Location</Text>
            <TouchableOpacity style={styles.selectBox} onPress={() => setShowLocationModal(true)}>
              <Text style={selectedLocation ? styles.inputText : styles.placeholder}>
                {selectedLocation || "Select your area..."}
              </Text>
              <Text style={styles.selectArrow}>▼</Text>
            </TouchableOpacity>

            <View style={styles.idRow}>
              <View style={{ flex: 1, marginRight: 5 }}>
                <Text style={styles.label}>Household ID</Text>
                <View style={styles.idBox}>
                  {idLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.idValue}>{householdId || "Waiting..."}</Text>}
                </View>
              </View>
              {householdId && householdId !== "..." && householdId !== "Error" && (
                <View style={styles.qrWrapper}>
                  <QRCode value={householdId} size={70} getRef={(c) => (qrCodeRef.current = c)} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Waste Generation Tier</Text>
            <View style={styles.pillContainer}>
              {WASTE_TIERS.map(tier => (
                <TouchableOpacity key={tier} style={[styles.pill, wasteTier === tier && styles.pillActive]} onPress={() => handleWasteTierSelect(tier)}>
                  <Text style={[styles.pillText, wasteTier === tier && styles.pillTextActive]}>{tier}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <TouchableOpacity style={styles.accordionHeader} onPress={() => setShowAdvanced(!showAdvanced)}>
              <Text style={styles.accordionTitle}>Manual History Adjustments</Text>
              <Text style={styles.accordionIcon}>{showAdvanced ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedContent}>
                <View style={styles.tabContainer}>
                  {WASTE_TYPES.map(type => (
                    <TouchableOpacity key={type} style={[styles.tab, activeTab === type && styles.tabActive]} onPress={() => setActiveTab(type)}>
                      <Text style={[styles.tabText, activeTab === type && styles.tabTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.weightList}>
                  {wasteTier ? wasteData[activeTab].map((item, index) => (
                    <View key={index} style={styles.rowInput}>
                      <Text style={styles.rowLabel}>Week {item.week}:</Text>
                      <View style={styles.weightInputWrapper}>
                        <TextInput style={styles.weightInput} keyboardType="numeric" value={String(item.weight_kg)} onChangeText={(text) => updateWeight(activeTab, index, text)} selectTextOnFocus />
                        <Text style={styles.unit}>kg</Text>
                      </View>
                    </View>
                  )) : <Text style={styles.infoText}>Select a Waste Level first.</Text>}
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit & Generate QR</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showLocationModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Area</Text>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.searchBar} placeholder="Search Colombo or Gampaha..." value={searchQuery} onChangeText={setSearchQuery} autoFocus />
          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.locationItem}
                onPress={() => { setSelectedLocation(item.label); setShowLocationModal(false); setSearchQuery(''); }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.locationText}>{item.label}</Text>
                  <View style={styles.districtBadge}><Text style={styles.districtBadgeText}>{item.district}</Text></View>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 24 },
  headerSection: { marginBottom: 25 },
  welcomeLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  header: { fontSize: 28, fontWeight: '600', color: COLORS.textDark, marginTop: 4 },
  subText: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, marginBottom: 16, elevation: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 8 },
  selectBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginBottom: 20 },
  inputText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  placeholder: { fontSize: 15, color: COLORS.textLight },
  selectArrow: { fontSize: 10, color: COLORS.secondary },
  idRow: { flexDirection: 'row', alignItems: 'center' },
  idBox: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  idValue: { fontSize: 18, fontWeight: '600', color: COLORS.primary },
  qrWrapper: { backgroundColor: COLORS.white, padding: 5, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginLeft: 15 },
  pillContainer: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontWeight: '600', color: COLORS.textLight },
  pillTextActive: { color: COLORS.white },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  accordionIcon: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  advancedContent: { marginTop: 15, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 15 },
  tabContainer: { flexDirection: 'row', marginBottom: 20 },
  tab: { flex: 1, paddingBottom: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textLight, fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: COLORS.primary },
  weightList: { gap: 10 },
  rowInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: COLORS.textDark, fontWeight: '600' },
  weightInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 10 },
  weightInput: { paddingVertical: 8, fontSize: 14, fontWeight: '600', color: COLORS.primary, width: 60, textAlign: 'right' },
  unit: { fontSize: 10, color: COLORS.textLight, marginLeft: 4, fontWeight: '600' },
  infoText: { fontStyle: 'italic', color: COLORS.textLight, textAlign: 'center', marginVertical: 10 },
  submitBtn: { backgroundColor: COLORS.primary, padding: 20, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textDark },
  closeText: { color: COLORS.error, fontWeight: 'bold' },
  searchBar: { margin: 20, padding: 15, backgroundColor: COLORS.background, borderRadius: 12, fontSize: 16 },
  locationItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  locationText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  districtBadge: { backgroundColor: '#E0EAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  districtBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '700', textTransform: 'uppercase' },
});