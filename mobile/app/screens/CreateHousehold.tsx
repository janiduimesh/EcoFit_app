import { getApiUrl } from '../utils/config';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, Modal, FlatList, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';

import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';

const LOCATIONS = ["Dehiwela", "Moratuwa", "Homagama", "Boralesgamuwa"];
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

export default function CreateHouseholdScreen({ navigation, route }: any) {

  const { email } = route.params || { email: "unknown@email.com" };

  const [householdId, setHouseholdId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const [wasteTier, setWasteTier] = useState('');
  const [incomeTier, setIncomeTier] = useState('Medium');

  const [idLoading, setIdLoading] = useState(false);
  const qrCodeRef = useRef(null);

  const [wasteData, setWasteData] = useState<any>({
    Organic: [],
    Inorganic: [],
    Recyclable: []
  });

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState("Organic");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNextId = async () => {
      if (!selectedLocation) return;
      setIdLoading(true);
      setHouseholdId("Loading...");

      try {
        const response = await api.get(`/get_next_id`, { params: { location: selectedLocation }});
        setHouseholdId(response.data.next_id);
      } catch (error) {
        console.error("ID Fetch Error:", error);
        setHouseholdId("Error");
        Alert.alert("Connection Error", "Could not fetch ID.");
      } finally {
        setIdLoading(false);
      }
    };

    fetchNextId();
  }, [selectedLocation]);


  const generateWeights = (tier: string) => {
    if (!tier) return;
    const { year, currentWeek } = getCurrentDateInfo();
    const newData: any = { Organic: [], Inorganic: [], Recyclable: [] };

    const multipliers: any = { Low: 0.8, Medium: 1.0, High: 1.5 };
    const mult = multipliers[tier];

    for (let i = 12; i > 0; i--) {
      const weekNum = currentWeek - i > 0 ? currentWeek - i : 52 + (currentWeek - i);
      const yearNum = currentWeek - i > 0 ? year : year - 1;

      const organicBase = (5 + Math.random() * 5) * mult;
      const inorganicBase = (1 + Math.random() * 2) * mult;
      const recyclableBase = (2 + Math.random() * 3) * mult;

      newData.Organic.push({ year: yearNum, week: weekNum, weight_kg: parseFloat(organicBase.toFixed(2)) });
      newData.Inorganic.push({ year: yearNum, week: weekNum, weight_kg: parseFloat(inorganicBase.toFixed(2)) });
      newData.Recyclable.push({ year: yearNum, week: weekNum, weight_kg: parseFloat(recyclableBase.toFixed(2)) });
    }
    setWasteData(newData);
  };

  const handleWasteTierSelect = (tier: string) => {
    setWasteTier(tier);
    // Logic: You can map Waste Tier to Income Tier if you want, or just keep Income static
    // For now, we keep Income as Medium automatically, but generate weights based on waste tier.
    generateWeights(tier);
  };

  const updateWeight = (type: string, index: number, text: string) => {
    const val = parseFloat(text);
    if (isNaN(val)) return;
    const updatedList = [...wasteData[type]];
    updatedList[index].weight_kg = val;
    setWasteData((prev: any) => ({ ...prev, [type]: updatedList }));
  };

  const handleSubmit = async () => {
    if (!householdId || householdId === "Loading..." || householdId === "Error") {
        Alert.alert("Error", "Please wait for a valid Household ID.");
        return;
    }
    if (!wasteTier) {
      Alert.alert("Error", "Please select a Waste Generation Level.");
      return;
    }

    setLoading(true);

    try {
      let qrBase64String = "";
      if (qrCodeRef.current) {
        // @ts-ignore
        qrCodeRef.current.toDataURL((data) => {
            qrBase64String = data;
        });
        await new Promise(r => setTimeout(r, 100));
      }

      const payload = {
        email: email,
        household_id: householdId,
        income_tier: incomeTier,
        waste_data: wasteData,
        qr_code: qrBase64String || "placeholder"
      };

      const response = await api.post('/create_user', payload);

      if (response.status === 200) {
        Alert.alert("Success", "Household Created!", [
        { text: "Go to Dashboard", onPress: () => navigation.replace('Dashboard', { email }) }
        ]);

      }
    } catch (error: any) {
      let errorMessage = "Submission failed.";
      if (error.response) {
        const detail = error.response.data.detail;
        if (typeof detail === 'object') {
            errorMessage = JSON.stringify(detail);
        } else {
            errorMessage = detail;
        }
      } else {
        errorMessage = error.message;
      }
      console.log("Submit Error:", errorMessage);
      Alert.alert("Server Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = LOCATIONS.filter(loc =>
    loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <Text style={styles.header}>New Household Entry</Text>
          <Text style={{marginBottom:15, color:'#555'}}>User: {email}</Text>

          {/* 1. LOCATION & ID SECTION */}
          <View style={styles.card}>
            <Text style={styles.label}>Location (Select to Generate ID)</Text>
            <TouchableOpacity
              style={styles.inputBox}
              onPress={() => setShowLocationModal(true)}
            >
              <Text style={selectedLocation ? styles.inputText : styles.placeholder}>
                {selectedLocation || "Select Area..."}
              </Text>
            </TouchableOpacity>

            <View style={styles.idSectionRow}>
                <View style={{flex: 1, marginRight: 10}}>
                    <Text style={styles.label}>Household ID</Text>
                    <View style={[styles.inputBox, styles.readOnly]}>
                        {idLoading ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                            <Text style={styles.inputText}>{householdId || "Waiting..."}</Text>
                        )}
                    </View>
                </View>

                {householdId && householdId !== "Loading..." && householdId !== "Error" ? (
                <View style={styles.qrContainer}>
                    <QRCode
                        value={householdId}
                        size={70}
                        getRef={(c) => (qrCodeRef.current = c)}
                    />
                    <Text style={styles.qrLabel}>Generated</Text>
                </View>
                ) : null}
            </View>
          </View>


          <View style={styles.card}>
            <Text style={styles.label}>Average Waste Generation Level</Text>
            <Text style={styles.subLabel}>(Auto-fills historical data based on selection)</Text>
            <View style={styles.pillContainer}>
              {WASTE_TIERS.map(tier => (
                <TouchableOpacity
                  key={tier}
                  style={[styles.pill, wasteTier === tier && styles.pillActive]}
                  onPress={() => handleWasteTierSelect(tier)}
                >
                  <Text style={[styles.pillText, wasteTier === tier && styles.pillTextActive]}>
                    {tier}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 3. ADVANCED EDIT SECTION */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.accordionTitle}>Advanced: Edit 12-Week History</Text>
              <Text style={styles.accordionIcon}>{showAdvanced ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedContent}>
                <View style={styles.tabContainer}>
                  {WASTE_TYPES.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.tab, activeTab === type && styles.tabActive]}
                      onPress={() => setActiveTab(type)}
                    >
                      <Text style={[styles.tabText, activeTab === type && styles.tabTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {wasteTier ? (
                  wasteData[activeTab].map((item: any, index: number) => (
                    <View key={index} style={styles.rowInput}>
                      <Text style={styles.rowLabel}>Week {item.week}:</Text>
                      <TextInput
                        style={styles.weightInput}
                        keyboardType="numeric"
                        value={String(item.weight_kg)}
                        onChangeText={(text) => updateWeight(activeTab, index, text)}
                      />
                      <Text style={styles.unit}>kg</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.infoText}>Select a Waste Level first to generate data.</Text>
                )}
              </View>
            )}
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Data & QR</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showLocationModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchBar}
            placeholder="Search city..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.locationItem}
                onPress={() => {
                  setSelectedLocation(item);
                  setShowLocationModal(false);
                  setSearchQuery('');
                }}
              >
                <Text style={styles.locationText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  scrollContent: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 5 },
  subLabel: { fontSize: 12, color: '#999', marginBottom: 10, fontStyle:'italic' },
  inputBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#fff' },
  readOnly: { backgroundColor: '#f9f9f9', borderColor: '#eee' },
  inputText: { fontSize: 16, color: '#333' },
  placeholder: { fontSize: 16, color: '#aaa' },
  idSectionRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  qrContainer: { alignItems: 'center', justifyContent: 'center', padding: 5, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  qrLabel: { fontSize: 10, color: '#888', marginTop: 4 },
  pillContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  pill: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginHorizontal: 4 },
  pillActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  pillText: { fontWeight: '600', color: '#555' },
  pillTextActive: { color: '#fff' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accordionTitle: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  accordionIcon: { fontSize: 14, color: '#007AFF' },
  advancedContent: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  infoText: { fontStyle: 'italic', color: '#888', textAlign: 'center', marginTop: 10 },
  tabContainer: { flexDirection: 'row', marginBottom: 15 },
  tab: { flex: 1, paddingBottom: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#007AFF' },
  rowInput: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rowLabel: { flex: 1, fontSize: 14, color: '#444' },
  weightInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 4, width: 80, padding: 5, textAlign: 'right', marginRight: 5 },
  unit: { fontSize: 12, color: '#888' },
  submitBtn: { backgroundColor: '#28a745', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { backgroundColor: '#94d3a2' },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  closeText: { color: 'red', fontSize: 16 },
  searchBar: { margin: 15, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8, fontSize: 16 },
  locationItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  locationText: { fontSize: 16 },
});