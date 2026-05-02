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
  payload: Record<string, unknown> = {},
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
      // Try to silently re-initialise LIFF so it refreshes the ID token.
      // If the LINE session is still alive, the user won't notice anything.
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId && window.liff.init) {
        await window.liff.init({ liffId });
      }
      // If LIFF is still not logged in after reinit, force a proper logout so
      // the user is redirected to the LINE login screen rather than left in a
      // broken state.
      if (!window.liff.isLoggedIn?.()) {
        window.liff.logout?.();
        window.liff.login?.();
      }
    } catch {
      // Last resort: full page reload so LIFF re-initialises from scratch.
      window.location.reload();
    }
  }

  return data as ApiResponse<T>;
}

/** SWR fetcher for action keys. Use as: `useSWR(['get_circles', { member_id }], swrFetcher)` */
export const swrFetcher = ([action, payload]: [string, Record<string, unknown>]) =>
  callAction(action, payload);
