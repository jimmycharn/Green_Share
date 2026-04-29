import { supabaseAdmin } from './supabase';

/**
 * Verify LINE LIFF ID Token against LINE's verify endpoint.
 * https://developers.line.biz/en/reference/line-login/#verify-id-token
 *
 * Returns the decoded payload (including `sub` = LINE user ID) or null if invalid.
 */
async function verifyLineIdToken(idToken) {
  if (!idToken) return null;

  const clientId =
    process.env.LINE_LOGIN_CHANNEL_ID ||
    (process.env.NEXT_PUBLIC_LIFF_ID ? process.env.NEXT_PUBLIC_LIFF_ID.split('-')[0] : null);

  if (!clientId) {
    console.error('[auth] Missing LINE_LOGIN_CHANNEL_ID / NEXT_PUBLIC_LIFF_ID');
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.set('id_token', idToken);
    params.set('client_id', clientId);

    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        const text = await res.text();
        console.warn('[auth] LINE verify failed:', res.status, text);
      }
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[auth] verify error:', err);
    return null;
  }
}

/**
 * Read Bearer token from the incoming request, verify with LINE,
 * then look up the matching DB member.
 *
 * Returns `{ lineId, user }` where `user` may be null if not yet registered.
 * Returns `null` if the token is missing/invalid.
 */
export async function getAuthUser(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;

  const token = header.slice(7).trim();
  const payload = await verifyLineIdToken(token);
  if (!payload?.sub) return null;

  const lineId = payload.sub;

  const { data: user } = await supabaseAdmin
    .from('members')
    .select('id, role, status, line_id, name')
    .eq('line_id', lineId)
    .maybeSingle();

  return { lineId, user: user || null };
}
