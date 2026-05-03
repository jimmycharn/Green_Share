import { authHeaders } from '@/lib/authHeaders';

export type ApiResponse<T = unknown> = {
  status: 'success' | 'error';
  message?: string;
  forceLogout?: boolean;
} & T;

/**
 * POST to `/api/action` with the LIFF ID token attached.
 * Throws on network errors; returns the parsed JSON body otherwise.
 */
export async function callAction<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: authHeaders() as HeadersInit,
    body: JSON.stringify({ action, ...payload }),
  });

  // The server always responds with JSON; if the server crashed we
  // fall back to an error object so callers don't have to handle JSON parse.
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { status: 'error', message: 'Invalid server response' };
  }

  if (data?.forceLogout && typeof window !== 'undefined' && window.liff) {
    try {
      window.liff.logout?.();
      window.liff.login?.();
    } catch {
      window.location.reload();
    }
  }

  return data as ApiResponse<T>;
}

/** SWR fetcher for action keys. Use as: `useSWR(['get_circles', { member_id }], swrFetcher)` */
export const swrFetcher = ([action, payload]: [string, Record<string, unknown>]) =>
  callAction(action, payload);
