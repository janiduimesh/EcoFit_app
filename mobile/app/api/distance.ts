import { getApiUrl } from '../utils/config';

export interface DistanceRequest {
  volume: number;
}

export interface DistanceResponse {
  status: string;
  distance_cm?: number;
  bin_volume_ml?: number;
  bin_volume_liters?: number;
  waste_volume_ml: number;
  fit_status: 'fits' | 'partial_fit' | 'does_not_fit';
  message?: string;
}

/**
 * @param request 
 * @returns 
 */
export const checkDistance = async (request: DistanceRequest): Promise<DistanceResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/check-distance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Distance check failed' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Distance check API error:', error);
    throw error;
  }
};

