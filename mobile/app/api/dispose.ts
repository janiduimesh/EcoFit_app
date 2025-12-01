import { getApiUrl } from '../utils/config';

export interface DisposeResponse {
  waste_type: string;
  bin_type: string;
  fit_status: string;
  confidence: number;
  tips: string[];
  message?: string;
}

export interface DisposeRequest {
  image_data?: string;
  description?: string;
  volume: number;
  input_method: 'image' | 'description';
}

/**
 * Dispose function to handle waste classification
 * @param request - The waste classification request
 * @returns Promise<DisposeResponse>
 */
export const dispose = async (request: DisposeRequest): Promise<DisposeResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/dispose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Dispose API error:', error);
    
    throw error;
  }
};

