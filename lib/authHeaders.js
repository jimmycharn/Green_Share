/**
 * Client-side helper: build fetch headers with LINE LIFF ID token attached.
 * Use in every `fetch('/api/...')` call from the browser.
 *
 *   import { authHeaders } from '@/lib/authHeaders';
 *   fetch('/api/action', { method: 'POST', headers: authHeaders(), body: ... })
 */
export function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  if (typeof window !== 'undefined' && window.liff) {
    try {
      if (window.liff.isLoggedIn?.()) {
        const token = window.liff.getIDToken?.();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // liff not ready yet — request will be treated as unauthenticated
    }
  }

  return headers;
}
