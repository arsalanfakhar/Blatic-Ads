'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';
import { formatCurrency, formatPercent } from '@/lib/format';

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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch('/api/alerts/budget-bleed');
      const data = await res.json();
      if (data.ok) setAlerts(data.data);
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
      <h1 className="mb-6 text-2xl font-semibold text-primary-600">Budget Bleed Alerts</h1>

      {alerts.length === 0 ? (
        <div className="rounded-lg border border-primary-200 bg-white p-8 text-center">
          <p className="text-sm text-primary-500">No budget bleed detected. Your campaigns are performing well.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => (
            <div
              key={a.adSetId}
              className="rounded-lg border border-primary-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <h3 className="text-sm font-medium text-primary-600">{a.adSetName}</h3>
                  </div>
                  <p className="mt-1 text-xs text-primary-400">Campaign: {a.campaignName}</p>
                  <p className="mt-2 text-sm text-primary-500">{a.reason}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 rounded bg-primary-50 p-3">
                <Metric label="Spend" value={formatCurrency(a.spend)} />
                <Metric label="ROAS" value={`${a.roas.toFixed(2)}x`} warn={a.roas < 1} />
                <Metric label="CTR" value={formatPercent(a.ctr)} warn={a.ctr < 0.5} />
                <Metric label="CPC" value={formatCurrency(a.cpc)} />
              </div>
            </div>
          ))}
        </div>
      )}
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
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-primary-400">{label}</p>
      <p className={`text-sm font-medium ${warn ? 'text-red-600' : 'text-primary-600'}`}>
        {value}
      </p>
    </div>
  );
}
