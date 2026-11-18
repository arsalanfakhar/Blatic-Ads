function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const from = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?from=${from}`;
  }
}

const networkErrResponse = () =>
  new Response(JSON.stringify({ ok: false, error: 'network error' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    return networkErrResponse();
  }
  if (res.status === 401) {
    redirectToLogin();
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    const msg = !res.ok
      ? res.status === 504 ? 'Request timed out — please try again'
        : res.status === 502 || res.status === 503 ? 'Server temporarily unavailable — please try again'
        : `Server error (${res.status}) — please try again`
      : 'Unexpected server response — please try again';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: res.ok ? 200 : res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return res;
}
