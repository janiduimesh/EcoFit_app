import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';

import AdminReviewPortal from './Admin';
import ForecastScreen from './Forecast';
import PricingPortal from './Price';
import UserCreation from './user_Creation';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('review');

  const renderContent = () => {
    switch (activeTab) {
      case 'review':
        return <AdminReviewPortal />;
      case 'forecast':
        return <ForecastScreen />;
      case 'pricing':
        return <PricingPortal />;
      case 'users':
        return <UserCreation />;
      default:
        return <AdminReviewPortal />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#102a43" />

      {/* 1. Main Content Area */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>

      {/* 2. Custom Bottom Tab Bar */}
      <View style={styles.tabBar}>

        {/* Tab 1: Review (Default) */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('review')}
        >
          <View style={[styles.iconContainer, activeTab === 'review' && styles.activeIcon]}>
            <Text style={styles.tabIcon}>📋</Text>
          </View>
          <Text style={[styles.tabLabel, activeTab === 'review' && styles.activeLabel]}>
            Review
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Forecast */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('forecast')}
        >
          <View style={[styles.iconContainer, activeTab === 'forecast' && styles.activeIcon]}>
            <Text style={styles.tabIcon}>📈</Text>
          </View>
          <Text style={[styles.tabLabel, activeTab === 'forecast' && styles.activeLabel]}>
            Forecast
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Pricing */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('pricing')}
        >
           <View style={[styles.iconContainer, activeTab === 'pricing' && styles.activeIcon]}>
            <Text style={styles.tabIcon}>💰</Text>
          </View>
          <Text style={[styles.tabLabel, activeTab === 'pricing' && styles.activeLabel]}>
            Pricing
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Users */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('users')}
        >
           <View style={[styles.iconContainer, activeTab === 'users' && styles.activeIcon]}>
            <Text style={styles.tabIcon}>👤+</Text>
          </View>
          <Text style={[styles.tabLabel, activeTab === 'users' && styles.activeLabel]}>
            Create User
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  contentContainer: {
    flex: 1,

  },
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 85 : 70,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    padding: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  activeIcon: {
    backgroundColor: '#e3f2fd',
  },
  tabIcon: {
    fontSize: 22,
    color: '#333',
  },
  tabLabel: {
    fontSize: 10,
    color: '#829ab1',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  activeLabel: {
    color: '#102a43',
    fontWeight: 'bold',
  }
});

export default AdminPanel;