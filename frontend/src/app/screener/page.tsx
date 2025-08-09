"use client";
import React from 'react';
import { useCredentialManager } from '../../context/CredentialManager';
import { fetchEodScreener, ScreenerResponse, ScreenerQuery, fetchIntradayScreener } from '../../services/marketApi';
import type { ScreenerItem } from '../../types/market';

export default function ScreenerPage() {
  const { credentials } = useCredentialManager();
  const [data, setData] = React.useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Default to only RELIND and TCS for initial testing
  const [query, setQuery] = React.useState<ScreenerQuery>({ limit: 50, offset: 0, min_change_pct: 1, sort_field: 'change_pct', sort_order: 'desc', symbols: 'RELIND,TCS' });

  const load = React.useCallback(async () => {
    if (!credentials?.sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      // If screener cache is empty on server (e.g., before EOD build), fall back to intraday page 1
      let resp = await fetchEodScreener(credentials.sessionToken, query);
      if (!resp.items || resp.items.length === 0) {
        resp = await fetchIntradayScreener(credentials.sessionToken, { page: 1, page_size: query.limit ?? 50, exchange: 'NSE' });
      }
      setData(resp);
    } catch (e: any) {
      setError(e?.message || 'Failed to load screener');
    } finally {
      setLoading(false);
    }
  }, [credentials?.sessionToken, query]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onChange = (patch: Partial<ScreenerQuery>) => setQuery((q) => ({ ...q, ...patch, offset: 0 }));

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">EOD Screener</h1>
        <div className="flex gap-2">
          <input type="number" className="px-3 py-2 rounded border bg-white dark:bg-gray-800 text-sm w-40" placeholder="Min % change" value={query.min_change_pct ?? ''} onChange={(e) => onChange({ min_change_pct: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <input type="number" className="px-3 py-2 rounded border bg-white dark:bg-gray-800 text-sm w-40" placeholder="Min volume" value={query.min_volume ?? ''} onChange={(e) => onChange({ min_volume: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded">Apply</button>
        </div>
      </div>
      {loading && <div className="text-gray-500 dark:text-gray-400">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && data && (
        <div className="overflow-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left p-2">Company</th>
                <th className="text-right p-2">Market price</th>
                <th className="text-right p-2">1D Δ</th>
                <th className="text-right p-2">1D Δ%</th>
                <th className="text-right p-2">Volume</th>
                <th className="text-right p-2">1W Vol Δ%</th>
                <th className="text-center p-2">52W Range</th>
                <th className="text-center p-2">Sparkline</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row: ScreenerItem, idx: number) => {
                const pct = row.change_pct ?? 0;
                const pos = pct >= 0;
                const low = row.fifty_two_week_low ?? null;
                const high = row.fifty_two_week_high ?? null;
                const price = row.close_price ?? null;
                let rangePct = null as number | null;
                if (low !== null && high !== null && price !== null && high > low) {
                  rangePct = ((price - low) / (high - low)) * 100;
                }
                const key = row.snapshot_id != null
                  ? `snap-${row.snapshot_id}`
                  : `${row.instrument?.short_name || 'inst'}-${row.snapshot_date || 'nodate'}-${idx}`;
                return (
                  <tr key={key} className="border-t">
                    <td className="p-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold">
                          {row.instrument.short_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{row.instrument.company_name}</span>
                          <span className="text-xs text-gray-500">{row.instrument.short_name} · {row.instrument.exchange_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right">{price !== null && price !== undefined ? formatNumber(price) : '—'}</td>
                    <td className={`p-2 text-right ${pos ? 'text-green-600' : 'text-red-600'}`}>{row.change_abs !== null && row.change_abs !== undefined ? row.change_abs.toFixed(2) : '—'}</td>
                    <td className={`p-2 text-right ${pos ? 'text-green-600' : 'text-red-600'}`}>{row.change_pct !== null && row.change_pct !== undefined ? row.change_pct.toFixed(2) + '%' : '—'}</td>
                    <td className="p-2 text-right">{row.volume ?? '—'}</td>
                    <td className={`p-2 text-right ${((row.week_volume_diff_pct ?? 0) >= 0) ? 'text-green-600' : 'text-red-600'}`}>{row.week_volume_diff_pct !== null && row.week_volume_diff_pct !== undefined ? row.week_volume_diff_pct.toFixed(2) + '%' : '—'}</td>
                    <td className="p-2">
                      {rangePct !== null ? (
                        <div className="w-40 h-2 bg-gray-200 dark:bg-gray-700 rounded relative">
                          <div className="absolute top-1/2 -translate-y-1/2 h-2 bg-blue-500 rounded" style={{ width: '2px', left: `${rangePct}%` }} />
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-2">
                      {row.sparkline_data && Array.isArray(row.sparkline_data.p) ? (
                        <div className="w-32 h-8">
                          <MiniSparkline values={row.sparkline_data.p} positive={pos} />
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data && (
        <div className="flex items-center justify-between py-4 text-sm">
          <div className="text-gray-600 dark:text-gray-300">{data.total} results</div>
          <div className="flex items-center gap-2">
            <button disabled={query.offset === 0} onClick={() => setQuery((q) => ({ ...q, offset: Math.max(0, (q.offset ?? 0) - (q.limit ?? 50)) }))} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <button disabled={(query.offset ?? 0) + (query.limit ?? 50) >= data.total} onClick={() => setQuery((q) => ({ ...q, offset: (q.offset ?? 0) + (q.limit ?? 50) }))} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!values || values.length < 2) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    ctx.strokeStyle = positive ? '#16a34a' : '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * (w - 2) + 1;
      const y = h - 1 - ((v - min) / range) * (h - 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [values, positive]);
  return <canvas ref={ref} width={128} height={32} className="w-full h-full" />;
}


