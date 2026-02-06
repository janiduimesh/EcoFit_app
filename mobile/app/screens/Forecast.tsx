import { getApiUrl } from '../utils/config';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  FlatList,
  SafeAreaView
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { CameraView, useCameraPermissions } from 'expo-camera';


const API_BASE = getApiUrl();
const SCREEN_WIDTH = Dimensions.get('window').width;
const WASTE_TYPES = ['Organic', 'Inorganic', 'Recyclable'];

const ForecastScreen = () => {
  // 1. State
  const [householdId, setHouseholdId] = useState('');
  const [wasteType, setWasteType] = useState('Inorganic');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);

  // Household Selection State
  const [householdList, setHouseholdList] = useState([]);
  const [filteredHouseholds, setFilteredHouseholds] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Camera State
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // 2. Initial Fetch (Households)
  useEffect(() => {
    fetchHouseholdList();
  }, []);

  const fetchHouseholdList = async () => {
    try {

      const response = await fetch(`${API_BASE}/households`);
      if (response.ok) {
        const data = await response.json();
        // Handle if data is array of strings or objects
        const ids = data.map(item => item._id || item.household_id || item);
        setHouseholdList(ids);
        setFilteredHouseholds(ids);
      }
    } catch (error) {
      console.log("Could not fetch household list", error);
    }
  };

  const handleSearch = (text) => {
    setSearchText(text);
    if (text) {
      const filtered = householdList.filter(id =>
        id.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredHouseholds(filtered);
    } else {
      setFilteredHouseholds(householdList);
    }
  };

  const selectHousehold = (id) => {
    setHouseholdId(id);
    setShowPicker(false);
    setSearchText('');
  };

  // 3. Camera Logic
  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission Error", "Camera permission is required.");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    setIsScanning(false);
    setHouseholdId(data);
    Alert.alert("Scanned", `ID set to: ${data}`);
  };

  // 4. Forecast Fetch Logic
  const fetchForecast = async () => {
    if (!householdId) {
      Alert.alert("Required", "Please select or scan a Household ID");
      return;
    }

    setLoading(true);
    setChartData(null);

    try {
      const response = await fetch(
        `${API_BASE}/forecast/${householdId}/${wasteType}?horizon=1`
      );
      const data = await response.json();

      if (response.ok) {
        processDataForCharts(data);
      } else {
        Alert.alert("Error", data.detail || "Failed to fetch forecast");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Network Error", "Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Data Processing
  const processDataForCharts = (apiResponse) => {
    const history = apiResponse.history_data || [];
    const forecast = apiResponse.forecast_data || [];

    if (!history.length && !forecast.length) {
      Alert.alert("Info", "No data found for this user.");
      return;
    }

    const historyLabels = history.map(item => `W${item.week}`);
    const forecastLabels = forecast.map(item => `W${item.week}`);

    // UPDATED: Show full history
    const allLabels = [...historyLabels, ...forecastLabels];

    const historyWeights = history.map(item => item.predicted_weight_kg || item.weight_kg);

    // Connector Point
    const lastHistoryWeight = historyWeights[historyWeights.length - 1] || 0;

    // UPDATED: Pad forecast with nulls for the duration of history (minus 1 for connection)
    // This ensures the red line only appears after history ends
    const forecastWeights = [
      ...Array(Math.max(0, historyWeights.length - 1)).fill(null),
      lastHistoryWeight,
      ...forecast.map(item => item.predicted_weight_kg)
    ];

    // UPDATED: Use full history
    const displayHistoryWeights = historyWeights;

    // Tax Data Logic (Same adjustments)
    const historyTax = history.map(item => item.estimated_bill?.final_bill || 0);
    const lastHistoryTax = historyTax[historyTax.length - 1] || 0;

    const forecastTax = [
      ...Array(Math.max(0, historyTax.length - 1)).fill(null),
      lastHistoryTax,
      ...forecast.map(item => item.estimated_bill?.final_bill || 0)
    ];
    const displayHistoryTax = historyTax;

    setChartData({
      labels: allLabels,
      weight: {
        datasets: [
          {
            data: displayHistoryWeights,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            strokeWidth: 2,
          },
          {
            data: forecastWeights,
            color: (opacity = 1) => `rgba(220, 53, 69, ${opacity})`,
            strokeWidth: 2,
            withDots: true,
          }
        ],
        legend: ["History", "Forecast"]
      },
      tax: {
        datasets: [
          {
            data: displayHistoryTax,
            color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
            strokeWidth: 2,
          },
          {
            data: forecastTax,
            color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
            strokeWidth: 2,
            withDots: true
          }
        ],
        legend: ["Bill", "Est. Bill"]
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <Text style={styles.headerTitle}>Waste Forecast Engine</Text>
        <Text style={styles.headerSubtitle}>Predict waste generation & taxes</Text>

        {/* Controls Card */}
        <View style={styles.card}>

          {/* HOUSEHOLD SELECTION AREA */}
          <Text style={styles.label}>Household ID</Text>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowPicker(true)}
            >
              <Text style={householdId ? styles.selectorText : styles.placeholderText}>
                {householdId || "Select Household..."}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
              <Text style={styles.scanBtnText}>📸</Text>
            </TouchableOpacity>
          </View>

          {/* WASTE TYPE SELECTION */}
          <Text style={styles.label}>Waste Type</Text>
          <View style={styles.btnRow}>
            {WASTE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, wasteType === type && styles.typeBtnActive]}
                onPress={() => setWasteType(type)}
              >
                <Text style={[styles.typeBtnText, wasteType === type && styles.typeBtnTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.runBtn}
            onPress={fetchForecast}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.runBtnText}>Run AI Forecast</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Charts Section */}
        {chartData ? (
          <View style={styles.resultsContainer}>

            {/* Weight Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartHeader}>Weight Trend (kg)</Text>
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={chartData.weight}
                  width={Math.max(SCREEN_WIDTH - 40, chartData.labels.length * 50)}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chartStyle}
                  withShadow={false}
                  fromZero
                />
              </ScrollView>
            </View>

            {/* Tax Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartHeader}>Projected Tax Bill (LKR)</Text>
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={chartData.tax}
                  width={Math.max(SCREEN_WIDTH - 40, chartData.labels.length * 50)}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chartStyle}
                  withShadow={false}
                  yAxisLabel="Rs "
                  fromZero
                />
              </ScrollView>
            </View>

          </View>
        ) : (
          !loading && (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>Select a household to view predictions.</Text>
            </View>
          )
        )}

      </ScrollView>

      {/* MODAL: HOUSEHOLD PICKER */}
      <Modal visible={showPicker} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Household</Text>

            <TextInput
              style={styles.searchInput}
              placeholder="Search ID..."
              value={searchText}
              onChangeText={handleSearch}
            />

            <FlatList
              data={filteredHouseholds}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => selectHousehold(item)}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
              ListEmptyComponent={<Text style={styles.emptyListText}>No IDs found.</Text>}
            />

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: CAMERA SCANNER */}
      <Modal visible={isScanning} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          >
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraText}>Scan User QR Code</Text>
              <TouchableOpacity
                style={styles.closeCameraBtn}
                onPress={() => setIsScanning(false)}
              >
                <Text style={styles.closeCameraText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// CHART CONFIG
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  scrollContent: { padding: 20, paddingBottom: 50 },

  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginTop: 10 },
  headerSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },

  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 20,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  label: { fontSize: 12, fontWeight: 'bold', color: '#555', textTransform: 'uppercase', marginBottom: 5 },

  // Selection Row
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  selectorBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12,
    backgroundColor: '#fafafa'
  },
  selectorText: { color: '#333', fontWeight: 'bold' },
  placeholderText: { color: '#999' },
  dropdownIcon: { color: '#666', fontSize: 12 },

  scanBtn: {
    backgroundColor: '#102a43', width: 50, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center'
  },
  scanBtnText: { fontSize: 20 },

  // Type Buttons
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  typeBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff',
  },
  typeBtnActive: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  typeBtnText: { color: '#555', fontSize: 12 },
  typeBtnTextActive: { color: 'white', fontWeight: 'bold' },

  runBtn: {
    backgroundColor: '#1565c0', padding: 14, borderRadius: 8, alignItems: 'center',
  },
  runBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  // Charts
  resultsContainer: { gap: 20 },
  chartCard: { backgroundColor: 'white', borderRadius: 12, padding: 10, elevation: 2 },
  chartHeader: { fontSize: 16, fontWeight: 'bold', color: '#333', marginLeft: 10, marginTop: 10 },
  chartStyle: { marginVertical: 8, borderRadius: 16 },

  placeholder: { alignItems: 'center', marginTop: 50 },
  placeholderText: { color: '#999', fontSize: 14 },

  // Modal Styles
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, maxHeight: 500 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  emptyListText: { textAlign: 'center', color: '#999', marginVertical: 20 },
  closeModalBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
  closeModalText: { color: '#d00000', fontWeight: 'bold' },

  // Camera Overlay
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50, backgroundColor: 'rgba(0,0,0,0.3)' },
  cameraText: { color: '#fff', fontSize: 20, marginBottom: 20, fontWeight: 'bold' },
  closeCameraBtn: { backgroundColor: '#d00000', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30 },
  closeCameraText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default ForecastScreen;