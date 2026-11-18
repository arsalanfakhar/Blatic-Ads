'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface KPIs {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  totalRevenue: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  avgRoas: number;
}

interface TrendPoint {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  clicks: number;
  impressions: number;
}

interface TrueRoas {
  totalAdSpend: number;
  shopifyRevenue: number;
  atlasRevenue: number | null;
  trueRoas: number;
  metaReportedRoas: number;
  revenueSource: 'atlas' | 'shopify';
}

interface Alert {
  adSetId: string;
  adSetName: string;
  campaignName: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
  spend: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [trueRoas, setTrueRoas] = useState<TrueRoas | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [kpiRes, trendRes, roasRes, alertRes] = await Promise.all([
        apiFetch('/api/insights/overview'),
        apiFetch('/api/insights/trends'),
        apiFetch('/api/insights/true-roas'),
        apiFetch('/api/alerts/budget-bleed'),
      ]);

      const [kpiData, trendData, roasData, alertData] = await Promise.all([
        kpiRes.json(),
        trendRes.json(),
        roasRes.json(),
        alertRes.json(),
      ]);

      if (kpiData.ok) setKpis(kpiData.data);
      if (trendData.ok) setTrends(trendData.data);
      if (roasData.ok) setTrueRoas(roasData.data);
      if (alertData.ok) setAlerts(alertData.data);
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
      <h1 className="mb-6 text-2xl font-semibold text-primary-600">Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Ad Spend" value={formatCurrency(kpis?.totalSpend)} />
        <KpiCard label="Revenue (Meta)" value={formatCurrency(kpis?.totalRevenue)} />
        <KpiCard
          label="True ROAS"
          value={trueRoas ? `${trueRoas.trueRoas.toFixed(2)}x` : '—'}
          subtitle={trueRoas ? `via ${trueRoas.revenueSource}` : undefined}
        />
        <KpiCard label="Avg CTR" value={formatPercent(kpis?.avgCtr)} />
        <KpiCard label="Avg CPC" value={formatCurrency(kpis?.avgCpc)} />
        <KpiCard label="Impressions" value={formatNumber(kpis?.totalImpressions)} />
        <KpiCard label="Clicks" value={formatNumber(kpis?.totalClicks)} />
        <KpiCard label="Purchases" value={formatNumber(kpis?.totalPurchases)} />
        <KpiCard label="Meta ROAS" value={kpis ? `${kpis.avgRoas.toFixed(2)}x` : '—'} />
        <KpiCard label="Avg CPM" value={formatCurrency(kpis?.avgCpm)} />
      </div>

      {/* Spend vs Revenue Trend */}
      {trends.length > 0 && (
        <div className="mb-8 rounded-lg border border-primary-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-medium text-primary-500">Spend vs Revenue (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  [formatCurrency(value), name === 'spend' ? 'Spend' : 'Revenue']
                }
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="spend" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Budget Bleed Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-primary-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-medium text-primary-500">
            Budget Bleed Alerts ({alerts.length})
          </h2>
          <div className="space-y-3">
            {alerts.slice(0, 10).map((a) => (
              <div
                key={a.adSetId}
                className="flex items-start gap-3 rounded-md border border-primary-100 p-3"
              >
                <SeverityBadge severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary-600">{a.adSetName}</p>
                  <p className="text-xs text-primary-400">{a.campaignName}</p>
                  <p className="mt-1 text-xs text-primary-500">{a.reason}</p>
                </div>
                <div className="text-right text-xs text-primary-500">
                  <p>Spend: {formatCurrency(a.spend)}</p>
                  <p>ROAS: {a.roas.toFixed(2)}x</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!kpis?.totalSpend && !loading && (
        <p className="mt-4 text-sm text-primary-400">
          No data yet. Connect your Meta ad accounts and run a sync in Settings.
        </p>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-primary-200 bg-white p-4">
      <p className="text-xs font-medium text-primary-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-primary-600">{value}</p>
      {subtitle && <p className="text-xs text-primary-400">{subtitle}</p>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}
