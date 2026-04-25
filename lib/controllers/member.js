import { supabaseAdmin } from '../supabase';
import { notifyAdmin } from '../line';

function generateNextId(prefix, count) {
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function registerMember(data) {
  try {
    // Check if user already exists
    const { data: existingUsers, error: fetchError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('line_id', data.line_id);

    if (fetchError) throw fetchError;

    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];
      return {
        status: 'success',
        message: 'Welcome back',
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        phone: user.phone,
        bank_account: user.bank_account,
        role: user.role,
        member_status: user.status
      };
    }

    // Generate new ID (Simulated - in real app you might want to use a sequence or UUID entirely)
    const { count } = await supabaseAdmin.from('members').select('*', { count: 'exact', head: true });
    const newId = generateNextId('M', count);

    // Insert new member
    const { error: insertError } = await supabaseAdmin.from('members').insert([{
      id: newId,
      name: data.name,
      nickname: data.nickname,
      line_id: data.line_id,
      phone: data.phone,
      bank_account: data.bank_account,
      role: 'MEMBER',
      status: 'PENDING'
    }]);

    if (insertError) throw insertError;

    await notifyAdmin(`👤 สมาชิกใหม่รออนุมัติ!\nชื่อ: ${data.name} (${data.nickname})`);

    return {
      status: 'success',
      message: 'Registered (Pending)',
      id: newId,
      name: data.name,
      nickname: data.nickname,
      phone: data.phone,
      bank_account: data.bank_account,
      role: 'MEMBER',
      member_status: 'PENDING'
    };
  } catch (error) {
    throw error;
  }
}

export async function updateProfile(data) {
  try {
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('line_id', data.line_id)
      .single();

    if (fetchError || !user) {
      return { status: 'error', message: 'ไม่พบข้อมูลสมาชิก' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        name: data.name,
        nickname: data.nickname,
        phone: data.phone,
        bank_account: data.bank_account
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return { status: 'success', message: 'แก้ไขข้อมูลเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}
