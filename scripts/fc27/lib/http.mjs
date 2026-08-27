/**
 * Polite HTTP helper for the FC27 pipeline.
 *
 * Everything here is deliberately conservative: one request at a time, a
 * fixed delay between pages, capped exponential backoff on transient
 * failures, and no attempt whatsoever to work around a 401/403. If a source
 * says "not without credentials", that is a final answer for this pipeline —
 * see docs/fc27/README.md § Ethics.
 */

/** Errors that mean "the server refused us", not "the network hiccupped". */
export class AccessDeniedError extends Error {
  constructor(url, status) {
    super(`Access denied (HTTP ${status}) for ${url} — not retried by design.`);
    this.name = 'AccessDeniedError';
    this.status = status;
  }
}

export class EgressBlockedError extends Error {
  constructor(url, cause) {
    super(`Network egress blocked for ${url}: ${cause}`);
    this.name = 'EgressBlockedError';
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a URL and parse JSON, with retry/backoff on transient failures only.
 *
 * Retries: 429, 5xx, and network errors. Backoff honours `Retry-After` when
 * the server sends one. Never retries 401/403/404 — those are answers.
 *
 * @param {string} url
 * @param {{ headers?: Record<string,string>, retries?: number, timeoutMs?: number }} opts
 * @returns {Promise<any>} parsed JSON body
 */
export async function getJson(url, opts = {}) {
  const { headers = {}, retries = 4, timeoutMs = 30_000 } = opts;
  let attempt = 0;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new AccessDeniedError(url, res.status);
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt >= retries) {
          throw new Error(`HTTP ${res.status} for ${url} after ${retries} retries`);
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2 ** attempt * 2000, 30_000);
        attempt += 1;
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (err instanceof AccessDeniedError) throw err;

      // Node surfaces proxy/DNS refusals as a generic TypeError with a cause.
      const cause = String(err?.cause?.code || err?.cause?.message || '');
      if (/ENOTFOUND|ECONNREFUSED|EPROXY|403/.test(cause)) {
        throw new EgressBlockedError(url, cause);
      }

      if (attempt >= retries) throw err;
      attempt += 1;
      await sleep(Math.min(2 ** attempt * 2000, 30_000));
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Reachability probe. Resolves to a plain result object rather than throwing,
 * so discover_sources.mjs can report on every candidate in one pass.
 * @param {string} url
 * @returns {Promise<{ url: string, ok: boolean, status: number | null, error: string | null }>}
 */
export async function probe(url, opts = {}) {
  const { timeoutMs = 15_000, headers = {} } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return { url, ok: res.ok, status: res.status, error: null };
  } catch (err) {
    const detail = String(err?.cause?.code || err?.cause?.message || err?.message || err);
    return { url, ok: false, status: null, error: detail };
  } finally {
    clearTimeout(timer);
  }
}
