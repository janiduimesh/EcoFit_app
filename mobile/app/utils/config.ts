// Get API URL from environment variables or use default
// Completely avoid expo-constants during initial load to prevent TurboModuleRegistry errors
export const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Function to get the API URL from expo config when available
export const getApiUrl = () => {
  // For now, just return the default API URL to avoid expo-constants issues
  // This can be enhanced later when the app is stable
  return API_URL;
};

// App configuration
export const APP_CONFIG = {
  name: 'EcoFit',
  version: '1.0.0',
  apiUrl: getApiUrl(),
  timeout: 10000, // 10 seconds
  retryAttempts: 3,
};

// API endpoints
export const API_ENDPOINTS = {
  dispose: '/dispose',
  health: '/health',
  user: '/user',
  fitness: '/fitness',
  eco: '/eco',
};

// Environment configuration
export const ENV = {
  isDevelopment: __DEV__,
  isProduction: !__DEV__,
  nodeEnv: process.env.NODE_ENV || 'development',
};

// App colors
export const COLORS = {
  primary: '#4CAF50',
  secondary: '#2E7D32',
  accent: '#8BC34A',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  error: '#F44336',
  warning: '#FF9800',
  success: '#4CAF50',
  info: '#2196F3',
};

// App dimensions
export const DIMENSIONS = {
  padding: 20,
  margin: 15,
  borderRadius: 8,
  buttonHeight: 50,
  inputHeight: 45,
};

// Font sizes
export const FONT_SIZES = {
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
  xxlarge: 28,
};

// API configuration
export const API_CONFIG = {
  baseURL: getApiUrl(),
  timeout: APP_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};
