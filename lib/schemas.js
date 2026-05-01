import { z } from 'zod';

// ------------- Primitives -------------
const id = z.string().min(1).max(64);
const uuid = z.string().uuid();
const role = z.enum(['MEMBER', 'MANAGER', 'ADMIN', 'SUPERADMIN']);
const nonNegNum = z.coerce.number().nonnegative();
const posInt = z.coerce.number().int().positive();

// ------------- Per-action schemas -------------
// ส่วนใหญ่ใช้ `.passthrough()` เพื่อยังรองรับ field ที่ controller คาด
// แต่คอลัมน์สำคัญถูก validate type ก่อนเข้าระบบ
export const schemas = {
  // --- Public (no auth required) ---
  check_user: z
    .object({
      line_id: z.string().min(1),
      name: z.string().max(120).optional().nullable(),
      nickname: z.string().max(120).optional().nullable(),
    })
    .passthrough(),
  register: z
    .object({
      line_id: z.string().min(1),
      name: z.string().min(1).max(120),
      nickname: z.string().max(120).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      bank_account: z.string().max(120).optional().nullable(),
      role: role.optional(),
      house_name: z.string().max(120).optional().nullable(),
      house_code: z.string().max(64).optional().nullable(),
    })
    .passthrough(),

  // --- Member ---
  update_profile: z
    .object({
      line_id: z.string().min(1),
      name: z.string().min(1).max(120).optional(),
      nickname: z.string().max(120).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      bank_account: z.string().max(120).optional().nullable(),
    })
    .passthrough(),
  get_members: z.object({ member_id: id }).passthrough(),

  // --- Circle ---
  create_circle: z
    .object({
      creator_id: id,
      circle_name: z.string().min(1).max(200),
      total_amount: nonNegNum,
      amount_per_hand: nonNegNum,
      total_hands: posInt,
    })
    .passthrough(),
  get_circles: z.object({ member_id: id }).passthrough(),
  get_circle_detail: z.object({ circle_id: id }).passthrough(),
  join_circle: z.object({ circle_id: id, hand_no: posInt, member_id: id }).passthrough(),
  submit_bid: z
    .object({
      circle_id: id,
      period: posInt,
      member_id: id,
      bid_amount: nonNegNum,
    })
    .passthrough(),
  upload_slip: z
    .object({
      circle_id: id,
      member_id: id,
      period: posInt,
      amount: nonNegNum,
    })
    .passthrough(),
  verify_slip: z.object({ slip_id: uuid }).passthrough(),
  random_select_bidder: z.object({ circle_id: id, period: posInt }).passthrough(),
  close_bidding: z.object({ circle_id: id, period: posInt }).passthrough(),
  close_period: z.object({ circle_id: id, period: posInt }).passthrough(),
  start_circle: z.object({ circle_id: id }).passthrough(),
  cancel_hand: z.object({ circle_id: id, hand_no: posInt }).passthrough(),
  change_hand_owner: z.object({ circle_id: id, hand_no: posInt, new_member_id: id }).passthrough(),
  update_circle_settings: z.object({ circle_id: id }).passthrough(),
  delete_circle: z.object({ circle_id: id }).passthrough(),
  create_payout: z
    .object({
      circle_id: id,
      period: posInt,
      member_id: id,
      amount: nonNegNum,
    })
    .passthrough(),
  verify_payout: z
    .object({
      payout_id: uuid,
      status: z.enum(['APPROVED', 'REJECTED']),
    })
    .passthrough(),
  update_period_date: z
    .object({
      circle_id: id,
      period: posInt,
      period_date: z.string().min(1),
      amount: z.coerce.number().min(0).optional().nullable(),
    })
    .passthrough(),
  regenerate_period_dates: z.object({ circle_id: id }).passthrough(),
  get_period_dates: z.object({ circle_id: id }).passthrough(),

  // --- Admin dashboard ---
  get_admin_dashboard: z.object({}).passthrough(),
  get_admin_circles: z.object({ admin_id: id }).passthrough(),
  approve_house_member: z
    .object({
      house_id: uuid,
      new_status: z.enum(['ACTIVE', 'BLOCKED']),
    })
    .passthrough(),
  remove_house_member: z.object({ house_id: uuid }).passthrough(),
  full_delete_member: z.object({ member_id: id }).passthrough(),
  update_member_role: z.object({ member_id: id, new_role: role }).passthrough(),
  assign_member_bank: z.object({ house_id: uuid }).passthrough(),
  set_member_nickname: z
    .object({
      member_id: id,
      nickname: z.string().max(120).optional().nullable(),
    })
    .passthrough(),
  transfer_member: z.object({ house_id: uuid, new_admin_id: id }).passthrough(),
  add_bank: z
    .object({
      bank_name: z.string().min(1),
      account_no: z.string().min(1),
      account_name: z.string().min(1),
    })
    .passthrough(),
  edit_bank: z
    .object({
      bank_id: uuid,
      bank_name: z.string().min(1),
      account_no: z.string().min(1),
      account_name: z.string().min(1),
    })
    .passthrough(),
  delete_bank: z.object({ bank_id: uuid }).passthrough(),
  set_default_bank: z.object({ bank_id: uuid }).passthrough(),

  // --- Legacy ---
  manage_slot: z.object({}).passthrough(),
  approve_payment: z.object({ slip_id: uuid }).passthrough(),
};

/**
 * Validate payload for a given action. Returns `{ ok, data, message }`.
 * If schema for action is missing, returns ok=true (passthrough)
 * — means: add a schema to get stricter validation for that action.
 */
export function validateAction(action, payload) {
  const schema = schemas[action];
  if (!schema) return { ok: true, data: payload };

  const result = schema.safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path?.join('.') || 'payload';
    return { ok: false, message: `ข้อมูลไม่ถูกต้อง (${field}): ${first?.message || 'invalid'}` };
  }
  return { ok: true, data: { ...payload, ...result.data } };
}

// Sets to classify actions for auth behavior
export const PUBLIC_ACTIONS = new Set(['check_user', 'register']);

// For these actions, `member_id` means "the caller / myself" — override with auth user.
export const SELF_MEMBER_ACTIONS = new Set([
  'get_circles',
  'get_circle_detail',
  'get_members',
  'join_circle',
  'submit_bid',
  'upload_slip',
  'cancel_hand',
]);
