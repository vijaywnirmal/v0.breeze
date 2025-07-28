import React, { useState } from 'react';
import DashboardWidget from './DashboardWidget';
import ChartWrapper from './ChartWrapper';
import ChartService from '../services/chartService';

interface Credentials {
  api_key: string;
  api_secret: string;
  session_token: string;
}

interface UserData {
  user_name: string;
  userid: string;
  funds: any;
  credentials: Credentials;
}

interface DashboardProps {
  userData: UserData;
}

const Dashboard: React.FC<DashboardProps> = ({ userData }) => {
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [selectedInterval, setSelectedInterval] = useState('1minute');

  const watchlistSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
  const portfolioSymbols = ['ICICIBANK', 'SBIN', 'WIPRO'];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white shadow p-6 rounded">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome, {userData.user_name}!</h2>
        <p className="text-gray-600">Your trading dashboard with reusable chart components</p>
      </div>

      {/* Main Chart Section */}
      <div className="bg-white shadow p-6 rounded">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Main Chart</h3>
          <div className="flex items-center space-x-4">
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="RELIANCE">RELIANCE</option>
              <option value="TCS">TCS</option>
              <option value="INFY">INFY</option>
              <option value="HDFCBANK">HDFCBANK</option>
            </select>
            <select
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="1minute">1 Min</option>
              <option value="5minute">5 Min</option>
              <option value="30minute">30 Min</option>
              <option value="1day">1 Day</option>
            </select>
          </div>
        </div>
        
        <ChartWrapper
          isLive={true}
          userData={userData}
          symbol={selectedSymbol}
          exchange="NSE"
          interval={selectedInterval}
          height={400}
          title={ChartService.formatChartTitle(selectedSymbol, selectedInterval, true)}
          showControls={true}
        />
      </div>

      {/* Watchlist Widgets */}
      <div className="bg-white shadow p-6 rounded">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Watchlist</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {watchlistSymbols.map((symbol) => (
            <DashboardWidget
              key={symbol}
              userData={userData}
              symbol={symbol}
              exchange="NSE"
              interval="1minute"
              isLive={true}
              widgetType="watchlist"
              height={250}
            />
          ))}
        </div>
      </div>

      {/* Portfolio Widgets */}
      <div className="bg-white shadow p-6 rounded">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolioSymbols.map((symbol) => (
            <DashboardWidget
              key={symbol}
              userData={userData}
              symbol={symbol}
              exchange="NSE"
              interval="1day"
              isLive={false}
              widgetType="portfolio"
              height={250}
            />
          ))}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="bg-white shadow p-6 rounded">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Chart Usage Examples</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Example 1: Simple Historical Chart */}
          <div className="border border-gray-200 rounded p-4">
            <h4 className="font-medium text-gray-800 mb-2">Historical Chart</h4>
            <p className="text-sm text-gray-600 mb-3">Basic historical data chart</p>
            <ChartWrapper
              data={[]} // Empty data will show placeholder
              symbol="RELIANCE"
              interval="1day"
              height={200}
              title="RELIANCE - 1 Day"
              showControls={false}
            />
          </div>

          {/* Example 2: Live Chart with Controls */}
          <div className="border border-gray-200 rounded p-4">
            <h4 className="font-medium text-gray-800 mb-2">Live Chart</h4>
            <p className="text-sm text-gray-600 mb-3">Real-time streaming chart</p>
            <ChartWrapper
              isLive={true}
              userData={userData}
              symbol="TCS"
              exchange="NSE"
              interval="1minute"
              height={200}
              title="TCS - 1 Min (Live)"
              showControls={true}
            />
          </div>

          {/* Example 3: Compact Widget */}
          <div className="border border-gray-200 rounded p-4">
            <h4 className="font-medium text-gray-800 mb-2">Compact Widget</h4>
            <p className="text-sm text-gray-600 mb-3">Small chart widget for dashboards</p>
            <DashboardWidget
              userData={userData}
              symbol="INFY"
              exchange="NSE"
              interval="5minute"
              isLive={true}
              widgetType="analysis"
              height={150}
            />
          </div>

          {/* Example 4: Portfolio Widget */}
          <div className="border border-gray-200 rounded p-4">
            <h4 className="font-medium text-gray-800 mb-2">Portfolio Widget</h4>
            <p className="text-sm text-gray-600 mb-3">Historical data with stats</p>
            <DashboardWidget
              userData={userData}
              symbol="HDFCBANK"
              exchange="NSE"
              interval="1day"
              isLive={false}
              widgetType="portfolio"
              height={150}
            />
          </div>
        </div>
      </div>

      {/* Usage Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">How to Use Charts Anywhere</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-700 mb-2">ChartWrapper Component</h4>
            <div className="text-sm text-blue-600 space-y-1">
              <div>• Use for both historical and live charts</div>
              <div>• Supports all chart types and intervals</div>
              <div>• Built-in error handling and loading states</div>
              <div>• Customizable height, controls, and styling</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-blue-700 mb-2">DashboardWidget Component</h4>
            <div className="text-sm text-blue-600 space-y-1">
              <div>• Pre-built widgets for common use cases</div>
              <div>• Automatic data fetching and stats calculation</div>
              <div>• Different styles for watchlist, portfolio, analysis</div>
              <div>• Compact design for dashboard layouts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 