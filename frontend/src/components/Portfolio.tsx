import React from 'react';

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

interface PortfolioProps {
  userData: UserData;
}

const Portfolio: React.FC<PortfolioProps> = ({ userData }) => (
  <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
    <h2 className="text-lg font-semibold mb-2">Portfolio</h2>
    <div className="text-gray-500 text-sm mb-2">View holdings and positions.</div>
    {/* TODO: Add tables for holdings and positions */}
    <div className="text-gray-400">(Tables coming soon)</div>
  </div>
);

export default Portfolio; 