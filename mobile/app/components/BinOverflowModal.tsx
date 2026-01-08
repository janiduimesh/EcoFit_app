import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { getBinImage } from '../utils/binImages';

interface BinOverflowModalProps {
  visible: boolean;
  onClose: () => void;
}

// Hardcoded bin overflow data - will be replaced with time series model predictions later
const BIN_OVERFLOW_DATA = [
  {
    id: 'blue_bin',
    name: 'Recycling Bin',
    color: '#2196F3',
    overflowDate: 'January 12, 2026',
    daysUntil: 6,
    prediction: 'Based on current disposal patterns',
  },
  {
    id: 'yellow_bin',
    name: 'General Waste',
    color: '#FFC107',
    overflowDate: 'January 9, 2026',
    daysUntil: 3,
    prediction: 'Higher than usual activity detected',
  },
  {
    id: 'green_bin',
    name: 'Organic Waste',
    color: '#4CAF50',
    overflowDate: 'January 14, 2026',
    daysUntil: 8,
    prediction: 'Normal disposal rate',
  },
  {
    id: 'black_bin',
    name: 'Hazardous Waste',
    color: '#424242',
    overflowDate: 'February 2, 2026',
    daysUntil: 27,
    prediction: 'Low activity - safe capacity',
  },
  {
    id: 'red_bin',
    name: 'Electronic Waste',
    color: '#F44336',
    overflowDate: 'January 28, 2026',
    daysUntil: 22,
    prediction: 'Moderate disposal rate',
  },
];

const { width } = Dimensions.get('window');

export default function BinOverflowModal({ visible, onClose }: BinOverflowModalProps) {
  const getUrgencyColor = (days: number) => {
    if (days <= 3) return '#F44336';
    if (days <= 7) return '#FF9800';
    return '#4CAF50';
  };

  const getUrgencyLabel = (days: number) => {
    if (days <= 3) return 'CRITICAL';
    if (days <= 7) return 'SOON';
    return 'SAFE';
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerIcon}>📊</Text>
              <View>
                <Text style={styles.title}>Bin Overflow Forecast</Text>
                <Text style={styles.subtitle}>AI-Powered Predictions</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoIcon}>🤖</Text>
            <Text style={styles.infoText}>
              Predictions based on time series analysis of your disposal patterns
            </Text>
          </View>

          {/* Bin List */}
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {BIN_OVERFLOW_DATA.map((bin) => (
              <View key={bin.id} style={styles.binCard}>
                {/* Bin Image and Info */}
                <View style={styles.binHeader}>
                  <View style={styles.binImageContainer}>
                    <Image
                      source={getBinImage(bin.id)}
                      style={styles.binImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.binInfo}>
                    <Text style={styles.binName}>{bin.name}</Text>
                    <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(bin.daysUntil) }]}>
                      <Text style={styles.urgencyText}>{getUrgencyLabel(bin.daysUntil)}</Text>
                    </View>
                  </View>
                </View>

                {/* Overflow Date */}
                <View style={styles.overflowSection}>
                  <View style={styles.overflowDateContainer}>
                    <Text style={styles.overflowIcon}>📅</Text>
                    <View>
                      <Text style={styles.overflowLabel}>Predicted Overflow</Text>
                      <Text style={styles.overflowDate}>{bin.overflowDate}</Text>
                    </View>
                  </View>
                  <View style={[styles.daysContainer, { backgroundColor: getUrgencyColor(bin.daysUntil) }]}>
                    <Text style={styles.daysNumber}>{bin.daysUntil}</Text>
                    <Text style={styles.daysLabel}>days</Text>
                  </View>
                </View>

                {/* Prediction Note */}
                <View style={styles.predictionNote}>
                  <Text style={styles.predictionIcon}>💡</Text>
                  <Text style={styles.predictionText}>{bin.prediction}</Text>
                </View>
              </View>
            ))}

            {/* Footer Note */}
            <View style={styles.footerNote}>
              <Text style={styles.footerIcon}>⚡</Text>
              <Text style={styles.footerText}>
                Predictions update daily based on your disposal activity. Time series models analyze historical patterns to forecast overflow dates.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 24,
    width: '94%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2E7D32',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  content: {
    flex: 1,
    minHeight: 100,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  binCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  binHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  binImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  binImage: {
    width: 45,
    height: 45,
  },
  binInfo: {
    flex: 1,
  },
  binName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  overflowSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  overflowDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overflowIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  overflowLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overflowDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  daysContainer: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 56,
  },
  daysNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  daysLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
  predictionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  predictionIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  predictionText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    flex: 1,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  footerIcon: {
    fontSize: 18,
    marginTop: 2,
    marginRight: 10,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
    lineHeight: 18,
  },
});

