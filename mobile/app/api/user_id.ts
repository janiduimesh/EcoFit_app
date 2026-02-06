import {API_URL} from '../utils/config';
import axios from 'axios';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchNextCollectorId = async (location: string) => {
  try {
    console.log(`Fetching ID for ${location} from ${API_URL}/auth/next-id`);
    const response = await api.get(`/auth/next-id`, {
        params: { location }
    });
    return response.data.next_id;
  } catch (error: any) {

    if (error.response) {

      console.error("Server Error:", error.response.status, error.response.data);
    } else if (error.request) {

      console.error("Network Error: No response received. Check API_URL.");
    } else {
      console.error("Error Message:", error.message);
    }
    return "01";
  }
};

export default api;