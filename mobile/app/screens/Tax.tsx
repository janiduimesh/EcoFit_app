import { getApiUrl } from '../utils/config';
import UserProfile from '../components/HouseHoldProfile';
import LeaderBoard from '../components/LeaderBoardScreen';
import Svg, { Path } from 'react-native-svg';
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
  ScrollView,
  Modal,
  StatusBar,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import axios from 'axios';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_BASE = getApiUrl();
const WASTE_TYPES = ["Organic", "Inorganic", "Recyclable"];

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  accent: '#74C69D',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  reward: '#2D6A4F',
  penalty: '#D90429',
  pending: '#FFB703',
  border: '#E0EAE5'
};

const getMonthName = (year, week) => {
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  return date.toLocaleString('default', { month: 'short', year: '2-digit' });
};

// --- SUB-COMPONENT: BottomNavBar ---
const BottomNavBar = ({ onLeaderboard, onProfile, onPayments }) => {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={onProfile}>
        <View style={styles.navIcon}>
          <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke={COLORS.textDark} strokeWidth={1.5}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
          </Svg>
        </View>
        <Text style={styles.navText}>Household</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={onLeaderboard}>
        <View style={styles.navIcon}>
          <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke={COLORS.textDark} strokeWidth={1.5}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
          </Svg>
        </View>
        <Text style={styles.navText}>Ranking</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={onPayments}>
        <View style={styles.navIcon}>
          <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke={COLORS.textDark} strokeWidth={1.5}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </Svg>
        </View>
        <Text style={styles.navText}>Payments</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- SUB-COMPONENT: DashboardHeader ---
const DashboardHeader = ({
  householdId, activeTab, setActiveTab,
  inputs, handleInputChange,
  loadingSim, handleSimulate,
  loadingSubmit, handleSubmitForReview,
  dashboardData, email, onToggleAll
}) => {
  const userName = email ? email.split('@')[0] : 'User';
  const formatMoney = (val) => `Rs.${parseFloat(val || 0).toFixed(2)}`;
  const formatWeight = (val) => `${parseFloat(val || 0).toFixed(2)} kg`;

  return (
    <View style={{ backgroundColor: COLORS.background }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.welcomeLabel}>ECOFIT USER</Text>
          <Text style={styles.welcomeText}>Hello, {userName}!</Text>
        </View>
        <View style={styles.headerControls}>
           <TouchableOpacity onPress={() => onToggleAll(false)}><Text style={styles.controlLink}>Expand</Text></TouchableOpacity>
           <View style={styles.dotSeparator} />
           <TouchableOpacity onPress={() => onToggleAll(true)}><Text style={styles.controlLink}>Collapse</Text></TouchableOpacity>
        </View>
      </View>

     <View style={styles.entrySection}>
        <View style={styles.sleekHeaderRow}>
          <View style={styles.headerLeft}>
            <View style={styles.greenIndicatorSmall} />
            <Text style={styles.sleekHeaderTitle}>Waste Category</Text>
          </View>
          <View style={styles.sleekIdChip}>
            <Text style={styles.sleekIdLabel}>HOUSEHOLD ID</Text>
            <Text style={styles.sleekIdValue}>{householdId || '...'}</Text>
          </View>
        </View>

        <View style={styles.modernTabTrack}>
          {WASTE_TYPES.map(type => (
            <TouchableOpacity key={type} style={[styles.modernTab, activeTab === type && styles.modernTabActive]} onPress={() => setActiveTab(type)}>
              <Text style={[styles.modernTabText, activeTab === type && styles.modernTabTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.premiumCard}>
          <View style={styles.premiumInputSide}>
            <View style={styles.weightDisplayRow}>
              <TextInput
                style={styles.floatingHiddenInput}
                value={inputs[activeTab] || ''}
                onChangeText={(text) => handleInputChange(text)}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="transparent"
              />
              <View style={styles.visualNumericContainer} pointerEvents="none">
                <Text style={styles.premiumBigInt}>{inputs[activeTab]?.split('.')[0] || '0'}</Text>
                <Text style={styles.premiumSmallDec}>.{inputs[activeTab]?.split('.')[1] || '00'}</Text>
              </View>
            </View>
            <Text style={styles.premiumUnitTag}>KILOGRAMS (KG)</Text>
          </View>

          <View style={styles.premiumButtonSide}>
            <TouchableOpacity style={styles.sleekSimBtn} onPress={handleSimulate} disabled={loadingSim}>
              {loadingSim ? <ActivityIndicator color={COLORS.primary} size="small" /> : <Text style={styles.sleekSimBtnText}>Predict</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sleekSubmitBtn} onPress={handleSubmitForReview} disabled={loadingSubmit}>
              {loadingSubmit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sleekSubmitBtnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {dashboardData && (
        <View style={styles.simCard}>
          <View style={styles.simHeader}><Text style={styles.simTitle}>Prediction Result</Text></View>
          <View style={styles.simRowTransparent}>
            <View style={styles.simCol}>
              <Text style={styles.simLabel}>This Week</Text>
              <Text style={styles.simValue}>{formatMoney(dashboardData.current_bill.final_bill)}</Text>
              <Text style={[styles.simSub, { color: COLORS.accent }]}>{dashboardData.current_bill.status}</Text>
            </View>
            <View style={styles.vertLine} />
            <View style={styles.simCol}>
              <Text style={styles.simLabel}>Forecasted</Text>
              <Text style={styles.simValue}>{formatMoney(dashboardData.predicted_bill.final_bill)}</Text>
              <Text style={styles.simSub}>{formatWeight(dashboardData.predicted_bill.weight_kg)}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.overviewHeaderRow}>
        <View style={styles.greenIndicatorMain} />
        <Text style={styles.mainSectionHeader}>Dashboard Overview</Text>
      </View>
    </View>
  );
};


const WasteDashboard = ({ route, navigation }) => {
  const { email } = route.params || {};
  const [householdId, setHouseholdId] = useState('');
  const [activeTab, setActiveTab] = useState('Organic');
  const [inputs, setInputs] = useState({ Organic: '', Inorganic: '', Recyclable: '' });
  const [dashboardData, setDashboardData] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [billsList, setBillsList] = useState([]);
  const [overallStats, setOverallStats] = useState([]);
  const [loadingSim, setLoadingSim] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    const fetchLinkedHousehold = async () => {
      if (!email) return;
      try {
        const res = await axios.get(`${API_BASE}/household/check_by_email/${email.trim().toLowerCase()}`);
        if (res.data.exists && res.data.household_id) setHouseholdId(res.data.household_id);
      } catch (error) { console.error(error); }
    };
    fetchLinkedHousehold();
  }, [email]);

  useEffect(() => { if (householdId) loadPageData(); }, [householdId]);
  useEffect(() => { if (householdId) fetchListsOnly(); }, [activeTab]);

  const loadPageData = async () => {
    if (!householdId) return;
    setRefreshing(true);
    try { await axios.post(`${API_BASE}/sync_missing_weeks/${householdId}`); } catch (e) { }
    await Promise.all([fetchSmartDefaults(), fetchListsOnly(), fetchOverallStats()]);
    setRefreshing(false);
  };

  const fetchListsOnly = async () => {
    await Promise.all([fetchHistory(), fetchPending(), fetchUnpaidBills()]);
  };

  const fetchUnpaidBills = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my-bills/${householdId}`);
      setBillsList(res.data.filter(b => b.status === "UNPAID" && b.waste_type === activeTab));
    } catch (e) { setBillsList([]); }
  };

  const fetchOverallStats = async () => {
    try {
      const requests = WASTE_TYPES.map(type => axios.get(`${API_BASE}/history_statement/${householdId}/${type}`).catch(() => ({ data: { history: [] } })));
      const responses = await Promise.all(requests);
      let allRows = [];
      responses.forEach(res => { if (res.data?.history) allRows = [...allRows, ...res.data.history]; });
      const groups = {};
      allRows.forEach(item => {
        const key = getMonthName(item.year, item.week);
        if (!groups[key]) groups[key] = { month: key, totalBill: 0, totalWeight: 0, sortKey: `${item.year}-${item.week}` };
        groups[key].totalBill += (item.final_bill || 0);
        groups[key].totalWeight += (item.weight_kg || 0);
      });
      setOverallStats(Object.values(groups).sort((a, b) => b.sortKey.localeCompare(a.sortKey)));
    } catch (error) { console.log(error); }
  };

  const fetchSmartDefaults = async () => {
    try {
      const res = await axios.get(`${API_BASE}/predict_next_week/${householdId}`);
      const data = res.data.waste_data;
      if (!data) return;
      setInputs(prev => ({
        Organic: data.Organic?.predicted_next_week_kg?.toFixed(2) || prev.Organic,
        Inorganic: data.Inorganic?.predicted_next_week_kg?.toFixed(2) || prev.Inorganic,
        Recyclable: data.Recyclable?.predicted_next_week_kg?.toFixed(2) || prev.Recyclable
      }));
    } catch (error) { console.log(error); }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history_statement/${householdId}/${activeTab}`);
      setHistoryList(res.data.history.sort((a, b) => b.year !== a.year ? b.year - a.year : b.week - a.week));
    } catch (error) { setHistoryList([]); }
  };

  const fetchPending = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my_submissions/${householdId}/${activeTab}`);
      setPendingList(res.data);
    } catch (error) { setPendingList([]); }
  };

  const handleInputChange = useCallback((text) => setInputs(prev => ({ ...prev, [activeTab]: text })), [activeTab]);

  const handleSimulate = async () => {
    if (!inputs[activeTab]) { Alert.alert('Enter Weight'); return; }
    setLoadingSim(true);
    Keyboard.dismiss();
    try {
      const res = await axios.post(`${API_BASE}/process_weekly_waste`, {
        household_id: householdId, waste_type: activeTab, current_weight_kg: parseFloat(inputs[activeTab])
      });
      setDashboardData(res.data);
    } catch (error) { Alert.alert('Error', 'Prediction failed.'); }
    finally { setLoadingSim(false); }
  };

  const handleSubmitForReview = async () => {
    if (!inputs[activeTab]) { Alert.alert('Enter Weight'); return; }
    setLoadingSubmit(true);
    Keyboard.dismiss();
    try {
      const res = await axios.post(`${API_BASE}/submit_weight_for_review`, {
        household_id: householdId, waste_type: activeTab, weight_kg: parseFloat(inputs[activeTab])
      });
      if (res.status === 200) {
        Alert.alert('Sent', 'Waste submission sent for review.');
        setInputs(prev => ({ ...prev, [activeTab]: '' }));
        setDashboardData(null);
        fetchListsOnly();
      }
    } catch (error) { Alert.alert('Error', 'Failed to submit.'); }
    finally { setLoadingSubmit(false); }
  };

  const toggleSection = (title) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
  };

  const toggleAllSections = (collapse) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (collapse) {
      const allTitles = sectionedData.map(s => s.title);
      setCollapsedSections(allTitles);
    } else {
      setCollapsedSections([]);
    }
  };


  const getStatusConfig = (status, isPending, isBill) => {
    if (isPending) return { color: COLORS.pending, label: 'Awaiting review', icon: null };

    if (status === 'REWARD') return {
      color: COLORS.reward,
      label: 'Eco-Reward',
      icon: (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.reward} strokeWidth={2}>
          <Path strokeLinecap="round" strokeLinejoin="round" d="m9 14.25 6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </Svg>
      )
    };

    if (status === 'PENALTY') return {
      color: COLORS.penalty,
      label: 'Excess Penalty',
      icon: (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.penalty} strokeWidth={2.5}>
          <Path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </Svg>
      )
    };

    return isBill ? { color: COLORS.pending, label: 'Processing...', icon: null } : { color: COLORS.textLight, label: 'Record Finalized', icon: null };
  };

  const sectionedData = useMemo(() => {
    const sections = [];
    if (overallStats.length > 0) {
      sections.push({ title: "Monthly Estimations", data: collapsedSections.includes("Monthly Estimations") ? [] : [{ isOverallStats: true }], isStatsSection: true });
    }
    if (billsList.length > 0) {
      sections.push({ title: "Invoices Due", data: collapsedSections.includes("Invoices Due") ? [] : billsList.map(item => ({ ...item, isBill: true })), isBillSection: true });
    }
    if (pendingList.length > 0) {
      sections.push({ title: "Awaiting Verification", data: collapsedSections.includes("Awaiting Verification") ? [] : pendingList.map(item => ({ ...item, isPending: true })), isPending: true });
    }
    const groups = {};
    historyList.forEach(item => {
      const key = new Date(item.year, 0, 1 + (item.week - 1) * 7).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { title: key, data: [], totalBill: 0 };
      groups[key].data.push(item);
      groups[key].totalBill += (item.final_bill || 0);
    });
    Object.keys(groups).forEach(key => sections.push({ title: key, totalBill: groups[key].totalBill, data: collapsedSections.includes(key) ? [] : groups[key].data }));
    return sections;
  }, [historyList, pendingList, billsList, collapsedSections, overallStats]);

  const renderSectionHeader = ({ section }) => {
    const isCollapsed = collapsedSections.includes(section.title);
    return (
      <TouchableOpacity style={[styles.sectionHeader, section.isBillSection && { borderLeftColor: COLORS.penalty }]} onPress={() => toggleSection(section.title)} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionArrow}>{isCollapsed ? '▶' : '▼'}</Text>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
        {(!section.isPending && !section.isBillSection && !section.isStatsSection) && (<Text style={styles.sectionTotalAmt}>Rs.{section.totalBill.toFixed(2)}</Text>)}
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }) => {
    if (item.isOverallStats) {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
          {overallStats.map((stat, idx) => (
            <View key={idx} style={styles.summaryBadge}>
              <Text style={stat.totalBill > 500 ? [styles.summaryMonth, {color: COLORS.penalty}] : styles.summaryMonth}>{stat.month}</Text>
              <Text style={styles.summaryBill}>Rs.{stat.totalBill.toFixed(2)}</Text>
              <View style={styles.weightTag}><Text style={styles.summaryWeight}>{stat.totalWeight.toFixed(2)} kg</Text></View>
            </View>
          ))}
        </ScrollView>
      );
    }
    const isPending = !!item.isPending;
    const config = getStatusConfig(item.status, isPending, !!item.isBill);

    return (
      <View style={[styles.historyItem, item.isBill && styles.billItemBorder, isPending && styles.pendingItemShadow]}>
        <View style={styles.historyDateBox}>
          <Text style={styles.historyWeek}>W{item.week || '?'}</Text>
          <Text style={styles.historyYear}>{item.year || '2026'}</Text>
        </View>

        <View style={styles.historyCenter}>
          <Text style={styles.historyWeight}>{parseFloat(item.weight_kg || 0).toFixed(2)} kg</Text>


          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={[styles.historyStatus, { color: config.color, marginRight: 6 }]}>{config.label}</Text>
            {config.icon}
          </View>

          {!isPending && (
            <View style={styles.financialDetailRow}>
              {item.discount_amount > 0 && (<Text style={styles.discountText}>- Rs.{item.discount_amount.toFixed(2)} (Eco-Bonus)</Text>)}
              {item.penalty_amount > 0 && (<Text style={styles.penaltyText}>+ Rs.{item.penalty_amount.toFixed(2)} (Excess)</Text>)}
            </View>
          )}
        </View>

        <View style={styles.historyRight}>
          <Text style={[styles.historyPrice, item.isBill && { color: COLORS.penalty }, isPending && { color: COLORS.textLight, fontSize: 13 }]}>
            {isPending ? "Pending Review" : `Rs.${parseFloat(item.total_amount || item.final_bill || 0).toFixed(2)}`}
          </Text>
          {item.isBill && (
            <TouchableOpacity style={styles.payBtn} onPress={() => navigation.navigate('Payment', { householdId })}>
              <Text style={styles.payBtnText}>Pay Now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sectionedData}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderHistoryItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={
          <DashboardHeader
            householdId={householdId} activeTab={activeTab} setActiveTab={setActiveTab}
            inputs={inputs} handleInputChange={handleInputChange}
            loadingSim={loadingSim} handleSimulate={handleSimulate}
            loadingSubmit={loadingSubmit} handleSubmitForReview={handleSubmitForReview}
            dashboardData={dashboardData} email={email} onToggleAll={toggleAllSections}
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPageData} tintColor={COLORS.primary} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No activities recorded yet.</Text>}
      />
      <UserProfile isVisible={showProfile} onClose={() => setShowProfile(false)} householdId={householdId} />
      <Modal visible={showLeaderboard} animationType="slide" transparent={false}>
          <LeaderBoard route={{ params: { householdId } }} navigation={{ goBack: () => setShowLeaderboard(false) }} />
      </Modal>
      <BottomNavBar onLeaderboard={() => setShowLeaderboard(true)} onProfile={() => setShowProfile(true)} onPayments={() => navigation.navigate('Payment', { householdId })} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 15
  },
  headerControls: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  controlLink: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  dotSeparator: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textLight, marginHorizontal: 8 },
  welcomeLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: 'bold', textTransform: 'uppercase' },
  welcomeText: { fontSize: 22, fontWeight: 'bold', color: COLORS.textDark },

  entrySection: { marginVertical: 10, paddingHorizontal: 20 },
  sleekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  greenIndicatorSmall: { width: 4, height: 18, backgroundColor: COLORS.secondary, borderRadius: 2, marginRight: 8 },
  sleekHeaderTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  sleekIdChip: { backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  sleekIdLabel: { fontSize: 7, fontWeight: '900', color: COLORS.textLight },
  sleekIdValue: { fontSize: 11, fontWeight: 'bold', color: COLORS.secondary },

  modernTabTrack: { flexDirection: 'row', backgroundColor: '#E6EFEA', borderRadius: 14, padding: 4, marginBottom: 15 },
  modernTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  modernTabActive: { backgroundColor: COLORS.white, elevation: 3 },
  modernTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  modernTabTextActive: { color: COLORS.primary, fontWeight: '800' },

  premiumCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    borderWidth: 1,
    borderColor: '#ffffff50'
  },
  premiumInputSide: { flex: 1 },
  weightDisplayRow: { flexDirection: 'row', alignItems: 'baseline', position: 'relative' },
  floatingHiddenInput: { position: 'absolute', width: '100%', height: '100%', zIndex: 10, color: 'transparent', fontSize: 40 },
  visualNumericContainer: { flexDirection: 'row', alignItems: 'baseline' },
  premiumBigInt: { fontSize: 48, fontWeight: '600', color: COLORS.primary, letterSpacing: -2 },
  premiumSmallDec: { fontSize: 24, fontWeight: '600', color: COLORS.accent, marginLeft: 2 },
  premiumUnitTag: { fontSize: 10, fontWeight: '800', color: COLORS.textLight, marginTop: -5 },
  premiumButtonSide: { width: 100, gap: 8, paddingLeft: 15, borderLeftWidth: 1, borderLeftColor: '#f0f4f2' },
  sleekSimBtn: { paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: 'center' },
  sleekSubmitBtn: { backgroundColor: COLORS.primary, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  sleekSimBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 11 },
  sleekSubmitBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  simCard: {
    backgroundColor: COLORS.white,
    margin: 20,
    borderRadius: 24,
    padding: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E0F2E9'
  },
  simHeader: { marginBottom: 5 },
  simTitle: { color: COLORS.secondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  simRowTransparent: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, paddingVertical: 15, borderRadius: 16 },
  simCol: { alignItems: 'center', flex: 1 },
  simLabel: { color: COLORS.textLight, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  simValue: { color: COLORS.primary, fontSize: 24, fontWeight: '900' },
  simSub: { fontSize: 12, fontWeight: 'bold', marginTop: 2, color: COLORS.secondary },
  vertLine: { width: 1, height: '80%', backgroundColor: COLORS.border, alignSelf: 'center' },

  summaryScroll: { paddingLeft: 20, paddingBottom: 15, paddingTop: 5 },
  summaryBadge: { backgroundColor: COLORS.white, padding: 15, borderRadius: 18, marginRight: 12, width: 130, elevation: 3, borderTopWidth: 4, borderTopColor: COLORS.secondary },
  summaryMonth: { color: COLORS.textLight, fontSize: 11, fontWeight: 'bold' },
  summaryBill: { color: COLORS.textDark, fontSize: 16, fontWeight: 'bold', marginVertical: 4 },
  weightTag: { backgroundColor: COLORS.background, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  summaryWeight: { color: COLORS.secondary, fontSize: 11, fontWeight: 'bold' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.secondary,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionArrow: { fontSize: 12, color: COLORS.textLight, marginRight: 10, width: 15 },
  sectionTitle: { fontWeight: 'bold', color: COLORS.textDark, fontSize: 14 },
  sectionTotalAmt: { fontWeight: 'bold', color: COLORS.primary, fontSize: 14 },

  historyItem: { backgroundColor: '#fff', marginHorizontal: 20, padding: 15, borderRadius: 15, marginBottom: 8, elevation: 1, flexDirection: 'row', alignItems: 'center' },
  historyDateBox: { alignItems: 'center', paddingRight: 15, borderRightWidth: 1, borderRightColor: '#eee', width: 50 },
  historyWeek: { fontWeight: 'bold', color: COLORS.textDark },
  historyYear: { fontSize: 10, color: COLORS.textLight },
  historyCenter: { flex: 1, paddingLeft: 15 },
  historyWeight: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark },
  historyStatus: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  financialDetailRow: { marginTop: 5 },
  discountText: { fontSize: 11, color: COLORS.reward, fontWeight: '600' },
  penaltyText: { fontSize: 11, color: COLORS.penalty, fontWeight: '600' },
  historyRight: { alignItems: 'flex-end' },
  historyPrice: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark },
  payBtn: { backgroundColor: COLORS.penalty, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, marginTop: 5 },
  payBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  overviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  greenIndicatorMain: {
    width: 5,
    height: 22,
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
    marginRight: 12
  },
  mainSectionHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark
  },

  listContent: { paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: COLORS.textLight, marginTop: 30 },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navIcon: { fontSize: 20, marginBottom: 2 },
  navText: { fontSize: 10, fontWeight: 'bold', color: COLORS.textDark },
});

export default WasteDashboard;