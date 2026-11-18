'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/clientApi';
import { formatCurrency, formatPercent } from '@/lib/format';

interface Creative {
  id: string;
  metaCreativeId: string;
  name: string | null;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  tags: string[];
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
}

type SortKey = 'spend' | 'roas' | 'ctr' | 'cpc';

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('spend');

  useEffect(() => {
    async function load() {
      const res = await apiFetch('/api/creatives');
      const data = await res.json();
      if (data.ok) setCreatives(data.data);
      setLoading(false);
    }
    load();
  }, []);

  const sorted = [...creatives].sort((a, b) => b[sortBy] - a[sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary-600">Creatives</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary-400">Sort by:</span>
          {(['spend', 'roas', 'ctr', 'cpc'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                sortBy === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-primary-100 text-primary-500 hover:bg-primary-200'
              }`}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-primary-400">
          No creatives synced yet. Run a Meta sync from Settings.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => (
            <a
              key={c.id}
              href={`/creatives/${c.id}`}
              className="group rounded-lg border border-primary-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              {(c.thumbnailUrl || c.imageUrl) && (
                <div className="mb-3 aspect-video overflow-hidden rounded bg-primary-50">
                  <img
                    src={c.thumbnailUrl || c.imageUrl || ''}
                    alt={c.name || 'Creative'}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <p className="text-sm font-medium text-primary-600 group-hover:underline">
                {c.name || c.title || `Creative ${c.metaCreativeId}`}
              </p>
              {c.body && (
                <p className="mt-1 line-clamp-2 text-xs text-primary-400">{c.body}</p>
              )}
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-500"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Stat label="Spend" value={formatCurrency(c.spend)} />
                <Stat label="ROAS" value={`${c.roas.toFixed(2)}x`} />
                <Stat label="CTR" value={formatPercent(c.ctr)} />
                <Stat label="CPC" value={formatCurrency(c.cpc)} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-primary-400">{label}</p>
      <p className="text-xs font-medium text-primary-600">{value}</p>
    </div>
  );
}
