import { getApiUrl } from '../utils/config';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  RefreshControl,
  Modal,
  Button
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';


const API_BASE = getApiUrl();


const ReviewItem = ({ item, onActionComplete }) => {
  const [weight, setWeight] = useState(item.weight_kg.toString());
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionType) => {
    setLoading(true);
    try {
      const currentWeight = parseFloat(weight);

      if (actionType === 'VERIFY' && currentWeight !== item.weight_kg) {
        await axios.post(`${API_BASE}/submit_weight_for_review`, {
          household_id: item.household_id,
          waste_type: item.waste_type,
          weight_kg: currentWeight
        });
      }

      const response = await axios.post(`${API_BASE}/process_review_action`, {
        submission_id: item.submission_id,
        action: actionType
      });

      if (response.status === 200) {
        Alert.alert('Success', `Item ${actionType === 'VERIFY' ? 'Verified' : 'Denied'}`);
        onActionComplete(); // Refresh list
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.reviewCard}>
      <View style={styles.cardHeader}>
        <View>
            <Text style={styles.householdId}>{item.household_id}</Text>
            <Text style={styles.wasteType}>{item.waste_type}</Text>
        </View>
        <View style={styles.weekBadge}>
           <Text style={styles.weekText}>W{item.week}</Text>
        </View>
      </View>

      <Text style={styles.metaText}>Submitted: {new Date(item.submitted_at).toLocaleDateString()}</Text>

      <View style={styles.editContainer}>
        <Text style={styles.label}>Weight (kg):</Text>
        <TextInput
          style={styles.weightInput}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnDeny]}
          onPress={() => handleAction('DENY')}
          disabled={loading}
        >
           <Text style={styles.btnText}>Deny</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnVerify]}
          onPress={() => handleAction('VERIFY')}
          disabled={loading}
        >
           {loading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.btnText}>Approve</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};


const AdminReviewPortal = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search / Scan State
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Camera State
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  // Load ALL data on mount
  useEffect(() => {
    fetchItems();
  }, []);

  // --- API: Fetch Data ---
  const fetchItems = async (specificId = null) => {
    setLoading(true);
    setRefreshing(true);
    try {
      let endpoint = `${API_BASE}/all_pending_reviews`;

      // If we are searching for a specific user
      if (specificId) {
        endpoint = `${API_BASE}/pending_reviews/${specificId}`;
        setIsSearching(true);
        setSearchText(specificId); // Fill the search bar
      } else {
        setIsSearching(false);
        setSearchText('');
      }

      const response = await axios.get(endpoint);
      setItems(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not fetch records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const handleSearch = () => {
    if (!searchText.trim()) {
      fetchItems();
    } else {
      fetchItems(searchText.trim());
    }
  };


  const handleBarcodeScanned = ({ type, data }) => {
    setIsScanning(false);

    Alert.alert("QR Scanned", `Found: ${data}`);
    fetchItems(data);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission Error", "Camera permission is required to scan.");
        return;
      }
    }
    setIsScanning(true);
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* 1. TOP BAR: Search & Scan */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter Household ID..."
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity style={styles.iconBtn} onPress={handleSearch}>
          <Text style={styles.iconText}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={openScanner}>
          <Text style={styles.iconText}>📸</Text>
        </TouchableOpacity>
      </View>

      {/* 2. MODE INDICATOR */}
      {isSearching && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterText}>Filtering for: {searchText}</Text>
          <TouchableOpacity onPress={() => fetchItems()}>
            <Text style={styles.clearText}>Clear Filter ✖</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. CONTENT AREA */}
      <View style={styles.content}>
        <Text style={styles.headerTitle}>
          {isSearching ? "User Verification" : "Global Admin Portal"}
        </Text>
        <Text style={styles.subTitle}>
          Pending Items: {items.length}
        </Text>

        <FlatList
          data={items}
          keyExtractor={(item) => item.submission_id}
          renderItem={({ item }) => (

            <ReviewItem
              item={item}
              onActionComplete={() => fetchItems(isSearching ? searchText : null)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
             <RefreshControl
               refreshing={refreshing}
               onRefresh={() => fetchItems(isSearching ? searchText : null)}
               tintColor="#fff"
             />
          }
          ListEmptyComponent={
            !loading && <Text style={styles.emptyText}>No pending items found.</Text>
          }
        />
      </View>

      {/* 4. CAMERA MODAL */}
      <Modal visible={isScanning} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },

  // Top Bar Styles
  topBar: { flexDirection: 'row', padding: 15, backgroundColor: '#16213e', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, height: 40, marginRight: 10 },
  iconBtn: { backgroundColor: '#0f3460', padding: 10, borderRadius: 8, marginLeft: 5 },
  iconText: { fontSize: 18 },

  // Filter Banner
  filterBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#e94560', padding: 10 },
  filterText: { color: '#fff', fontWeight: 'bold' },
  clearText: { color: '#fff', textDecorationLine: 'underline' },

  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 10, textAlign: 'center' },
  subTitle: { fontSize: 14, color: '#a0a0c0', textAlign: 'center', marginBottom: 20 },

  // Card Styles (Same as before)
  reviewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderLeftWidth: 5, borderLeftColor: '#fca311' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  householdId: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  wasteType: { fontSize: 14, color: '#666', fontWeight:'600' },
  weekBadge: { backgroundColor: '#e0f7fa', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  weekText: { color: '#006064', fontWeight: 'bold', fontSize: 14 },
  metaText: { color: '#888', fontSize: 12, marginBottom: 15 },
  editContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8 },
  label: { fontSize: 16, fontWeight: '600', marginRight: 10, color: '#444' },
  weightInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 5, fontSize: 18, fontWeight: 'bold', textAlign: 'center', color:'#000' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
  btnDeny: { backgroundColor: '#d00000' },
  btnVerify: { backgroundColor: '#2b9348' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 100, fontSize: 16 },

  // Camera Styles
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50, backgroundColor: 'rgba(0,0,0,0.3)' },
  cameraText: { color: '#fff', fontSize: 20, marginBottom: 20, fontWeight: 'bold' },
  closeCameraBtn: { backgroundColor: '#d00000', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30 },
  closeCameraText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default AdminReviewPortal;