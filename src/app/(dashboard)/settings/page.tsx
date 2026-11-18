'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';
import { timeAgo } from '@/lib/format';

interface MetaAccount {
  id: string;
  accountId: string;
  name: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

interface ShopifyConn {
  id: string;
  storeDomain: string;
  shopName: string | null;
  currency: string;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

interface SyncRun {
  id: string;
  source: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  itemCount: number;
  errorMessage: string | null;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [shopify, setShopify] = useState<ShopifyConn[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncRun[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [accRes, shopRes, syncRes] = await Promise.all([
      apiFetch('/api/settings/accounts'),
      apiFetch('/api/settings/shopify'),
      apiFetch('/api/sync/status'),
    ]);
    const [accData, shopData, syncData] = await Promise.all([
      accRes.json(),
      shopRes.json(),
      syncRes.json(),
    ]);
    if (accData.ok) setAccounts(accData.data);
    if (shopData.ok) setShopify(shopData.data);
    if (syncData.ok) setSyncHistory(syncData.data);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function triggerSync(source: 'meta' | 'shopify', full = false) {
    setSyncing(source);
    await apiFetch(`/api/sync/${source}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullSync: full }),
    });
    setSyncing(null);
    loadAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-primary-600">Settings</h1>

      {/* Meta Ad Accounts */}
      <section className="rounded-lg border border-primary-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-primary-600">Meta Ad Accounts</h2>
          <button
            onClick={() => triggerSync('meta')}
            disabled={syncing === 'meta'}
            className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {syncing === 'meta' ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-xs text-primary-400">
            No Meta accounts connected. Add account IDs and tokens via the API or environment variables.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded border border-primary-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-primary-600">{a.name}</p>
                  <p className="text-xs text-primary-400">ID: {a.accountId} · {a.currency}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-400'}`}>
                  {a.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shopify Connection */}
      <section className="rounded-lg border border-primary-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-primary-600">Shopify Store</h2>
          <button
            onClick={() => triggerSync('shopify')}
            disabled={syncing === 'shopify'}
            className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {syncing === 'shopify' ? 'Syncing…' : 'Sync Orders'}
          </button>
        </div>
        {shopify.length === 0 ? (
          <p className="text-xs text-primary-400">
            No Shopify store connected. Add your store domain and access token via the API.
          </p>
        ) : (
          <div className="space-y-2">
            {shopify.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border border-primary-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-primary-600">{s.shopName || s.storeDomain}</p>
                  <p className="text-xs text-primary-400">{s.storeDomain} · Last sync: {timeAgo(s.lastSyncAt)}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-400'}`}>
                  {s.isActive ? 'Connected' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sync History */}
      <section className="rounded-lg border border-primary-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-primary-600">Sync History</h2>
        {syncHistory.length === 0 ? (
          <p className="text-xs text-primary-400">No sync runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-primary-100 text-primary-400">
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2 text-right">Items</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((s) => (
                  <tr key={s.id} className="border-b border-primary-50">
                    <td className="px-3 py-2 font-medium">{s.source}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 ${
                        s.status === 'SUCCESS' ? 'bg-green-100 text-green-700'
                          : s.status === 'FAILED' ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-primary-500">{timeAgo(s.startedAt)}</td>
                    <td className="px-3 py-2 text-right">{s.itemCount}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-red-500">{s.errorMessage || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
