import { supabaseAdmin } from '../supabase';

export async function manageSlot(data) {
  if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return { status: 'error', message: 'No Permission' };
  }

  // Example placeholder for manageSlot logic
  return { status: 'success', message: 'Slot managed' };
}

export async function approvePayment(data) {
  if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return { status: 'error', message: 'No Permission' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('slips')
      .update({ status: 'APPROVED' })
      .eq('id', data.slip_id);

    if (error) throw error;

    return { status: 'success', message: 'อนุมัติเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}
