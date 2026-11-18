const API_VERSION = '2024-01';

interface ShopifyConfig {
  domain: string;
  accessToken: string;
}

function getConfig(): ShopifyConfig {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!domain || !accessToken) {
    throw new Error('SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN must be set.');
  }
  return { domain, accessToken };
}

export function isShopifyConfigured(): boolean {
  return !!(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);
}

export async function shopifyFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const { domain, accessToken } = getConfig();
  const url = new URL(`https://${domain}/admin/api/${API_VERSION}/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function shopifyFetchPaginated<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T[]> {
  const results: T[] = [];
  const { domain, accessToken } = getConfig();
  let url: string | null = `https://${domain}/admin/api/${API_VERSION}/${endpoint}`;

  const searchParams = new URLSearchParams(params);
  if (!searchParams.has('limit')) searchParams.set('limit', '250');

  url = `${url}?${searchParams.toString()}`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Shopify API ${res.status}: ${body}`);
    }

    const data = await res.json();
    const key = Object.keys(data)[0];
    if (key && Array.isArray(data[key])) {
      results.push(...data[key]);
    }

    const linkHeader = res.headers.get('link');
    url = parseLinkNext(linkHeader);
  }

  return results;
}

function parseLinkNext(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}
