import { supabaseAdmin } from '../supabase';
import { notifyAdmin } from '../line';

function generateNextId(prefix, count) {
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function checkMember(data) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('line_id', data.line_id)
      .maybeSingle();
      
    if (error) throw error;
    return { status: 'success', user };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

export async function registerMember(data) {
  const { line_id, name, nickname, phone, bank_account, role, house_name, house_code } = data;

  try {
    // 1. Generate new ID
    const { count } = await supabaseAdmin.from('members').select('*', { count: 'exact', head: true });
    const newId = generateNextId('M', count);

    // 2. Insert into members (First time ever)
    const { error: insertError } = await supabaseAdmin.from('members').insert([{
      id: newId,
      line_id,
      name,
      nickname,
      phone,
      bank_account,
      role: role || 'MEMBER',
      house_name: role === 'ADMIN' ? (house_name || name) : null,
      status: 'PENDING'
    }]);

    if (insertError) throw insertError;

    // 3. Handle House Assignment
    let targetAdminId = house_code;
    
    // Find Superadmin for house creation request
    const { data: superAdmin } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('role', 'SUPERADMIN')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (role === 'ADMIN') {
      targetAdminId = superAdmin?.id;
    } 

    if (targetAdminId && targetAdminId !== newId) {
      // Create relationship
      await supabaseAdmin.from('member_houses').insert([{
        member_id: newId,
        admin_id: targetAdminId,
        status: 'PENDING'
      }]);
    }

    // 4. Notify Admin
    await notifyAdmin(`🆕 มีคนสมัครสมาชิกใหม่!\nชื่อ: ${name}\nบทบาท: ${role}\nเป้าหมาย: ${role === 'ADMIN' ? 'ขอเปิดบ้านแชร์' : 'ขอเข้าบ้าน ' + targetAdminId}`);

    return { status: 'success', message: 'สมัครสมาชิกสำเร็จ รอการอนุมัติครับ' };
  } catch (error) {
    console.error("Registration Error:", error);
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
