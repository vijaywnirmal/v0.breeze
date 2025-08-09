import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type BrokerCredentials = {
  apiKey: string;
  apiSecret: string;
  sessionToken: string;
};

export type AccountDetails = {
  name: string;
  accountId: string;
  balance: number;
  holdings: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
  }>;
  // Add more fields as needed
};

// Fetch account details using the session token
export async function fetchAccountDetails(sessionToken: string): Promise<AccountDetails> {
  if (!API_URL) throw new Error('API URL is not set');
  try {
    const response = await axios.get(
      `${API_URL}/account/details`,
      {
        params: { api_session: sessionToken },
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: false,
      }
    );
    return response.data as AccountDetails;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.detail || 'Failed to fetch account details');
    }
    throw new Error('Network error or server unavailable');
  }
}
