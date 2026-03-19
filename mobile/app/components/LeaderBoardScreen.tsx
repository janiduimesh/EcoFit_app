import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Dimensions
} from 'react-native';
import axios from 'axios';
import Svg, { Path } from 'react-native-svg';
import { getApiUrl } from '../utils/config';

const { width } = Dimensions.get('window');
const API_BASE = getApiUrl();

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  accent: '#74C69D',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  danger: '#BC4749',
  success: '#386641',
  neutral: '#E2E8F0',
  gold: '#FFD700',
  silver: '#94A3B8',
  bronze: '#B45309'
};

// --- ICON COMPONENTS ---
const DiscountIcon = ({ size = 12, color = COLORS.success }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="m8.99 14.993 6-6m6 3.001c0 1.268-.63 2.39-1.593 3.069a3.746 3.746 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043 3.745 3.745 0 0 1-3.068 1.593c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 0 1-3.296-1.043 3.746 3.746 0 0 1-1.043-3.297 3.746 3.746 0 0 1-1.593-3.068c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 0 1 1.043-3.297 3.745 3.745 0 0 1 3.296-1.042 3.745 3.745 0 0 1 3.068-1.594c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.297 3.746 3.746 0 0 1 1.593 3.068ZM9.74 9.743h.008v.007H9.74v-.007Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </Svg>
);

const PenaltyIcon = ({ size = 12, color = COLORS.danger }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </Svg>
);

const RankIcon = ({ rank }) => {
  const size = 26;
  const color = rank === 1 ? COLORS.gold : rank === 2 ? COLORS.silver : rank === 3 ? COLORS.bronze : COLORS.secondary;
  if (rank <= 3) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
        <Path d="M12 15l-2 5l2 2l2-2l-2-5zm0 0l-4-9l4-2l4 2l-4 9z" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return <Text style={styles.lbRankText}>{rank}</Text>;
};

const LeaderBoardScreen = ({ route, navigation }) => {
  const { householdId } = route.params || {};
  const now = new Date();

  const parseHousehold = (id) => {
    if (!id) return { area: 'Unknown', houseNo: '??' };
    const parts = id.split('-');
    const area = parts.length > 2 ? parts[1] : parts[0];
    const houseNo = parts[parts.length - 1];
    return { area, houseNo };
  };

  const userArea = parseHousehold(householdId).area;
  const [viewMode, setViewMode] = useState('weekly');
  const [areaFilter, setAreaFilter] = useState('All');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const [week, setWeek] = useState(getWeekNumber(new Date()));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchLeaderboard(); }, [viewMode, month, week, year]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const endpoint = viewMode === 'weekly' ? '/leaderboard/weekly' : '/leaderboard/monthly';
      const params = viewMode === 'weekly' ? { year, week } : { year, month };
      const res = await axios.get(`${API_BASE}${endpoint}`, { params });
      setData(res.data);
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustDate = (delta) => {
    if (viewMode === 'weekly') {
      let newWeek = week + delta;
      if (newWeek < 1) { setWeek(52); setYear(year - 1); }
      else if (newWeek > 52) { setWeek(1); setYear(year + 1); }
      else { setWeek(newWeek); }
    } else {
      let newMonth = month + delta;
      if (newMonth < 1) { setMonth(12); setYear(year - 1); }
      else if (newMonth > 12) { setMonth(1); setYear(year + 1); }
      else { setMonth(newMonth); }
    }
  };

  const filteredData = data.filter(item => {
    if (areaFilter === 'All') return true;
    return parseHousehold(item.household_id).area === userArea;
  });

  const totalCommunityDiscount = filteredData.reduce((sum, item) =>
    sum + (item.discount_amount ?? item.discount ?? 0), 0
  );

  const renderItem = ({ item }) => {
    const isMe = item.household_id === householdId;
    const baseCost = item.base_cost ?? 0;
    const penalty = item.penalty_amount ?? item.penalty ?? 0;
    const discount = item.discount_amount ?? item.discount ?? 0;
    const finalBill = item.total_paid ?? item.final_bill ?? 0;
    const totalWeight = item.total_weight ?? item.weight_kg ?? 0;

    const { area, houseNo } = parseHousehold(item.household_id);


    const rewardValue = item.calculated_reward_amount || null;
    const rewardPct = item.applied_percentage || (item.rank === 1 ? '12%' : item.rank === 2 ? '10%' : '8%');

    return (
      <View style={[styles.lbRow, isMe && styles.lbRowSelf]}>
        <View style={styles.rankContainer}><RankIcon rank={item.rank} /></View>
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.lbName} numberOfLines={1}>
                {item.household_name || `House ${houseNo}`}
            </Text>

            {viewMode === 'monthly' && item.rank <= 3 && (
              <View style={[
                styles.rewardBadge,
                { backgroundColor: item.rank === 1 ? COLORS.gold : item.rank === 2 ? COLORS.silver : COLORS.bronze }
              ]}>
                <Text style={styles.rewardBadgeText}>
                  {rewardValue ? `Rs.${rewardValue.toFixed(0)} Credit` : `Next Bill: -${rewardPct}`}
                </Text>
              </View>
            )}

            <View style={styles.consistencyBadge}>
              <Text style={styles.consistencyText}>{item.consistency || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.auditRow}>
            <View style={styles.auditBadge}>
              <Text style={styles.auditLabel}>Base: Rs.{baseCost.toFixed(0)}</Text>
            </View>
            <View style={[styles.auditBadge, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
              <PenaltyIcon />
              <Text style={[styles.auditLabel, { color: COLORS.danger }]}> Rs.{penalty.toFixed(0)}</Text>
            </View>
            <View style={[styles.auditBadge, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
              <DiscountIcon />
              <Text style={[styles.auditLabel, { color: COLORS.success }]}> Rs.{discount.toFixed(0)}</Text>
            </View>
          </View>
          <Text style={styles.lbLoc}>{area}</Text>
        </View>
        <View style={styles.statsContainer}>
          <Text style={styles.lbVal}>Rs.{finalBill.toFixed(0)}</Text>
          <Text style={styles.lbWeight}>{totalWeight.toFixed(1)}kg</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'weekly' && styles.activeToggle]}
            onPress={() => setViewMode('weekly')}
          >
            <Text style={[styles.toggleText, viewMode === 'weekly' && styles.activeToggleText]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'monthly' && styles.activeToggle]}
            onPress={() => setViewMode('monthly')}
          >
            <Text style={[styles.toggleText, viewMode === 'monthly' && styles.activeToggleText]}>Monthly</Text>
          </TouchableOpacity>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.datePickerContainer}>
        <TouchableOpacity onPress={() => handleAdjustDate(-1)} style={styles.pBtn}>
          <Text style={styles.pBtnText}>◀</Text>
        </TouchableOpacity>
        <View style={styles.labelWrapper}>
          <Text style={styles.mLabel}>
            {viewMode === 'weekly' ? `Week ${week}` : new Date(year, month - 1).toLocaleString('default', { month: 'long' })}
          </Text>
          <Text style={styles.yLabel}>{year}</Text>
        </View>
        <TouchableOpacity onPress={() => handleAdjustDate(1)} style={styles.pBtn}>
          <Text style={styles.pBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.household_id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.topSection}>
            <Text style={styles.title}>{viewMode === 'weekly' ? 'Weekly Rank' : 'Monthly Rank'}</Text>

            <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Show Ranking For:</Text>
                <View style={styles.filterToggle}>
                <TouchableOpacity
                    style={[styles.filterBtn, areaFilter === 'All' && styles.filterBtnActive]}
                    onPress={() => setAreaFilter('All')}
                >
                    <Text style={[styles.filterBtnText, areaFilter === 'All' && styles.filterBtnTextActive]}>All Areas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterBtn, areaFilter === 'My Area' && styles.filterBtnActive]}
                    onPress={() => setAreaFilter('My Area')}
                >
                    <Text style={[styles.filterBtnText, areaFilter === 'My Area' && styles.filterBtnTextActive]}>{userArea}</Text>
                </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.subtitle}>
              {viewMode === 'weekly'
                ? "Maintain waste limits to rank higher and save more!"
                : "Top 3 monthly recyclers receive percentage-based bill credits for their next payment."}
            </Text>
            {totalCommunityDiscount > 0 && (
              <View style={styles.impactCard}>
                <DiscountIcon size={20} color={COLORS.white} />
                <Text style={styles.impactText}>
                    {areaFilter === 'All' ? 'Community' : userArea} saved Rs.{totalCommunityDiscount.toFixed(0)}
                </Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          loading ?
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /> :
          <View style={styles.emptyWrap}>
             <Text style={styles.empty}>No data available for this selection.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backText: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10 },
  activeToggle: { backgroundColor: COLORS.white, elevation: 2 },
  toggleText: { fontSize: 12, fontWeight: 'bold', color: COLORS.textLight },
  activeToggleText: { color: COLORS.primary },
  datePickerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, backgroundColor: COLORS.white, marginBottom: 10 },
  pBtn: { padding: 10 },
  pBtnText: { color: COLORS.primary, fontWeight: 'bold' },
  labelWrapper: { alignItems: 'center', minWidth: 120 },
  mLabel: { fontWeight: 'bold', fontSize: 15, color: COLORS.textDark },
  yLabel: { fontSize: 10, color: COLORS.textLight },
  topSection: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '600', color: COLORS.textDark, letterSpacing: -1 },
  filterContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, padding: 10, borderRadius: 16, marginTop: 15, borderWidth: 1, borderColor: COLORS.neutral },
  filterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  filterToggle: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 2 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterBtnText: { fontSize: 11, fontWeight: 'bold', color: COLORS.textLight },
  filterBtnTextActive: { color: COLORS.white },
  subtitle: { fontSize: 11, color: COLORS.textLight, marginTop: 12, marginBottom: 12, lineHeight: 16 },
  impactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 14, borderRadius: 18, elevation: 2 },
  impactText: { color: COLORS.white, fontWeight: '700', marginLeft: 10, fontSize: 13 },
  lbRow: { flexDirection: 'row', padding: 16, backgroundColor: COLORS.white, borderRadius: 26, marginBottom: 14, alignItems: 'center', elevation: 3 },
  lbRowSelf: { borderWidth: 2, borderColor: COLORS.primary, backgroundColor: '#F0FDF4' },
  rankContainer: { width: 42, alignItems: 'center' },
  lbRankText: { fontWeight: '900', color: COLORS.secondary, fontSize: 16 },
  infoContainer: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  lbName: { fontWeight: '800', color: COLORS.textDark, fontSize: 15, maxWidth: '55%' },
  rewardBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  rewardBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.textDark },
  consistencyBadge: { backgroundColor: COLORS.neutral, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  consistencyText: { fontSize: 8, fontWeight: '900', color: COLORS.textDark },
  auditRow: { flexDirection: 'row', flexWrap: 'wrap' },
  auditBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: '#EDF2F7', minWidth: 60 },
  auditLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textLight },
  lbLoc: { fontSize: 10, color: COLORS.textLight, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 0.5 },
  statsContainer: { alignItems: 'flex-end', marginLeft: 8 },
  lbVal: { fontWeight: '900', color: COLORS.primary, fontSize: 18 },
  lbWeight: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  emptyWrap: { marginTop: 60, alignItems: 'center', paddingHorizontal: 40 },
  empty: { color: COLORS.textLight, fontSize: 14, textAlign: 'center' }
});

export default LeaderBoardScreen;