import axios, { AxiosInstance } from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || ""; // use Next.js rewrite when empty

// Shared axios instance with baseURL and request id header
let httpClient: AxiosInstance | null = null;
export function getHttpClient(): AxiosInstance {
  if (httpClient) return httpClient;
  const base = API_URL || '';
  httpClient = axios.create({ baseURL: base || undefined, withCredentials: false });
  httpClient.interceptors.request.use((config) => {
    const rid = Math.random().toString(36).slice(2);
    (config.headers as Record<string, string>)["X-Request-ID"] = rid;
    return config;
  });
  return httpClient;
}

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
  if (!API_URL && typeof window === 'undefined') throw new Error('API URL is not set');
  try {
    const client = getHttpClient();
    const response = await client.get(
      `/api/account/details`,
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
