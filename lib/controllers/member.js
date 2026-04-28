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
        role: 'MEMBER',
        status: 'INCOMPLETE' // Set as incomplete initially
      }]);
      
      if (insertError) throw insertError;
      
      user = {
        id: newId, name: data.name, nickname: data.nickname, role: 'MEMBER', status: 'INCOMPLETE'
      };
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

export async function completeOnboarding(data) {
  const { member_id, name, nickname, phone, bank_account, role, house_name, house_code } = data;

  try {
    // 1. Update Profile
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        name, nickname, phone, bank_account, role: role || 'MEMBER',
        house_name: role === 'ADMIN' ? (house_name || name) : null,
        status: 'PENDING' // Always pending after onboarding until approved
      })
      .eq('id', member_id);

    if (updateError) throw updateError;

    // 2. Handle House Assignment
    let targetAdminId;
    if (role === 'ADMIN') {
      // Find Superadmin to request house creation
      const { data: superAdmin } = await supabaseAdmin
        .from('members')
        .select('id')
        .eq('role', 'SUPERADMIN')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      targetAdminId = superAdmin?.id;
    } else {
      // Join specific house by house_code (which is an admin_id)
      targetAdminId = house_code;
    }

    if (targetAdminId && targetAdminId !== member_id) {
      // Upsert into member_houses
      await supabaseAdmin.from('member_houses').upsert({
        member_id,
        admin_id: targetAdminId,
        status: 'PENDING'
      }, { onConflict: 'member_id, admin_id' });
    }

    // Notify relevant admin
    await notifyAdmin(`🆕 สมาชิกใหม่เสร็จสิ้นการลงทะเบียน!\nชื่อ: ${name}\nบทบาทที่ต้องการ: ${role}\nเป้าหมาย: ${role === 'ADMIN' ? 'เปิดบ้านแชร์' : 'เข้าบ้าน ' + targetAdminId}`);

    return { status: 'success', message: 'ลงทะเบียนสำเร็จ รอการอนุมัติจากแอดมินครับ' };
  } catch (error) {
    console.error("Onboarding Error:", error);
    return { status: 'error', message: error.message };
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
      `)
      .neq('status', 'INCOMPLETE'); // Filter out incomplete profiles

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
      // 1. If caller is Admin/Superadmin, look for their own house link
      let houseInfo = m.member_houses?.find(h => h.admin_id === requester.id);
      
      // 2. If caller is a regular Member OR no link found above, just take the first house link
      if (!houseInfo && m.member_houses && m.member_houses.length > 0) {
        houseInfo = m.member_houses[0];
      }

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
