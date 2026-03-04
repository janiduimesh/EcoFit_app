import { getApiUrl } from '../utils/config';

export type ComplaintPriority = 'low' | 'medium' | 'high';

export interface ComplaintCreateRequest {
  lat: number;
  lng: number;

  wardId?: string;
  category?: string;
  description?: string;
  priority?: ComplaintPriority;

  userId?: string;
  contact?: string;

  status?: string; // optional
}

export interface ComplaintDoc {
  _id?: string;
  complaintId?: string;

  wardId?: string;
  category?: string;
  description?: string;
  priority?: string;
  status?: string;
  createdAt?: string;

  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };

  userId?: string;
  contact?: string;
}

export interface CreateComplaintResponse {
  success: boolean;
  message: string;
  data?: ComplaintDoc;
}

export interface LiveComplaintsResponse {
  success: boolean;
  count: number;
  data: ComplaintDoc[];
}

/**
 * POST /api/v1/complaints
 */
export const createComplaint = async (
  request: ComplaintCreateRequest
): Promise<CreateComplaintResponse> => {
  try {
    const response = await fetch(
      `${getApiUrl()}/complaints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${txt}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Create Complaint API error:', error);
    throw error;
  }
};

/**
 * GET /api/v1/complaints/live
 */
export const getLiveComplaints = async (params?: {
  hours?: number;
  wardId?: string;
  limit?: number;
}): Promise<LiveComplaintsResponse> => {
  try {
    const hours = params?.hours ?? 24;
    const limit = params?.limit ?? 2000;

    const query = new URLSearchParams();
    query.append('hours', String(hours));
    query.append('limit', String(limit));
    if (params?.wardId) query.append('wardId', params.wardId);

    const response = await fetch(
      `${getApiUrl()}/complaints/live?${query.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${txt}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Live Complaints API error:', error);
    throw error;
  }
};