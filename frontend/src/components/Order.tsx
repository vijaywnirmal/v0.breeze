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

interface OrderProps {
  userData: UserData;
}

const Order: React.FC<OrderProps> = ({ userData }) => (
  <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
    <h2 className="text-lg font-semibold mb-2">Place Order</h2>
    <div className="text-gray-500 text-sm mb-2">Place buy/sell orders for stocks/options/futures.</div>
    {/* TODO: Add form for order placement */}
    <div className="text-gray-400">(Form coming soon)</div>
  </div>
);

export default Order; 