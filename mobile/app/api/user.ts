import { getApiUrl } from '../utils/config';

export interface UserRegisterRequest {
  name: string;
  email: string;
  password: string;
  address?: string;
}

export interface UserRegisterResponse {
  message: string;
  user_id?: string;
  email: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  message: string;
  token?: string | null;
  user_id?: string;
}

/**
 * Register a new user
 * @param request - User registration data
 * @returns Promise<UserRegisterResponse>
 */
export const registerUser = async (request: UserRegisterRequest): Promise<UserRegisterResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/user/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('User registration API error:', error);
    throw error;
  }
};

/**
 * Login a user
 * @param request - User login data (email and password)
 * @returns Promise<UserLoginResponse>
 */
export const loginUser = async (request: UserLoginRequest): Promise<UserLoginResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('User login API error:', error);
    throw error;
  }
};

