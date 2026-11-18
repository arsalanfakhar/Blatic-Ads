const META_API_VERSION = 'v22.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const TRANSIENT_CODES = [1, 2];
const RATE_LIMIT_THRESHOLD = 75;

interface MetaErrorResponse {
  error: { message: string; type: string; code: number; fbtrace_id?: string };
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly fbtraceId?: string
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_ACCESS_TOKEN is not set');
  return token;
}

function checkRateLimit(headers: Headers): void {
  const usage = headers.get('x-business-use-case-usage');
  if (!usage) return;

  try {
    const parsed = JSON.parse(usage);
    for (const accountUsages of Object.values(parsed) as Array<
      Array<{ call_count: number; total_cputime: number; total_time: number }>
    >) {
      for (const u of accountUsages) {
        if (
          u.call_count >= RATE_LIMIT_THRESHOLD ||
          u.total_cputime >= RATE_LIMIT_THRESHOLD ||
          u.total_time >= RATE_LIMIT_THRESHOLD
        ) {
          throw new MetaApiError(
            `Meta API rate limit approaching: call_count=${u.call_count}%, cpu=${u.total_cputime}%, time=${u.total_time}%`,
            429
          );
        }
      }
    }
  } catch (e) {
    if (e instanceof MetaApiError) throw e;
  }
}

export async function metaApiFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${META_BASE}${endpoint}`);
  url.searchParams.set('access_token', getAccessToken());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      checkRateLimit(res.headers);

      if (!res.ok) {
        const body = (await res.json()) as MetaErrorResponse;
        throw new MetaApiError(
          body.error?.message ?? `HTTP ${res.status}`,
          body.error?.code ?? res.status,
          body.error?.fbtrace_id
        );
      }

      return (await res.json()) as T;
    } catch (e) {
      // Timeouts, network drops and Meta's temporary error codes (1, 2) are worth retrying;
      // rate limits and real API errors are not.
      const transient = !(e instanceof MetaApiError) || TRANSIENT_CODES.includes(e.code);
      if (!transient || attempt >= MAX_ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
}

interface MetaPaginatedResponse<T> {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export const ACTIVE_ONLY_FILTER = JSON.stringify([
  { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] },
]);

export async function metaApiFetchPaginated<T>(
  endpoint: string,
  params?: Record<string, string>,
  maxPages = 50
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const p: Record<string, string> = { limit: '500', ...params };
    if (after) p.after = after;

    const res = await metaApiFetch<MetaPaginatedResponse<T>>(endpoint, p);
    all.push(...res.data);

    after = res.paging?.cursors?.after;
    if (!after || !res.paging?.next) break;
  }

  return all;
}
