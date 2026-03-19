import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Modal,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, ScrollView, Dimensions
} from 'react-native';
import axios from 'axios';
import { getApiUrl } from '../utils/config';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Svg, { Path, Rect, Defs, ClipPath, G } from 'react-native-svg';

const API_BASE = getApiUrl();

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  organic: '#A7C957',
  recyclable: '#38A3A5',
  inorganic: '#6A4C93',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  border: '#E0EAE5',
  cardBg: '#F8FBFA'
};

const TIER_RANGES = {
  Low: { organic: "1.2 - 2.8", inorganic: "0.2 - 0.6", recyclable: "0.4 - 1.2" },
  Medium: { organic: "2.5 - 4.5", inorganic: "0.5 - 1.0", recyclable: "0.8 - 1.8" },
  High: { organic: "4.8 - 7.5", inorganic: "0.8 - 1.5", recyclable: "1.5 - 3.2" }
};

const DynamicBin = ({ value, color, label, maxWeight = 5 }) => {
  const fillPercent = Math.min(Math.max((value / maxWeight) * 100, 2), 95);
  const totalBodyHeight = 16;
  const fillHeight = (fillPercent / 100) * totalBodyHeight;

  const binPath = "m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0";

  return (
    <View style={styles.binItem}>
      <Svg width="70" height="80" viewBox="0 0 24 24" fill="none">
        <Defs>
          <ClipPath id={`clip-${label}`}>
            <Path d={binPath} />
          </ClipPath>
        </Defs>
        <Path d={binPath} fill="#F1F5F9" opacity={0.5} />
        <G clipPath={`url(#clip-${label})`}>
          <Rect x="0" y={22 - fillHeight} width="24" height={fillHeight} fill={color} opacity={0.8} />
        </G>
        <Path d={binPath} stroke={COLORS.textDark} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={[styles.binValue, { color }]}>{value.toFixed(1)}<Text style={styles.unitText}> kg</Text></Text>
      <Text style={styles.binLabel}>{label}</Text>
    </View>
  );
};

const HouseHoldProfile = ({ isVisible, onClose, householdId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible && householdId) fetchExtendedData();
  }, [isVisible, householdId]);

  const fetchExtendedData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/household/profile_extended/${householdId}`);
      setData(res.data);
    } catch (error) {
      Alert.alert("Error", "Could not fetch profile analytics.");
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = async () => {
    if (!data?.profile?.qr_code) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Error", "Storage access is required.");
        return;
      }
      const base64Data = data.profile.qr_code.includes('base64,') ? data.profile.qr_code.split('base64,')[1] : data.profile.qr_code;
      const fileName = `Household_QR_${householdId}.png`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' });
      await MediaLibrary.createAssetAsync(fileUri);
      Alert.alert("Saved", "Your Household ID has been saved to gallery.");
    } catch (e) {
      Alert.alert("Error", "Failed to save ID.");
    }
  };

  const currentTier = data?.profile?.income_tier || 'Medium';
  const ranges = TIER_RANGES[currentTier] || TIER_RANGES['Medium'];

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContent}>
          <StatusBar barStyle="dark-content" />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSubtitle}>Verified Profile</Text>
              <Text style={styles.headerTitle}>Household Insights</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
          ) : data ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>

              {/* QR Section */}
              <TouchableOpacity activeOpacity={0.9} onLongPress={downloadQRCode} style={styles.qrCard}>
                <Image
                  source={{ uri: `data:image/png;base64,${data.profile.qr_code}` }}
                  style={styles.qrImage}
                />
                <View style={styles.idBadge}>
                  <Text style={styles.idText}>{data.profile.household_id}</Text>
                </View>
                <Text style={styles.hint}>Long-press QR to save image</Text>
              </TouchableOpacity>

              {/* Dynamic Waste Fill Visualization */}
              <View style={styles.vizSection}>
                <Text style={styles.sectionLabel}>Your 12-Week Averages</Text>
                <View style={styles.binRow}>
                  <DynamicBin value={data.averages.Organic} color={COLORS.organic} label="Organic" maxWeight={8} />
                  <DynamicBin value={data.averages.Recyclable} color={COLORS.recyclable} label="Recyclable" maxWeight={4} />
                  <DynamicBin value={data.averages.Inorganic} color={COLORS.inorganic} label="Inorganic" maxWeight={2} />
                </View>
              </View>

              {/* Tier Benchmark Ranges */}
              <View style={styles.rangeCard}>
                <View style={styles.rangeHeader}>
                    <Text style={styles.rangeTitle}>{currentTier} Waste Range</Text>
                    <View style={styles.tierBadge}><Text style={styles.tierBadgeText}>Expected kg/week</Text></View>
                </View>
                <View style={styles.rangeRow}>
                    <View style={styles.rangeItem}>
                        <Text style={[styles.rangeLabel, {color: COLORS.organic}]}>Organic</Text>
                        <Text style={styles.rangeValue}>{ranges.organic}</Text>
                    </View>
                    <View style={styles.rangeItem}>
                        <Text style={[styles.rangeLabel, {color: COLORS.recyclable}]}>Recyclable</Text>
                        <Text style={styles.rangeValue}>{ranges.recyclable}</Text>
                    </View>
                    <View style={styles.rangeItem}>
                        <Text style={[styles.rangeLabel, {color: COLORS.inorganic}]}>Inorganic</Text>
                        <Text style={styles.rangeValue}>{ranges.inorganic}</Text>
                    </View>
                </View>
              </View>

              {/* Account Details */}
              <View style={styles.detailsCard}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Linked Email</Text>
                  <Text style={styles.detailValue}>{data.profile.linked_email}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Waste Tier</Text>
                  <Text style={[styles.detailValue, { color: COLORS.primary }]}>{data.profile.income_tier}</Text>
                </View>
              </View>

              <Text style={styles.footerNote}>
                Ranges help you track if your disposal is within normal limits for your household size.
              </Text>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '90%' },
  header: { padding: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSubtitle: { fontSize: 10, fontWeight: '900', color: COLORS.secondary, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textDark },
  closeBtn: { backgroundColor: COLORS.background, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  closeIcon: { fontSize: 16, fontWeight: 'bold' },

  scrollBody: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  qrCard: { width: '100%', backgroundColor: COLORS.white, borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  qrImage: { width: 170, height: 170, marginBottom: 15 },
  idBadge: { backgroundColor: COLORS.background, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  idText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  hint: { fontSize: 10, color: COLORS.textLight, marginTop: 10, fontStyle: 'italic' },

  vizSection: { width: '100%', marginTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: COLORS.secondary, textTransform: 'uppercase', marginBottom: 15, textAlign: 'center' },
  binRow: { flexDirection: 'row', justifyContent: 'space-between' },
  binItem: { alignItems: 'center', flex: 1 },
  binValue: { fontSize: 16, fontWeight: '900', marginTop: 5 },
  unitText: { fontSize: 10, fontWeight: '400' },
  binLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginTop: 2 },


  rangeCard: { width: '100%', marginTop: 24, backgroundColor: COLORS.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 5, borderLeftColor: COLORS.primary },
  rangeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rangeTitle: { fontSize: 12, fontWeight: '900', color: COLORS.textDark, textTransform: 'uppercase' },
  tierBadge: { backgroundColor: COLORS.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tierBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.secondary },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeItem: { flex: 1, alignItems: 'center' },
  rangeLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  rangeValue: { fontSize: 13, fontWeight: '800', color: COLORS.textDark, marginTop: 2 },

  detailsCard: { width: '100%', marginTop: 20, backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  detailItem: { paddingVertical: 8 },
  detailLabel: { fontSize: 10, fontWeight: '900', color: COLORS.secondary, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  footerNote: { marginTop: 20, fontSize: 11, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 20 }
});

export default HouseHoldProfile;