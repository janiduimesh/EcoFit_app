import { getApiUrl } from '../utils/config';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SectionList,
  SafeAreaView,
  Keyboard,
  RefreshControl,
  ScrollView
} from 'react-native';
import axios from 'axios';

const API_BASE = getApiUrl();
const WASTE_TYPES = ["Organic", "Inorganic", "Recyclable"];


const getMonthName = (year, week) => {
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  return date.toLocaleString('default', { month: 'short', year: '2-digit' });
};


const DashboardHeader = ({
  householdId, setHouseholdId, loadPageData,
  activeTab, setActiveTab,
  inputs, handleInputChange,
  loadingSim, handleSimulate,
  loadingSubmit, handleSubmitForReview,
  dashboardData,
  overallStats // <--- New Prop for Monthly Totals
}) => {

  // Formatters
  const formatMoney = (val) => val ? `Rs.${parseFloat(val).toFixed(2)}` : 'Rs.0.00';
  const formatWeight = (val) => val ? `${parseFloat(val).toFixed(2)} kg` : '0.00 kg';
  const getStatusStyle = (status) => {
    if (status === 'REWARD') return { color: '#2e7d32', bg: '#e8f5e9', label: 'Reward 🌿' };
    if (status === 'PENALTY') return { color: '#c62828', bg: '#ffebee', label: 'Penalty ⚠️' };
    return { color: '#ef6c00', bg: '#fff3e0', label: status };
  };

  return (
    <View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Total Monthly Spending (All Waste)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
          {overallStats.length === 0 ? (
            <Text style={{color:'#999', fontStyle:'italic'}}>Loading totals...</Text>
          ) : (
            overallStats.map((item, index) => (
              <View key={index} style={styles.summaryBadge}>
                <Text style={styles.summaryMonth}>{item.month}</Text>
                <Text style={styles.summaryBill}>{formatMoney(item.totalBill)}</Text>
                <Text style={styles.summaryWeight}>{formatWeight(item.totalWeight)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* --- ID & TITLE --- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Waste Dashboard</Text>
        <View style={styles.idBox}>
          <Text style={styles.idLabel}>ID:</Text>
          <TextInput
            style={styles.idInput}
            value={householdId}
            onChangeText={setHouseholdId}
            onEndEditing={loadPageData}
          />
        </View>
      </View>

      {/* --- TABS --- */}
      <View style={styles.tabRow}>
          {WASTE_TYPES.map(type => (
              <TouchableOpacity key={type} style={[styles.tab, activeTab === type && styles.activeTab]} onPress={() => setActiveTab(type)}>
                  <Text style={[styles.tabText, activeTab === type && styles.activeTabText]}>{type}</Text>
              </TouchableOpacity>
          ))}
      </View>

      {/* --- INPUT CARD --- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{activeTab} Entry</Text>
        <TextInput
            style={styles.mainInput}
            value={inputs[activeTab] || ''} // Ensure it's never undefined
            onChangeText={(text) => handleInputChange(text)}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#ccc"
        />
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, {backgroundColor:'#1976d2'}]} onPress={handleSimulate} disabled={loadingSim}>
              {loadingSim ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Simulate</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, {backgroundColor:'#388e3c'}]} onPress={handleSubmitForReview} disabled={loadingSubmit}>
              {loadingSubmit ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Submit</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* --- SIMULATION RESULT --- */}
      {dashboardData && (
        <View style={styles.simCard}>
          <Text style={styles.simTitle}>Simulation Result</Text>
          <View style={styles.simRow}>
              <View style={styles.simCol}>
                  <Text style={styles.simLabel}>Week {dashboardData.current_week_number}</Text>
                  <Text style={styles.simValue}>{formatMoney(dashboardData.current_bill.final_bill)}</Text>
                  <Text style={[styles.simSub, {color: getStatusStyle(dashboardData.current_bill.status).color}]}>
                      {dashboardData.current_bill.status}
                  </Text>
              </View>
              <View style={styles.vertLine} />
              <View style={styles.simCol}>
                  <Text style={styles.simLabel}>Week {dashboardData.next_week_number} (Est)</Text>
                  <Text style={styles.simValue}>{formatMoney(dashboardData.predicted_bill.final_bill)}</Text>
                  <Text style={styles.simSub}>{formatWeight(dashboardData.predicted_bill.weight_kg)}</Text>
              </View>
          </View>
        </View>
      )}

      <Text style={styles.mainSectionHeader}>Payment History ({activeTab})</Text>
    </View>
  );
};

const WasteDashboard = () => {
  const [householdId, setHouseholdId] = useState('HH-Moratuwa-01');
  const [activeTab, setActiveTab] = useState('Organic');
  const [inputs, setInputs] = useState({ Organic: '', Inorganic: '', Recyclable: '' });
  const [dashboardData, setDashboardData] = useState(null);

  // Data State
  const [historyList, setHistoryList] = useState([]);
  const [pendingList, setPendingList] = useState([]);

  // New State for Overall Summary
  const [overallStats, setOverallStats] = useState([]);

  const [loadingSim, setLoadingSim] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // --- Initial Load ---
  useEffect(() => { loadPageData(); }, [householdId]);

  useEffect(() => {
    fetchListsOnly();
  }, [activeTab]);

  const loadPageData = async () => {
    setRefreshing(true);
    try { await axios.post(`${API_BASE}/sync_missing_weeks/${householdId}`); } catch (e) {}

    // Fetch Everything
    await Promise.all([
      fetchSmartDefaults(),
      fetchListsOnly(),
      fetchOverallStats()
    ]);

    setRefreshing(false);
  };

  const fetchListsOnly = async () => {
    await Promise.all([fetchHistory(), fetchPending()]);
  };

  // --- NEW: FETCH ALL DATA FOR SUMMARY ---
  const fetchOverallStats = async () => {
    try {
      // Parallel fetch for all 3 types
      const requests = WASTE_TYPES.map(type =>
        axios.get(`${API_BASE}/history_statement/${householdId}/${type}`).catch(() => ({ data: { history: [] } }))
      );

      const responses = await Promise.all(requests);

      // Combine all rows
      let allRows = [];
      responses.forEach(res => {
        if(res.data && res.data.history) {
          allRows = [...allRows, ...res.data.history];
        }
      });

      // Group by Month
      const groups = {};
      allRows.forEach(item => {
        const key = getMonthName(item.year, item.week);
        if (!groups[key]) {
          groups[key] = { month: key, totalBill: 0, totalWeight: 0, sortKey: `${item.year}-${item.week}` };
        }
        groups[key].totalBill += (item.final_bill || 0);
        groups[key].totalWeight += (item.weight_kg || 0);
      });


      const sortedStats = Object.values(groups).sort((a, b) => {
         return b.sortKey.localeCompare(a.sortKey);
      });

      setOverallStats(sortedStats);

    } catch (error) {
      console.log("Error fetching overall stats", error);
    }
  };

  const fetchSmartDefaults = async () => {
    try {
      const res = await axios.get(`${API_BASE}/predict_next_week/${householdId}`);
      const data = res.data.waste_data;
      setInputs(prev => ({
        Organic: data.Organic?.predicted_next_week_kg?.toFixed(2) || prev.Organic,
        Inorganic: data.Inorganic?.predicted_next_week_kg?.toFixed(2) || prev.Inorganic,
        Recyclable: data.Recyclable?.predicted_next_week_kg?.toFixed(2) || prev.Recyclable
      }));
    } catch (error) { }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history_statement/${householdId}/${activeTab}`);
      const sortedHistory = res.data.history.sort((a, b) => {
         if (a.year !== b.year) return b.year - a.year;
         return b.week - a.week;
      });
      setHistoryList(sortedHistory);
    } catch (error) { setHistoryList([]); }
  };

  const fetchPending = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my_submissions/${householdId}/${activeTab}`);
      setPendingList(res.data);
    } catch (error) { setPendingList([]); }
  };

  // --- Handlers ---
  const handleInputChange = useCallback((text) => {
    setInputs(prev => ({...prev, [activeTab]: text}));
  }, [activeTab]);

  const handleSimulate = async () => {
    if (!inputs[activeTab]) { Alert.alert('Missing Input'); return; }
    setLoadingSim(true);
    Keyboard.dismiss();
    try {
      const res = await axios.post(`${API_BASE}/process_weekly_waste`, {
        household_id: householdId,
        waste_type: activeTab,
        current_weight_kg: parseFloat(inputs[activeTab])
      });
      setDashboardData(res.data);
    } catch (error) { Alert.alert('Error', 'Simulation failed.'); }
    finally { setLoadingSim(false); }
  };

  const handleSubmitForReview = async () => {
    if (!inputs[activeTab]) { Alert.alert('Missing Input'); return; }
    setLoadingSubmit(true);
    Keyboard.dismiss();
    try {
      const res = await axios.post(`${API_BASE}/submit_weight_for_review`, {
        household_id: householdId,
        waste_type: activeTab,
        weight_kg: parseFloat(inputs[activeTab])
      });
      if (res.status === 200) {
        Alert.alert('Success', res.data.message);
        setInputs(prev => ({...prev, [activeTab]: ''}));
        setDashboardData(null);
        fetchListsOnly();
        fetchOverallStats(); // Refresh totals too
      }
    } catch (error) { Alert.alert('Error', 'Failed to submit.'); }
    finally { setLoadingSubmit(false); }
  };

  // --- Formatters for List Items ---
  const formatMoney = (val) => val ? `Rs.${parseFloat(val).toFixed(2)}` : 'Rs.0.00';
  const formatWeight = (val) => val ? `${parseFloat(val).toFixed(2)} kg` : '0.00 kg';
  const getStatusStyle = (status) => {
    if (status === 'REWARD') return { color: '#2e7d32', bg: '#e8f5e9', label: 'Reward 🌿' };
    if (status === 'PENALTY') return { color: '#c62828', bg: '#ffebee', label: 'Penalty ⚠️' };
    if (status === 'REVIEW') return { color: '#1565c0', bg: '#e3f2fd', label: 'Review ⏳' };
    return { color: '#ef6c00', bg: '#fff3e0', label: status };
  };

  // --- Section Logic ---
  const sectionedData = useMemo(() => {
    const getMonthNameLong = (year, week) => {
      const date = new Date(year, 0, 1 + (week - 1) * 7);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const sections = [];

    // Pending
    if (pendingList.length > 0) {
      sections.push({
        title: "Pending Review",
        data: pendingList.map(item => ({...item, isPending: true})),
        totalBill: 0,
        totalWeight: pendingList.reduce((acc, curr) => acc + curr.weight_kg, 0),
        isPending: true
      });
    }

    // History
    const groups = {};
    historyList.forEach(item => {
      const key = getMonthNameLong(item.year, item.week);
      if (!groups[key]) {
        groups[key] = { title: key, data: [], totalBill: 0, totalWeight: 0 };
      }
      groups[key].data.push(item);
      groups[key].totalBill += (item.final_bill || 0);
      groups[key].totalWeight += (item.weight_kg || 0);
    });

    Object.keys(groups).forEach(key => sections.push(groups[key]));
    return sections;
  }, [historyList, pendingList]);


  // --- Renders ---
  const renderSectionHeader = ({ section: { title, totalBill, totalWeight, isPending } }) => (
    <View style={[styles.sectionHeader, isPending ? styles.pendingHeader : null]}>
      <Text style={[styles.sectionTitle, isPending ? styles.pendingTitle : null]}>{title}</Text>
      {!isPending && (
          <View style={styles.sectionTotals}>
            <View style={styles.totalBadge}>
                <Text style={styles.totalLabel}>Total Bill</Text>
                <Text style={styles.totalValue}>{formatMoney(totalBill)}</Text>
            </View>
            <View style={styles.totalBadge}>
                <Text style={styles.totalLabel}>Total Wgt</Text>
                <Text style={styles.totalValue}>{formatWeight(totalWeight)}</Text>
            </View>
          </View>
      )}
    </View>
  );

  const renderHistoryItem = ({ item }) => {
    const isPending = item.isPending;
    const style = getStatusStyle(item.status);
    return (
      <View style={[styles.historyItem, isPending && styles.pendingBorder]}>
        <View style={styles.weekBox}>
           <Text style={styles.weekNum}>{item.week ? `W${item.week}` : '...'}</Text>
           <Text style={styles.yearNum}>{item.year}</Text>
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.weightText}>{formatWeight(item.weight_kg)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
             <Text style={[styles.statusText, { color: style.color }]}>{style.label}</Text>
          </View>
        </View>
        <View style={styles.rightBox}>
           {isPending ? (
             <Text style={styles.pendingHint}>Pending</Text>
           ) : (
             <View>
                <Text style={styles.priceText}>{formatMoney(item.final_bill)}</Text>
                {item.penalty_amount > 1 && <Text style={styles.penaltySmall}>+ {formatMoney(item.penalty_amount)} Pen</Text>}
                {item.discount_amount > 0 && <Text style={styles.discountSmall}>- {formatMoney(item.discount_amount)} Disc</Text>}
             </View>
           )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sectionedData}
        keyExtractor={(item) => item.submission_id || `${item.year}-${item.week}`}
        renderItem={renderHistoryItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={
          // Passing Component directly to prevent re-mount on input change
          <DashboardHeader
            householdId={householdId}
            setHouseholdId={setHouseholdId}
            loadPageData={loadPageData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            inputs={inputs}
            handleInputChange={handleInputChange}
            loadingSim={loadingSim}
            handleSimulate={handleSimulate}
            loadingSubmit={loadingSubmit}
            handleSubmitForReview={handleSubmitForReview}
            dashboardData={dashboardData}
            overallStats={overallStats}
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPageData} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  listContent: { padding: 20, paddingBottom: 50 },

  // --- NEW STYLES FOR SUMMARY ---
  summaryContainer: { marginBottom: 20 },
  summaryTitle: { fontSize: 14, fontWeight: 'bold', color: '#627d98', marginBottom: 10, textTransform:'uppercase' },
  summaryScroll: { paddingRight: 20 },
  summaryBadge: {
    backgroundColor: '#102a43',
    padding: 15,
    borderRadius: 12,
    marginRight: 10,
    width: 120,
    alignItems: 'center'
  },
  summaryMonth: { color: '#829ab1', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  summaryBill: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  summaryWeight: { color: '#bcccdc', fontSize: 12 },

  // --- EXISTING STYLES ---
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#102a43' },
  idBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, borderRadius: 20, height: 40 },
  idLabel: { fontSize: 12, fontWeight: 'bold', color: '#627d98', marginRight: 5 },
  idInput: { fontSize: 14, fontWeight: 'bold', color: '#102a43', width: 100 },

  tabRow: { flexDirection: 'row', backgroundColor: '#d9e2ec', borderRadius: 10, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontWeight: '600', color: '#627d98' },
  activeTabText: { color: '#102a43', fontWeight: 'bold' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 3, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#334e68', marginBottom: 15 },
  mainInput: { fontSize: 32, fontWeight: 'bold', color: '#102a43', textAlign: 'center', borderBottomWidth: 2, borderColor: '#f0f4f8', paddingBottom: 10, marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 15 },
  btn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  simCard: { backgroundColor: '#102a43', borderRadius: 16, padding: 20, marginBottom: 25 },
  simTitle: { color: '#829ab1', fontWeight: 'bold', marginBottom: 15, textAlign: 'center', fontSize: 12, textTransform: 'uppercase' },
  simRow: { flexDirection: 'row', justifyContent: 'space-around' },
  simCol: { alignItems: 'center' },
  simLabel: { color: '#bcccdc', fontSize: 12, marginBottom: 5 },
  simValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  simSub: { color: '#f0f4f8', fontSize: 12, fontWeight: '600', marginTop: 2 },
  vertLine: { width: 1, backgroundColor: '#334e68' },

  mainSectionHeader: { fontSize: 20, fontWeight: 'bold', color: '#102a43', marginBottom: 15 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#dfe6ed',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 15,
    marginBottom: 10
  },
  pendingHeader: { backgroundColor: '#e3f2fd' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#334e68' },
  pendingTitle: { color: '#1565c0' },

  sectionTotals: { flexDirection: 'row', gap: 15 },
  totalBadge: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 9, color: '#627d98', textTransform: 'uppercase', fontWeight: 'bold' },
  totalValue: { fontSize: 13, fontWeight: 'bold', color: '#102a43' },

  historyItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 8, alignItems: 'center', elevation: 1 },
  pendingBorder: { borderLeftWidth: 4, borderLeftColor: '#2196f3' },
  weekBox: { alignItems: 'center', width: 45, borderRightWidth: 1, borderColor: '#f0f4f8', marginRight: 15 },
  weekNum: { fontSize: 14, fontWeight: 'bold', color: '#334e68' },
  yearNum: { fontSize: 10, color: '#829ab1' },

  centerBox: { flex: 1 },
  weightText: { fontSize: 16, fontWeight: 'bold', color: '#102a43' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: 'bold' },

  rightBox: { alignItems: 'flex-end' },
  priceText: { fontSize: 16, fontWeight: 'bold', color: '#102a43' },
  pendingHint: { fontSize: 12, color: '#2196f3', fontStyle: 'italic' },
  penaltySmall: { fontSize: 10, color: '#c62828', marginTop: 2 },
  discountSmall: { fontSize: 10, color: '#2e7d32', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 }
});

export default WasteDashboard;