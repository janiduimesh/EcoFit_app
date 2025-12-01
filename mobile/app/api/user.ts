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

export interface UserProfileUpdateRequest {
  waste_amount?: string;
  has_recycling_bin?: boolean;
  has_compost_bin?: boolean;
  has_weekly_collection?: boolean;
  residence_type?: string;
  household_size?: string;
  onboarding_completed?: boolean;
}

export interface UserProfileUpdateResponse {
  message: string;
  success: boolean;
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

/**
 * Update user profile information
 * @param userId - User ID
 * @param profileData - Profile data to update
 * @returns Promise<UserProfileUpdateResponse>
 */
export const updateUserProfile = async (
  userId: string,
  profileData: UserProfileUpdateRequest
): Promise<UserProfileUpdateResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/user/${userId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Update failed' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('User profile update API error:', error);
    throw error;
  }
};

