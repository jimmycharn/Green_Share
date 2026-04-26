import { supabaseAdmin } from '../supabase';
import { notifyAdmin } from '../line';

function generateNextId(prefix, count) {
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function registerMember(data) {
  try {
    const { data: existingUsers, error: fetchError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('line_id', data.line_id);

    if (fetchError) throw fetchError;

    let user;
    if (existingUsers && existingUsers.length > 0) {
      user = existingUsers[0];
    } else {
      const { count } = await supabaseAdmin.from('members').select('*', { count: 'exact', head: true });
      const newId = generateNextId('M', count);
      
      const { error: insertError } = await supabaseAdmin.from('members').insert([{
        id: newId,
        name: data.name,
        nickname: data.nickname,
        line_id: data.line_id,
        phone: data.phone,
        bank_account: data.bank_account,
        role: 'MEMBER',
        status: 'ACTIVE' // Global status is ACTIVE, house status is PENDING
      }]);
      
      if (insertError) throw insertError;
      
      // Attempt to notify superadmin (or we notify specific admins later)
      await notifyAdmin(`👤 สมาชิกใหม่ลงทะเบียนสำเร็จ!\nชื่อ: ${data.name} (${data.nickname})`);
      
      user = {
        id: newId, name: data.name, nickname: data.nickname, phone: data.phone,
        bank_account: data.bank_account, role: 'MEMBER', status: 'ACTIVE'
      };
    }

    // Now handle the house invitation (member_houses)
    // If they clicked an invite link (data.house exists) and it's not themselves
    if (data.house && data.house !== user.id) {
      // Check if already in this house
      const { data: existingHouse } = await supabaseAdmin
        .from('member_houses')
        .select('*')
        .eq('member_id', user.id)
        .eq('admin_id', data.house)
        .single();
        
      if (!existingHouse) {
        // Apply to house
        await supabaseAdmin.from('member_houses').insert([{
          member_id: user.id,
          admin_id: data.house,
          status: 'PENDING'
        }]);
      }
    }

    return {
      status: 'success',
      message: 'Welcome',
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      phone: user.phone,
      bank_account: user.bank_account,
      role: user.role,
      member_status: user.status
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

export async function getMembers(data) {
  try {
    // Only fetch members if the requester is valid
    const { data: requester } = await supabaseAdmin.from('members').select('status, role').eq('id', data.member_id).single();
    if (!requester || (requester.status !== 'ACTIVE' && !['SUPERADMIN', 'ADMIN'].includes(requester.role))) {
      return { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลสมาชิก' };
    }

    const { data: members, error } = await supabaseAdmin
      .from('members')
      .select('id, name, nickname, phone, role, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return { status: 'success', members };
  } catch (error) {
    throw error;
  }
}
