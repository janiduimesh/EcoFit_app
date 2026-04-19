import { getApiUrl } from '../utils/config';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, Modal, FlatList, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';


import Svg, { Path, Rect, G, Defs, ClipPath } from 'react-native-svg';

import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';
import { REGIONAL_LOCATIONS } from '../components/Tax_Areas';

type TaxHouseholdStackParamList = {
  Tax_Household: { email: string };
  Tax: { email: string };
};
type CreateHouseholdScreenNavigationProp = StackNavigationProp<TaxHouseholdStackParamList, 'Tax_Household'>;
type CreateHouseholdScreenRouteProp = RouteProp<TaxHouseholdStackParamList, 'Tax_Household'>;
type CreateHouseholdScreenProps = {
  navigation: CreateHouseholdScreenNavigationProp;
  route: CreateHouseholdScreenRouteProp;
};

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

type WasteTier = 'Low' | 'Medium' | 'High';
type WasteDataPoint = { year: number; week: number; weight_kg: number };
type WasteData = {
  Organic: WasteDataPoint[];
  Inorganic: WasteDataPoint[];
  Recyclable: WasteDataPoint[];
};

const WASTE_TYPES: (keyof WasteData)[] = ["Organic", "Inorganic", "Recyclable"];
const WASTE_TIERS: WasteTier[] = ["Low", "Medium", "High"];

// Reference ranges for the UI Legend
const TIER_REFERENCES = {
  Low: { level: "1/4", organic: "1.2 - 2.8", inorganic: "0.2 - 0.6", recyclable: "0.4 - 1.2" },
  Medium: { level: "1/2", organic: "2.5 - 4.5", inorganic: "0.5 - 1.0", recyclable: "0.8 - 1.8" },
  High: { level: "3/4", organic: "4.8 - 7.5", inorganic: "0.8 - 1.5", recyclable: "1.5 - 3.2" }
};

const API_BASE = getApiUrl();
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// --- Bin Icon Component ---
const BinIcon = ({ tier, isActive }) => {
  const levels = { Low: 6, Medium: 12, High: 18 };
  const fillHeight = levels[tier] || 0;
  const color = isActive ? COLORS.white : COLORS.primary;
  const binPath = "M7 4 L17 4 L16 22 C16 23 15 23.5 14 23.5 L10 23.5 C9 23.5 8 23 8 22 L7 4 Z";

  return (
    <View style={{ marginBottom: 8 }}>
      <Svg width="40" height="45" viewBox="0 0 24 24" fill="none">
        <Defs>
          <ClipPath id={`clip-${tier}`}>
            <Path d={binPath} />
          </ClipPath>
        </Defs>
        <Path d={binPath} fill={isActive ? 'rgba(255,255,255,0.2)' : '#E0EAE5'} />
        <G clipPath={`url(#clip-${tier})`}>
          <Rect x="0" y={24 - fillHeight} width="24" height={fillHeight} fill={color} opacity={isActive ? 1 : 0.7} />
        </G>
        <Path d={binPath} stroke={isActive ? COLORS.white : COLORS.textDark} strokeWidth="1.2" />
      </Svg>
    </View>
  );
};

const getCurrentDateInfo = () => {
  const today = new Date();
  const year = today.getFullYear();
  const oneJan = new Date(today.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((today.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const currentWeek = Math.ceil((today.getDay() + 1 + numberOfDays) / 7);
  return { year, currentWeek };
};

export default function CreateHouseholdScreen({ navigation, route }: CreateHouseholdScreenProps) {
  const { email } = route.params || { email: "unknown@email.com" };

  const [householdId, setHouseholdId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [wasteTier, setWasteTier] = useState('');
  const [incomeTier, setIncomeTier] = useState('');
  const [idLoading, setIdLoading] = useState(false);
  const qrCodeRef = useRef<{ toDataURL: (callback: (data: string) => void) => void } | null>(null);

  const [wasteData, setWasteData] = useState<WasteData>({ Organic: [], Inorganic: [], Recyclable: [] });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof WasteData>("Organic");
  const [loading, setLoading] = useState(false);

  const filteredLocations = REGIONAL_LOCATIONS.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.district.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchNextId = async () => {
      if (!selectedLocation) return;
      setIdLoading(true);
      try {
        const response = await api.get(`/get_next_id`, { params: { location: selectedLocation } });
        setHouseholdId(response.data.next_id);
      } catch (error) {
        setHouseholdId("Error");
      } finally { setIdLoading(false); }
    };
    fetchNextId();
  }, [selectedLocation]);


//   const generateWeights = (tier) => {
//     const { year, currentWeek } = getCurrentDateInfo();
//     const newData = { Organic: [], Inorganic: [], Recyclable: [] };
//     const multipliers = { Low: 0.8, Medium: 1.0, High: 1.5 };

  const generateWeights = (tier: WasteTier) => {
    if (!tier) return;
    const { year, currentWeek } = getCurrentDateInfo();
    const newData: WasteData = { Organic: [], Inorganic: [], Recyclable: [] };
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

  const handleWasteTierSelect = (tier: WasteTier) => {
    setWasteTier(tier);
    setIncomeTier(tier);
    generateWeights(tier);
  };

  const updateWeight = (type: keyof WasteData, index: number, text: string) => {
    const updatedList = [...wasteData[type]];
    updatedList[index].weight_kg = text === '' ? 0 : parseFloat(text) || 0;
    setWasteData((prev) => ({ ...prev, [type]: updatedList }));
  };

  const handleSubmit = async () => {
    if (!wasteTier || !selectedLocation) {
      Alert.alert("Selection Required", "Please select location and waste tier.");
      return;
    }
    setLoading(true);
    try {
      let qrBase64String = "";
      if (qrCodeRef.current) {
        qrCodeRef.current.toDataURL((data) => { qrBase64String = data; });
        await new Promise(r => setTimeout(r, 250));
      }
      const finalWasteData = JSON.parse(JSON.stringify(wasteData));
      WASTE_TYPES.forEach((t: keyof WasteData) => {
        finalWasteData[t] = finalWasteData[t].map((item: WasteDataPoint) => ({
          ...item,
          weight_kg: Number(item.weight_kg) || 0
        }));
      });
      const payload = { email, household_id: householdId, income_tier: incomeTier, waste_data: finalWasteData, qr_code: qrBase64String || "placeholder" };
      const response = await api.post('/create_user', payload);
      if (response.status === 200) {
        Alert.alert("Success", "Household Created!", [{ text: "Go to Dashboard", onPress: () => navigation.replace('Tax', { email }) }]);
      }
    } catch (error) {
      Alert.alert("Error", "Submission failed.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <View style={styles.headerSection}>
            <Text style={styles.welcomeLabel}>Configuration</Text>
            <Text style={styles.header}>Household Setup</Text>
          </View>

          {/* Location & ID Card */}
          <View style={styles.card}>
            <Text style={styles.label}>1. Resident Location</Text>
            <TouchableOpacity style={styles.selectBox} onPress={() => setShowLocationModal(true)}>
              <Text style={selectedLocation ? styles.inputText : styles.placeholder}>{selectedLocation || "Select your area..."}</Text>
              <Text style={styles.selectArrow}>▼</Text>
            </TouchableOpacity>

            <View style={styles.idRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Assigned ID</Text>
                <View style={styles.idBox}>
                  {idLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.idValue}>{householdId || "---"}</Text>}
                </View>
              </View>
              {householdId && householdId !== "Error" && (
                <View style={styles.qrWrapper}>
                  <QRCode value={householdId} size={60} getRef={(c) => (qrCodeRef.current = c)} />
                </View>
              )}
            </View>
          </View>

          {/* Visual Tier Selection Card */}
          <View style={styles.card}>
            <Text style={styles.label}>2. Weekly Bin Level</Text>
            <Text style={styles.subLabel}>How full is your bin on collection day?</Text>

            <View style={styles.tierGrid}>
              {WASTE_TIERS.map(tier => (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierCard, wasteTier === tier && styles.tierCardActive]}
                  onPress={() => handleWasteTierSelect(tier)}
                >
                  <BinIcon tier={tier} isActive={wasteTier === tier} />
                  <Text style={[styles.tierTitle, wasteTier === tier && styles.whiteText]}>{tier}</Text>
                  <Text style={[styles.tierSub, wasteTier === tier && styles.whiteText]}>~{TIER_REFERENCES[tier].level} Full</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reference Table / Legend */}
            <View style={styles.legendBox}>
              <Text style={styles.legendTitle}>Estimated Weight Ranges (kg/week):</Text>
              <View style={styles.legendHeader}>
                <Text style={[styles.legendCol, {flex: 1.2}]}>Tier</Text>
                <Text style={styles.legendCol}>Organic</Text>
                <Text style={styles.legendCol}>Inorg.</Text>
                <Text style={styles.legendCol}>Recyc.</Text>
              </View>
              {Object.keys(TIER_REFERENCES).map(t => (
                <View key={t} style={[styles.legendRow, wasteTier === t && styles.legendRowHighlight]}>
                  <Text style={[styles.legendVal, {flex: 1.2, fontWeight: '700'}]}>{t}</Text>
                  <Text style={styles.legendVal}>{TIER_REFERENCES[t].organic}</Text>
                  <Text style={styles.legendVal}>{TIER_REFERENCES[t].inorganic}</Text>
                  <Text style={styles.legendVal}>{TIER_REFERENCES[t].recyclable}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* History Adjustments */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.accordionHeader} onPress={() => setShowAdvanced(!showAdvanced)}>
              <Text style={styles.accordionTitle}>Review Historical Data</Text>
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
                {wasteTier ? wasteData[activeTab].map((item, index) => (
                  <View key={index} style={styles.rowInput}>
                    <Text style={styles.rowLabel}>Week {item.week}:</Text>
                    <View style={styles.weightInputWrapper}>
                      <TextInput style={styles.weightInput} keyboardType="numeric" value={String(item.weight_kg)} onChangeText={(text) => updateWeight(activeTab, index, text)} />
                      <Text style={styles.unit}>kg</Text>
                    </View>
                  </View>
                )) : <Text style={styles.infoText}>Please select a level above first.</Text>}
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Confirm & Finish</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Modal */}
      <Modal visible={showLocationModal} animationType="fade">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Service Area</Text>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.searchBar} placeholder="Search area or district..." value={searchQuery} onChangeText={setSearchQuery} />
          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.locationItem} onPress={() => { setSelectedLocation(item.label); setShowLocationModal(false); }}>
                <Text style={styles.locationText}>{item.label}</Text>
                <View style={styles.districtBadge}><Text style={styles.districtBadgeText}>{item.district}</Text></View>
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
  scrollContent: { padding: 20 },
  headerSection: { marginBottom: 20 },
  welcomeLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: '700', textTransform: 'uppercase' },
  header: { fontSize: 26, fontWeight: 'bold', color: COLORS.textDark },
  card: { backgroundColor: COLORS.white, borderRadius: 18, padding: 18, marginBottom: 15, elevation: 3 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 10 },
  subLabel: { fontSize: 13, color: COLORS.textLight, marginTop: -5, marginBottom: 15 },
  selectBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, padding: 15, marginBottom: 15 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  idBox: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, minWidth: 120 },
  idValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  qrWrapper: { backgroundColor: COLORS.white, padding: 5, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  tierGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tierCard: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border },
  tierCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tierTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textDark },
  tierSub: { fontSize: 11, color: COLORS.textLight },
  whiteText: { color: COLORS.white },
  legendBox: { backgroundColor: '#F8FAFA', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  legendTitle: { fontSize: 11, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 8, textTransform: 'uppercase' },
  legendHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4, marginBottom: 4 },
  legendRow: { flexDirection: 'row', paddingVertical: 4, borderRadius: 4 },
  legendRowHighlight: { backgroundColor: 'rgba(45, 106, 79, 0.1)' },
  legendCol: { flex: 1, fontSize: 10, fontWeight: 'bold', color: COLORS.textLight },
  legendVal: { flex: 1, fontSize: 10, color: COLORS.textDark },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  tabContainer: { flexDirection: 'row', marginBottom: 15 },
  tab: { flex: 1, paddingBottom: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textLight, fontWeight: '700', fontSize: 11 },
  tabTextActive: { color: COLORS.primary },
  rowInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { fontSize: 13, color: COLORS.textDark },
  weightInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 8 },
  weightInput: { paddingVertical: 5, fontSize: 13, fontWeight: 'bold', color: COLORS.primary, width: 50, textAlign: 'right' },
  unit: { fontSize: 10, color: COLORS.textLight, marginLeft: 2 },
  submitBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 15, alignItems: 'center' },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  searchBar: { margin: 15, padding: 12, backgroundColor: COLORS.background, borderRadius: 10 },
  locationItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: COLORS.background, flexDirection: 'row', justifyContent: 'space-between' },
  districtBadge: { backgroundColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  districtBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.primary }
});