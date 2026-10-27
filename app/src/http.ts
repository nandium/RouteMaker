/** Fetch plumbing shared by the Lynx app and the browser tools; must stay free of Lynx globals. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

type Fetcher = (
  url: string,
  init: Omit<RequestInit, 'headers'> & { headers: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type FetchJsonInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  /** Sent as a bearer token. */
  token?: string | null;
  /** Serialized as the body with a JSON content type. */
  json?: unknown;
};

/** Resolves with the parsed body (undefined for 204); rejects with ApiError on any non-2xx. */
export async function fetchJson<T>(
  fetcher: Fetcher,
  url: string,
  { token, json, headers, ...init }: FetchJsonInit = {}
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      ...headers,
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
  if (response.status === 204) return undefined as T;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // Proxies may answer with HTML; the status below is still meaningful.
  }
  if (!response.ok)
    throw new ApiError(
      failureDetail(payload) ?? `Request failed (${response.status})`,
      response.status
    );
  if (payload === undefined) throw new ApiError('Unexpected response', response.status);
  return payload as T;
}

function failureDetail(payload: unknown) {
  const detail = (payload as { detail?: unknown } | null | undefined)?.detail;
  return typeof detail === 'string' && detail ? detail : undefined;
}
