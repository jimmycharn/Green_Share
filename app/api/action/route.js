import { NextResponse } from 'next/server';
import { registerMember, updateProfile, getMembers } from '@/lib/controllers/member';
import { createCircle, getCircles, getCircleDetail, joinCircle, submitBid, uploadSlip, randomSelectBidder } from '@/lib/controllers/circle';
import { manageSlot, approvePayment } from '@/lib/controllers/admin';

export async function POST(req) {
  try {
    const data = await req.json();
    const action = data.action;

    if (!action) {
      return NextResponse.json({ status: 'error', message: 'Action is required' }, { status: 400 });
    }

    // --- Member Routes ---
    if (action === 'register') return NextResponse.json(await registerMember(data));
    if (action === 'update_profile') return NextResponse.json(await updateProfile(data));
    if (action === 'get_members') return NextResponse.json(await getMembers(data));

    // --- Circle Routes ---
    if (action === 'create_circle') return NextResponse.json(await createCircle(data));
    if (action === 'get_circles') return NextResponse.json(await getCircles(data));
    if (action === 'get_circle_detail') return NextResponse.json(await getCircleDetail(data));
    if (action === 'join_circle') return NextResponse.json(await joinCircle(data));
    if (action === 'submit_bid') return NextResponse.json(await submitBid(data));
    if (action === 'upload_slip') return NextResponse.json(await uploadSlip(data));
    if (action === 'random_select_bidder') return NextResponse.json(await randomSelectBidder(data));

    // --- Admin Routes ---
    if (action === 'manage_slot') return NextResponse.json(await manageSlot(data));
    if (action === 'approve_payment') return NextResponse.json(await approvePayment(data));

    // TODO: Implement other actions as needed (get_pending_members, admin_pay_winner, etc.)

    return NextResponse.json({ status: 'error', message: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message || error.toString() }, { status: 500 });
  }
}
