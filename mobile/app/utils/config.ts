import axios from 'axios';

export const API_URL = 'http://192.168.8.108:8000/api/v2';

export const getApiUrl = () => {
  return API_URL;
};


const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

export default api;


export const APP_CONFIG = {
  name: 'EcoFit',
  version: '1.0.0',
  apiUrl: API_URL,
  timeout: 10000,
  retryAttempts: 3,
};

export const API_ENDPOINTS = {
  dispose: '/dispose',
  health: '/health',
  user: '/user',
  fitness: '/fitness',
  eco: '/eco',
};

export const ENV = {
  isDevelopment: __DEV__,
  isProduction: !__DEV__,
  nodeEnv: process.env.NODE_ENV || 'development',
};

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

export const DIMENSIONS = {
  padding: 20,
  margin: 15,
  borderRadius: 8,
  buttonHeight: 50,
  inputHeight: 45,
};

export const FONT_SIZES = {
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
  xxlarge: 28,
};