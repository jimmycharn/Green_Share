import { NextResponse } from 'next/server';
import { registerMember, updateProfile, getMembers } from '@/lib/controllers/member';
import { createCircle, getCircles, getCircleDetail, joinCircle, submitBid, uploadSlip, verifySlip, randomSelectBidder, startCircle, cancelHand, changeHandOwner, updateCircleSettings, closeBidding, closePeriod, deleteCircle, createPayout, verifyPayout } from '@/lib/controllers/circle';
import { manageSlot, approvePayment, getAdminDashboard, approveHouseMember, removeHouseMember, fullDeleteMember, updateMemberRole, assignMemberBank, transferMember, addBank, editBank, deleteBank, setDefaultBank } from '@/lib/controllers/admin';

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
    if (action === 'verify_slip') return NextResponse.json(await verifySlip(data));
    if (action === 'random_select_bidder') return NextResponse.json(await randomSelectBidder(data));
    if (action === 'start_circle') return NextResponse.json(await startCircle(data));
    if (action === 'cancel_hand') return NextResponse.json(await cancelHand(data));
    if (action === 'change_hand_owner') return NextResponse.json(await changeHandOwner(data));
    if (action === 'update_circle_settings') return NextResponse.json(await updateCircleSettings(data));
    if (action === 'close_bidding') return NextResponse.json(await closeBidding(data));
    if (action === 'close_period') return NextResponse.json(await closePeriod(data));
    if (action === 'delete_circle') return NextResponse.json(await deleteCircle(data));
    if (action === 'create_payout') return NextResponse.json(await createPayout(data));
    if (action === 'verify_payout') return NextResponse.json(await verifyPayout(data));

    // --- Admin Dashboard Routes ---
    if (action === 'get_admin_dashboard') return NextResponse.json(await getAdminDashboard(data));
    if (action === 'approve_house_member') return NextResponse.json(await approveHouseMember(data));
    if (action === 'remove_house_member') return NextResponse.json(await removeHouseMember(data));
    if (action === 'full_delete_member') return NextResponse.json(await fullDeleteMember(data));
    if (action === 'update_member_role') return NextResponse.json(await updateMemberRole(data));
    if (action === 'assign_member_bank') return NextResponse.json(await assignMemberBank(data));
    if (action === 'transfer_member') return NextResponse.json(await transferMember(data));
    if (action === 'add_bank') return NextResponse.json(await addBank(data));
    if (action === 'edit_bank') return NextResponse.json(await editBank(data));
    if (action === 'delete_bank') return NextResponse.json(await deleteBank(data));
    if (action === 'set_default_bank') return NextResponse.json(await setDefaultBank(data));

    // --- Legacy Admin ---
    if (action === 'manage_slot') return NextResponse.json(await manageSlot(data));
    if (action === 'approve_payment') return NextResponse.json(await approvePayment(data));

    return NextResponse.json({ status: 'error', message: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message || error.toString() }, { status: 500 });
  }
}
