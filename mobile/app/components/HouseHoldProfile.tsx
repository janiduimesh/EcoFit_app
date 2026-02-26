import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import axios from 'axios';
import { getApiUrl } from '../utils/config';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const API_BASE = getApiUrl();

const COLORS = {
  primary: '#2D6A4F',
  secondary: '#40916C',
  accent: '#74C69D',
  background: '#F0F7F4',
  white: '#FFFFFF',
  textDark: '#1B4332',
  textLight: '#52796F',
  border: '#E0EAE5'
};

const HouseHoldProfile = ({ isVisible, onClose, householdId }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible && householdId) {
      fetchProfile();
    }
  }, [isVisible, householdId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/household/profile/${householdId}`);
      setProfileData(res.data);
    } catch (error) {
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = async () => {
    if (!profileData?.qr_code) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "Gallery access is needed to save your ID.");
        return;
      }

      const base64Data = profileData.qr_code.includes('base64,')
        ? profileData.qr_code.split('base64,')[1]
        : profileData.qr_code;

      const fileName = `QR_${householdId.replace(/[^a-z0-9]/gi, '_')}.png`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: 'base64',
      });

      const asset = await MediaLibrary.createAssetAsync(fileUri);
      const album = await MediaLibrary.getAlbumAsync("GreenCitizen");

      if (album == null) {
        await MediaLibrary.createAlbumAsync("GreenCitizen", asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      Alert.alert("Success", "QR Code saved to 'GreenCitizen' gallery! 📸");
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save image. Please check storage permissions.");
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContent}>
          <StatusBar barStyle="dark-content" />


          <View style={styles.safeHeaderWrapper}>
            <View style={styles.header}>
              <View>
                <Text style={styles.welcomeLabel}>Credentials</Text>
                <Text style={styles.headerTitle}>Household Profile</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
          ) : profileData ? (
            <View style={styles.body}>

              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={downloadQRCode}
                style={styles.qrCard}
              >
                <Image
                  source={{ uri: `data:image/png;base64,${profileData.qr_code}` }}
                  style={styles.qrImage}
                />
                <View style={styles.idChip}>
                   <Text style={styles.idLabel}>{householdId}</Text>
                </View>
                <Text style={styles.hintText}>Long-press image to save</Text>
              </TouchableOpacity>

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Linked Email</Text>
                  <Text style={styles.value}>{profileData.linked_email}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Waste Tier</Text>
                  <Text style={[styles.value, { color: COLORS.primary, fontWeight: '900' }]}>
                    {profileData.income_tier}
                  </Text>
                </View>
              </View>

              <Text style={styles.note}>
                Scan this code to verify your disposal and calculate taxes.
              </Text>
            </View>
          ) : (
            <Text style={styles.errorText}>Data unavailable.</Text>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: '85%',

  },
  safeHeaderWrapper: {
    paddingHorizontal: 28,
    paddingTop: 35,
    paddingBottom: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: '800', textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textDark, marginTop: 4 },
  closeBtn: { backgroundColor: COLORS.background, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  closeIcon: { fontSize: 18, color: COLORS.textDark, fontWeight: 'bold' },

  body: { alignItems: 'center', paddingHorizontal: 24 },
  qrCard: {
    backgroundColor: COLORS.white,
    padding: 25,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20
  },
  qrImage: { width: 200, height: 200, marginBottom: 20 },
  idChip: { backgroundColor: COLORS.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  idLabel: { fontSize: 13, color: COLORS.primary, fontWeight: '800' },
  hintText: { fontSize: 11, color: COLORS.textLight, marginTop: 15, fontStyle: 'italic' },

  infoSection: {
    width: '100%',
    marginTop: 25,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  infoRow: { paddingVertical: 12 },
  label: { fontSize: 11, color: COLORS.secondary, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 15, color: COLORS.textDark, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border },

  note: { marginTop: 25, textAlign: 'center', color: COLORS.textLight, fontSize: 13, lineHeight: 20 },
  errorText: { textAlign: 'center', color: COLORS.textLight, marginTop: 60 }
});

export default HouseHoldProfile;