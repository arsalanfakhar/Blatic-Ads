import { DateRange } from './overviewService';

export function parseDateRange(searchParams: URLSearchParams): DateRange {
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  return { from, to };
}
