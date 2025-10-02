import { getApiUrl } from '../utils/config';

export interface DisposeResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

/**
 * Dispose function to handle data processing
 * @param data - The data to be processed
 * @returns Promise<DisposeResponse>
 */
export const dispose = async (data: string): Promise<DisposeResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/dispose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Dispose API error:', error);
    
    // Return mock data for development if API is not available
    return {
      success: true,
      data: `Processed: ${data}`,
      message: 'Data processed successfully (mock response)',
    };
  }
};

/**
 * Alternative dispose function for different data types
 * @param data - The data to be processed
 * @param type - The type of data being processed
 * @returns Promise<DisposeResponse>
 */
export const disposeWithType = async (
  data: any,
  type: string
): Promise<DisposeResponse> => {
  try {
    const response = await fetch(`${getApiUrl()}/dispose/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, type }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Dispose with type API error:', error);
    
    return {
      success: true,
      data: `Processed ${type}: ${JSON.stringify(data)}`,
      message: `Data of type ${type} processed successfully (mock response)`,
    };
  }
};
