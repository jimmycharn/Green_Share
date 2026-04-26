import { supabaseAdmin } from '../supabase';
import { notifyAdmin } from '../line';

function generateNextId(prefix, count) {
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function createCircle(data) {
  try {
    const { count } = await supabaseAdmin.from('circles').select('*', { count: 'exact', head: true });
    const newId = generateNextId('C', count);

    const { error } = await supabaseAdmin.from('circles').insert([{
      id: newId,
      name: data.circle_name,
      type: data.type,
      creator_id: data.creator_id,
      line_group_url: data.line_group_url || '',
      total_amount: data.total_amount,
      amount_per_hand: data.amount_per_hand,
      total_hands: data.total_hands,
      start_date: data.start_date ? new Date(data.start_date) : new Date(),
      status: 'OPEN',
      period_type: data.period_type || 'WEEKLY',
      period_value: data.period_value || 'MON',
      period_extra: data.period_extra || '',
      period_interval: parseInt(data.period_interval) || 7,
      bid_start_time: data.bid_start_time || '12:00:00',
      bid_end_time: data.bid_end_time || '18:00:00',
      notify_hours: parseInt(data.notify_hours) || 24,
      notify_message: data.notify_message || '',
      min_bid: parseFloat(data.min_bid) || 0,
      max_bid: parseFloat(data.max_bid) || 1000,
      close_mode: data.close_mode === 'ปิดอัตโนมัติ' ? 'AUTO' : 'MANUAL',
      auto_action: data.auto_action || 'NOTIFY',
      interest_method: data.interest_method || 'หักดอก'
    }]);

    if (error) throw error;

    await notifyAdmin(`✨ เปิดวงแชร์ใหม่!\nชื่อวง: ${data.circle_name}\nส่งงวดละ: ${data.amount_per_hand}`);

    return { status: 'success', id: newId };
  } catch (error) {
    throw error;
  }
}

export async function getCircles(data) {
  try {
    // Basic verification: user is active or is an Admin
    const { data: member } = await supabaseAdmin.from('members').select('status, role').eq('id', data.member_id).single();
    if (!member) {
      return { status: 'error', message: 'ไม่พบข้อมูลสมาชิก' };
    }
    
    if (member.status !== 'ACTIVE' && member.role !== 'SUPERADMIN' && member.role !== 'ADMIN') {
      return { status: 'error', message: 'รอการอนุมัติจากแอดมินก่อนครับ' };
    }

    // Fetch all circles
    const { data: circles, error } = await supabaseAdmin
      .from('circles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch circles user is member of
    const { data: joinedCircleIds } = await supabaseAdmin
      .from('circle_players')
      .select('circle_id')
      .eq('member_id', data.member_id);
    
    const joinedSet = new Set(joinedCircleIds?.map(j => j.circle_id) || []);

    return { 
      status: 'success', 
      circles: circles.map(c => ({
        ...c, 
        is_participant: joinedSet.has(c.id)
      })) 
    };
  } catch (error) {
    throw error;
  }
}

export async function getCircleDetail(data) {
  try {
    const { data: circle, error: circleError } = await supabaseAdmin
      .from('circles')
      .select('*')
      .eq('id', data.circle_id)
      .single();

    if (circleError || !circle) return { status: 'error', message: 'ไม่พบวงแชร์ ID: ' + data.circle_id };

    const { data: players } = await supabaseAdmin.from('circle_players').select('*').eq('circle_id', data.circle_id);
    const { data: bids } = await supabaseAdmin.from('bids').select('*').eq('circle_id', data.circle_id).order('bid_amount', { ascending: false });
    const { data: slips } = await supabaseAdmin.from('slips').select('*').eq('circle_id', data.circle_id).order('uploaded_at', { ascending: false });

    return { 
      status: 'success', 
      circle,
      players: players || [], 
      bids: bids || [],
      slips: slips || []
    };
  } catch (error) {
    throw error;
  }
}

export async function joinCircle(data) {
  try {
    const { data: existingPlayer } = await supabaseAdmin
      .from('circle_players')
      .select('id')
      .eq('circle_id', data.circle_id)
      .eq('hand_no', data.hand_no)
      .single();

    if (existingPlayer) return { status: 'error', message: 'มือนี้มีคนจองแล้ว' };

    const { data: member } = await supabaseAdmin.from('members').select('name').eq('id', data.member_id).single();
    if (!member) return { status: 'error', message: 'Member not found' };

    const { error } = await supabaseAdmin.from('circle_players').insert([{
      circle_id: data.circle_id,
      hand_no: parseInt(data.hand_no),
      member_id: data.member_id,
      member_name: member.name,
      status: 'LIVE',
      interest_earned: 0
    }]);

    if (error) throw error;

    return { status: 'success', message: 'จองมือสำเร็จเรียบร้อย!' };
  } catch (error) {
    throw error;
  }
}

export async function submitBid(data) {
  try {
    const bidAmount = parseFloat(data.bid_amount);
    
    // UPSERT methodology
    const { error } = await supabaseAdmin.from('bids').upsert({
      circle_id: data.circle_id,
      period: data.period,
      member_id: data.member_id,
      bid_amount: bidAmount,
      bid_time: new Date()
    }, { onConflict: 'circle_id, period, member_id' });

    if (error) throw error;
    return { status: 'success', message: 'ส่งดอกเบี้ยเรียบร้อย!' };
  } catch (error) {
    throw error;
  }
}

export async function uploadSlip(data) {
  try {
    const { error } = await supabaseAdmin.from('slips').insert([{
      circle_id: data.circle_id,
      member_id: data.member_id,
      period: data.period,
      amount: data.amount,
      note: data.note || '-',
      image_url: data.image_url || 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
      status: 'PENDING',
      target_hand: data.hand_no || 'ALL',
      is_cash: data.is_cash === 'true'
    }]);

    if (error) throw error;

    let msgType = (data.is_cash === 'true') ? "💵 รับเงินสด" : "🧾 ส่งสลิป";
    await notifyAdmin(`${msgType} (งวด ${data.period})\nยอด: ${data.amount}`);

    return { status: 'success', message: 'บันทึกเรียบร้อย!' };
  } catch (error) {
    throw error;
  }
}

export async function verifySlip(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์อนุมัติสลิป' };
    }

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

export async function randomSelectBidder(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return { status: 'error', message: 'No Permission' };
  }
  // Simplified version. Logic should match exactly with the app script.
  return { status: 'error', message: 'randomSelectBidder Needs full translation' };
}

export async function startCircle(data) {
  try {
    // Only Admin or the Creator can start the circle
    const { data: circle } = await supabaseAdmin.from('circles').select('status, creator_id').eq('id', data.circle_id).single();
    if (!circle) throw new Error('Circle not found');
    if (circle.status !== 'OPEN') return { status: 'error', message: 'วงแชร์ไม่ได้อยู่ในสถานะที่สามารถเริ่มได้' };

    const { error } = await supabaseAdmin.from('circles').update({ status: 'ACTIVE' }).eq('id', data.circle_id);
    if (error) throw error;
    
    return { status: 'success', message: 'เริ่มวงแชร์เรียบร้อยแล้ว!' };
  } catch (error) {
    throw error;
  }
}

export async function cancelHand(data) {
  try {
    const { data: circle } = await supabaseAdmin.from('circles').select('status').eq('id', data.circle_id).single();
    if (!circle || circle.status !== 'OPEN') {
      return { status: 'error', message: 'ไม่สามารถยกเลิกได้เนื่องจากวงเริ่มดำเนินการไปแล้ว' };
    }

    const { data: player } = await supabaseAdmin.from('circle_players').select('*').eq('circle_id', data.circle_id).eq('hand_no', data.hand_no).single();
    if (!player) return { status: 'error', message: 'ไม่พบข้อมูลการจองมือนี้' };

    // Check permissions
    if (data.caller_id !== player.member_id && !['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ยกเลิกมือของคนอื่น' };
    }

    const { error } = await supabaseAdmin.from('circle_players').delete().eq('id', player.id);
    if (error) throw error;

    return { status: 'success', message: 'ยกเลิกการจองมือสำเร็จ' };
  } catch (error) {
    throw error;
  }
}

export async function changeHandOwner(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'มีเพียงแอดมินเท่านั้นที่เปลี่ยนมือให้คนอื่นได้' };
    }

    const { data: newMember } = await supabaseAdmin.from('members').select('name').eq('id', data.new_member_id).single();
    if (!newMember) return { status: 'error', message: 'ไม่พบชื่อสมาชิกใหม่ในระบบ' };

    const { error } = await supabaseAdmin.from('circle_players')
      .update({ member_id: data.new_member_id, member_name: newMember.name })
      .eq('circle_id', data.circle_id)
      .eq('hand_no', data.hand_no);

    if (error) throw error;

    return { status: 'success', message: `โอนมือสำเร็จ! โอนให้คุณ ${newMember.name}` };
  } catch (error) {
    throw error;
  }
}

export async function updateCircleSettings(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ปรับปรุงการตั้งค่า' };
    }

    const { error } = await supabaseAdmin
      .from('circles')
      .update({
        bid_start_time: data.bid_start_time,
        bid_end_time: data.bid_end_time,
        min_bid: parseFloat(data.min_bid),
        max_bid: parseFloat(data.max_bid),
        notify_hours: parseInt(data.notify_hours),
        close_mode: data.close_mode === 'ปิดอัตโนมัติ' ? 'AUTO' : 'MANUAL',
        interest_method: data.interest_method
      })
      .eq('id', data.circle_id);

    if (error) throw error;
    return { status: 'success', message: 'ปรับปรุงการตั้งค่าเรียบร้อยแล้ว!' };
  } catch (error) {
    throw error;
  }
}
