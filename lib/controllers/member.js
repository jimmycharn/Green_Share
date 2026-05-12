import { supabaseAdmin } from '../supabase';
import { notifyAdmin, sendJoinRequestFlex } from '../line';

export async function checkMember(data) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('line_id', data.line_id)
      .maybeSingle();

    if (error) throw error;

    // Auto-bootstrap SUPERADMIN for the configured admin LINE UID.
    // This ensures the operator can log in immediately without going through
    // the regular onboarding flow.
    if (!user && process.env.ADMIN_LINE_UID && data.line_id === process.env.ADMIN_LINE_UID) {
      const displayName = (data.name && String(data.name).trim()) || 'Super Admin';
      const { data: created, error: insertError } = await supabaseAdmin
        .from('members')
        .insert([
          {
            line_id: data.line_id,
            name: displayName,
            nickname: data.nickname || null,
            phone: null,
            bank_account: null,
            role: 'SUPERADMIN',
            status: 'ACTIVE',
            house_name: displayName,
            picture_url: data.picture_url || null,
          },
        ])
        .select('*')
        .single();

      if (insertError) throw insertError;
      return { status: 'success', user: created, bootstrapped: true };
    }

    // Opportunistically refresh the cached LINE picture so other members see
    // the latest avatar without a manual profile sync.
    if (user && data.picture_url && user.picture_url !== data.picture_url) {
      const { data: updated } = await supabaseAdmin
        .from('members')
        .update({ picture_url: data.picture_url })
        .eq('id', user.id)
        .select('*')
        .single();
      if (updated) return { status: 'success', user: updated };
    }

    return { status: 'success', user };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

export async function registerMember(data) {
  const {
    line_id,
    name,
    nickname,
    phone,
    bank_account,
    role,
    house_name,
    house_code,
    picture_url,
  } = data;

  try {
    // 1. Insert member — id generated atomically by DB (next_member_id())
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('members')
      .insert([
        {
          line_id,
          name,
          nickname,
          phone,
          bank_account,
          role: role || 'MEMBER',
          house_name: role === 'ADMIN' ? house_name || name : null,
          status: 'PENDING',
          picture_url: picture_url || null,
        },
      ])
      .select('id')
      .single();

    if (insertError) throw insertError;
    const newId = inserted.id;

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
      // Create relationship — surface failures so members can't end up
      // orphaned (registered without any member_houses row).
      const { error: linkError } = await supabaseAdmin.from('member_houses').insert([
        {
          member_id: newId,
          admin_id: targetAdminId,
          status: 'PENDING',
        },
      ]);
      if (linkError) {
        // Roll back the member row to keep the data consistent.
        await supabaseAdmin.from('members').delete().eq('id', newId);
        throw new Error(`สมัครสมาชิกล้มเหลว: ${linkError.message}`);
      }
    } else if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      // Regular member registered without a valid house code → bail out.
      await supabaseAdmin.from('members').delete().eq('id', newId);
      return {
        status: 'error',
        message: 'ไม่พบบ้านแชร์ที่ระบุ กรุณาขอลิงก์เชิญจากท้าวแชร์อีกครั้ง',
      };
    }

    // 4. Notify Admin
    await notifyAdmin(
      `🆕 มีคนสมัครสมาชิกใหม่!\nชื่อ: ${name}\nบทบาท: ${role}\nเป้าหมาย: ${role === 'ADMIN' ? 'ขอเปิดบ้านแชร์' : 'ขอเข้าบ้าน ' + targetAdminId}`
    );

    return { status: 'success', message: 'สมัครสมาชิกสำเร็จ รอการอนุมัติครับ' };
  } catch (error) {
    console.error('Registration Error:', error);
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
        bank_account: data.bank_account,
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
    const { data: requester } = await supabaseAdmin
      .from('members')
      .select('id, status, role')
      .eq('id', data.member_id)
      .single();
    if (
      !requester ||
      (requester.status !== 'ACTIVE' && !['SUPERADMIN', 'ADMIN'].includes(requester.role))
    ) {
      return { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลสมาชิก' };
    }

    let query = supabaseAdmin
      .from('members')
      .select(
        `
        id, name, nickname, phone, role, status, picture_url, created_at,
        member_houses!member_id(id, admin_id, status, assigned_bank_id)
      `
      )
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

      const memberIds = [requester.id, ...(houseLinks?.map((h) => h.member_id) || [])];
      query = query.in('id', memberIds);
    }

    const { data: members, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Load this caller's personal nickname overrides in one go and merge them in.
    // Each entry is private to the caller — keyed by (viewer_id=caller, target_id=member).
    const { data: nicknameRows } = await supabaseAdmin
      .from('member_nicknames')
      .select('target_id, nickname')
      .eq('viewer_id', requester.id);
    const nicknameByTarget = new Map((nicknameRows || []).map((r) => [r.target_id, r.nickname]));

    // Filter or map to show house-specific status
    const membersWithHouseStatus = members.map((m) => {
      // 1. If caller is Admin/Superadmin, look for their own house link
      let houseInfo = m.member_houses?.find((h) => h.admin_id === requester.id);

      // 2. If caller is a regular Member OR no link found above, just take the first house link
      if (!houseInfo && m.member_houses && m.member_houses.length > 0) {
        houseInfo = m.member_houses[0];
      }

      return {
        ...m,
        house_id: houseInfo?.id,
        house_status: houseInfo?.status || 'NOT_JOINED',
        assigned_bank_id: houseInfo?.assigned_bank_id ?? null,
        custom_nickname: nicknameByTarget.get(m.id) ?? null,
      };
    });

    return { status: 'success', members: membersWithHouseStatus };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ขอเข้าร่วมบ้านแชร์อื่น (สำหรับสมาชิกที่ลงทะเบียนแล้ว)
// =============================================
export async function requestJoinHouse(data) {
  try {
    const { caller_id, house_code } = data;

    // Validate house_code is a valid admin member ID
    const { data: admin } = await supabaseAdmin
      .from('members')
      .select('id, name, role, line_id')
      .eq('id', house_code)
      .in('role', ['ADMIN', 'SUPERADMIN'])
      .single();

    if (!admin) {
      return { status: 'error', message: 'ไม่พบบ้านแชร์ที่ระบุ กรุณาตรวจสอบรหัสอีกครั้ง' };
    }

    if (admin.id === caller_id) {
      return { status: 'error', message: 'คุณเป็นท้าวแชร์ของบ้านนี้อยู่แล้ว' };
    }

    // Check if already a member of this house
    const { data: existing } = await supabaseAdmin
      .from('member_houses')
      .select('id, status')
      .eq('member_id', caller_id)
      .eq('admin_id', admin.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'ACTIVE') {
        return { status: 'error', message: 'คุณเป็นสมาชิกของบ้านนี้อยู่แล้ว' };
      }
      if (existing.status === 'PENDING') {
        return { status: 'error', message: 'คุณได้ส่งคำขอเข้าร่วมบ้านนี้แล้ว รอการอนุมัติ' };
      }
      // BLOCKED → allow re-request
      await supabaseAdmin.from('member_houses').delete().eq('id', existing.id);
    }

    const { error: insertError } = await supabaseAdmin.from('member_houses').insert([
      {
        member_id: caller_id,
        admin_id: admin.id,
        status: 'PENDING',
      },
    ]);

    if (insertError) throw insertError;

    // Notify the admin via Flex
    const { data: requester } = await supabaseAdmin
      .from('members')
      .select('name, role')
      .eq('id', caller_id)
      .single();

    const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/members`;

    if (admin?.line_id) {
      await sendJoinRequestFlex(admin.line_id, {
        requesterName: requester?.name || 'ไม่ระบุ',
        requesterRole: requester?.role || 'MEMBER',
        houseName: admin.name,
        houseAdminName: admin.name,
        liffUrl,
      });
    }

    // Notify superadmin via OA
    const isRequesterAdmin = requester?.role === 'ADMIN' || requester?.role === 'SUPERADMIN';
    await notifyAdmin(
      isRequesterAdmin
        ? `แอดมิน: ${requester?.name || 'ไม่ระบุ'}\n🏠 จากบ้านแชร์: ${requester?.name || 'ไม่ระบุ'}\n🏠 ส่งคำขอเข้าร่วมบ้านแชร์!\nบ้าน: ${admin.name}`
        : `ผู้ใช้: ${requester?.name || 'ไม่ระบุ'}\n🏠 จากบ้านแชร์: ${requester?.name || 'ไม่ระบุ'}\n🏠 ส่งคำขอเข้าร่วมบ้านแชร์!\nบ้าน: ${admin.name}`
    );

    return {
      status: 'success',
      message: `ส่งคำขอเข้าร่วมบ้าน "${admin.name}" เรียบร้อย รอการอนุมัติ`,
    };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ดึงรายการบ้านแชร์ที่สมาชิกสังกัดอยู่
// =============================================
export async function getMyHouses(data) {
  try {
    const { caller_id } = data;

    const { data: houses, error } = await supabaseAdmin
      .from('member_houses')
      .select(
        `
        id, status, admin_id,
        admins:admin_id (id, name, picture_url, house_name)
      `
      )
      .eq('member_id', caller_id)
      .order('status', { ascending: true });

    if (error) throw error;

    const result = (houses || []).map((h) => ({
      house_id: h.id,
      status: h.status,
      admin_id: h.admin_id,
      admin_name: h.admins?.name || 'ไม่ระบุ',
      admin_picture: h.admins?.picture_url || null,
      house_name: h.admins?.house_name || h.admins?.name || 'ไม่ระบุ',
    }));

    return { status: 'success', houses: result };
  } catch (error) {
    throw error;
  }
}

// =============================================
// สร้างลิงก์เชิญเข้าร่วมบ้าน (สำหรับท้าวแชร์)
// =============================================
export async function generateHouseInvite(data) {
  try {
    const { caller_id } = data;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://greenshare.app';
    const inviteUrl = `${baseUrl}/onboarding?house=${caller_id}`;

    return { status: 'success', invite_url: inviteUrl };
  } catch (error) {
    throw error;
  }
}
