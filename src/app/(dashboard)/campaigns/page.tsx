'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

interface Campaign {
  id: string;
  metaCampaignId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch('/api/campaigns');
      const data = await res.json();
      if (data.ok) setCampaigns(data.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-primary-600">Campaigns</h1>

      {campaigns.length === 0 ? (
        <p className="text-sm text-primary-400">
          No campaigns synced yet. Run a Meta sync from Settings.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-primary-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-xs font-medium text-primary-400">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">ROAS</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">CPC</th>
                <th className="px-4 py-3 text-right">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-primary-50 hover:bg-primary-50">
                  <td className="px-4 py-3">
                    <a
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-primary-600 hover:underline"
                    >
                      {c.name}
                    </a>
                    {c.objective && (
                      <p className="text-xs text-primary-400">{c.objective}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.effectiveStatus} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.spend)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.revenue)}</td>
                  <td className="px-4 py-3 text-right">{c.roas.toFixed(2)}x</td>
                  <td className="px-4 py-3 text-right">{formatPercent(c.ctr)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.cpc)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(c.purchases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-500'
      }`}
    >
      {status}
    </span>
  );
}
