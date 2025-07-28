import React, { useState } from 'react';

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

interface FundsProps {
  userData: UserData;
  setUserData: (userData: UserData) => void;
}

const Funds: React.FC<FundsProps> = ({ userData, setUserData }) => {
  const [segment, setSegment] = useState('equity');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'allocate' | 'unallocate'>('allocate');
  const [message, setMessage] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);

  const handleFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const endpoint = action === 'allocate' ? '/api/allocate_funds' : '/api/unallocate_funds';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData.credentials,
          segment,
          amount: Number(amount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsgType('success');
        setMessage(data.message || 'Success');
        // Optionally update funds in dashboard
        const fundsRes = await fetch('/api/funds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData.credentials),
        });
        const fundsData = await fundsRes.json();
        if (fundsData.success) setUserData({ ...userData, funds: fundsData.funds });
      } else {
        setMsgType('error');
        setMessage(data.message || 'Error');
      }
    } catch (err) {
      setMsgType('error');
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
      <h2 className="text-lg font-semibold mb-2">Funds Management</h2>
      <form onSubmit={handleFunds} className="flex flex-col gap-2">
        <label>
          Segment:
          <select className="border p-2 rounded w-full" value={segment} onChange={e => setSegment(e.target.value)}>
            <option value="equity">Equity</option>
            <option value="fno">FNO</option>
            <option value="commodity">Commodity</option>
          </select>
        </label>
        <label>
          Amount:
          <input
            className="border p-2 rounded w-full"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className={action==='allocate' ? 'bg-blue-600 text-white rounded p-2 font-semibold flex-1' : 'border rounded p-2 flex-1'}
            onClick={()=>setAction('allocate')}
          >Allocate</button>
          <button
            type="button"
            className={action==='unallocate' ? 'bg-blue-600 text-white rounded p-2 font-semibold flex-1' : 'border rounded p-2 flex-1'}
            onClick={()=>setAction('unallocate')}
          >Unallocate</button>
        </div>
        <button
          type="submit"
          className="bg-green-600 text-white rounded p-2 font-semibold mt-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? (action==='allocate' ? 'Allocating...' : 'Unallocating...') : (action==='allocate' ? 'Allocate Funds' : 'Unallocate Funds')}
        </button>
      </form>
      {message && <div className={msgType==='success' ? 'text-green-600' : 'text-red-600'}>{message}</div>}
    </div>
  );
};

export default Funds; 