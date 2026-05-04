// @ts-nocheck
// Step 6c: legacy JS migrated to TSX with broad types only.
// Strict typing of this 2k-line file is deferred — see @/app/circles/[id]/page.tsx
// callers receive correct shadcn/lucide types via imports below. Internal
// business logic types (Period, Bid winner, etc.) intentionally use `any`
// pending future incremental refactor.
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { authHeaders } from '@/lib/authHeaders';
import { callAction } from '@/lib/api';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Loose types kept intentionally — full domain modeling is out of scope.
type AnyRecord = Record<string, any>;
type Circle = AnyRecord & { id: string; creator_id?: string; status?: string; name?: string };
type Player = AnyRecord & { member_id?: string; member_name?: string };
type Bid = AnyRecord;
type Slip = AnyRecord;
type Payout = AnyRecord & { id?: string; image_url?: string; amount?: number | string };
type Member = AnyRecord & {
  id: string;
  name?: string;
  nickname?: string;
  custom_nickname?: string | null;
};
type Bank = AnyRecord & {
  bank_name?: string;
  account_no?: string;
  account_name?: string;
};

export default function CircleDetail() {
  const router = useRouter();
  const params = useParams();
  const circleId = params.id as string;
  const confirm = useConfirm();
  const { dbUser, profile, liff, isLoading: isUserLoading } = useUser() as any;

  const [isInitializing, setIsInitializing] = useState(true);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [periodDates, setPeriodDates] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState<string>('');

  // Hand Management States
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [adminModal, setAdminModal] = useState<{
    open: boolean;
    mode: string;
    handNo: any;
  }>({ open: false, mode: '', handNo: '' });
  const [slipModal, setSlipModal] = useState<{ open: boolean; period: any }>({
    open: false,
    period: null,
  });
  const [uploadData, setUploadData] = useState<AnyRecord>({
    amount: '',
    note: '',
    image_url: '',
  });
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<string>('');
  const [expandedPeriod, setExpandedPeriod] = useState<any>(null);
  const [bidModal, setBidModal] = useState<{ open: boolean; period: any }>({
    open: false,
    period: null,
  });
  const [configModal, setConfigModal] = useState<{
    open: boolean;
    period: any;
    mode?: string;
  }>({ open: false, period: null, mode: '' });
  const [payoutModal, setPayoutModal] = useState<{
    open: boolean;
    period: any;
    winner_id: any;
    winner_name: string;
    amount: number;
  }>({
    open: false,
    period: null,
    winner_id: null,
    winner_name: '',
    amount: 0,
  });
  const [inspectPayoutModal, setInspectPayoutModal] = useState<{
    open: boolean;
    payout: Payout | null;
  }>({ open: false, payout: null });
  const [reviewSlipModal, setReviewSlipModal] = useState<{
    open: boolean;
    slip: AnyRecord | null;
  }>({ open: false, slip: null });
  const [bidAmount, setBidAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'TRANSFER' | 'CASH'>('TRANSFER');
  const [myBank, setMyBank] = useState<Bank | null>(null);
  const [settingsData, setSettingsData] = useState<AnyRecord>({
    name: '',
    line_group_url: '',
    bid_start_time: '12:00',
    bid_end_time: '18:00',
    min_bid: '0',
    max_bid: '1000',
    notify_hours: '24',
    close_mode: 'แอดมินปิดเอง',
    interest_method: 'หักดอก',
  });

  // File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const isCircleAdmin =
    dbUser &&
    circle &&
    (['SUPERADMIN', 'ADMIN'].includes(dbUser.role) || dbUser.id === circle.creator_id);

  useEffect(() => {
    if (!dbUser || !circleId) return;
    fetchCircleDetail();
    // Pre-fetch member list in parallel for admins (needed for booking modal)
    if (['ADMIN', 'SUPERADMIN'].includes(dbUser.role) && allMembers.length === 0) {
      callAction('get_members', { member_id: dbUser.id })
        .then((d) => {
          if (d.status === 'success') setAllMembers(d.members);
        })
        .catch(() => {});
    }
  }, [dbUser, circleId]);

  useEffect(() => {
    // Covers the rare case: a MEMBER-role user who is the circle creator
    if (!isCircleAdmin || allMembers.length > 0) return;
    if (['ADMIN', 'SUPERADMIN'].includes(dbUser?.role)) return; // already fetched above
    callAction('get_members', { member_id: dbUser.id })
      .then((data) => {
        if (data.status === 'success') setAllMembers(data.members);
      })
      .catch((err) => console.log(err));
  }, [isCircleAdmin, dbUser]);

  const fetchCircleDetail = async () => {
    const data = await callAction('get_circle_detail', {
      circle_id: circleId,
      member_id: dbUser?.id,
    });
    if (data.status === 'success') {
      setCircle(data.circle);
      setPlayers(data.players || []);
      setBids(data.bids || []);
      setSlips(data.slips || []);
      setPayouts(data.payouts || []);
      setPeriodDates(data.periodDates || []);
      setMyBank(data.myBank);

      // Conditional Default Tab
      if (!activeTab) {
        setActiveTab('timeline');
      }
    } else {
      setMessage({ type: 'error', text: data.message || 'ไม่พบวงแชร์นี้' });
    }
    setIsInitializing(false);
  };

  const handleMemberJoin = async (handNo) => {
    const ok = await confirm({
      title: 'จองมือ',
      description: `ยืนยันการจองมือที่ ${handNo}?`,
    });
    if (!ok) return;
    try {
      const resData = await callAction('join_circle', {
        circle_id: circleId,
        hand_no: handNo,
        member_id: dbUser.id,
      });
      if (resData.status === 'success') {
        setMessage({ type: 'success', text: 'จองมือสำเร็จ!' });
        if ((resData as any).newPlayer) setPlayers((prev) => [...prev, (resData as any).newPlayer]);
        else fetchCircleDetail();
      } else setMessage({ type: 'error', text: resData.message });
    } catch (err) {
      setMessage({ type: 'error', text: 'การเชื่อมต่อขัดข้อง' });
    }
  };

  const submitAdminModal = async () => {
    if (!adminSelectedUserId) return;
    const isJoin = adminModal.mode === 'JOIN';
    if (!isJoin) {
      const ok = await confirm({
        title: 'โอนมือ',
        description: 'ยืนยันการโอนมือให้สมาชิกท่านนี้?',
      });
      if (!ok) return;
    }
    try {
      const actionName = isJoin ? 'join_circle' : 'change_hand_owner';
      const payload = isJoin
        ? {
            circle_id: circleId,
            hand_no: adminModal.handNo,
            member_id: adminSelectedUserId,
          }
        : {
            circle_id: circleId,
            hand_no: adminModal.handNo,
            new_member_id: adminSelectedUserId,
            caller_id: dbUser.id,
            caller_role: dbUser.role,
          };

      const data = await callAction(actionName, payload);
      if (data.status === 'success') {
        setAdminModal({ open: false, mode: '', handNo: '' });
        if (isJoin && (data as any).newPlayer)
          setPlayers((prev) => [...prev, (data as any).newPlayer]);
        else fetchCircleDetail();
        setMessage({ type: 'success', text: data.message });
      } else setMessage({ type: 'error', text: data.message });
    } catch {
      setMessage({ type: 'error', text: 'การเชื่อมต่อขัดข้อง' });
    }
  };

  const handleStartCircle = async () => {
    const ok = await confirm({
      title: 'เริ่มวงแชร์',
      description: 'ยืนยันการเริ่มวงแชร์? ระบบจะปิดรับการจองมือตามปกติและเปลี่ยนสถานะเป็น ACTIVE',
    });
    if (!ok) return;
    try {
      const data = await callAction('start_circle', {
        circle_id: circleId,
        caller_role: dbUser.role,
      });
      if (data.status === 'success') fetchCircleDetail();
      setMessage({ type: data.status, text: data.message });
    } catch {
      setMessage({ type: 'error', text: 'การเชื่อมต่อขัดข้อง' });
    }
  };

  const handleCancelHand = async (e, handNo) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'ยกเลิกจองมือ',
      description: `ยืนยันการยกเลิกจองมือที่ ${handNo}?`,
      destructive: true,
    });
    if (!ok) return;
    try {
      const data = await callAction('cancel_hand', {
        circle_id: circleId,
        hand_no: handNo,
        caller_id: dbUser.id,
        caller_role: dbUser.role,
      });
      if (data.status === 'success') {
        if ((data as any).deletedPlayerId)
          setPlayers((prev) => prev.filter((p) => p.id !== (data as any).deletedPlayerId));
        else fetchCircleDetail();
      }
      setMessage({ type: data.status, text: data.message });
    } catch {
      setMessage({ type: 'error', text: 'การเชื่อมต่อขัดข้อง' });
    }
  };

  const openAdminChangeModal = (e, handNo) => {
    e.stopPropagation();
    setAdminModal({ open: true, mode: 'CHANGE', handNo });
    setAdminSelectedUserId('');
  };

  const handleEmptyHandClick = (handNo) => {
    if (circle.status !== 'OPEN') return;
    if (isCircleAdmin) {
      setAdminModal({ open: true, mode: 'JOIN', handNo });
      setAdminSelectedUserId(dbUser.id);
    } else {
      handleMemberJoin(handNo);
    }
  };

  const handleVerifySlip = async (slipId) => {
    const ok = await confirm({
      title: 'อนุมัติสลิป',
      description: 'ยืนยันการอนุมัติสลิปนี้?',
    });
    if (!ok) return;
    try {
      const data = await callAction('verify_slip', { slip_id: slipId, caller_role: dbUser.role });
      if (data.status === 'success') {
        setReviewSlipModal({ open: false, slip: null });
        fetchCircleDetail();
      }
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleUploadSlip = async (e) => {
    e.preventDefault();
    if (!uploadData.amount) {
      toast.error('กรุณาระบุยอดเงิน');
      return;
    }

    let finalImageUrl = uploadData.image_url;
    setUploadLoading(true);

    try {
      // 1. Upload File to Storage if selected
      if (selectedFile && paymentMode === 'TRANSFER') {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${circleId}/${Date.now()}.${fileExt}`;

        const { data: uploadRes, error: uploadError } = await supabase.storage
          .from('slips')
          .upload(fileName, selectedFile);

        if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message);

        const {
          data: { publicUrl },
        } = supabase.storage.from('slips').getPublicUrl(uploadRes.path);

        finalImageUrl = publicUrl;
      }

      // 2. Submit Action
      const data = await callAction('upload_slip', {
        circle_id: circleId,
        member_id: dbUser.id,
        period: slipModal.period,
        amount: uploadData.amount,
        note: uploadData.note,
        image_url: finalImageUrl,
        is_cash: paymentMode === 'CASH',
      });
      if (data.status === 'success') {
        setUploadData({ amount: '', note: '', image_url: '' });
        setSelectedFile(null);
        setFilePreview(null);
        setSlipModal({ open: false, period: null });
        fetchCircleDetail();
        setMessage({ type: 'success', text: 'ส่งสลิปเรียบร้อย!' });
      } else toast.error(data.message);
    } catch (err) {
      toast.error(err.message || 'การเชื่อมต่อขัดข้อง');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    if (bidAmount === '') return;
    const amount = parseFloat(bidAmount);

    // Filter non-zero bids for validation
    if (amount !== 0) {
      if (amount < circle.min_bid || amount > circle.max_bid) {
        toast.error(
          `กรุณาระบุยอดเปียตามเงื่อนไขวงแชร์ (${circle.min_bid.toLocaleString()} - ${circle.max_bid.toLocaleString()} บาท)`
        );
        return;
      }
    }

    try {
      const data = await callAction('submit_bid', {
        circle_id: circleId,
        period: bidModal.period,
        member_id: dbUser.id,
        bid_amount: amount,
      });
      if (data.status === 'success') {
        setBidModal({ open: false, period: null });
        setBidAmount('');
        fetchCircleDetail();
        if (amount === 0) setMessage({ type: 'success', text: 'ยกเลิกการประมูลเรียบร้อย' });
      } else toast.error(data.message);
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง');
    }
  };

  const handleAdminAutoPay = async (period) => {
    const amt = getRequiredAmount(period);
    try {
      const data = await callAction('upload_slip', {
        circle_id: circleId,
        member_id: dbUser.id,
        period: period,
        amount: amt,
        status: 'APPROVED',
        caller_role: dbUser.role,
      });
      if (data.status === 'success') {
        fetchCircleDetail();
        setMessage({ type: 'success', text: 'แอดมินชำระเงินเรียบร้อย!' });
      } else toast.error(data.message);
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง');
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const data = await callAction('update_circle_settings', {
        circle_id: circleId,
        caller_role: dbUser.role,
        ...settingsData,
        period_config: configModal.period
          ? {
              period: configModal.period,
              assigned_to: settingsData.assigned_to,
              amount: settingsData.amount,
              period_date: settingsData.period_date,
            }
          : null,
      });
      if (data.status === 'success') {
        setConfigModal({ open: false, period: null });
        fetchCircleDetail();
      } else toast.error(data.message);
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง');
    }
  };

  const handleCircleAction = async (action, period) => {
    let confirmMsg = '';
    if (action === 'random_select_bidder')
      confirmMsg = 'สุ่มหาผู้ชนะสำหรับงวดนี้? (จะใช้กรณีไม่มีคนประมูลดอก)';
    if (action === 'close_bidding') confirmMsg = 'ยืนยันการปิดรับประมูลของงวดนี้?';
    if (action === 'close_period')
      confirmMsg = 'ยืนยันการปิดงวดและเริ่มงวดถัดไป? (ตรวจสอบว่าทุกคนชำระเงินเรียบร้อยแล้ว)';

    if (confirmMsg) {
      const ok = await confirm({ title: 'ยืนยัน', description: confirmMsg });
      if (!ok) return;
    }

    try {
      const data = await callAction(action, {
        circle_id: circleId,
        period,
        caller_role: dbUser.role,
      });
      if (data.status === 'success') {
        setMessage({ type: 'success', text: data.message });
        fetchCircleDetail();
      } else toast.error(data.message);
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง');
    }
  };

  const toggleAccordion = (period) => {
    setExpandedPeriod(expandedPeriod === period ? null : period);
  };

  const getRequiredAmount = (period) => {
    if (!circle || !dbUser) return 0;

    // 1. Identify all winner IDs for past periods
    const pastWinnersMap = {}; // period -> winner_id
    const bidsByP = {};
    bids.forEach((b) => {
      if (b.period < period) {
        if (!bidsByP[b.period]) bidsByP[b.period] = [];
        bidsByP[b.period].push(b);
      }
    });
    Object.keys(bidsByP).forEach((p) => {
      const sorted = bidsByP[p].sort((a, b) => b.bid_amount - a.bid_amount);
      pastWinnersMap[p] = sorted[0].member_id;
    });

    // 2. Count how many wins the current user has and sum their bid amounts if needed
    const userWins = [];
    Object.keys(pastWinnersMap).forEach((p) => {
      if (pastWinnersMap[p] === dbUser.id) {
        const winningBid = bids.find((b) => b.period === parseInt(p) && b.member_id === dbUser.id);
        if (winningBid) userWins.push(winningBid);
      }
    });

    const userHandsCount = players.filter((p) => p.member_id === dbUser.id).length;
    const deadHandsCount = userWins.length;
    const liveHandsCount = userHandsCount - deadHandsCount;

    let totalAmount = 0;
    // Every hand pays the base amount
    totalAmount += userHandsCount * circle.amount_per_hand;

    // If method is 'ไม่หักดอก', dead hands also pay their respective bid amounts
    if (circle.interest_method === 'ไม่หักดอก') {
      userWins.forEach((win) => {
        totalAmount += win.bid_amount;
      });
    }

    return totalAmount;
  };

  const getAssignedTo = (period) => {
    if (!circle?.assignments) return null;
    return circle.assignments[period] || circle.assignments[String(period)] || null;
  };

  const isBiddingClosed = (period) =>
    circle?.current_period === period && Boolean(circle?.current_period_bidding_closed);

  const canUserBid = (period) => {
    if (!circle || !dbUser) return false;

    // Assignment check: if this period is assigned, no manual bidding
    const assignedTo = getAssignedTo(period);
    if (assignedTo && assignedTo !== 'NONE') return false;

    // Permission check
    const permission = circle.bid_permission || 'NONE';
    if (permission === 'NONE') return true;

    const myHandsCount = players.filter((p) => p.member_id === dbUser.id).length;
    if (myHandsCount === 0) return false;

    // Count approved slips for this user in this period
    const approvedSlips = slips.filter(
      (s) => s.member_id === dbUser.id && s.period === period && s.status === 'APPROVED'
    );

    if (permission === 'PARTIAL') {
      return approvedSlips.length >= 1;
    }

    if (permission === 'ALL') {
      return approvedSlips.length >= 1;
    }

    return true;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกเลขบัญชีแล้ว!');
  };
  const handlePayoutSubmit = async () => {
    if (!payoutModal.period || !payoutModal.winner_id) return;
    setUploadLoading(true);
    try {
      let finalImg = uploadData.image_url;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `slips/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('shares')
          .upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from('shares').getPublicUrl(filePath);
        finalImg = publicUrl;
      }

      const data = await callAction('create_payout', {
        circle_id: circleId,
        member_id: payoutModal.winner_id,
        period: payoutModal.period,
        amount: payoutModal.amount,
        image_url: finalImg,
        is_cash: paymentMode === 'CASH',
        caller_role: dbUser.role,
      });
      if (data.status === 'success') {
        setMessage({ type: 'success', text: data.message });
        setPayoutModal({ ...payoutModal, open: false });
        setSelectedFile(null);
        setFilePreview(null);
        fetchCircleDetail();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งหลักฐาน' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleVerifyPayout = async (payoutId, status) => {
    try {
      const data = await callAction('verify_payout', {
        payout_id: payoutId,
        status,
        caller_id: dbUser.id,
      });
      if (data.status === 'success') {
        setMessage({ type: 'success', text: data.message });
        setInspectPayoutModal({ open: false, payout: null });
        fetchCircleDetail();
      } else setMessage({ type: 'error', text: data.message });
    } catch {
      setMessage({ type: 'error', text: 'การเชื่อมต่อขัดข้อง' });
    }
  };

  if (isUserLoading || isInitializing) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: 'var(--primary)' }}>กำลังโหลด...</h3>
      </div>
    );
  }

  if (!circle) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="glass-panel">
          <h3 style={{ color: 'var(--danger)' }}>{message.text || 'ไม่พบข้อมูลวงแชร์'}</h3>
          <Link
            href="/circles/view"
            className="btn-primary"
            style={{ display: 'inline-block', marginTop: '20px', textDecoration: 'none' }}
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  const totalHandsArray = Array.from({ length: circle.total_hands }, (_, i) => i + 1);

  return (
    <>
      <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
        {/* Header Circle Title */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>{circle.name}</h2>
            {isCircleAdmin && (
              <button
                onClick={() => {
                  setSettingsData({
                    ...circle,
                    close_mode: circle.close_mode === 'AUTO' ? 'ปิดอัตโนมัติ' : 'แอดมินปิดเอง',
                  });
                  setConfigModal({ open: true, mode: 'EDIT_CIRCLE' });
                }}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                ✏️
              </button>
            )}
            <span
              className={`badge ${circle.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}
              style={{ fontSize: '0.6rem' }}
            >
              {circle.status}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
              ยอดวงรวม:{' '}
              <strong style={{ color: 'var(--primary)' }}>
                {(circle.type === 'ขั้นบันได (ดอกคงที่)' && periodDates.length > 0
                  ? periodDates.reduce((s, pd) => s + (Number(pd.amount) || 0), 0)
                  : circle.total_amount
                ).toLocaleString()}{' '}
                ฿
              </strong>
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ประเภท: {circle.type}</span>
          </div>

          {/* Notify button for step-interest circles */}
          {isCircleAdmin && circle.type === 'ขั้นบันได (ดอกคงที่)' && circle.status === 'OPEN' && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: '📣 แจ้งเตือนสมาชิกทาง LINE',
                  description:
                    'ระบบจะส่งการแจ้งเตือนวงแชร์นี้ไปยังสมาชิกทุกคนในบ้านแชร์ทันที ยืนยันหรือไม่?',
                });
                if (!ok) return;
                try {
                  const data = await callAction('notify_circle_members', {
                    circle_id: circleId,
                    caller_role: dbUser.role,
                  });
                  if (data.status === 'success') {
                    toast.success(data.message);
                  } else {
                    toast.error(data.message);
                  }
                } catch {
                  toast.error('การเชื่อมต่อขัดข้อง');
                }
              }}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #00B900 0%, #00a000 100%)',
                color: 'white',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              📣 แจ้งเตือนสมาชิกให้มาจองมือทาง LINE
            </button>
          )}
        </div>

        {message.text && (
          <div
            style={{
              padding: '12px',
              marginBottom: '20px',
              borderRadius: '12px',
              background:
                message.type === 'success'
                  ? '#dcfce7'
                  : message.type === 'error'
                    ? '#fee2e2'
                    : '#e0f2fe',
              color:
                message.type === 'success'
                  ? '#166534'
                  : message.type === 'error'
                    ? '#991b1b'
                    : '#0369a1',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '0.85rem',
            }}
          >
            {message.text}
          </div>
        )}

        {/* Modern Tabs */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            padding: '6px',
            borderRadius: '18px',
          }}
        >
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '14px',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              background: activeTab === 'timeline' ? 'var(--primary-gradient)' : 'transparent',
              color: activeTab === 'timeline' ? 'white' : '#64748b',
            }}
          >
            📊 ติดตามงวด
          </button>
          <button
            onClick={() => setActiveTab('members')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '14px',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              background: activeTab === 'members' ? 'var(--primary-gradient)' : 'transparent',
              color: activeTab === 'members' ? 'white' : '#64748b',
            }}
          >
            👥 สมาชิกวงแชร์
          </button>
        </div>

        {activeTab === 'members' && (
          <div className="animate-fade-in">
            {isCircleAdmin && circle.status === 'OPEN' && (
              <div
                className="glass-panel"
                style={{
                  marginBottom: '20px',
                  textAlign: 'center',
                  border: '1px dashed var(--primary)',
                }}
              >
                <h4 style={{ margin: '0 0 12px 0' }}>จัดการวงแชร์</h4>
                <button
                  onClick={handleStartCircle}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  {' '}
                  ✨ เริ่มเดินวง{' '}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {totalHandsArray.map((hand) => {
                const player = players.find((p) => p.hand_no === hand);
                const canClick = !player && circle.status === 'OPEN';
                return (
                  <div
                    key={hand}
                    onClick={() => (canClick ? handleEmptyHandClick(hand) : null)}
                    className="glass-panel"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      opacity: !player && !canClick ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: player ? 'var(--primary-gradient)' : '#cbd5e1',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                        }}
                      >
                        {hand}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: player ? '700' : '500',
                            color: player ? 'var(--foreground)' : '#94a3b8',
                          }}
                        >
                          {player
                            ? allMembers.find((m) => m.id === player.member_id)?.custom_nickname ||
                              player.member_name
                            : canClick
                              ? 'ว่าง (แตะเพื่อจอง)'
                              : 'ว่าง'}
                        </div>
                        {/* Amount display for this hand's period */}
                        {(() => {
                          const pDate = periodDates.find((p) => p.period === hand);
                          const isStepType = circle.type === 'ขั้นบันได (ดอกคงที่)';
                          const amt = isStepType ? pDate?.amount : circle.amount_per_hand;
                          if (isStepType && (amt === undefined || amt === null)) {
                            return (
                              <div
                                style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '500' }}
                              >
                                ยังไม่กำหนดยอดชำระ
                              </div>
                            );
                          }
                          if (amt === undefined || amt === null) return null;
                          return (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--primary)',
                                fontWeight: '600',
                              }}
                            >
                              ส่งงวดละ {Number(amt).toLocaleString()} ฿
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {player && isCircleAdmin && (
                      <button
                        onClick={(e) => openAdminChangeModal(e, hand)}
                        style={{
                          background: 'none',
                          border: '1px solid #e2e8f0',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          color: 'var(--primary)',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                        }}
                      >
                        จัดการ
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div
            className="animate-fade-in"
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {totalHandsArray.map((period) => {
              const isStairType = circle.type === 'ขั้นบันได (ดอกคงที่)';
              const winnerBid = bids
                .filter((b) => b.period === period)
                .sort((a, b) => b.bid_amount - a.bid_amount)[0];
              const winner = winnerBid
                ? players.find((p) => p.member_id === winnerBid.member_id)
                : null;
              const isCompleted = period < circle.current_period;
              const isCurrent = period === circle.current_period;
              const isFuture = period > circle.current_period;
              const isExpanded = expandedPeriod === period;
              const winnerPayout = payouts.find(
                (po) => po.period === period && po.member_id === winnerBid?.member_id
              );
              const mySlip = slips.find((s) => s.period === period && s.member_id === dbUser?.id);
              const canPay = !mySlip || mySlip.status === 'REJECTED';

              // Staircase-specific
              const stairAssignedId = isStairType ? getAssignedTo(period) || null : null;
              const stairWinnerPlayer = isStairType
                ? stairAssignedId && stairAssignedId !== 'NONE'
                  ? players.find((p) => p.member_id === stairAssignedId)
                  : players.find((p) => p.hand_no === period)
                : null;
              const stairWinnerName =
                allMembers.find((m) => m.id === stairWinnerPlayer?.member_id)?.custom_nickname ||
                stairWinnerPlayer?.member_name ||
                '';
              const stairWinnerPic = stairWinnerPlayer?.picture_url || null;
              const pDateObj = periodDates.find((p) => p.period === period);
              const amountPerPeriod = pDateObj?.amount ?? circle.amount_per_hand;
              const stairReceivedAmount = isStairType
                ? periodDates.reduce((s, pd) => s + (Number(pd.amount) || 0), 0)
                : 0;
              const stairPayout =
                isStairType && stairAssignedId && stairAssignedId !== 'NONE'
                  ? payouts.find((po) => po.period === period && po.member_id === stairAssignedId)
                  : isStairType
                    ? payouts.find(
                        (po) =>
                          po.period === period && po.member_id === stairWinnerPlayer?.member_id
                      )
                    : null;
              const stairWinnerId =
                stairAssignedId && stairAssignedId !== 'NONE'
                  ? stairAssignedId
                  : stairWinnerPlayer?.member_id;
              const stairIsMe = dbUser?.id === stairWinnerId;

              // Calculate Received Amount
              const deadHands = period - 1;
              const liveHands = circle.total_hands - deadHands;
              const receivedAmount = winnerBid
                ? circle.interest_method === 'ไม่หักดอก'
                  ? circle.amount_per_hand * circle.total_hands
                  : circle.amount_per_hand * deadHands +
                    (circle.amount_per_hand - winnerBid.bid_amount) * (liveHands - 1)
                : 0;

              return (
                <div
                  key={period}
                  className="glass-panel"
                  style={{
                    padding: '0',
                    overflow: 'hidden',
                    border: isCurrent
                      ? '2px solid var(--primary)'
                      : '1px solid var(--glass-border)',
                  }}
                >
                  {/* Card Header */}
                  <div
                    onClick={() =>
                      !isFuture || circle.status === 'OPEN' ? toggleAccordion(period) : null
                    }
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: isStairType ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      background: isCompleted
                        ? 'rgba(16, 185, 129, 0.05)'
                        : isCurrent
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'transparent',
                      cursor: isFuture && circle.status !== 'OPEN' ? 'default' : 'pointer',
                    }}
                  >
                    {isStairType ? (
                      /* ── Staircase card header ── */
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {/* Profile picture */}
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: isCurrent
                              ? '2px solid var(--primary)'
                              : isCompleted
                                ? '2px solid #10b981'
                                : '2px solid #e2e8f0',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {stairWinnerPic ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={stairWinnerPic}
                              alt={stairWinnerName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : stairWinnerName ? (
                            <span
                              style={{ fontSize: '1.3rem', color: '#94a3b8', fontWeight: '700' }}
                            >
                              {stairWinnerName[0]?.toUpperCase()}
                            </span>
                          ) : (
                            <span style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>👤</span>
                          )}
                        </div>
                        {/* Text lines */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Line 1: period + date + status */}
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '5px',
                              marginBottom: '3px',
                            }}
                          >
                            <span>งวดที่ {period}</span>
                            {pDateObj?.period_date && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: '500',
                                  color: 'var(--primary)',
                                  background: 'var(--primary-light, #e0e7ff)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                }}
                              >
                                📅{' '}
                                {new Date(pDateObj.period_date).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                            {isCompleted && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: '600',
                                  color: '#166534',
                                  background: '#dcfce7',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                ✅ ปิดงวดแล้ว
                              </span>
                            )}
                            {isCurrent && circle.status !== 'OPEN' && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: '600',
                                  color: 'var(--primary)',
                                }}
                              >
                                ⭐ กำลังดำเนินการ
                              </span>
                            )}
                            {(isFuture || circle.status === 'OPEN') && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: '500',
                                  color: '#94a3b8',
                                }}
                              >
                                🔒 รอดำเนินการ
                              </span>
                            )}
                          </div>
                          {/* Line 2: winner name */}
                          {stairWinnerName ? (
                            <div
                              style={{
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                color: '#1e293b',
                                marginBottom: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              🏆 {stairWinnerName}
                            </div>
                          ) : (
                            <div
                              style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '2px' }}
                            >
                              ยังไม่กำหนดผู้รับ
                            </div>
                          )}
                          {/* Line 3: จ่ายงวดละ */}
                          {amountPerPeriod != null ? (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--primary)',
                                fontWeight: '700',
                                marginBottom: '2px',
                              }}
                            >
                              💰 จ่ายงวดละ: {Number(amountPerPeriod).toLocaleString()} ฿
                            </div>
                          ) : (
                            <div
                              style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px' }}
                            >
                              ยังไม่กำหนดยอดชำระ
                            </div>
                          )}
                          {/* Line 4: รับสุทธิ */}
                          {stairWinnerId && stairReceivedAmount > 0 && (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: '#166534',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              🏦 รับสุทธิ: {stairReceivedAmount.toLocaleString()} ฿
                              {/* Admin view */}
                              {isCircleAdmin ? (
                                !stairPayout || stairPayout.status === 'REJECTED' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPayoutModal({
                                        open: true,
                                        period,
                                        winner_id: stairWinnerId,
                                        winner_name: stairWinnerName,
                                        amount: stairReceivedAmount,
                                      });
                                    }}
                                    style={{
                                      background: 'var(--primary)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.7rem',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    💸 จ่ายเงิน
                                  </button>
                                ) : stairPayout.status === 'PENDING' ? (
                                  <span
                                    style={{
                                      background: '#fef9c3',
                                      color: '#92400e',
                                      padding: '1px 6px',
                                      borderRadius: '5px',
                                      fontWeight: '700',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    ⏳ รอตรวจสอบ
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      background: '#dcfce7',
                                      color: '#166534',
                                      padding: '1px 6px',
                                      borderRadius: '5px',
                                      fontWeight: '700',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    ✅ รับแล้ว
                                  </span>
                                )
                              ) : stairIsMe ? (
                                /* Winner’s view */
                                !stairPayout || stairPayout.status === 'REJECTED' ? (
                                  <span
                                    style={{
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      padding: '1px 6px',
                                      borderRadius: '5px',
                                      fontWeight: '700',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    ❌ ยังไม่จ่าย
                                  </span>
                                ) : stairPayout.status === 'PENDING' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectPayoutModal({ open: true, payout: stairPayout });
                                    }}
                                    style={{
                                      background: '#f59e0b',
                                      color: 'white',
                                      border: 'none',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.7rem',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🔍 ตรวจสอบ
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      background: '#dcfce7',
                                      color: '#166534',
                                      padding: '1px 6px',
                                      borderRadius: '5px',
                                      fontWeight: '700',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    ✅ รับแล้ว
                                  </span>
                                )
                              ) : /* Other members’ view */
                              !stairPayout || stairPayout.status === 'REJECTED' ? (
                                <span
                                  style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '1px 6px',
                                    borderRadius: '5px',
                                    fontWeight: '600',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  ⏳ ยังไม่จ่าย
                                </span>
                              ) : stairPayout.status === 'PENDING' ? (
                                <span
                                  style={{
                                    background: '#fef9c3',
                                    color: '#92400e',
                                    padding: '1px 6px',
                                    borderRadius: '5px',
                                    fontWeight: '600',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  ⏳ รอตรวจสอบ
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '1px 6px',
                                    borderRadius: '5px',
                                    fontWeight: '600',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  ✅ รับแล้ว
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ── Standard (auction) card header ── */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: isCompleted
                              ? 'var(--primary-gradient)'
                              : isCurrent
                                ? 'var(--secondary)'
                                : '#e2e8f0',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            fontSize: '0.9rem',
                          }}
                        >
                          {period}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '0.95rem',
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>งวดที่ {period}</span>
                            {pDateObj?.period_date && (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: '500',
                                  color: 'var(--primary)',
                                  background: 'var(--primary-light, #e0e7ff)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginRight: '8px',
                                }}
                              >
                                📅{' '}
                                {new Date(pDateObj.period_date).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                            {circle.status === 'OPEN' ? (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  color: '#94a3b8',
                                  fontSize: '0.7rem',
                                  fontWeight: '500',
                                }}
                              >
                                🔒 รอดำเนินการ
                              </span>
                            ) : (
                              <>
                                {isCurrent && (
                                  <span
                                    style={{
                                      marginLeft: '8px',
                                      color: 'var(--primary)',
                                      fontSize: '0.7rem',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    ⭐ กำลังดำเนินการ
                                  </span>
                                )}
                                {isFuture && (
                                  <span
                                    style={{
                                      marginLeft: '8px',
                                      color: '#94a3b8',
                                      fontSize: '0.7rem',
                                      fontWeight: '500',
                                    }}
                                  >
                                    🔒 รอดำเนินการ
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {isCompleted && winner && (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              🏆 {winner.member_name}
                            </div>
                          )}
                          {/* Amount */}
                          {circle.amount_per_hand != null && (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--primary)',
                                fontWeight: '700',
                                marginTop: '2px',
                              }}
                            >
                              💰 {Number(circle.amount_per_hand).toLocaleString()} ฿/งวด
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isCompleted && <span style={{ fontSize: '1.2rem' }}>🏆</span>}
                      {(isFuture || isCurrent || circle.status === 'OPEN') && isCircleAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const assignedTo = getAssignedTo(period) || 'NONE';
                            const pDate = periodDates.find((p) => p.period === period);
                            setSettingsData({
                              ...circle,
                              close_mode:
                                circle.close_mode === 'AUTO' ? 'ปิดอัตโนมัติ' : 'แอดมินปิดเอง',
                              assigned_to: assignedTo,
                              amount: pDate?.amount ?? circle?.amount_per_hand ?? 0,
                              period_date: pDate?.period_date || '',
                            });
                            setConfigModal({ open: true, period });
                          }}
                          style={{
                            background: '#f1f5f9',
                            border: 'none',
                            padding: '8px',
                            borderRadius: '10px',
                            color: '#64748b',
                          }}
                        >
                          ⚙️
                        </button>
                      )}
                      {(!isFuture || circle.status === 'OPEN') && (
                        <span
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'all 0.3s',
                            color: '#cbd5e1',
                          }}
                        >
                          ▼
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Winner Summary (For Completed) */}
                  {isCompleted && winner && !isExpanded && (
                    <div
                      style={{
                        padding: '0 20px 16px 20px',
                        display: 'flex',
                        gap: '20px',
                        fontSize: '0.85rem',
                        borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none',
                      }}
                    >
                      {!isStairType && winnerBid?.bid_amount > 0 && (
                        <div>
                          <span style={{ color: '#94a3b8' }}>ยอดเปีย:</span>{' '}
                          <strong style={{ color: 'var(--primary)' }}>
                            {winnerBid.bid_amount.toLocaleString()}
                          </strong>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#94a3b8' }}>รับสุทธิ:</span>{' '}
                        <strong style={{ color: '#166534' }}>
                          {receivedAmount.toLocaleString()} ฿
                        </strong>
                        {winnerPayout?.status === 'APPROVED' && (
                          <span
                            style={{
                              marginLeft: '6px',
                              background: '#dcfce7',
                              color: '#166534',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              fontWeight: '700',
                              fontSize: '0.72rem',
                            }}
                          >
                            ✅ รับแล้ว
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '16px 20px',
                        borderTop: '1px solid #f1f5f9',
                        background: 'white',
                      }}
                    >
                      {circle.status === 'OPEN' ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.9rem',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <span style={{ fontSize: '1.4rem' }}>🎯</span>
                            งวดนี้ยังไม่เปิดดำเนินการ (อยู่ระหว่างรวบรวมสมาชิก)
                          </div>
                          {(() => {
                            const assignedTo = getAssignedTo(period) || 'NONE';
                            let assignedName = '';
                            if (assignedTo !== 'NONE') {
                              if (assignedTo === circle.creator_id) assignedName = 'ท้าวแชร์';
                              else {
                                const m = players.find((p) => p.member_id === assignedTo);
                                assignedName = m ? m.member_name : assignedTo;
                              }
                            }

                            if (assignedTo !== 'NONE') {
                              return (
                                <div
                                  style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--primary)',
                                    fontWeight: '800',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    padding: '12px',
                                    borderRadius: '14px',
                                    border: '1px dashed var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                  }}
                                >
                                  📌 กำหนดผู้ชนะล่วงหน้าคือ:{' '}
                                  <span style={{ color: 'black' }}>{assignedName}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        (isCurrent || isCompleted) && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              marginBottom: '20px',
                            }}
                          >
                            {/* Bingo/Auction Logic */}
                            {circle.type === 'ประมูล (เปียแข่งดอก)' && (
                              <>
                                {isCurrent &&
                                  (!isBiddingClosed(period) ? (
                                    (() => {
                                      const assignedTo = getAssignedTo(period) || 'NONE';

                                      if (assignedTo !== 'NONE') {
                                        return (
                                          <div
                                            style={{
                                              flex: '1 1 45%',
                                              padding: '12px',
                                              fontSize: '0.85rem',
                                              background: 'rgba(16, 185, 129, 0.1)',
                                              borderRadius: '12px',
                                              color: 'var(--primary)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '6px',
                                              border: '1px dashed var(--primary)',
                                            }}
                                          >
                                            🔒 งวดนี้กำหนดผู้ชนะไว้แล้ว
                                          </div>
                                        );
                                      }

                                      return canUserBid(period) ? (
                                        <button
                                          onClick={() => setBidModal({ open: true, period })}
                                          className="btn-primary"
                                          style={{
                                            flex: '1 1 45%',
                                            padding: '12px',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                          }}
                                        >
                                          🔨 ประมูล (เปีย)
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            toast.error(
                                              circle.bid_permission === 'PARTIAL'
                                                ? 'กรุณาชำระเงินอย่างน้อย 1 มือก่อนประมูล'
                                                : 'กรุณาชำระเงินให้ครบทุกมือก่อนประมูล'
                                            )
                                          }
                                          className="btn-primary"
                                          style={{
                                            flex: '1 1 45%',
                                            padding: '12px',
                                            fontSize: '0.85rem',
                                            background: '#cbd5e1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            cursor: 'not-allowed',
                                          }}
                                        >
                                          🔨 ประมูล (ติดเงื่อนไขจ่าย)
                                        </button>
                                      );
                                    })()
                                  ) : (
                                    <div
                                      style={{
                                        flex: '1 1 45%',
                                        padding: '12px',
                                        fontSize: '0.85rem',
                                        background: '#f1f5f9',
                                        borderRadius: '12px',
                                        color: '#64748b',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        border: '1px solid #e2e8f0',
                                      }}
                                    >
                                      🔒 ปิดรับการประมูลแล้ว
                                    </div>
                                  ))}

                                {canPay && (
                                  <button
                                    onClick={async () => {
                                      if (isCircleAdmin) {
                                        const ok = await confirm({
                                          title: 'ชำระเงิน',
                                          description:
                                            'ยืนยันการชำระเงินทุกมือสำหรับงวดนี้? (แอดมินชำระให้ตนเอง)',
                                        });
                                        if (ok) handleAdminAutoPay(period);
                                      } else {
                                        const amt = getRequiredAmount(period);
                                        setUploadData({ ...uploadData, amount: amt });
                                        setSlipModal({ open: true, period });
                                      }
                                    }}
                                    className="btn-primary"
                                    style={{
                                      flex: '1 1 45%',
                                      padding: '12px',
                                      fontSize: '0.85rem',
                                      background: '#0d9488',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    🗳️ ชำระเงิน
                                  </button>
                                )}

                                {isCircleAdmin && (
                                  <>
                                    {isCurrent && !isBiddingClosed(period) && (
                                      <>
                                        {(() => {
                                          const isAssigned = Boolean(getAssignedTo(period));
                                          return (
                                            !isAssigned && (
                                              <button
                                                onClick={() =>
                                                  handleCircleAction('random_select_bidder', period)
                                                }
                                                className="btn-primary"
                                                style={{
                                                  flex: '1 1 30%',
                                                  padding: '10px',
                                                  fontSize: '0.75rem',
                                                  background: '#8b5cf6',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                }}
                                              >
                                                <span>🎲</span> สุ่มผู้ชนะ
                                              </button>
                                            )
                                          );
                                        })()}
                                        <button
                                          onClick={() =>
                                            handleCircleAction('close_bidding', period)
                                          }
                                          className="btn-primary"
                                          style={{
                                            flex: '1 1 30%',
                                            padding: '10px',
                                            fontSize: '0.75rem',
                                            background: '#f59e0b',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px',
                                          }}
                                        >
                                          <span>🔒</span> ปิดประมูล
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => handleCircleAction('close_period', period)}
                                      className="btn-primary"
                                      style={{
                                        flex: '1 1 30%',
                                        padding: '10px',
                                        fontSize: '0.75rem',
                                        background: '#ef4444',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <span>🎌</span> ปิดงวด
                                    </button>
                                  </>
                                )}
                              </>
                            )}

                            {/* Staircase/Fixed Interest Logic */}
                            {circle.type === 'ขั้นบันได (ดอกคงที่)' && (
                              <>
                                {canPay && (
                                  <button
                                    onClick={async () => {
                                      if (isCircleAdmin) {
                                        const ok = await confirm({
                                          title: 'ชำระเงิน',
                                          description:
                                            'ยืนยันการชำระเงินทุกมือำหรับงวดนี้? (แอดมินชำระให้ตนเอง)',
                                        });
                                        if (ok) handleAdminAutoPay(period);
                                      } else {
                                        const amt = getRequiredAmount(period);
                                        setUploadData({ ...uploadData, amount: amt });
                                        setSlipModal({ open: true, period });
                                      }
                                    }}
                                    className="btn-primary"
                                    style={{
                                      flex: '1 1 100%',
                                      padding: '14px',
                                      fontSize: '1rem',
                                      background: '#0d9488',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    🗳️ ชำระเงิน
                                  </button>
                                )}

                                {isCircleAdmin && (
                                  <button
                                    onClick={() => handleCircleAction('close_period', period)}
                                    className="btn-primary"
                                    style={{
                                      flex: '1 1 100%',
                                      padding: '12px',
                                      fontSize: '0.9rem',
                                      background: '#ef4444',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    <span>🎌</span> ปิดงวดการส่งเงิน
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )
                      )}

                      {isCompleted && winner && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            marginBottom: '20px',
                            padding: '12px',
                            borderRadius: '16px',
                            background: '#f0fdf4',
                          }}
                        >
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              background: 'var(--primary-gradient)',
                            }}
                          >
                            <img
                              src={
                                winner.picture_url ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${winner.member_id}`
                              }
                              alt="winner"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700' }}>🏆 {winner.member_name}</div>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: '#166534',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              รับสุทธิ {receivedAmount.toLocaleString()} ฿
                              {!isStairType && winnerBid?.bid_amount > 0 && (
                                <span>(ดอก {winnerBid.bid_amount.toLocaleString()})</span>
                              )}
                              {winnerPayout?.status === 'APPROVED' && (
                                <span
                                  style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '1px 7px',
                                    borderRadius: '6px',
                                    fontWeight: '700',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  ✅ รับแล้ว
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Details: Bids & Slips */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            color: '#475569',
                            marginBottom: '4px',
                          }}
                        >
                          สถานะสมาชิกในงวดนี้:
                        </div>
                        {(() => {
                          // 1. Identify winners of all periods BEFORE this period to count wins per member
                          const winCounts = {};
                          const bidsByP = {};
                          bids.forEach((b) => {
                            if (b.period < period) {
                              if (!bidsByP[b.period]) bidsByP[b.period] = [];
                              bidsByP[b.period].push(b);
                            }
                          });
                          Object.keys(bidsByP).forEach((pKey) => {
                            const sorted = bidsByP[pKey].sort(
                              (a, b) => b.bid_amount - a.bid_amount
                            );
                            const winnerId = sorted[0].member_id;
                            winCounts[winnerId] = (winCounts[winnerId] || 0) + 1;
                          });

                          // 2. Identify status for each hand
                          const handStatus = {}; // hand_no -> status
                          const memberHands = {};
                          [...players]
                            .sort((a, b) => a.hand_no - b.hand_no)
                            .forEach((hp) => {
                              if (!memberHands[hp.member_id]) memberHands[hp.member_id] = [];
                              memberHands[hp.member_id].push(hp.hand_no);
                            });

                          Object.keys(memberHands).forEach((mId) => {
                            const wins = winCounts[mId] || 0;
                            memberHands[mId].forEach((hNo, idx) => {
                              if (idx < wins) handStatus[hNo] = 'DEAD';
                              else if (idx === wins) handStatus[hNo] = 'ACTIVE';
                              else handStatus[hNo] = 'FUTURE';
                            });
                          });

                          // 3. Current period winner
                          const periodBids = bids
                            .filter((b) => b.period === period)
                            .sort((a, b) => b.bid_amount - a.bid_amount);
                          const periodWinner = periodBids[0];
                          const winnerMemberId = periodWinner?.member_id;
                          const currentPayout = payouts.find(
                            (po) => po.period === period && po.member_id === winnerMemberId
                          );
                          const biddingIsClosed =
                            isCompleted || isBiddingClosed(period) || Boolean(currentPayout);

                          return [...players]
                            .sort((a, b) => a.hand_no - b.hand_no)
                            .map((p) => {
                              const pBid = bids.find(
                                (b) => b.period === period && b.member_id === p.member_id
                              );
                              const pSlip = slips.find(
                                (s) => s.period === period && s.member_id === p.member_id
                              );
                              const isMe = dbUser && p.member_id === dbUser.id;
                              const status = handStatus[p.hand_no];
                              const isDead = status === 'DEAD';
                              const isActive = status === 'ACTIVE';
                              const isWinner =
                                p.member_id === winnerMemberId && isActive && biddingIsClosed;

                              // Net Amount Calculation for winner: (Total Hands * Amount Per Hand) - (My Bid Amount)
                              // This depends on the circle rules, but usually:
                              const netAmount =
                                circle.total_hands * circle.amount_per_hand -
                                (periodWinner?.bid_amount || 0);

                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '12px',
                                    borderRadius: '14px',
                                    background: isWinner ? '#fffbeb' : '#f8fafc',
                                    border: isWinner
                                      ? '1.5px solid #fbbf24'
                                      : isMe
                                        ? '1.5px solid #cbd5e1'
                                        : '1px solid #f1f5f9',
                                    opacity: isDead ? 0.6 : 1,
                                    marginBottom: '8px',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.95rem',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: isActive || isWinner ? '800' : '500',
                                          color: isWinner
                                            ? '#92400e'
                                            : isDead
                                              ? '#94a3b8'
                                              : '#1e293b',
                                        }}
                                      >
                                        {isWinner ? '🏆 ' : ''}
                                        {allMembers.find((m) => m.id === p.member_id)
                                          ?.custom_nickname || p.member_name}{' '}
                                        {isDead ? '(มือตาย)' : ''}
                                      </span>
                                      {!isStairType && pBid && !isWinner && isActive && (
                                        <span
                                          style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--primary)',
                                            fontWeight: '600',
                                          }}
                                        >
                                          (เปีย{' '}
                                          {isCompleted || isCircleAdmin || isMe
                                            ? pBid.bid_amount.toLocaleString()
                                            : '***'}
                                          )
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      {pSlip ? (
                                        pSlip.status === 'APPROVED' ? (
                                          <span
                                            style={{
                                              fontSize: '0.7rem',
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                              background: '#dcfce7',
                                              color: '#166534',
                                            }}
                                          >
                                            ✅ จ่ายแล้ว
                                          </span>
                                        ) : isCircleAdmin ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReviewSlipModal({ open: true, slip: pSlip });
                                            }}
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '3px 10px',
                                              borderRadius: '6px',
                                              background: '#f59e0b',
                                              color: 'white',
                                              border: 'none',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            🔍 ตรวจสอบสลิป
                                          </button>
                                        ) : (
                                          <span
                                            style={{
                                              fontSize: '0.7rem',
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                              background: '#fef3c7',
                                              color: '#92400e',
                                            }}
                                          >
                                            ⏳ รออนุมัติ
                                          </span>
                                        )
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: '#fee2e2',
                                            color: '#991b1b',
                                          }}
                                        >
                                          ❌ ยังไม่จ่าย
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {isWinner && (
                                    <div
                                      style={{
                                        fontSize: '0.8rem',
                                        color: '#92400e',
                                        fontWeight: '600',
                                        marginTop: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <span>ยอดรับสุทธิ: {netAmount.toLocaleString()} ฿</span>
                                      {!isStairType && periodWinner?.bid_amount > 0 && (
                                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                          (เปีย {periodWinner.bid_amount.toLocaleString()})
                                        </span>
                                      )}
                                      {/* Admin: pay button or status */}
                                      {isCircleAdmin ? (
                                        !currentPayout || currentPayout.status === 'REJECTED' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPayoutModal({
                                                open: true,
                                                period,
                                                winner_id: p.member_id,
                                                winner_name: p.member_name,
                                                amount: netAmount,
                                              });
                                            }}
                                            style={{
                                              background: 'var(--primary-gradient)',
                                              color: 'white',
                                              border: 'none',
                                              padding: '4px 12px',
                                              borderRadius: '8px',
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            💸 จ่ายเงินให้ผู้ชนะ
                                          </button>
                                        ) : currentPayout.status === 'PENDING' ? (
                                          <span
                                            style={{
                                              fontSize: '0.72rem',
                                              fontWeight: '700',
                                              color: '#ea580c',
                                              background: '#fff7ed',
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                            }}
                                          >
                                            ⏳ รอตรวจสอบ
                                          </span>
                                        ) : (
                                          <span
                                            style={{
                                              fontSize: '0.72rem',
                                              fontWeight: '700',
                                              color: '#166534',
                                              background: '#dcfce7',
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                            }}
                                          >
                                            ✅ รับแล้ว
                                          </span>
                                        )
                                      ) : isMe ? (
                                        /* Winner member: ยังไม่ได้รับ / ตรวจสอบ / รับแล้ว */
                                        !currentPayout || currentPayout.status === 'REJECTED' ? (
                                          <span
                                            style={{
                                              fontSize: '0.72rem',
                                              fontWeight: '700',
                                              color: '#dc2626',
                                              background: '#fee2e2',
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                            }}
                                          >
                                            ❌ ยังไม่ได้รับ
                                          </span>
                                        ) : currentPayout.status === 'PENDING' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setInspectPayoutModal({
                                                open: true,
                                                payout: currentPayout,
                                              });
                                            }}
                                            style={{
                                              background: '#3b82f6',
                                              color: 'white',
                                              border: 'none',
                                              padding: '4px 12px',
                                              borderRadius: '8px',
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            🔍 ตรวจสอบ
                                          </button>
                                        ) : (
                                          <span
                                            style={{
                                              fontSize: '0.72rem',
                                              fontWeight: '700',
                                              color: '#166534',
                                              background: '#dcfce7',
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                            }}
                                          >
                                            ✅ รับแล้ว
                                          </span>
                                        )
                                      ) : /* Other members: read-only payout status */
                                      !currentPayout || currentPayout.status === 'REJECTED' ? (
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            fontWeight: '600',
                                            color: '#dc2626',
                                          }}
                                        >
                                          ❌ ยังไม่ได้รับ
                                        </span>
                                      ) : currentPayout.status === 'PENDING' ? (
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            fontWeight: '600',
                                            color: '#ea580c',
                                          }}
                                        >
                                          ⏳ รอตรวจสอบ
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            fontWeight: '600',
                                            color: '#166534',
                                          }}
                                        >
                                          ✅ ได้รับแล้ว
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <Dialog
        open={adminModal.open}
        onOpenChange={(o) => !o && setAdminModal({ open: false, mode: '', handNo: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adminModal.mode === 'JOIN'
                ? `📌 จองมือที่ ${adminModal.handNo}`
                : `🔄 โอนมือที่ ${adminModal.handNo}`}
            </DialogTitle>
          </DialogHeader>
          <select
            value={adminSelectedUserId}
            onChange={(e) => setAdminSelectedUserId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
          >
            <option value="">-- เลือกสมาชิก --</option>
            {adminModal.mode === 'JOIN' && dbUser && (
              <option value={dbUser.id}>จองให้ตัวเอง ({dbUser.name})</option>
            )}
            {(() => {
              // Only show regular MEMBERs (not ADMIN/SUPERADMIN) who are
              // actively linked to this circle's creator's house.
              // The creator/dbUser is already covered by "จองให้ตัวเอง" above.
              const eligibleMembers = allMembers.filter((m) => {
                // Skip the logged-in user (already shown as "จองให้ตัวเอง")
                if (m.id === dbUser?.id) return false;
                // Skip admins and superadmins — they are house owners, not players
                if (['ADMIN', 'SUPERADMIN'].includes(m.role)) return false;
                // Must have an ACTIVE link to this circle's creator house
                return m.member_houses?.some(
                  (h) => h.admin_id === circle?.creator_id && h.status === 'ACTIVE'
                );
              });
              return eligibleMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.nickname || m.id})
                </option>
              ));
            })()}
          </select>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdminModal({ open: false, mode: '', handNo: '' })}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={submitAdminModal}
              disabled={!adminSelectedUserId}
              className="flex-1"
            >
              ตกลง
            </Button>
          </DialogFooter>
          {!['JOIN'].includes(adminModal.mode) && circle.status === 'OPEN' && (
            <Button
              type="button"
              variant="link"
              onClick={(e) => {
                handleCancelHand(e, adminModal.handNo);
                setAdminModal({ open: false, mode: '', handNo: '' });
              }}
              className="mt-3 w-full text-destructive hover:text-destructive"
            >
              ยกเลิกการจองมือนี้ (คืนเป็นว่าง)
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={slipModal.open}
        onOpenChange={(o) => !o && setSlipModal({ open: false, period: null })}
      >
        <DialogContent className="max-h-[95vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">💳</span> แจ้งชำระเงิน
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center">
            <div className="mb-4 flex size-[90px] items-center justify-center rounded-full bg-primary shadow-[0_8px_16px_rgba(16,185,129,0.2)]">
              <span className="text-4xl">💰</span>
            </div>
            <div className="text-4xl font-extrabold text-primary">
              {uploadData.amount?.toLocaleString()}
            </div>
            <div className="text-base font-medium text-muted-foreground">บาท</div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode('TRANSFER')}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                paymentMode === 'TRANSFER'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              📱 โอนเงิน
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('CASH')}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                paymentMode === 'CASH'
                  ? 'bg-slate-600 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              💵 เงินสด
            </button>
          </div>

          {paymentMode === 'TRANSFER' && myBank && (
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                โอนเข้าบัญชีแอดมิน:
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-foreground">
                  {myBank.bank_name} {myBank.account_no}
                </span>
                <Button type="button" size="sm" onClick={() => copyToClipboard(myBank.account_no)}>
                  คัดลอก
                </Button>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{myBank.account_name}</div>
            </div>
          )}

          <form onSubmit={handleUploadSlip} className="flex flex-col gap-4">
            {paymentMode === 'TRANSFER' && (
              <label className="flex min-h-[150px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-center">
                {filePreview ? (
                  <div className="w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview}
                      alt="preview"
                      className="mx-auto max-h-[200px] w-full rounded-xl object-contain"
                    />
                    <div className="mt-2.5 text-sm font-bold text-primary">แตะเพื่อเปลี่ยนรูป</div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 text-4xl">📸</div>
                    <div className="text-base font-bold text-foreground">แตะเพื่อเลือกรูปสลิป</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      รองรับไฟล์ภาพ JPEG, PNG
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}

            <div className="relative">
              <span className="absolute left-4 top-3 text-base">✍️</span>
              <input
                type="text"
                placeholder="บันทึกช่วยจำ (ถ้ามี)"
                value={uploadData.note}
                onChange={(e) => setUploadData({ ...uploadData, note: e.target.value })}
                className="w-full rounded-2xl border-2 border-muted bg-background py-3 pl-11 pr-4 text-base outline-none focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={uploadLoading || (paymentMode === 'TRANSFER' && !selectedFile)}
              className="mt-2 h-14 rounded-2xl text-base font-extrabold"
            >
              {uploadLoading ? '⌛ กำลังดำเนินการ...' : '✅ ยืนยันชำระเงิน'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bid Modal */}
      <Dialog
        open={bidModal.open}
        onOpenChange={(o) => !o && setBidModal({ open: false, period: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              🔨 ประมูล (เปีย) งวดที่ {bidModal.period}
            </DialogTitle>
            <p className="text-center text-sm text-muted-foreground">
              ระบุจำนวนดอกเบี้ยที่คุณต้องการประมูล
            </p>
          </DialogHeader>
          <form onSubmit={handleBidSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-bold">จำนวนดอกเบี้ย (บาท)</label>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="เช่น 350"
                required
                className="w-full rounded-lg border-2 border-primary bg-background px-4 py-4 text-center text-xl outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="mt-2 text-center text-xs text-muted-foreground">
                ต่ำสุด {circle?.min_bid?.toLocaleString()} / สูงสุด{' '}
                {circle?.max_bid?.toLocaleString()}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBidModal({ open: false, period: null })}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button type="submit" className="flex-1">
                ส่งประมูล
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Config / Edit Modal */}
      <Dialog
        open={configModal.open}
        onOpenChange={(o) => !o && setConfigModal({ open: false, period: null })}
      >
        <DialogContent className="max-h-[95vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">⚙️</span> ตั้งค่า:{' '}
              {configModal.period
                ? `(งวด ${configModal.period})`
                : configModal.mode === 'EDIT_CIRCLE'
                  ? 'แก้ไขข้อมูลวงแชร์'
                  : circle?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateSettings} className="flex flex-col gap-5">
            {configModal.mode === 'EDIT_CIRCLE' && (
              <>
                <FormField label="ชื่อวงแชร์">
                  <input
                    type="text"
                    value={settingsData.name}
                    onChange={(e) => setSettingsData({ ...settingsData, name: e.target.value })}
                    required
                    className="w-full rounded-lg border-2 border-muted bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </FormField>
                <FormField label="ลิงก์กลุ่ม LINE ประจำวง">
                  <input
                    type="text"
                    value={settingsData.line_group_url}
                    onChange={(e) =>
                      setSettingsData({ ...settingsData, line_group_url: e.target.value })
                    }
                    placeholder="https://line.me/ti/g/..."
                    className="w-full rounded-lg border-2 border-muted bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </FormField>
              </>
            )}

            {circle?.type !== 'ขั้นบันได (ดอกคงที่)' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="⏰ เวลาเปิด" boxed={false}>
                    <input
                      type="time"
                      value={settingsData.bid_start_time}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, bid_start_time: e.target.value })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </FormField>
                  <FormField label="⏰ เวลาปิด" boxed={false}>
                    <input
                      type="time"
                      value={settingsData.bid_end_time}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, bid_end_time: e.target.value })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="💰 ดอกต่ำสุด" boxed={false}>
                    <input
                      type="number"
                      value={settingsData.min_bid}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, min_bid: e.target.value })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </FormField>
                  <FormField label="💰 ดอกสูงสุด" boxed={false}>
                    <input
                      type="number"
                      value={settingsData.max_bid}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, max_bid: e.target.value })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="🔔 แจ้งเตือน (ชม.)" boxed={false}>
                    <input
                      type="number"
                      value={settingsData.notify_hours}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, notify_hours: e.target.value })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    />
                  </FormField>
                  <FormField label="🔒 โหมดปิด" boxed={false}>
                    <select
                      value={settingsData.close_mode}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, close_mode: e.target.value })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    >
                      <option value="แอดมินปิดเอง">แอดมินปิดเอง</option>
                      <option value="ปิดอัตโนมัติ">ปิดอัตโนมัติ (AUTO)</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="✂️ วิธีคิดดอก" boxed={false}>
                  <select
                    value={settingsData.interest_method}
                    onChange={(e) =>
                      setSettingsData({ ...settingsData, interest_method: e.target.value })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                  >
                    <option value="หักดอก">หักดอก (Interest Deduct)</option>
                    <option value="ไม่หักดอก">ไม่หักดอก (Interest Add)</option>
                  </select>
                </FormField>
              </>
            )}

            {circle?.type === 'ขั้นบันได (ดอกคงที่)' && configModal.period && (
              <FormField label="จำนวนเงินชำระต่องวด (บาท)" boxed={false}>
                <input
                  type="number"
                  value={settingsData.amount}
                  onChange={(e) => setSettingsData({ ...settingsData, amount: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                />
              </FormField>
            )}

            {configModal.period && (
              <>
                <FormField label="วันที่งวด" boxed={false}>
                  <input
                    type="date"
                    value={settingsData.period_date}
                    onChange={(e) =>
                      setSettingsData({ ...settingsData, period_date: e.target.value })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                  />
                </FormField>
                <FormField label="งวดนี้กำหนดไว้ให้กับ">
                  <select
                    value={settingsData.assigned_to || 'NONE'}
                    onChange={(e) =>
                      setSettingsData({ ...settingsData, assigned_to: e.target.value })
                    }
                    className="w-full rounded-lg border-2 border-muted bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="NONE">ไม่กำหนด</option>
                    <option value={circle.creator_id}>ท้าวแชร์</option>
                    {Array.from(
                      new Set(
                        players
                          .filter((p) => p.member_id !== circle.creator_id)
                          .map((p) => p.member_id)
                      )
                    ).map((mId) => {
                      const m = players.find((p) => p.member_id === mId);
                      return (
                        <option key={mId} value={mId}>
                          {m?.member_name}
                        </option>
                      );
                    })}
                  </select>
                </FormField>
              </>
            )}

            {circle?.type !== 'ขั้นบันได (ดอกคงที่)' && (
              <FormField label="⚖️ สิทธิประมูล (Auction Permission)">
                <select
                  value={settingsData.bid_permission}
                  onChange={(e) =>
                    setSettingsData({ ...settingsData, bid_permission: e.target.value })
                  }
                  className="w-full rounded-lg border-2 border-muted bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="NONE">ไม่ต้องชำระก่อน</option>
                  <option value="PARTIAL">ต้องชำระบางมือก่อนอย่างน้อย 1 มือ</option>
                  <option value="ALL">ต้องชำระทุกมือก่อนในงวดนั้น</option>
                </select>
              </FormField>
            )}

            <Button type="submit" size="lg" className="mt-2 w-full">
              บันทึกข้อมูล
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* Payout Modal (Admin paying Winner) */}
      <Dialog
        open={payoutModal.open}
        onOpenChange={(o) => !o && setPayoutModal({ ...payoutModal, open: false })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>💸 จ่ายเงินให้ผู้ชนะ (งวดที่ {payoutModal.period})</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            เตรียมโอนเงินให้ <b>{payoutModal.winner_name}</b>
            <br />
            ยอดรับสุทธิ:{' '}
            <b className="text-xl text-primary">{payoutModal.amount.toLocaleString()} ฿</b>
          </p>

          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <label className="mb-2 block text-sm font-bold">วิธีการชำระ</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('TRANSFER')}
                className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${
                  paymentMode === 'TRANSFER'
                    ? 'border-primary bg-emerald-50 text-primary'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                🏦 โอนเงิน
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('CASH')}
                className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${
                  paymentMode === 'CASH'
                    ? 'border-primary bg-emerald-50 text-primary'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                💵 เงินสด
              </button>
            </div>
          </div>

          {paymentMode === 'TRANSFER' && (
            <div>
              <label className="mb-2 block text-sm font-bold">แนบหลักฐานการโอน (สลิป)</label>
              <div
                onClick={() => document.getElementById('payout-file').click()}
                className="flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40"
              >
                {filePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={filePreview} alt="preview" className="size-full object-cover" />
                ) : (
                  <>
                    <div className="mb-2 text-3xl">📸</div>
                    <div className="text-sm text-muted-foreground">กดเพื่ออัปโหลดรูปภาพ</div>
                  </>
                )}
              </div>
              <input
                id="payout-file"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setSelectedFile(file);
                    setFilePreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
              />
            </div>
          )}

          <Button
            type="button"
            onClick={handlePayoutSubmit}
            disabled={uploadLoading}
            className="w-full"
            size="lg"
          >
            {uploadLoading
              ? 'กำลังส่ง...'
              : paymentMode === 'CASH'
                ? '✅ ยืนยันการจ่ายเงินสด'
                : '🚀 ส่งหลักฐานการโอน'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Inspect Payout Modal (Winner reviewing Admin) */}
      <Dialog
        open={inspectPayoutModal.open}
        onOpenChange={(o) => !o && setInspectPayoutModal({ open: false, payout: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔍 ตรวจสอบยอดรับเงิน</DialogTitle>
          </DialogHeader>
          {inspectPayoutModal.payout && (
            <>
              <div className="text-center">
                <div className="mb-1 text-sm text-muted-foreground">ยอดที่แอดมินแจ้งโอน</div>
                <div className="text-2xl font-extrabold text-primary">
                  {parseFloat(inspectPayoutModal.payout.amount).toLocaleString()} ฿
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspectPayoutModal.payout.image_url}
                  alt="Admin Slip"
                  className="max-h-[350px] w-full object-contain"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => handleVerifyPayout(inspectPayoutModal.payout.id, 'REJECTED')}
                >
                  ❌ แจ้งสลิปผิด
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => handleVerifyPayout(inspectPayoutModal.payout.id, 'APPROVED')}
                >
                  ✅ ได้รับเงินแล้ว
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Slip Modal — Admin approves member payment slip */}
      <Dialog
        open={reviewSlipModal.open}
        onOpenChange={(o) => !o && setReviewSlipModal({ open: false, slip: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔍 ตรวจสอบหลักฐานการชำระเงิน</DialogTitle>
          </DialogHeader>
          {reviewSlipModal.slip && (
            <>
              <div className="text-center">
                <div className="mb-1 text-sm text-muted-foreground">ยอดที่สมาชิกแจ้งชำระ</div>
                <div className="text-2xl font-extrabold text-primary">
                  {parseFloat(reviewSlipModal.slip.amount || 0).toLocaleString()} ฿
                </div>
                {reviewSlipModal.slip.note && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {reviewSlipModal.slip.note}
                  </div>
                )}
              </div>
              {reviewSlipModal.slip.image_url ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reviewSlipModal.slip.image_url}
                    alt="Payment Slip"
                    className="max-h-[350px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  ไม่มีรูปสลิปแนบมา
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => handleVerifySlip(reviewSlipModal.slip!.id)}
                >
                  ✅ อนุมัติ
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormField({ label, children, boxed = true }) {
  if (boxed) {
    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <label className="mb-2 block text-sm font-bold">{label}</label>
        {children}
      </div>
    );
  }
  return (
    <div>
      <label className="mb-2 block text-xs font-bold">{label}</label>
      {children}
    </div>
  );
}
