import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { TipsResponse, submitTipsFeedback } from '../api/tips';

interface TipsModalProps {
  visible: boolean;
  onClose: () => void;
  tips: TipsResponse | null;
  userId: string;
  isLoading: boolean;
}

export default function TipsModal({
  visible,
  onClose,
  tips,
  userId,
  isLoading,
}: TipsModalProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleFeedback = async (feedback: 'like' | 'dislike') => {
    if (!tips || feedbackSubmitted) return;

    setSubmittingFeedback(true);
    try {
      await submitTipsFeedback({
        tip_id: tips.tip_id,
        user_id: userId,
        feedback,
      });
      setFeedbackSubmitted(true);
      Alert.alert('Thank you!', 'Your feedback has been recorded.');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleClose = () => {
    setFeedbackSubmitted(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Disposal Recommendation</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Getting personalized tips...</Text>
            </View>
          ) : tips ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Tips List */}
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Disposal Tips:</Text>
                {tips.tips && tips.tips.length > 0 ? (
                  tips.tips.map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <Text style={styles.tipBullet}>•</Text>
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTipsText}>No specific tips available.</Text>
                )}
              </View>

              {/* Feedback Section */}
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackTitle}>Was this helpful?</Text>
                <View style={styles.feedbackButtons}>
                  <TouchableOpacity
                    style={[
                      styles.feedbackButton,
                      styles.likeButton,
                      feedbackSubmitted && styles.feedbackButtonDisabled,
                    ]}
                    onPress={() => handleFeedback('like')}
                    disabled={feedbackSubmitted || submittingFeedback}
                  >
                    {submittingFeedback ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.feedbackEmoji}>👍</Text>
                        <Text style={styles.feedbackButtonText}>Like</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.feedbackButton,
                      styles.dislikeButton,
                      feedbackSubmitted && styles.feedbackButtonDisabled,
                    ]}
                    onPress={() => handleFeedback('dislike')}
                    disabled={feedbackSubmitted || submittingFeedback}
                  >
                    {submittingFeedback ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.feedbackEmoji}>👎</Text>
                        <Text style={styles.feedbackButtonText}>Dislike</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {feedbackSubmitted && (
                  <Text style={styles.feedbackThanks}>Thanks for your feedback!</Text>
                )}
              </View>

              {/* Tip ID */}
              <Text style={styles.tipId}>Recommendation ID: {tips.tip_id}</Text>
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load tips</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  tipsContainer: {
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 16,
  },
  tipBullet: {
    fontSize: 16,
    color: '#2E7D32',
    marginRight: 8,
    fontWeight: 'bold',
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  noTipsText: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
  },
  feedbackSection: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 100,
    justifyContent: 'center',
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },
  dislikeButton: {
    backgroundColor: '#F44336',
  },
  feedbackButtonDisabled: {
    opacity: 0.5,
  },
  feedbackEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  feedbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  feedbackThanks: {
    marginTop: 16,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  tipId: {
    marginTop: 20,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
  },
});

