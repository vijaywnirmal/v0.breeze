export interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataRequest {
  api_key: string;
  api_secret: string;
  session_token: string;
  stock_code: string;
  exchange_code: string;
  interval: string;
  from_date: string;
  to_date: string;
  product_type?: string;
  expiry_date?: string;
  strike_price?: string;
  right?: string;
}

export interface ChartServiceResponse {
  success: boolean;
  data?: ChartData[];
  error?: string;
}

class ChartService {
  // Fetch historical data
  static async fetchHistoricalData(request: HistoricalDataRequest): Promise<ChartServiceResponse> {
    try {
      const response = await fetch('/api/historical_data', {
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
      
      if (result.success && result.data) {
        // Transform the data to match ChartData interface
        const transformedData: ChartData[] = result.data.map((item: any) => ({
          time: Math.floor(new Date(item.datetime).getTime() / 1000),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume) || 0,
        }));

        return {
          success: true,
          data: transformedData,
        };
      } else {
        return {
          success: false,
          error: result.message || 'Failed to fetch historical data',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Get default date range for different intervals
  static getDefaultDateRange(interval: string): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    
    let from: string;
    switch (interval) {
      case '1minute':
      case '5minute':
        // Last 7 days for intraday
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '30minute':
        // Last 30 days
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '1day':
        // Last 1 year
        from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    return { from, to };
  }

  // Format chart title
  static formatChartTitle(symbol: string, interval: string, isLive: boolean = false): string {
    const intervalText = interval.replace('minute', ' Min').replace('day', ' Day');
    const liveText = isLive ? ' (Live)' : '';
    return `${symbol} - ${intervalText}${liveText}`;
  }

  // Validate chart data
  static validateChartData(data: ChartData[]): boolean {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    return data.every(item => 
      typeof item.time === 'number' &&
      typeof item.open === 'number' &&
      typeof item.high === 'number' &&
      typeof item.low === 'number' &&
      typeof item.close === 'number' &&
      typeof item.volume === 'number' &&
      item.high >= Math.max(item.open, item.close) &&
      item.low <= Math.min(item.open, item.close)
    );
  }

  // Calculate basic statistics from chart data
  static calculateStats(data: ChartData[]) {
    if (data.length === 0) return null;

    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2] || currentPrice;
    const change = currentPrice - previousPrice;
    const changePercent = (change / previousPrice) * 100;
    
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    return {
      currentPrice,
      change,
      changePercent,
      high,
      low,
      avgVolume,
      dataPoints: data.length,
    };
  }

  // Get optimal chart height based on container
  static getOptimalHeight(containerHeight: number, showVolume: boolean = true): number {
    const minHeight = 300;
    const maxHeight = 800;
    const volumeOffset = showVolume ? 0 : 50;
    
    return Math.max(minHeight, Math.min(maxHeight, containerHeight - volumeOffset));
  }

  // Debounce function for chart updates
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
}

export default ChartService;
export type { ChartData, HistoricalDataRequest, ChartServiceResponse }; 