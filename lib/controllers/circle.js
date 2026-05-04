import { supabaseAdmin } from '../supabase';
import {
  notifyAdmin,
  sendCircleFlex,
  sendSlipNotificationToAdmin,
  sendPayoutNotificationToMember,
  sendBidStartNotification,
} from '../line';
import { generatePeriodDates } from '../periodDates';

export async function createCircle(data) {
  try {
    // 1. Prepare circle row — id generated atomically by DB (next_circle_id())
    const newCircleData = {
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
      interest_method: data.interest_method || 'หักดอก',
      bid_permission: data.bid_permission || 'NONE',
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('circles')
      .insert([newCircleData])
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert Error:', insertError);
      return { status: 'error', message: `บันทึกข้อมูลล้มเหลว: ${insertError.message}` };
    }

    const newId = inserted.id;
    newCircleData.id = newId;

    // 2. Default assignment: period 1 → creator (ท้าวแชร์)
    await supabaseAdmin.from('circle_period_assignments').insert([
      {
        circle_id: newId,
        period: 1,
        member_id: data.creator_id,
      },
    ]);

    // 3. Auto-generate period dates based on frequency settings
    try {
      const periodDates = generatePeriodDates(
        data.start_date || new Date().toISOString().split('T')[0],
        data.total_hands,
        data.period_type || 'MONTHLY',
        parseInt(data.period_interval) || 1,
        data.period_value || ''
      );

      if (periodDates.length > 0) {
        const rows = periodDates.map((pd) => ({
          circle_id: newId,
          period: pd.period,
          period_date: pd.date,
          is_manual: false,
        }));
        await supabaseAdmin.from('circle_period_dates').insert(rows);
      }
    } catch (dateErr) {
      console.error('Period date generation error (non-fatal):', dateErr);
      // Non-fatal: circle was created successfully, dates can be regenerated later
    }

    // 4. Notify all members in the house with a beautiful Flex Message
    // Skip notification for step-interest (ขั้นบันได) circles — admin must
    // configure per-period amounts first, then manually trigger the notify.
    if (newCircleData.type !== 'ขั้นบันได (ดอกคงที่)') {
      try {
        const { data: houseMembers, error: fetchErr } = await supabaseAdmin
          .from('member_houses')
          .select('member_id, status, member:members!member_id(line_id, name)')
          .eq('admin_id', data.creator_id)
          .in('status', ['ACTIVE', 'PENDING']);

        if (fetchErr) {
          console.error('Error fetching house members:', fetchErr);
        }

        console.log(
          `Found ${houseMembers?.length || 0} members to notify for Admin ID: ${data.creator_id}`
        );

        if (houseMembers && houseMembers.length > 0) {
          for (const hm of houseMembers) {
            const lineUid = hm.member?.line_id;
            const memberName = hm.member?.name;
            const status = hm.status;

            if (lineUid) {
              console.log(`- Sending to: ${memberName} (${lineUid}) [Status: ${status}]`);
              await sendCircleFlex(lineUid, newCircleData);
            } else {
              console.warn(
                `- Skipping member ${hm.member_id}: No LINE UID found for ${memberName}`
              );
            }
          }
        }

        // Always notify the admin (the creator) via their UID if not already sent
        if (process.env.ADMIN_LINE_UID) {
          const adminInList = houseMembers?.some(
            (hm) => hm.member?.line_id === process.env.ADMIN_LINE_UID
          );
          if (!adminInList) {
            console.log(`- Sending to Admin (fallback): ${process.env.ADMIN_LINE_UID}`);
            await sendCircleFlex(process.env.ADMIN_LINE_UID, newCircleData);
          }
        }
      } catch (lineErr) {
        console.error('LINE Notification Unexpected Error:', lineErr);
      }
    } else {
      console.log(
        'Step-interest circle created — skipping auto LINE notification. Admin must set period amounts first.'
      );
    }

    return { status: 'success', id: newId };
  } catch (error) {
    console.error('Create Circle Unexpected Error:', error);
    return {
      status: 'error',
      message: `เกิดข้อผิดพลาดไม่คาดคิด: ${error.message || error.toString()}`,
    };
  }
}

// Scope rules:
//  • SUPERADMIN: sees every circle in the system.
//  • ADMIN     : sees circles they created (their own house) + any circle
//                they personally joined as a player (cross-house participation).
//                — does NOT inherit visibility from old `member_houses` rows
//                  (when they were a regular member).
//  • MEMBER    : sees circles created by the admin(s) of their active house(s)
//                + any circle they personally joined as a player.
export async function getCircles(data) {
  try {
    const [memberRes, joinedRes] = await Promise.all([
      supabaseAdmin.from('members').select('id, status, role').eq('id', data.member_id).single(),
      supabaseAdmin.from('circle_players').select('circle_id').eq('member_id', data.member_id),
    ]);

    const member = memberRes.data;
    if (!member) return { status: 'error', message: 'ไม่พบข้อมูลสมาชิก' };

    if (member.status !== 'ACTIVE' && member.role !== 'SUPERADMIN' && member.role !== 'ADMIN') {
      return { status: 'error', message: 'รอการอนุมัติจากแอดมินก่อนครับ' };
    }

    const joinedSet = new Set((joinedRes.data || []).map((j) => j.circle_id));

    let circlesData = [];

    if (member.role === 'SUPERADMIN') {
      const { data, error } = await supabaseAdmin
        .from('circles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      circlesData = data || [];
    } else {
      // Resolve allowed creator ids based on role.
      const allowedCreatorIds = new Set();
      if (member.role === 'ADMIN') {
        allowedCreatorIds.add(member.id); // their own house
      } else {
        // MEMBER → admins of every active house they belong to
        const { data: houses, error: hErr } = await supabaseAdmin
          .from('member_houses')
          .select('admin_id')
          .eq('member_id', member.id)
          .eq('status', 'ACTIVE');
        if (hErr) throw hErr;
        for (const h of houses || []) if (h.admin_id) allowedCreatorIds.add(h.admin_id);
      }

      const queries = [];
      if (allowedCreatorIds.size > 0) {
        queries.push(
          supabaseAdmin.from('circles').select('*').in('creator_id', Array.from(allowedCreatorIds))
        );
      }
      if (joinedSet.size > 0) {
        queries.push(supabaseAdmin.from('circles').select('*').in('id', Array.from(joinedSet)));
      }

      if (queries.length === 0) {
        circlesData = [];
      } else {
        const results = await Promise.all(queries);
        const dedup = new Map();
        for (const res of results) {
          if (res.error) throw res.error;
          for (const c of res.data || []) dedup.set(c.id, c);
        }
        circlesData = Array.from(dedup.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    }

    return {
      status: 'success',
      circles: circlesData.map((c) => ({
        ...c,
        is_participant: joinedSet.has(c.id),
      })),
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

    if (circleError || !circle)
      return { status: 'error', message: 'ไม่พบวงแชร์ ID: ' + data.circle_id };

    // Fetch related data in parallel
    const [
      playersRes,
      bidsRes,
      slipsRes,
      houseLinkRes,
      payoutsRes,
      assignmentsRes,
      periodDatesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('circle_players')
        .select('*, members(picture_url)')
        .eq('circle_id', data.circle_id),
      supabaseAdmin
        .from('bids')
        .select('*')
        .eq('circle_id', data.circle_id)
        .order('bid_amount', { ascending: false }),
      supabaseAdmin
        .from('slips')
        .select('*')
        .eq('circle_id', data.circle_id)
        .order('uploaded_at', { ascending: false }),
      data.member_id
        ? supabaseAdmin
            .from('member_houses')
            .select('*, bank:assigned_bank_id(bank_name, account_no, account_name)')
            .eq('member_id', data.member_id)
            .eq('admin_id', circle.creator_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from('admin_payments').select('*').eq('circle_id', data.circle_id),
      supabaseAdmin
        .from('circle_period_assignments')
        .select('period, member_id')
        .eq('circle_id', data.circle_id),
      supabaseAdmin
        .from('circle_period_dates')
        .select('*')
        .eq('circle_id', data.circle_id)
        .order('period', { ascending: true }),
    ]);

    const assignments = {};
    for (const a of assignmentsRes.data || []) {
      assignments[a.period] = a.member_id;
    }

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

    // Flatten members.picture_url into each player row
    const players = (playersRes.data || []).map(({ members: m, ...p }) => ({
      ...p,
      picture_url: m?.picture_url || null,
    }));

    return {
      status: 'success',
      circle: { ...circle, assignments },
      players,
      bids: bidsRes.data || [],
      slips: slipsRes.data || [],
      payouts: payoutsRes.data || [],
      myBank,
      periodDates: periodDatesRes.data || [],
    };
  } catch (error) {
    throw error;
  }
}

export async function joinCircle(data) {
  try {
    // MEMBER role can only book for themselves; ADMIN/SUPERADMIN can book for anyone
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(data.caller_role);
    const targetMemberId = isAdmin && data.member_id ? data.member_id : data.caller_id;

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('name')
      .eq('id', targetMemberId)
      .single();
    if (!member) return { status: 'error', message: 'Member not found' };

    // Rely on UNIQUE(circle_id, hand_no) constraint to prevent race — no pre-check
    // .select() returns the inserted row so no second query is needed
    const { data: newPlayer, error } = await supabaseAdmin
      .from('circle_players')
      .insert([
        {
          circle_id: data.circle_id,
          hand_no: parseInt(data.hand_no),
          member_id: targetMemberId,
          member_name: member.name,
          status: 'LIVE',
          interest_earned: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { status: 'error', message: 'มือนี้มีคนจองแล้ว' };
      }
      throw error;
    }

    return { status: 'success', message: 'จองมือสำเร็จเรียบร้อย!', newPlayer };
  } catch (error) {
    throw error;
  }
}

export async function submitBid(data) {
  try {
    const bidAmount = parseFloat(data.bid_amount);

    // If amount is 0, delete the bid (unset bidding status)
    if (bidAmount === 0) {
      const { error } = await supabaseAdmin
        .from('bids')
        .delete()
        .eq('circle_id', data.circle_id)
        .eq('period', data.period)
        .eq('member_id', data.member_id);

      if (error) throw error;
      return { status: 'success', message: 'ยกเลิกการประมูลเรียบร้อย' };
    }

    // UPSERT methodology for non-zero bids
    const { error } = await supabaseAdmin.from('bids').upsert(
      {
        circle_id: data.circle_id,
        period: data.period,
        member_id: data.member_id,
        bid_amount: bidAmount,
        bid_time: new Date(),
      },
      { onConflict: 'circle_id, period, member_id' }
    );

    if (error) throw error;
    return { status: 'success', message: 'ส่งดอกเบี้ยเรียบร้อย!' };
  } catch (error) {
    throw error;
  }
}

export async function uploadSlip(data) {
  try {
    // Only allow setting status directly if the caller is an admin
    let finalStatus = 'PENDING';
    if (data.status === 'APPROVED' && ['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      finalStatus = 'APPROVED';
    }

    // Guard: non-admin cannot re-upload if slip is already APPROVED
    if (finalStatus !== 'APPROVED') {
      const { data: existing } = await supabaseAdmin
        .from('slips')
        .select('id, status')
        .eq('circle_id', data.circle_id)
        .eq('member_id', data.member_id)
        .eq('period', data.period)
        .eq('status', 'APPROVED')
        .maybeSingle();
      if (existing)
        return { status: 'error', message: 'ได้รับการอนุมัติแล้ว ไม่สามารถส่งสลิปซ้ำได้' };
    }

    // Remove any earlier PENDING/REJECTED slip for the same slot to prevent duplicates
    await supabaseAdmin
      .from('slips')
      .delete()
      .eq('circle_id', data.circle_id)
      .eq('member_id', data.member_id)
      .eq('period', data.period)
      .in('status', ['PENDING', 'REJECTED']);

    const { error } = await supabaseAdmin.from('slips').insert([
      {
        circle_id: data.circle_id,
        member_id: data.member_id,
        period: data.period,
        amount: data.amount,
        note: data.note || (finalStatus === 'APPROVED' ? 'แอดมินชำระอัตโนมัติ' : '-'),
        image_url: data.image_url || 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
        status: finalStatus,
        target_hand: data.hand_no || 'ALL',
        is_cash: data.is_cash === true || data.is_cash === 'true',
      },
    ]);

    if (error) throw error;

    if (finalStatus !== 'APPROVED') {
      // Fetch circle and member info for rich notification
      const [circleRes, memberRes] = await Promise.all([
        supabaseAdmin.from('circles').select('name, creator_id').eq('id', data.circle_id).single(),
        supabaseAdmin.from('members').select('name, nickname').eq('id', data.member_id).single(),
      ]);
      if (circleRes.data?.creator_id) {
        const { data: creator } = await supabaseAdmin
          .from('members')
          .select('line_id')
          .eq('id', circleRes.data.creator_id)
          .single();
        if (creator?.line_id) {
          const memberName = memberRes.data?.nickname || memberRes.data?.name || 'สมาชิก';
          sendSlipNotificationToAdmin(creator.line_id, {
            circleName: circleRes.data.name,
            memberName,
            period: data.period,
            amount: data.amount,
            circleId: data.circle_id,
            isCash: data.is_cash === true || data.is_cash === 'true',
          });
        }
      }
    }

    return {
      status: 'success',
      message: finalStatus === 'APPROVED' ? 'บันทึกการชำระเงินเรียบร้อย' : 'บันทึกเรียบร้อย!',
    };
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

    // 1. Find winners of all PREVIOUS periods to count wins per member
    const { data: allPastBids } = await supabaseAdmin
      .from('bids')
      .select('member_id, period, bid_amount')
      .eq('circle_id', circle_id)
      .lt('period', period)
      .order('period', { ascending: true });

    const winCounts = {};
    if (allPastBids && allPastBids.length > 0) {
      // Group by period to find the highest bidder (winner) for each
      const bidsByPeriod = {};
      allPastBids.forEach((b) => {
        if (!bidsByPeriod[b.period]) bidsByPeriod[b.period] = [];
        bidsByPeriod[b.period].push(b);
      });

      Object.keys(bidsByPeriod).forEach((p) => {
        const sorted = bidsByPeriod[p].sort((a, b) => b.bid_amount - a.bid_amount);
        const winnerId = sorted[0].member_id;
        winCounts[winnerId] = (winCounts[winnerId] || 0) + 1;
      });
    }

    // 2. Get all hands and their owners
    const { data: allHands, error: playerErr } = await supabaseAdmin
      .from('circle_players')
      .select('member_id, member_name')
      .eq('circle_id', circle_id);

    if (playerErr || !allHands || allHands.length === 0) {
      return { status: 'error', message: 'ไม่พบข้อมูลสมาชิกในวงแชร์' };
    }

    // 3. Calculate total hands per member and filter eligible ones
    const memberStats = {};
    allHands.forEach((h) => {
      if (!memberStats[h.member_id]) {
        memberStats[h.member_id] = { id: h.member_id, name: h.member_name, total: 0 };
      }
      memberStats[h.member_id].total++;
    });

    const eligibleMembers = Object.values(memberStats).filter((m) => {
      const wins = winCounts[m.id] || 0;
      return wins < m.total;
    });

    if (eligibleMembers.length === 0) {
      return {
        status: 'error',
        message: 'ไม่เหลือสมาชิกที่สามารถสุ่มได้แล้ว (มือตายครบทุกคนแล้ว)',
      };
    }

    // 4. Randomly pick one ELIGIBLE PLAYER
    const luckyWinner = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];

    // 5. Insert bid for them with 0 amount (as it's a random win)
    const { error: bidErr } = await supabaseAdmin.from('bids').upsert(
      {
        circle_id,
        period,
        member_id: luckyWinner.id,
        bid_amount: 0,
        bid_time: new Date(),
      },
      { onConflict: 'circle_id, period, member_id' }
    );

    if (bidErr) throw bidErr;

    return { status: 'success', message: `สุ่มผู้ชนะเรียบร้อย: ${luckyWinner.name}` };
  } catch (error) {
    throw error;
  }
}

export async function closeBidding(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ดำเนินการ' };
    }

    // Check assignment (now in dedicated table)
    const { data: assignment } = await supabaseAdmin
      .from('circle_period_assignments')
      .select('member_id')
      .eq('circle_id', data.circle_id)
      .eq('period', data.period)
      .maybeSingle();
    const assignedMemberId = assignment?.member_id || null;

    if (assignedMemberId) {
      const { data: existingBids } = await supabaseAdmin
        .from('bids')
        .select('*')
        .eq('circle_id', data.circle_id)
        .eq('period', data.period);
      if (!existingBids || existingBids.length === 0) {
        await supabaseAdmin.from('bids').insert([
          {
            circle_id: data.circle_id,
            period: data.period,
            member_id: assignedMemberId,
            bid_amount: 0,
          },
        ]);
      }
    }

    const { error } = await supabaseAdmin
      .from('circles')
      .update({ current_period_bidding_closed: true })
      .eq('id', data.circle_id);

    if (error) throw error;
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
    const { data: bids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('circle_id', circle_id)
      .eq('period', period);

    const { data: circle } = await supabaseAdmin
      .from('circles')
      .select('*')
      .eq('id', circle_id)
      .single();

    if (!bids || bids.length === 0) {
      if (circle.type === 'ขั้นบันได (ดอกคงที่)') {
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
            bid_time: new Date(),
          });
        } else {
          return { status: 'error', message: `ไม่พบสมาชิกในมือที่ ${period} สำหรับวงขั้นบันได` };
        }
      } else {
        return {
          status: 'error',
          message: 'ต้องมีผู้ชนะก่อนปิดงวด (กดสุ่มผู้ชนะหรือให้สมาชิกประมูล)',
        };
      }
    }

    // 2. Increment period
    // circle is already fetched above
    const nextPeriod = circle.current_period + 1;
    const isFinished = nextPeriod > circle.total_hands;

    const { error } = await supabaseAdmin
      .from('circles')
      .update({
        current_period: nextPeriod,
        status: isFinished ? 'CLOSED' : 'ACTIVE',
        current_period_bidding_closed: false, // reset flag when moving to next period
      })
      .eq('id', circle_id);

    if (error) throw error;

    return {
      status: 'success',
      message: isFinished
        ? 'วงแชร์นี้จบลงเรียบร้อยแล้ว!'
        : `ปิดงวดที่ ${period} และเริ่มงวดที่ ${nextPeriod} เรียบร้อย`,
    };
  } catch (error) {
    throw error;
  }
}

export async function startCircle(data) {
  try {
    // Only Admin or the Creator can start the circle
    const { data: circle } = await supabaseAdmin
      .from('circles')
      .select('status, creator_id')
      .eq('id', data.circle_id)
      .single();
    if (!circle) throw new Error('Circle not found');
    if (circle.status !== 'OPEN')
      return { status: 'error', message: 'วงแชร์ไม่ได้อยู่ในสถานะที่สามารถเริ่มได้' };

    const { error } = await supabaseAdmin
      .from('circles')
      .update({ status: 'ACTIVE' })
      .eq('id', data.circle_id);
    if (error) throw error;

    return { status: 'success', message: 'เริ่มวงแชร์เรียบร้อยแล้ว!' };
  } catch (error) {
    throw error;
  }
}

export async function cancelHand(data) {
  try {
    // Parallel: fetch circle status + player record in one round-trip
    const [circleRes, playerRes] = await Promise.all([
      supabaseAdmin.from('circles').select('status').eq('id', data.circle_id).single(),
      supabaseAdmin
        .from('circle_players')
        .select('id, member_id')
        .eq('circle_id', data.circle_id)
        .eq('hand_no', data.hand_no)
        .single(),
    ]);

    if (!circleRes.data || circleRes.data.status !== 'OPEN') {
      return { status: 'error', message: 'ไม่สามารถยกเลิกได้เนื่องจากวงเริ่มดำเนินการไปแล้ว' };
    }
    if (!playerRes.data) return { status: 'error', message: 'ไม่พบข้อมูลการจองมือนี้' };

    const player = playerRes.data;

    // Check permissions
    if (
      data.caller_id !== player.member_id &&
      !['SUPERADMIN', 'ADMIN'].includes(data.caller_role)
    ) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ยกเลิกมือของคนอื่น' };
    }

    const { error } = await supabaseAdmin.from('circle_players').delete().eq('id', player.id);
    if (error) throw error;

    // Return deleted player's ID so the client can update state locally (no extra SELECT)
    return { status: 'success', message: 'ยกเลิกการจองมือสำเร็จ', deletedPlayerId: player.id };
  } catch (error) {
    throw error;
  }
}

export async function changeHandOwner(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'มีเพียงแอดมินเท่านั้นที่เปลี่ยนมือให้คนอื่นได้' };
    }

    const { data: newMember } = await supabaseAdmin
      .from('members')
      .select('name')
      .eq('id', data.new_member_id)
      .single();
    if (!newMember) return { status: 'error', message: 'ไม่พบชื่อสมาชิกใหม่ในระบบ' };

    const { error } = await supabaseAdmin
      .from('circle_players')
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

    // Period-specific assignment update (stored in circle_period_assignments)
    if (data.period_config) {
      const { period, assigned_to, amount } = data.period_config;
      if (!assigned_to || assigned_to === 'NONE') {
        await supabaseAdmin
          .from('circle_period_assignments')
          .delete()
          .eq('circle_id', data.circle_id)
          .eq('period', period);
      } else {
        await supabaseAdmin.from('circle_period_assignments').upsert(
          {
            circle_id: data.circle_id,
            period: parseInt(period),
            member_id: assigned_to,
          },
          { onConflict: 'circle_id,period' }
        );
      }

      // Update amount and period_date in circle_period_dates if provided
      const updateDatePayload = {
        circle_id: data.circle_id,
        period: parseInt(period),
      };
      if (amount !== undefined && amount !== null && amount !== '') {
        updateDatePayload.amount = parseFloat(amount) || 0;
      }
      if (data.period_config.period_date) {
        updateDatePayload.period_date = data.period_config.period_date;
        updateDatePayload.is_manual = true;
      }

      // Use upsert to handle both existing and missing rows
      if (updateDatePayload.amount !== undefined || updateDatePayload.period_date) {
        // Ensure we have a period_date for upsert (needed as NOT NULL column)
        if (!updateDatePayload.period_date) {
          const { data: existingRow } = await supabaseAdmin
            .from('circle_period_dates')
            .select('period_date')
            .eq('circle_id', data.circle_id)
            .eq('period', parseInt(period))
            .maybeSingle();
          updateDatePayload.period_date =
            existingRow?.period_date || new Date().toISOString().split('T')[0];
        }
        await supabaseAdmin
          .from('circle_period_dates')
          .upsert(updateDatePayload, { onConflict: 'circle_id,period' });
      }
    }

    const updatePayload = {
      name: data.name,
      line_group_url: data.line_group_url,
      bid_start_time: data.bid_start_time,
      bid_end_time: data.bid_end_time,
      min_bid: parseFloat(data.min_bid),
      max_bid: parseFloat(data.max_bid),
      notify_hours: parseInt(data.notify_hours),
      close_mode: data.close_mode === 'ปิดอัตโนมัติ' ? 'AUTO' : 'MANUAL',
      interest_method: data.interest_method,
      bid_permission: data.bid_permission,
    };
    if (typeof data.notify_message === 'string') {
      updatePayload.notify_message = data.notify_message;
    }

    const { error } = await supabaseAdmin
      .from('circles')
      .update(updatePayload)
      .eq('id', data.circle_id);

    if (error) throw error;
    return { status: 'success', message: 'ปรับปรุงการตั้งค่าเรียบร้อยแล้ว!' };
  } catch (error) {
    throw error;
  }
}

export async function notifyBidStart(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ส่งการแจ้งเตือน' };
    }

    const { data: circle, error: circleErr } = await supabaseAdmin
      .from('circles')
      .select('id, name, min_bid, max_bid, current_period')
      .eq('id', data.circle_id)
      .single();

    if (circleErr || !circle) return { status: 'error', message: 'ไม่พบวงแชร์' };

    const period = data.period || circle.current_period;

    // Fetch all active players in this circle with their line_ids
    const { data: players, error: playersErr } = await supabaseAdmin
      .from('circle_players')
      .select('member_id, status, member:members!member_id(line_id)')
      .eq('circle_id', data.circle_id)
      .eq('status', 'ACTIVE');

    if (playersErr) throw playersErr;

    // Deduplicate by line_id
    const sentIds = new Set();
    let sent = 0;
    for (const p of players || []) {
      const lineId = p.member?.line_id;
      if (lineId && !sentIds.has(lineId)) {
        sentIds.add(lineId);
        await sendBidStartNotification(lineId, {
          circleName: circle.name,
          period,
          minBid: circle.min_bid || 0,
          maxBid: circle.max_bid || 0,
          circleId: circle.id,
        });
        sent++;
      }
    }

    return {
      status: 'success',
      message: `ส่งแจ้งเตือนเปิดประมูลให้สมาชิก ${sent} คนเรียบร้อยแล้ว`,
    };
  } catch (error) {
    throw error;
  }
}

export async function notifyCircleMembers(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ส่งการแจ้งเตือน' };
    }

    const { data: circle, error: circleErr } = await supabaseAdmin
      .from('circles')
      .select('*')
      .eq('id', data.circle_id)
      .single();

    if (circleErr || !circle) return { status: 'error', message: 'ไม่พบวงแชร์' };

    const { data: houseMembers, error: fetchErr } = await supabaseAdmin
      .from('member_houses')
      .select('member_id, status, member:members!member_id(line_id, name)')
      .eq('admin_id', circle.creator_id)
      .in('status', ['ACTIVE', 'PENDING']);

    if (fetchErr) throw fetchErr;

    let sent = 0;
    if (houseMembers && houseMembers.length > 0) {
      for (const hm of houseMembers) {
        const lineUid = hm.member?.line_id;
        if (lineUid) {
          await sendCircleFlex(lineUid, circle);
          sent++;
        }
      }
    }

    // Fallback: always notify the platform admin
    if (process.env.ADMIN_LINE_UID) {
      const adminInList = houseMembers?.some(
        (hm) => hm.member?.line_id === process.env.ADMIN_LINE_UID
      );
      if (!adminInList) {
        await sendCircleFlex(process.env.ADMIN_LINE_UID, circle);
        sent++;
      }
    }

    return { status: 'success', message: `ส่งแจ้งเตือนให้สมาชิก ${sent} คนเรียบร้อยแล้ว!` };
  } catch (error) {
    throw error;
  }
}

export async function deleteCircle(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ลบวงแชร์' };
    }

    const { error } = await supabaseAdmin.from('circles').delete().eq('id', data.circle_id);

    if (error) throw error;
    return { status: 'success', message: 'ลบวงแชร์เรียบร้อยแล้ว!' };
  } catch (error) {
    throw error;
  }
}

export async function createPayout(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์ดำเนินการ' };
    }

    // Delete old pending/rejected payout for this specific win if exists
    await supabaseAdmin
      .from('admin_payments')
      .delete()
      .eq('circle_id', data.circle_id)
      .eq('period', data.period)
      .eq('member_id', data.member_id);

    const { error } = await supabaseAdmin.from('admin_payments').insert([
      {
        circle_id: data.circle_id,
        member_id: data.member_id,
        period: data.period,
        amount: data.amount,
        image_url: data.image_url || 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
        status: data.auto_approve === true ? 'APPROVED' : 'PENDING',
        is_cash: data.is_cash === true,
      },
    ]);

    if (error) throw error;

    // Notify the recipient member via LINE
    const [circleRes, memberRes] = await Promise.all([
      supabaseAdmin.from('circles').select('name').eq('id', data.circle_id).single(),
      supabaseAdmin.from('members').select('line_id').eq('id', data.member_id).single(),
    ]);
    if (circleRes.data && memberRes.data?.line_id) {
      sendPayoutNotificationToMember(memberRes.data.line_id, {
        circleName: circleRes.data.name,
        period: data.period,
        amount: data.amount,
        circleId: data.circle_id,
        isCash: data.is_cash === true,
        autoApproved: data.auto_approve === true,
      });
    }

    return { status: 'success', message: 'ส่งหลักฐานการโอนเงินให้ผู้ชนะเรียบร้อย' };
  } catch (error) {
    throw error;
  }
}

export async function verifyPayout(data) {
  try {
    const { payout_id, status } = data; // 'APPROVED' or 'REJECTED'

    const { data: payout } = await supabaseAdmin
      .from('admin_payments')
      .select('member_id')
      .eq('id', payout_id)
      .single();
    if (!payout) return { status: 'error', message: 'ไม่พบรายการชำระเงิน' };

    if (data.caller_id !== payout.member_id) {
      return { status: 'error', message: 'คุณไม่มีสิทธิ์ตรวจสอบรายการนี้' };
    }

    const { error } = await supabaseAdmin
      .from('admin_payments')
      .update({ status: status })
      .eq('id', payout_id);

    if (error) throw error;
    return {
      status: 'success',
      message: status === 'APPROVED' ? 'ยืนยันการรับเงินเรียบร้อย' : 'ปฏิเสธรายการเรียบร้อย',
    };
  } catch (error) {
    throw error;
  }
}

export async function updatePeriodDate(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์แก้ไขวันงวด' };
    }

    const updatePayload = {
      circle_id: data.circle_id,
      period: parseInt(data.period),
      period_date: data.period_date,
      is_manual: true,
    };
    if (data.amount !== undefined) {
      updatePayload.amount = data.amount;
    }

    const { error } = await supabaseAdmin
      .from('circle_period_dates')
      .upsert(updatePayload, { onConflict: 'circle_id,period' });

    if (error) throw error;
    return { status: 'success', message: `อัปเดตวันงวดที่ ${data.period} เรียบร้อย` };
  } catch (error) {
    throw error;
  }
}

export async function regeneratePeriodDates(data) {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
      return { status: 'error', message: 'ไม่มีสิทธิ์รีเซ็ตวันงวด' };
    }

    // Fetch circle settings
    const { data: circle, error: fetchErr } = await supabaseAdmin
      .from('circles')
      .select('total_hands, start_date, period_type, period_interval, period_value')
      .eq('id', data.circle_id)
      .single();

    if (fetchErr || !circle) {
      return { status: 'error', message: 'ไม่พบข้อมูลวงแชร์' };
    }

    // Fetch manually set dates to preserve them
    const { data: manualDates } = await supabaseAdmin
      .from('circle_period_dates')
      .select('period, period_date, amount')
      .eq('circle_id', data.circle_id)
      .eq('is_manual', true);

    const manualMap = new Map();
    const manualAmountMap = new Map();
    for (const md of manualDates || []) {
      manualMap.set(md.period, md.period_date);
      if (md.amount !== null && md.amount !== undefined) {
        manualAmountMap.set(md.period, md.amount);
      }
    }

    // Generate new dates
    const startStr =
      circle.start_date instanceof Date
        ? circle.start_date.toISOString().split('T')[0]
        : typeof circle.start_date === 'string'
          ? circle.start_date.split('T')[0]
          : new Date().toISOString().split('T')[0];

    const generated = generatePeriodDates(
      startStr,
      circle.total_hands,
      circle.period_type || 'MONTHLY',
      parseInt(circle.period_interval) || 1,
      circle.period_value || ''
    );

    // Merge: keep manual dates, replace auto dates
    const rows = generated.map((pd) => ({
      circle_id: data.circle_id,
      period: pd.period,
      period_date: manualMap.has(pd.period) ? manualMap.get(pd.period) : pd.date,
      amount: manualAmountMap.has(pd.period) ? manualAmountMap.get(pd.period) : null,
      is_manual: manualMap.has(pd.period),
    }));

    // Delete all existing and re-insert
    await supabaseAdmin.from('circle_period_dates').delete().eq('circle_id', data.circle_id);

    if (rows.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('circle_period_dates').insert(rows);
      if (insertErr) throw insertErr;
    }

    return {
      status: 'success',
      message: `รีเซ็ตวันงวดเรียบร้อย (${rows.length} งวด, ${manualMap.size} งวดที่กำหนดเองไม่ถูกเปลี่ยน)`,
      dates: rows,
    };
  } catch (error) {
    throw error;
  }
}

export async function getPeriodDates(data) {
  try {
    const { data: dates, error } = await supabaseAdmin
      .from('circle_period_dates')
      .select('period, period_date, is_manual, amount')
      .eq('circle_id', data.circle_id)
      .order('period', { ascending: true });

    if (error) throw error;
    return { status: 'success', dates: dates || [] };
  } catch (error) {
    throw error;
  }
}
