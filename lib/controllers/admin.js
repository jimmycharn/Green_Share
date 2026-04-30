import { supabaseAdmin } from '../supabase';

// =============================================
// ADMIN DASHBOARD: ดึงข้อมูลรวมทั้ง 3 ส่วน
// =============================================
export async function getAdminDashboard(data) {
  const { caller_id, caller_role } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์เข้าถึง' };
  }

  try {
    // 1. ลูกวงรออนุมัติ (PENDING) ในบ้านนี้
    const { data: pendingMembers, error: e1 } = await supabaseAdmin
      .from('member_houses')
      .select('*, member:member_id(id, name, nickname, phone, role, status)')
      .eq('admin_id', caller_id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    // 2. สมาชิกทั้งหมดในบ้าน (ACTIVE + BLOCKED)
    const { data: houseMembers, error: e2 } = await supabaseAdmin
      .from('member_houses')
      .select(
        '*, member:member_id(id, name, nickname, phone, role, status), bank:assigned_bank_id(id, bank_name, account_no, account_name)'
      )
      .eq('admin_id', caller_id)
      .in('status', ['ACTIVE', 'BLOCKED'])
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    // 3. บัญชีธนาคารของ admin คนนี้
    const { data: banks, error: e3 } = await supabaseAdmin
      .from('banks')
      .select('*')
      .eq('member_id', caller_id)
      .order('created_at', { ascending: true });
    if (e3) throw e3;

    return {
      status: 'success',
      pendingMembers: pendingMembers || [],
      houseMembers: houseMembers || [],
      banks: banks || [],
    };
  } catch (error) {
    throw error;
  }
}

// =============================================
// อนุมัติ / ปฏิเสธ สมาชิกเข้าบ้าน
// =============================================
export async function approveHouseMember(data) {
  const { caller_id, caller_role, house_id, new_status } = data;
  // new_status: 'ACTIVE' (อนุมัติ) or 'BLOCKED' (ปฏิเสธ/บล็อค)
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    // Verify this house entry belongs to the caller
    const { data: house, error: fetchErr } = await supabaseAdmin
      .from('member_houses')
      .select('*')
      .eq('id', house_id)
      .eq('admin_id', caller_id)
      .single();

    if (fetchErr || !house) {
      return { status: 'error', message: 'ไม่พบข้อมูลหรือไม่มีสิทธิ์' };
    }

    const { error } = await supabaseAdmin
      .from('member_houses')
      .update({ status: new_status })
      .eq('id', house_id);

    if (error) throw error;

    // Additionally, update the global status in 'members' table to ACTIVE
    if (new_status === 'ACTIVE') {
      await supabaseAdmin.from('members').update({ status: 'ACTIVE' }).eq('id', house.member_id);
    }

    return {
      status: 'success',
      message: new_status === 'ACTIVE' ? 'อนุมัติสมาชิกเรียบร้อย!' : 'บล็อคสมาชิกเรียบร้อย',
    };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ตั้งชื่อเล่นให้สมาชิก (viewer-specific custom nickname)
// — เก็บใน member_nicknames(viewer_id, target_id, nickname)
//   เพื่อให้ผู้ตั้งเห็นชื่อนั้นเสมอ ไม่ว่าสมาชิกจะย้ายบ้านไปไหน
//   และผู้อื่นจะไม่เห็น (เว้นแต่จะตั้งให้เอง)
// — สิทธิ์:
//     SUPERADMIN: ตั้งชื่อให้ใครก็ได้
//     ADMIN: ตั้งชื่อได้เฉพาะสมาชิกในบ้านของตน
// =============================================
export async function setMemberNickname(data) {
  const { caller_id, caller_role, member_id, nickname } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }
  if (!member_id) {
    return { status: 'error', message: 'ระบุสมาชิกไม่ถูกต้อง' };
  }

  try {
    // ADMIN may only nickname members within their own house.
    if (caller_role === 'ADMIN') {
      const { data: link } = await supabaseAdmin
        .from('member_houses')
        .select('id')
        .eq('admin_id', caller_id)
        .eq('member_id', member_id)
        .maybeSingle();
      if (!link) {
        return { status: 'error', message: 'ไม่มีสิทธิ์ตั้งชื่อให้สมาชิกนอกบ้าน' };
      }
    }

    const trimmed = (nickname || '').trim();

    if (trimmed.length === 0) {
      // Clear the nickname → delete the row
      const { error } = await supabaseAdmin
        .from('member_nicknames')
        .delete()
        .eq('viewer_id', caller_id)
        .eq('target_id', member_id);
      if (error) throw error;
      return { status: 'success', message: 'ล้างชื่อเล่นเรียบร้อย' };
    }

    const { error } = await supabaseAdmin.from('member_nicknames').upsert(
      {
        viewer_id: caller_id,
        target_id: member_id,
        nickname: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'viewer_id,target_id' },
    );
    if (error) throw error;

    return { status: 'success', message: 'ตั้งชื่อเล่นเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

// =============================================
// SUPERADMIN: ดูวงแชร์ของท้าวแชร์/admin บ้านอื่น พร้อมรายชื่อสมาชิก
// — ใช้สำหรับ "ส่อง" บ้านอื่นในแท็บบ้านแชร์อื่น
// — merge member_nicknames ของ caller เข้า player list ด้วย
// =============================================
export async function getAdminCircles(data) {
  const { caller_id, caller_role, admin_id } = data;
  if (caller_role !== 'SUPERADMIN') {
    return { status: 'error', message: 'เฉพาะ Superadmin เท่านั้น' };
  }
  if (!admin_id) {
    return { status: 'error', message: 'ระบุท้าวแชร์ไม่ถูกต้อง' };
  }

  try {
    const { data: circles, error: circlesErr } = await supabaseAdmin
      .from('circles')
      .select('*')
      .eq('creator_id', admin_id)
      .order('created_at', { ascending: false });

    if (circlesErr) throw circlesErr;
    console.log(
      `[getAdminCircles] caller=${caller_id} admin_id=${admin_id} → ${circles?.length ?? 0} rows`,
    );
    if (!circles || circles.length === 0) {
      // Sanity-check: dump 3 sample rows of circles to help diagnose mismatches
      const { data: sample } = await supabaseAdmin
        .from('circles')
        .select('id, name, creator_id, status')
        .order('created_at', { ascending: false })
        .limit(5);
      console.log('[getAdminCircles] sample circles:', JSON.stringify(sample));
      return { status: 'success', circles: [] };
    }

    const circleIds = circles.map((c) => c.id);

    // Pull players for all circles in one query, joined with member info.
    const { data: players, error: playersErr } = await supabaseAdmin
      .from('circle_players')
      .select(
        `
        id, circle_id, hand_no, member_id, status,
        members:member_id (id, name, nickname, picture_url, phone, role)
      `,
      )
      .in('circle_id', circleIds)
      .order('hand_no', { ascending: true });

    if (playersErr) throw playersErr;

    // Caller's personal nickname overrides — only viewer (caller) sees these.
    const targetIds = Array.from(new Set((players || []).map((p) => p.member_id)));
    let nicknameByTarget = new Map();
    if (targetIds.length > 0) {
      const { data: nicknameRows } = await supabaseAdmin
        .from('member_nicknames')
        .select('target_id, nickname')
        .eq('viewer_id', caller_id)
        .in('target_id', targetIds);
      nicknameByTarget = new Map(
        (nicknameRows || []).map((r) => [r.target_id, r.nickname]),
      );
    }

    const playersByCircle = new Map();
    for (const p of players || []) {
      const list = playersByCircle.get(p.circle_id) || [];
      list.push({
        hand_no: p.hand_no,
        status: p.status,
        member_id: p.member_id,
        name: p.members?.name || '',
        nickname: p.members?.nickname || null,
        custom_nickname: nicknameByTarget.get(p.member_id) ?? null,
        picture_url: p.members?.picture_url || null,
        phone: p.members?.phone || null,
        role: p.members?.role || null,
      });
      playersByCircle.set(p.circle_id, list);
    }

    return {
      status: 'success',
      circles: circles.map((c) => ({
        ...c,
        players: playersByCircle.get(c.id) || [],
      })),
    };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ลบสมาชิกออกจากบ้าน
// =============================================
export async function removeHouseMember(data) {
  const { caller_id, caller_role, house_id } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('member_houses')
      .delete()
      .eq('id', house_id)
      .eq('admin_id', caller_id);

    if (error) throw error;
    return { status: 'success', message: 'ลบสมาชิกออกจากบ้านเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ลบสมาชิกออกจากระบบโดยสมบูรณ์ (สำหรับทดสอบ)
// =============================================
export async function fullDeleteMember(data) {
  const { caller_role, member_id } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์ลบสมาชิก' };
  }

  try {
    const { error } = await supabaseAdmin.from('members').delete().eq('id', member_id);

    if (error) throw error;
    return { status: 'success', message: 'ลบสมาชิกออกจากระบบเรียบร้อยแล้ว' };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ตั้งยศสมาชิก (Role)
// =============================================
export async function updateMemberRole(data) {
  const { caller_id, caller_role, member_id, new_role } = data;

  // ลำดับชั้น SUPERADMIN > ADMIN > MANAGER > MEMBER
  const ROLE_HIERARCHY = { MEMBER: 1, MANAGER: 2, ADMIN: 3, SUPERADMIN: 4 };

  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  // Admin ตั้งได้สูงสุดแค่ ADMIN
  if (caller_role === 'ADMIN' && ROLE_HIERARCHY[new_role] > ROLE_HIERARCHY['ADMIN']) {
    return { status: 'error', message: 'Admin ไม่สามารถตั้งยศที่สูงกว่าได้' };
  }

  // ห้ามตั้งยศให้ตัวเอง
  if (caller_id === member_id) {
    return { status: 'error', message: 'ไม่สามารถเปลี่ยนยศตัวเองได้' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('members')
      .update({ role: new_role })
      .eq('id', member_id);

    if (error) throw error;
    return { status: 'success', message: `เปลี่ยนยศเป็น ${new_role} เรียบร้อย` };
  } catch (error) {
    throw error;
  }
}

// =============================================
// กำหนดบัญชีธนาคารเฉพาะกิจให้สมาชิก
// =============================================
export async function assignMemberBank(data) {
  const { caller_id, caller_role, house_id, bank_id } = data;
  // bank_id อาจเป็น null เพื่อ reset กลับเป็นค่า default
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('member_houses')
      .update({ assigned_bank_id: bank_id || null })
      .eq('id', house_id)
      .eq('admin_id', caller_id);

    if (error) throw error;
    return {
      status: 'success',
      message: bank_id ? 'กำหนดบัญชีเรียบร้อย' : 'รีเซ็ตเป็นบัญชีหลักเรียบร้อย',
    };
  } catch (error) {
    throw error;
  }
}

// =============================================
// ย้ายสมาชิกไปยังบ้านอื่น (Superadmin only)
// =============================================
export async function transferMember(data) {
  const { caller_role, house_id, new_admin_id } = data;
  if (caller_role !== 'SUPERADMIN') {
    return { status: 'error', message: 'เฉพาะ Superadmin เท่านั้น' };
  }

  try {
    // Get current house entry
    const { data: house, error: fetchErr } = await supabaseAdmin
      .from('member_houses')
      .select('member_id')
      .eq('id', house_id)
      .single();

    if (fetchErr || !house) return { status: 'error', message: 'ไม่พบข้อมูล' };

    // Check if member is already in the target house
    const { data: existing } = await supabaseAdmin
      .from('member_houses')
      .select('id')
      .eq('member_id', house.member_id)
      .eq('admin_id', new_admin_id)
      .single();

    if (existing) {
      return { status: 'error', message: 'สมาชิกอยู่ในบ้านนั้นแล้ว' };
    }

    // Update admin_id of the house entry
    const { error } = await supabaseAdmin
      .from('member_houses')
      .update({ admin_id: new_admin_id, assigned_bank_id: null })
      .eq('id', house_id);

    if (error) throw error;
    return { status: 'success', message: 'ย้ายสมาชิกเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

// =============================================
// CRUD บัญชีธนาคาร
// =============================================
export async function addBank(data) {
  const { caller_id, caller_role, bank_name, account_no, account_name } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    const { data: newBank, error } = await supabaseAdmin
      .from('banks')
      .insert([{ member_id: caller_id, bank_name, account_no, account_name, is_default: false }])
      .select()
      .single();

    if (error) throw error;

    // ถ้ายังไม่มีบัญชีใดเลย ตั้งเป็นบัญชีหลักทันที
    const { count } = await supabaseAdmin
      .from('banks')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', caller_id);

    if (count === 1) {
      await supabaseAdmin.from('banks').update({ is_default: true }).eq('id', newBank.id);
    }

    return { status: 'success', message: 'เพิ่มบัญชีเรียบร้อย', bank: newBank };
  } catch (error) {
    throw error;
  }
}

export async function editBank(data) {
  const { caller_id, caller_role, bank_id, bank_name, account_no, account_name } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    const { error } = await supabaseAdmin
      .from('banks')
      .update({ bank_name, account_no, account_name })
      .eq('id', bank_id)
      .eq('member_id', caller_id);

    if (error) throw error;
    return { status: 'success', message: 'แก้ไขบัญชีเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

export async function deleteBank(data) {
  const { caller_id, caller_role, bank_id } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    // ป้องกันลบบัญชีหลัก ถ้ามีมากกว่า 1 บัญชี
    const { data: bank } = await supabaseAdmin
      .from('banks')
      .select('is_default')
      .eq('id', bank_id)
      .eq('member_id', caller_id)
      .single();

    if (!bank) return { status: 'error', message: 'ไม่พบบัญชี' };

    // ลบ
    const { error } = await supabaseAdmin
      .from('banks')
      .delete()
      .eq('id', bank_id)
      .eq('member_id', caller_id);

    if (error) throw error;

    // ถ้าลบบัญชีหลัก ให้ตั้งตัวถัดไปเป็นหลักอัตโนมัติ
    if (bank.is_default) {
      const { data: remaining } = await supabaseAdmin
        .from('banks')
        .select('id')
        .eq('member_id', caller_id)
        .limit(1);

      if (remaining && remaining.length > 0) {
        await supabaseAdmin.from('banks').update({ is_default: true }).eq('id', remaining[0].id);
      }
    }

    return { status: 'success', message: 'ลบบัญชีเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

export async function setDefaultBank(data) {
  const { caller_id, caller_role, bank_id } = data;
  if (!['SUPERADMIN', 'ADMIN'].includes(caller_role)) {
    return { status: 'error', message: 'ไม่มีสิทธิ์' };
  }

  try {
    // Reset all to false first
    await supabaseAdmin.from('banks').update({ is_default: false }).eq('member_id', caller_id);

    // Set the target bank as default
    const { error } = await supabaseAdmin
      .from('banks')
      .update({ is_default: true })
      .eq('id', bank_id)
      .eq('member_id', caller_id);

    if (error) throw error;
    return { status: 'success', message: 'ตั้งเป็นบัญชีหลักเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

// =============================================
// Legacy placeholders (เดิม)
// =============================================
export async function manageSlot(data) {
  if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return { status: 'error', message: 'No Permission' };
  }
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
