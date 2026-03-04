import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import axios from 'axios';
import { getApiUrl } from '../utils/config';
import CardManager from '../components/CardManager';

const API_BASE = getApiUrl();

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  accent: '#74C69D',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  penalty: '#D90429',
  border: '#E0EAE5',
  reward: '#2D6A4F'
};

const PaymentScreen = ({ route = {}, navigation }) => {
  const { householdId } = route.params || {};
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [savedCards, setSavedCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (householdId) {
      fetchInitialData();
    }
  }, [householdId]);

  const fetchInitialData = async () => {
    try {
      const [billsRes, cardsRes] = await Promise.all([
        axios.get(`${API_BASE}/my-bills/${householdId}`),
        axios.get(`${API_BASE}/cards/${householdId}`)
      ]);

      const unpaid = billsRes.data.filter(bill => bill.status === "UNPAID");
      setUnpaidBills(unpaid);
      setSavedCards(cardsRes.data);

      if (cardsRes.data.length > 0) {
        setSelectedCard(cardsRes.data[0]);
      }
    } catch (e) {
      Alert.alert("Error", "Could not load payment information");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = unpaidBills.reduce((sum, bill) => sum + (bill.final_bill || 0), 0);

  const handleFinalPay = async () => {
    if (unpaidBills.length === 0) return;
    if (!selectedCard) {
      Alert.alert("Action Required", "Please select or add a payment method.");
      return;
    }

    setPaying(true);
    const billIds = unpaidBills.map(b => b._id);

    try {
      const res = await axios.post(`${API_BASE}/pay-multiple-bills`, {
        bill_ids: billIds,
        payment_method: `${selectedCard.card_type} ending in ${selectedCard.last4}`
      });

      if (res.status === 200) {
        Alert.alert("Success", "Your environmental taxes have been settled.", [
          { text: "Finish", onPress: () => navigation.navigate('Tax') }
        ]);
      }
    } catch (e) {
      Alert.alert("Transaction Failed", "We could not process your payment at this time.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={styles.titleSection}>
          <Text style={styles.welcomeLabel}>Financials</Text>
          <Text style={styles.mainTitle}>Tax Payment</Text>
        </View>

        {/* --- BILL SUMMARY --- */}
        <View style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Outstanding Invoices</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unpaidBills.length}</Text>
            </View>
          </View>

          {unpaidBills.length === 0 ? (
            <Text style={styles.emptyText}>All your bills are settled! 🌿</Text>
          ) : (
            unpaidBills.map((bill, index) => {
              // Calculate original price before the reward deduction
              const originalPrice = (bill.final_bill || 0) + (bill.reward_deduction || 0);

              return (
                <View key={index} style={styles.billItemContainer}>
                  <View style={styles.billRow}>
                    <View>
                      <Text style={styles.billType}>{bill.waste_type}</Text>
                      <Text style={styles.billSub}>Week {bill.week}, {bill.year}</Text>
                    </View>
                    <Text style={styles.billPrice}>Rs.{originalPrice.toFixed(2)}</Text>
                  </View>


{bill.reward_deduction > 0 && (
  <View style={styles.rewardRow}>
    <View style={styles.rewardLabelGroup}>

      <Svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke={COLORS.reward}
        strokeWidth={2}
        style={{ marginRight: 6 }}
      >
        <Path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
        />
      </Svg>
      <Text style={styles.rewardLabel}>Monthly Rank Credit</Text>
    </View>
    <Text style={styles.rewardValue}>- Rs.{bill.reward_deduction.toFixed(2)}</Text>
  </View>
)}
                </View>
              );
            })
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>Rs.{totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* --- PAYMENT METHODS --- */}
        <View style={styles.methodCard}>
          <Text style={styles.methodTitle}>Payment Method</Text>

          {savedCards.map((card) => (
            <TouchableOpacity
              key={card.card_id}
              style={[
                styles.cardOption,
                selectedCard?.card_id === card.card_id && styles.activeCardOption
              ]}
              onPress={() => setSelectedCard(card)}
            >
              <View style={styles.cardInfo}>
                <View style={styles.iconWrapper}>
                  {card.card_type === 'Visa' ? (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={1.5}>
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                    </Svg>
                  ) : (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={1.5}>
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                    </Svg>
                  )}
                </View>
                <Text style={styles.cardText}>
                  {card.card_type} •••• {card.last4}
                </Text>
              </View>
              <View style={[
                styles.radio,
                selectedCard?.card_id === card.card_id && styles.radioActive
              ]} />
            </TouchableOpacity>
          ))}

          <CardManager householdId={householdId} onCardsUpdated={fetchInitialData} />

          <TouchableOpacity
            style={[
              styles.payBtn,
              (totalAmount === 0 || !selectedCard) && styles.disabledBtn
            ]}
            onPress={handleFinalPay}
            disabled={paying || totalAmount === 0 || !selectedCard}
          >
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payBtnText}>
                {totalAmount === 0 ? 'Fully Settled' : `Pay Rs.${totalAmount.toFixed(2)}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  titleSection: { marginBottom: 25 },
  welcomeLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  mainTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textDark, marginTop: 4 },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    elevation: 4,
    marginBottom: 20
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  countBadge: { backgroundColor: COLORS.penalty, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, marginLeft: 10 },
  countText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  billItemContainer: { marginBottom: 18 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billType: { fontSize: 15, fontWeight: 'bold', color: COLORS.textDark },
  billSub: { fontSize: 12, color: COLORS.textLight },
  billPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.textDark },

  // Reward Styling
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: 10 },
  rewardLabelGroup: { flexDirection: 'row', alignItems: 'center' },
  rewardIcon: { fontSize: 12, marginRight: 4 },
  rewardLabel: { fontSize: 12, color: COLORS.reward, fontWeight: '700', fontStyle: 'italic' },
  rewardValue: { fontSize: 12, color: COLORS.reward, fontWeight: '900' },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  totalValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  methodCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, elevation: 4 },
  methodTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 20 },

  cardOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  activeCardOption: { borderColor: COLORS.primary, backgroundColor: '#E0F2E9' },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { marginRight: 12 },
  cardText: { fontWeight: '700', color: COLORS.textDark },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.accent },
  radioActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  payBtn: { backgroundColor: COLORS.primary, padding: 16, alignItems: 'center', borderRadius: 12, marginTop: 10, elevation: 4 },
  disabledBtn: { backgroundColor: COLORS.textLight, opacity: 0.5 },
  payBtnText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  emptyText: { textAlign: 'center', color: COLORS.secondary, marginVertical: 30, fontWeight: '700' }
});

export default PaymentScreen;