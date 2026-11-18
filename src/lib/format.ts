export function timeAgo(date: Date | string | null): string {
  if (!date) return 'Never synced';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0';
  return n.toLocaleString();
}

export function formatCurrency(n: number | undefined | null): string {
  if (n === undefined || n === null) return 'Rs 0';
  return `Rs ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPercent(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0%';
  return `${n.toFixed(2)}%`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
