'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/clientApi';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

interface AdSetRow {
  id: string;
  name: string;
  status: string;
  optimizationGoal: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
}

interface CampaignDetail {
  id: string;
  metaCampaignId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string | null;
  bidStrategy: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  startTime: string | null;
  stopTime: string | null;
  adSets: AdSetRow[];
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch(`/api/campaigns/${id}`);
      const data = await res.json();
      if (data.ok) setCampaign(data.data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-primary-400">Campaign not found.</p>;
  }

  return (
    <div>
      <a href="/campaigns" className="mb-4 inline-block text-xs text-primary-400 hover:text-primary-600">
        ← Back to Campaigns
      </a>
      <h1 className="mb-2 text-2xl font-semibold text-primary-600">{campaign.name}</h1>
      <div className="mb-6 flex flex-wrap gap-3 text-xs text-primary-400">
        <span>Status: {campaign.effectiveStatus}</span>
        {campaign.objective && <span>Objective: {campaign.objective}</span>}
        {campaign.bidStrategy && <span>Bid: {campaign.bidStrategy}</span>}
        {campaign.dailyBudget != null && <span>Daily: {formatCurrency(campaign.dailyBudget)}</span>}
      </div>

      <h2 className="mb-3 text-sm font-medium text-primary-500">Ad Set Breakdown</h2>
      {campaign.adSets.length === 0 ? (
        <p className="text-xs text-primary-400">No ad sets with data in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-primary-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-xs font-medium text-primary-400">
                <th className="px-4 py-3">Ad Set</th>
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
              {campaign.adSets.map((as) => (
                <tr key={as.id} className="border-b border-primary-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary-600">{as.name}</p>
                    {as.optimizationGoal && (
                      <p className="text-xs text-primary-400">{as.optimizationGoal}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${
                      as.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-500'
                    }`}>
                      {as.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(as.spend)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(as.revenue)}</td>
                  <td className="px-4 py-3 text-right">{as.roas.toFixed(2)}x</td>
                  <td className="px-4 py-3 text-right">{formatPercent(as.ctr)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(as.cpc)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(as.purchases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
