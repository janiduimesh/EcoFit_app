import { getApiUrl } from '../utils/config';

export interface OverflowPredictionResponse {
  success: boolean;
  target_date?: string;
  predicted_distance_cm?: number;
  overflow_risk?: string;
  message: string;
  overflow_date?: string | null;
}

/**
 * Get overflow prediction for a bin.
 * GET /overflow/predict?bin_id=blue_bin
 */
export const getOverflowPredict = async (
  binId: string,
  targetDate?: string
): Promise<OverflowPredictionResponse> => {
  const params = new URLSearchParams({ bin_id: binId });
  if (targetDate) params.set('target_date', targetDate);
  const url = `${getApiUrl()}/overflow/predict?${params.toString()}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
};
