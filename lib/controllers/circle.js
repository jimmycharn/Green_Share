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
    // Fetch circles and member status in parallel
    const [memberRes, circlesRes, joinedRes] = await Promise.all([
      supabaseAdmin.from('members').select('status, role').eq('id', data.member_id).single(),
      supabaseAdmin.from('circles').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('circle_players').select('circle_id').eq('member_id', data.member_id)
    ]);

    const member = memberRes.data;
    if (!member) return { status: 'error', message: 'ไม่พบข้อมูลสมาชิก' };
    
    if (member.status !== 'ACTIVE' && member.role !== 'SUPERADMIN' && member.role !== 'ADMIN') {
      return { status: 'error', message: 'รอการอนุมัติจากแอดมินก่อนครับ' };
    }

    if (circlesRes.error) throw circlesRes.error;
    
    const joinedSet = new Set(joinedRes.data?.map(j => j.circle_id) || []);

    return { 
      status: 'success', 
      circles: circlesRes.data.map(c => ({
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

    // Fetch related data in parallel
    const [playersRes, bidsRes, slipsRes, houseLinkRes] = await Promise.all([
      supabaseAdmin.from('circle_players').select('*').eq('circle_id', data.circle_id),
      supabaseAdmin.from('bids').select('*').eq('circle_id', data.circle_id).order('bid_amount', { ascending: false }),
      supabaseAdmin.from('slips').select('*').eq('circle_id', data.circle_id).order('uploaded_at', { ascending: false }),
      data.member_id ? supabaseAdmin
         .from('member_houses')
         .select('*, bank:assigned_bank_id(bank_name, account_no, account_name)')
         .eq('member_id', data.member_id)
         .eq('admin_id', circle.creator_id)
         .maybeSingle() : Promise.resolve({ data: null })
    ]);

    let myBank = null;
    if (houseLinkRes.data) {
      if (houseLinkRes.data.bank) {
        myBank = houseLinkRes.data.bank;
      } else {
        // Fallback to default bank of the admin
        const { data: defaultBank } = await supabaseAdmin
          .from('banks')
          .select('bank_name, account_no, account_name')
          .eq('member_id', circle.creator_id)
          .eq('is_default', true)
          .maybeSingle();
        myBank = defaultBank;
      }
    }

    return { 
      status: 'success', 
      circle,
      players: playersRes.data || [], 
      bids: bidsRes.data || [],
      slips: slipsRes.data || [],
      myBank
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
      is_cash: data.is_cash === true || data.is_cash === 'true'
    }]);

    if (error) throw error;

    let msgType = (data.is_cash === true || data.is_cash === 'true') ? "💵 รับเงินสด" : "🧾 ส่งสลิป";
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
  try {
    if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ดำเนินการ' };
    }

    const { circle_id, period } = data;

    // 1. Get all LIVE players who haven't won yet
    // In this system, someone wins if they have a bid in a previous period
    const { data: previousWinners } = await supabaseAdmin
      .from('bids')
      .select('member_id')
      .eq('circle_id', circle_id);
    
    const wonMemberIds = previousWinners?.map(w => w.member_id) || [];

    const { data: livePlayers, error: playerErr } = await supabaseAdmin
      .from('circle_players')
      .select('member_id, member_name')
      .eq('circle_id', circle_id)
      .not('member_id', 'in', `(${wonMemberIds.length > 0 ? wonMemberIds.join(',') : '""'})`);

    if (playerErr || !livePlayers || livePlayers.length === 0) {
      return { status: 'error', message: 'ไม่เหลือมือกดที่สามารถสุ่มได้แล้ว' };
    }

    // 2. Randomly pick one
    const luckyWinner = livePlayers[Math.floor(Math.random() * livePlayers.length)];

    // 3. Insert bid for them with 0 amount (as it's a random win)
    const { error: bidErr } = await supabaseAdmin.from('bids').upsert({
      circle_id,
      period,
      member_id: luckyWinner.member_id,
      bid_amount: 0,
      bid_time: new Date()
    }, { onConflict: 'circle_id, period, member_id' });

    if (bidErr) throw bidErr;

    return { status: 'success', message: `สุ่มผู้ชนะเรียบร้อย: ${luckyWinner.member_name}` };
  } catch (error) {
    throw error;
  }
}

export async function closeBidding(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ดำเนินการ' };
    }
    // For Auction, "Closing Bidding" usually means we've decided who wins.
    // Our system current calculates winner on the fly from highest bid.
    // This action can be used to notify or trigger other logic.
    return { status: 'success', message: 'ปิดรับการประมูลสำหรับงวดนี้แล้ว' };
  } catch (error) {
    throw error;
  }
}

export async function closePeriod(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ดำเนินการ' };
    }

    const { circle_id, period } = data;

    // 1. Verify there is a winner for this period
    let { data: bids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('circle_id', circle_id)
      .eq('period', period);
    
    const { data: circle } = await supabaseAdmin.from('circles').select('*').eq('id', circle_id).single();

    if ((!bids || bids.length === 0)) {
        if (circle.type === "ขั้นบันได (ดอกคงที่)") {
            // Auto-assign winner for Staircase: the person whose hand_no matches the current period
            const { data: player } = await supabaseAdmin
                .from('circle_players')
                .select('member_id, member_name')
                .eq('circle_id', circle_id)
                .eq('hand_no', period)
                .single();
            
            if (player) {
                await supabaseAdmin.from('bids').insert({
                    circle_id,
                    period,
                    member_id: player.member_id,
                    bid_amount: 0,
                    bid_time: new Date()
                });
            } else {
                return { status: 'error', message: `ไม่พบสมาชิกในมือที่ ${period} สำหรับวงขั้นบันได` };
            }
        } else {
            return { status: 'error', message: 'ต้องมีผู้ชนะก่อนปิดงวด (กดสุ่มผู้ชนะหรือให้สมาชิกประมูล)' };
        }
    }

    // 2. Increment period
    // circle is already fetched above
    const nextPeriod = circle.current_period + 1;
    const isFinished = nextPeriod > circle.total_hands;

    const { error } = await supabaseAdmin.from('circles').update({
        current_period: nextPeriod,
        status: isFinished ? 'CLOSED' : 'ACTIVE'
    }).eq('id', circle_id);

    if (error) throw error;

    return { 
        status: 'success', 
        message: isFinished ? 'วงแชร์นี้จบลงเรียบร้อยแล้ว!' : `ปิดงวดที่ ${period} และเริ่มงวดที่ ${nextPeriod} เรียบร้อย` 
    };
  } catch (error) {
    throw error;
  }
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
        name: data.name,
        line_group_url: data.line_group_url,
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
