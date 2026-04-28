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
        status: 'PENDING' // Change from 'ACTIVE' to 'PENDING'
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
    // 1. Find the Superadmin for fallback (direct entry)
    const { data: superAdmin } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('role', 'SUPERADMIN')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const targetHouseId = data.house || superAdmin?.id;

    if (targetHouseId && targetHouseId !== user.id) {
      // Get the inviter's role to determine the new member's potential role
      const { data: inviter } = await supabaseAdmin
        .from('members')
        .select('role')
        .eq('id', targetHouseId)
        .single();

      // Check if already in this house
      const { data: existingHouse } = await supabaseAdmin
        .from('member_houses')
        .select('id')
        .eq('member_id', user.id)
        .eq('admin_id', targetHouseId)
        .maybeSingle();
        
      if (!existingHouse) {
        // If invited by Superadmin, they are destined to be an ADMIN
        // (We can set their role now, but they remain PENDING until approved)
        if (inviter?.role === 'SUPERADMIN' && data.house) {
           await supabaseAdmin.from('members').update({ role: 'ADMIN' }).eq('id', user.id);
           user.role = 'ADMIN';
        }

        // Apply to house
        await supabaseAdmin.from('member_houses').insert([{
          member_id: user.id,
          admin_id: targetHouseId,
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
    const { data: requester } = await supabaseAdmin.from('members').select('id, status, role').eq('id', data.member_id).single();
    if (!requester || (requester.status !== 'ACTIVE' && !['SUPERADMIN', 'ADMIN'].includes(requester.role))) {
      return { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลสมาชิก' };
    }

    let query = supabaseAdmin
      .from('members')
      .select(`
        id, name, nickname, phone, role, status, created_at,
        member_houses!member_id(id, admin_id, status)
      `);

    // If regular ADMIN, only show members in their house
    if (requester.role === 'ADMIN') {
      // We filter members who have a link to this admin's house
      // Note: This requires a slightly different approach with PostgREST 
      // or we fetch all and filter in JS if the list is small. 
      // For precision, let's use a filter on the join.
      const { data: houseLinks } = await supabaseAdmin
        .from('member_houses')
        .select('member_id')
        .eq('admin_id', requester.id);
      
      const memberIds = [requester.id, ...(houseLinks?.map(h => h.member_id) || [])];
      query = query.in('id', memberIds);
    }

    const { data: members, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Filter or map to show house-specific status
    const membersWithHouseStatus = members.map(m => {
      // If requester is Superadmin, they might see multiple houses for one member. 
      // We'll show the status for the first house they find or just the global status.
      const houseInfo = m.member_houses?.find(h => h.admin_id === requester.id) || m.member_houses?.[0];
      return {
        ...m,
        house_id: houseInfo?.id,
        house_status: houseInfo?.status || 'NOT_JOINED'
      };
    });
    
    return { status: 'success', members: membersWithHouseStatus };
  } catch (error) {
    throw error;
  }
}
