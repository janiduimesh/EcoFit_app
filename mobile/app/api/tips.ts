import { getApiUrl } from '../utils/config';

export interface TipsRequest {
  user_id: string;
  waste_type: string;
}

export interface TipsResponse {
  tip_id: string;
  technique: string;
  title: string;
  description: string;
  tip_workflow: string;
  message?: string;
}

export interface TipsFeedbackRequest {
  tip_id: string;
  user_id: string;
  feedback: 'like' | 'dislike';
}

export interface TipsFeedbackResponse {
  success: boolean;
  message: string;
}

/**
 * Get personalized disposal tips
 */
export const getTips = async (request: TipsRequest): Promise<TipsResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/dispose/tips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to get tips' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Tips API error:', error);
    throw error;
  }
};

/**
 * Submit feedback for a tip recommendation
 */
export const submitTipsFeedback = async (request: TipsFeedbackRequest): Promise<TipsFeedbackResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/dispose/tips/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to submit feedback' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Tips feedback API error:', error);
    throw error;
  }
};

