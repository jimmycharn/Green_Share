import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { validateAction, PUBLIC_ACTIONS, SELF_MEMBER_ACTIONS } from '@/lib/schemas';
import { rateLimit } from '@/lib/ratelimit';
import { registerMember, updateProfile, getMembers, checkMember } from '@/lib/controllers/member';
import {
  createCircle,
  getCircles,
  getCircleDetail,
  joinCircle,
  submitBid,
  uploadSlip,
  verifySlip,
  randomSelectBidder,
  startCircle,
  cancelHand,
  changeHandOwner,
  updateCircleSettings,
  closeBidding,
  closePeriod,
  deleteCircle,
  createPayout,
  verifyPayout,
} from '@/lib/controllers/circle';
import {
  manageSlot,
  approvePayment,
  getAdminDashboard,
  approveHouseMember,
  setMemberNickname,
  removeHouseMember,
  fullDeleteMember,
  updateMemberRole,
  assignMemberBank,
  transferMember,
  addBank,
  editBank,
  deleteBank,
  setDefaultBank,
} from '@/lib/controllers/admin';

const HANDLERS = {
  register: registerMember,
  check_user: checkMember,
  update_profile: updateProfile,
  get_members: getMembers,
  create_circle: createCircle,
  get_circles: getCircles,
  get_circle_detail: getCircleDetail,
  join_circle: joinCircle,
  submit_bid: submitBid,
  upload_slip: uploadSlip,
  verify_slip: verifySlip,
  random_select_bidder: randomSelectBidder,
  start_circle: startCircle,
  cancel_hand: cancelHand,
  change_hand_owner: changeHandOwner,
  update_circle_settings: updateCircleSettings,
  close_bidding: closeBidding,
  close_period: closePeriod,
  delete_circle: deleteCircle,
  create_payout: createPayout,
  verify_payout: verifyPayout,
  get_admin_dashboard: getAdminDashboard,
  approve_house_member: approveHouseMember,
  remove_house_member: removeHouseMember,
  full_delete_member: fullDeleteMember,
  update_member_role: updateMemberRole,
  assign_member_bank: assignMemberBank,
  set_member_nickname: setMemberNickname,
  transfer_member: transferMember,
  add_bank: addBank,
  edit_bank: editBank,
  delete_bank: deleteBank,
  set_default_bank: setDefaultBank,
  manage_slot: manageSlot,
  approve_payment: approvePayment,
};

function errorResponse(message, status = 400, extra = {}) {
  return NextResponse.json({ status: 'error', message, ...extra }, { status });
}

export async function POST(req) {
  let data;
  try {
    data = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const action = data?.action;
  if (!action || typeof action !== 'string') {
    return errorResponse('Action is required', 400);
  }

  const handler = HANDLERS[action];
  if (!handler) {
    return errorResponse(`Unknown action: ${action}`, 400);
  }

  // --- Authentication ---
  const isPublic = PUBLIC_ACTIONS.has(action);
  const auth = await getAuthUser(req);

  if (!isPublic) {
    if (!auth) {
      return errorResponse('กรุณาเข้าสู่ระบบอีกครั้ง', 401, { forceLogout: true });
    }
    if (!auth.user) {
      return errorResponse('USER_DELETED', 401, { forceLogout: true });
    }

    // Authoritative: override caller fields from the verified session
    data.caller_id = auth.user.id;
    data.caller_role = auth.user.role;

    // For self-centric actions, also override `member_id` to prevent
    // reading/writing other users' data by parameter tampering.
    if (SELF_MEMBER_ACTIONS.has(action)) {
      data.member_id = auth.user.id;
    }

    // update_profile: `line_id` in the body must match the verified LINE user.
    if (action === 'update_profile') {
      data.line_id = auth.lineId;
    }
  } else if (action === 'register' && auth) {
    // Optional: if caller is already authenticated, tie registration to that line_id
    data.line_id = auth.lineId;
  } else if (action === 'check_user' && auth) {
    // Always trust the verified LINE id over the client-provided one
    data.line_id = auth.lineId;
  }

  // --- Rate limiting (per-auth-user, fallback to IP) ---
  const rlKey =
    auth?.user?.id ||
    auth?.lineId ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous';
  const rl = rateLimit(`${rlKey}:${action}`);
  if (!rl.ok) {
    return errorResponse('เรียกใช้งานถี่เกินไป กรุณาลองใหม่อีกครั้ง', 429);
  }

  // --- Validation ---
  const v = validateAction(action, data);
  if (!v.ok) return errorResponse(v.message, 400);

  // --- Dispatch ---
  try {
    const result = await handler(v.data);
    // Ensure a JSON object with at least { status }
    if (!result || typeof result !== 'object') {
      return NextResponse.json({ status: 'success' });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[api/action:${action}]`, error);
    // Never leak internal error details to the client in production.
    const debug = process.env.NODE_ENV !== 'production';
    return errorResponse(
      debug ? `เกิดข้อผิดพลาด: ${error?.message || 'unknown'}` : 'เกิดข้อผิดพลาดภายในระบบ',
      500
    );
  }
}
