import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metaApiFetch, metaApiFetchPaginated, MetaApiError } from '../metaApiClient';

const ok = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body });
const fail = (code: number, message = 'err') => ({
  ok: false,
  status: 400,
  headers: new Headers(),
  json: async () => ({ error: { message, code, type: 'OAuthException' } }),
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('META_ACCESS_TOKEN', 'test-token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function run<T>(p: Promise<T>): Promise<T> {
  const settled = p.then(
    (v) => ({ v }),
    (e) => ({ e })
  );
  await vi.runAllTimersAsync();
  const r = (await settled) as { v?: T; e?: unknown };
  if ('e' in r) throw r.e;
  return r.v as T;
}

describe('metaApiFetch retries', () => {
  it('retries a network failure and then succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('aborted')).mockResolvedValueOnce(ok({ data: [1] }));
    expect(await run(metaApiFetch('/x'))).toEqual({ data: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries Meta temporary errors (code 1)', async () => {
    fetchMock.mockResolvedValueOnce(fail(1, 'unknown error')).mockResolvedValueOnce(ok({ data: [] }));
    await run(metaApiFetch('/x'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry rate-limit errors', async () => {
    fetchMock.mockResolvedValue(fail(17, 'User request limit reached'));
    await expect(run(metaApiFetch('/x'))).rejects.toBeInstanceOf(MetaApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after three attempts', async () => {
    fetchMock.mockRejectedValue(new Error('aborted'));
    await expect(run(metaApiFetch('/x'))).rejects.toThrow('aborted');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('metaApiFetchPaginated', () => {
  it('follows cursors until there is no next page', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ data: [1, 2], paging: { cursors: { after: 'c1' }, next: 'u' } }))
      .mockResolvedValueOnce(ok({ data: [3] }));
    expect(await run(metaApiFetchPaginated('/x'))).toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[1][0]).toContain('after=c1');
  });

  it('lets callers override the default page size', async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    await run(metaApiFetchPaginated('/x', { limit: '100' }));
    expect(fetchMock.mock.calls[0][0]).toContain('limit=100');
  });
});
