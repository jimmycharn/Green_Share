// @ts-nocheck
// Step 6c: legacy JS migrated to TSX with broad types only.
// Strict typing of this 2k-line file is deferred — see @/app/circles/[id]/page.tsx
// callers receive correct shadcn/lucide types via imports below. Internal
// business logic types (Period, Bid winner, etc.) intentionally use `any`
// pending future incremental refactor.
'use client';

import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { supabase } from '@/lib/supabase';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { authHeaders } from '@/lib/authHeaders';
import { callAction } from '@/lib/api';
import { subscribeToTable, unsubscribeChannel } from '@/lib/realtime';
import { usePolling } from '@/lib/polling';
import QRCode from 'qrcode';
import { generatePromptPayPayload, buildBankQRText } from '@/lib/promptpay';
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
  const searchParams = useSearchParams();
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
    deduction: number;
  }>({
    open: false,
    period: null,
    winner_id: null,
    winner_name: '',
    amount: 0,
    deduction: 0,
  });
  const [inspectPayoutModal, setInspectPayoutModal] = useState<{
    open: boolean;
    payout: Payout | null;
  }>({ open: false, payout: null });
  const [reviewSlipModal, setReviewSlipModal] = useState<{
    open: boolean;
    slip: AnyRecord | null;
  }>({ open: false, slip: null });
  const [imageViewer, setImageViewer] = useState<string | null>(null);
  const [notifiedBidPeriods, setNotifiedBidPeriods] = useState<Set<number>>(new Set());
  const [bidAmount, setBidAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'TRANSFER' | 'CASH'>('TRANSFER');
  const [myBank, setMyBank] = useState<Bank | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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
    // Realtime subscriptions for live updates
    const subs = [
      subscribeToTable(`cp-${circleId}`, 'circle_players', `circle_id=eq.${circleId}`, fetchCircleDetail),
      subscribeToTable(`slips-${circleId}`, 'slips', `circle_id=eq.${circleId}`, fetchCircleDetail),
      subscribeToTable(`payouts-${circleId}`, 'admin_payments', `circle_id=eq.${circleId}`, fetchCircleDetail),
      subscribeToTable(`bids-${circleId}`, 'bids', `circle_id=eq.${circleId}`, fetchCircleDetail),
    ];
    return () => {
      unsubscribeChannel(`cp-${circleId}`);
      unsubscribeChannel(`slips-${circleId}`);
      unsubscribeChannel(`payouts-${circleId}`);
      unsubscribeChannel(`bids-${circleId}`);
    };
  }, [dbUser, circleId]);

  // Polling fallback: refresh every 5s when tab is visible
  usePolling(() => {
    if (circleId && dbUser) fetchCircleDetail();
  }, 5000, !!(circleId && dbUser));

  // Generate QR code for bank transfer when myBank is available
  useEffect(() => {
    if (!myBank?.account_no) {
      setQrDataUrl(null);
      return;
    }
    const payload = generatePromptPayPayload(myBank.account_no);
    // If generatePromptPayPayload returns just the account number (not a PromptPay payload),
    // fall back to a plain text QR
    const qrText =
      payload === myBank.account_no
        ? buildBankQRText(myBank.bank_name || '', myBank.account_no, myBank.account_name || '')
        : payload;
    QRCode.toDataURL(qrText, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [myBank]);

  useEffect(() => {
    if (!circleId) return;
    const restored = new Set<number>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`bid_notified_${circleId}_`)) {
        const p = parseInt(key.replace(`bid_notified_${circleId}_`, ''), 10);
        if (p > 0) restored.add(p);
      }
    }
    if (restored.size > 0) setNotifiedBidPeriods(restored);
  }, [circleId]);

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

      // Conditional Default Tab — respect ?tab= query param
      if (!activeTab) {
        const urlTab = searchParams.get('tab');
        setActiveTab(urlTab === 'members' ? 'members' : 'timeline');
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

  const handleRemoveEmptyHand = async (handNo) => {
    const ok = await confirm({
      title: 'ลบมือว่าง',
      description: `ยืนยันการลบมือที่ ${handNo}? ระบบจะเลื่อนมือที่ ${handNo + 1} ขึ้นมาแทนโดยอัตโนมัติ`,
      destructive: true,
    });
    if (!ok) return;
    try {
      const data = await callAction('remove_empty_hand', {
        circle_id: circleId,
        hand_no: handNo,
        caller_role: dbUser.role,
      });
      if (data.status === 'success') {
        fetchCircleDetail();
        setMessage({ type: 'success', text: data.message || 'ลบมือว่างเรียบร้อยแล้ว' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
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

  const handleVerifySlip = async (slipId, slipStatus = 'APPROVED') => {
    const isApprove = slipStatus === 'APPROVED';
    const ok = await confirm({
      title: isApprove ? 'อนุมัติสลิป' : 'ไม่อนุมัติสลิป',
      description: isApprove
        ? 'ยืนยันการอนุมัติสลิปนี้?'
        : 'ยืนยันการไม่อนุมัติสลิปนี้? สมาชิกจะต้องส่งหลักฐานใหม่อีกครั้ง',
    });
    if (!ok) return;
    try {
      const data = await callAction('verify_slip', {
        slip_id: slipId,
        slip_status: slipStatus,
        caller_role: dbUser.role,
      });
      if (data.status === 'success') {
        toast.success(data.message);
        setReviewSlipModal({ open: false, slip: null });
        fetchCircleDetail();
      } else {
        toast.error(data.message);
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
      // 1. Upload File to Storage if selected (via server to avoid CORS in LIFF)
      if (selectedFile && paymentMode === 'TRANSFER') {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('folder', circleId);
        const ah = authHeaders();
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          headers: ah.Authorization ? { Authorization: ah.Authorization } : {},
          body: fd,
        });
        const upJson = await upRes.json();
        if (upJson.status !== 'success') throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + upJson.message);
        finalImageUrl = upJson.url;
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

  const isBiddingWindowOpen = (period: number): boolean => {
    const pDate = periodDates.find((pd) => pd.period === period);
    if (!pDate?.period_date) return true; // no date → no time restriction
    const bidStart = (circle?.bid_start_time || '00:00').substring(0, 5);
    const bidEnd = (circle?.bid_end_time || '23:59').substring(0, 5);
    const now = new Date();
    const start = new Date(`${pDate.period_date}T${bidStart}:00`);
    const end = new Date(`${pDate.period_date}T${bidEnd}:00`);
    return now >= start && now <= end;
  };

  const isBiddingWindowExpired = (period: number): boolean => {
    const pDate = periodDates.find((pd) => pd.period === period);
    if (!pDate?.period_date) return false; // no date set → never considered expired
    const bidEnd = (circle?.bid_end_time || '23:59').substring(0, 5);
    const end = new Date(`${pDate.period_date}T${bidEnd}:00`);
    return new Date() > end;
  };

  const toSecond = (t: string): string => new Date(t).toISOString().substring(0, 19);

  const getHasNoClearWinner = (period: number): boolean => {
    const periodBids = bids
      .filter((b) => b.period === period)
      .sort((a, b) => b.bid_amount - a.bid_amount);
    if (periodBids.length === 0) return true; // no bids → need random
    if (periodBids.length === 1) return false; // single bidder → clear winner
    const topAmount = periodBids[0].bid_amount;
    const topTime = toSecond(periodBids[0].bid_time);
    // tie only when same amount AND same second
    return periodBids[1].bid_amount === topAmount && toSecond(periodBids[1].bid_time) === topTime;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกเลขบัญชีแล้ว!');
  };
  const handlePayoutSubmit = async () => {
    if (!payoutModal.period || !payoutModal.winner_id) return;
    const isSelfPayout = payoutModal.winner_id === dbUser?.id;
    setUploadLoading(true);
    try {
      let finalImg = isSelfPayout ? null : uploadData.image_url;
      if (!isSelfPayout && selectedFile) {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('folder', 'payouts');
        const ah = authHeaders();
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          headers: ah.Authorization ? { Authorization: ah.Authorization } : {},
          body: fd,
        });
        const upJson = await upRes.json();
        if (upJson.status !== 'success') throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + upJson.message);
        finalImg = upJson.url;
      }

      const data = await callAction('create_payout', {
        circle_id: circleId,
        member_id: payoutModal.winner_id,
        period: payoutModal.period,
        amount: payoutModal.amount,
        image_url: finalImg,
        is_cash: isSelfPayout ? true : paymentMode === 'CASH',
        auto_approve: isSelfPayout,
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
          <div className="mb-2 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              aria-label="กลับ"
            >
              <ArrowLeft className="size-5 text-primary" />
            </Button>
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

          {/* Start circle admin block — show below LINE button when OPEN */}
          {isCircleAdmin && circle.status === 'OPEN' && (
            <div
              className="glass-panel"
              style={{
                marginTop: '12px',
                textAlign: 'center',
                border: '1px dashed var(--primary)',
              }}
            >
              <h4 style={{ margin: '0 0 12px 0' }}>จัดการวงแชร์</h4>
              <button onClick={handleStartCircle} className="btn-primary" style={{ width: '100%' }}>
                {' '}
                ✨ เริ่มเดินวง{' '}
              </button>
            </div>
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
            {/* start circle block moved to top section, above tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {totalHandsArray.map((hand) => {
                const player = players.find((p) => p.hand_no === hand);
                const assignedId =
                  circle.type === 'ขั้นบันได (ดอกคงที่)' ? getAssignedTo(hand) : null;
                const assignedMember =
                  assignedId && assignedId !== 'NONE'
                    ? allMembers.find((m) => m.id === assignedId)
                    : null;

                // If there's an assigned member but no player record yet, we still consider them the "player" for display
                const displayPlayer =
                  player ||
                  (assignedMember
                    ? {
                        member_id: assignedMember.id,
                        member_name: assignedMember.name,
                        picture_url: assignedMember.picture_url,
                      }
                    : null);

                const canClick = !displayPlayer && circle.status === 'OPEN';
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
                      opacity: !displayPlayer && !canClick ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: displayPlayer ? 'var(--primary-gradient)' : '#cbd5e1',
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
                            fontWeight: displayPlayer ? '700' : '500',
                            color: displayPlayer ? 'var(--foreground)' : '#94a3b8',
                          }}
                        >
                          {displayPlayer
                            ? allMembers.find((m) => m.id === displayPlayer.member_id)
                                ?.custom_nickname || displayPlayer.member_name
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
                    {/* Member can cancel their own hand */}
                    {player && player.member_id === dbUser?.id && !isCircleAdmin && circle.status === 'OPEN' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelHand(e, hand);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #fca5a5',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          color: '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                        }}
                      >
                        ยกเลิก
                      </button>
                    )}
                    {!displayPlayer && isCircleAdmin && circle.status === 'OPEN' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveEmptyHand(hand);
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #fca5a5',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          color: '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                        }}
                      >
                        🗑️ ลบ
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
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '0 -8px' }}
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
              const assignedMemberObj =
                stairAssignedId && stairAssignedId !== 'NONE'
                  ? allMembers.find((m) => m.id === stairAssignedId)
                  : null;
              const stairWinnerPlayer = isStairType
                ? stairAssignedId && stairAssignedId !== 'NONE'
                  ? players.find((p) => p.member_id === stairAssignedId)
                  : players.find((p) => p.hand_no === period)
                : null;
              const stairWinnerName =
                assignedMemberObj?.custom_nickname ||
                assignedMemberObj?.name ||
                allMembers.find((m) => m.id === stairWinnerPlayer?.member_id)?.custom_nickname ||
                stairWinnerPlayer?.member_name ||
                '';
              const stairWinnerPic =
                assignedMemberObj?.picture_url || stairWinnerPlayer?.picture_url || null;
              const pDateObj = periodDates.find((p) => p.period === period);
              const amountPerPeriod = isStairType
                ? pDateObj?.amount
                : (pDateObj?.amount ?? circle.amount_per_hand);
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
                      padding: '12px',
                      display: 'flex',
                      alignItems: isStairType || isCompleted ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      background: isCompleted
                        ? 'rgba(16, 185, 129, 0.05)'
                        : isCurrent
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'transparent',
                      cursor: isFuture && circle.status !== 'OPEN' ? 'default' : 'pointer',
                      position: 'relative',
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
                          paddingRight: '36px',
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
                          {amountPerPeriod != null && amountPerPeriod !== undefined ? (
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
                          {stairWinnerId && stairReceivedAmount > 0 && !isFuture && (
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
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (stairIsMe) {
                                        const ok = await confirm({
                                          title: 'ยืนยันการรับเงิน',
                                          description: `ยืนยันว่าคุณได้รับเงิน ${stairReceivedAmount.toLocaleString()} ฿ ครบแล้ว`,
                                        });
                                        if (!ok) return;
                                        try {
                                          const res = await callAction('create_payout', {
                                            circle_id: circleId,
                                            member_id: stairWinnerId,
                                            period,
                                            amount: stairReceivedAmount,
                                            is_cash: true,
                                            auto_approve: true,
                                            caller_role: dbUser.role,
                                          });
                                          if (res.status === 'success') fetchCircleDetail();
                                          else setMessage({ type: 'error', text: res.message });
                                        } catch {
                                          setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
                                        }
                                      } else {
                                        setPayoutModal({
                                          open: true,
                                          period,
                                          winner_id: stairWinnerId,
                                          winner_name: stairWinnerName,
                                          amount: stairReceivedAmount,
                                          deduction: 0,
                                        });
                                      }
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
                                  stairIsMe ? (
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
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        padding: '1px 6px',
                                        borderRadius: '5px',
                                        fontWeight: '600',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      ⏳ รอตรวจสอบ
                                    </span>
                                  )
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
                    ) : isCompleted && winner ? (
                      /* ── Auction completed: 3-row clean layout ── */
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          flex: 1,
                          minWidth: 0,
                          paddingRight: '36px',
                        }}
                      >
                        {/* Winner avatar */}
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '2px solid #10b981',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {winner.picture_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={winner.picture_url}
                              alt={winner.member_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span
                              style={{ fontSize: '1.2rem', color: '#94a3b8', fontWeight: '700' }}
                            >
                              {(allMembers.find((m) => m.id === winner.member_id)
                                ?.custom_nickname || winner.member_name)?.[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Text block */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Row 1: period + date chip + closed badge */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '5px',
                              marginBottom: '3px',
                            }}
                          >
                            <span
                              style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e293b' }}
                            >
                              งวดที่ {period}
                            </span>
                            {pDateObj?.period_date && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
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
                                })}{' '}
                                · ✅ ปิดแล้ว
                              </span>
                            )}
                          </div>

                          {/* Row 2: winner name + win-type label */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginBottom: '6px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: '700',
                                color: '#1e293b',
                              }}
                            >
                              🏆{' '}
                              {allMembers.find((m) => m.id === winner.member_id)?.custom_nickname ||
                                winner.member_name}
                            </span>
                            {getAssignedTo(period) && getAssignedTo(period) !== 'NONE' ? (
                              <span
                                style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: '700' }}
                              >
                                (ท้าวแชร์)
                              </span>
                            ) : winnerBid?.bid_amount > 0 ? (
                              <span
                                style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: '700' }}
                              >
                                (เปีย {winnerBid.bid_amount.toLocaleString()})
                              </span>
                            ) : winnerBid?.bid_amount === 0 ? (
                              <span
                                style={{ fontSize: '0.78rem', color: '#8b5cf6', fontWeight: '700' }}
                              >
                                (สุ่มชนะ)
                              </span>
                            ) : null}
                          </div>

                          {/* Row 3: amount chips + payout status */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '5px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#0d7248',
                                fontWeight: '600',
                                background: 'rgba(16,185,129,0.12)',
                                padding: '2px 7px',
                                borderRadius: '5px',
                              }}
                            >
                              💰 {Number(circle.amount_per_hand).toLocaleString()} ฿/งวด
                              {winnerBid?.bid_amount > 0 &&
                                ` · เปีย ${winnerBid.bid_amount.toLocaleString()}`}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#166534',
                                fontWeight: '700',
                                background: '#dcfce7',
                                padding: '2px 7px',
                                borderRadius: '5px',
                              }}
                            >
                              🏦 {receivedAmount.toLocaleString()} ฿
                            </span>
                            {/* Payout status / action button */}
                            {isCircleAdmin ? (
                              !winnerPayout || winnerPayout.status === 'REJECTED' ? (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (winner.member_id === dbUser?.id) {
                                      const ok = await confirm({
                                        title: 'ยืนยันการรับเงิน',
                                        description: `ยืนยันว่าคุณได้รับเงิน ${receivedAmount.toLocaleString()} ฿ ครบแล้ว`,
                                      });
                                      if (!ok) return;
                                      try {
                                        const res = await callAction('create_payout', {
                                          circle_id: circleId,
                                          member_id: winner.member_id,
                                          period,
                                          amount: receivedAmount,
                                          is_cash: true,
                                          auto_approve: true,
                                          caller_role: dbUser.role,
                                        });
                                        if (res.status === 'success') fetchCircleDetail();
                                        else setMessage({ type: 'error', text: res.message });
                                      } catch {
                                        setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
                                      }
                                    } else {
                                      setPayoutModal({
                                        open: true,
                                        period,
                                        winner_id: winner.member_id,
                                        winner_name:
                                          allMembers.find((m) => m.id === winner.member_id)
                                            ?.custom_nickname || winner.member_name,
                                        amount: receivedAmount,
                                        deduction: 0,
                                      });
                                    }
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
                              ) : winnerPayout.status === 'PENDING' ? (
                                winner.member_id === dbUser?.id ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectPayoutModal({ open: true, payout: winnerPayout });
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
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      padding: '2px 7px',
                                      borderRadius: '5px',
                                      fontWeight: '600',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    ⏳ รอตรวจสอบ
                                  </span>
                                )
                              ) : (
                                <span
                                  style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    fontWeight: '700',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  ✅ รับแล้ว
                                </span>
                              )
                            ) : winner.member_id === dbUser?.id ? (
                              !winnerPayout || winnerPayout.status === 'REJECTED' ? (
                                <span
                                  style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    fontWeight: '700',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  ❌ ยังไม่ได้รับเงิน
                                </span>
                              ) : winnerPayout.status === 'PENDING' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectPayoutModal({ open: true, payout: winnerPayout });
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
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    fontWeight: '700',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  ✅ รับแล้ว
                                </span>
                              )
                            ) : !winnerPayout || winnerPayout.status === 'REJECTED' ? (
                              <span
                                style={{
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontWeight: '600',
                                  fontSize: '0.7rem',
                                }}
                              >
                                ⏳ ยังไม่จ่าย
                              </span>
                            ) : winnerPayout.status === 'PENDING' ? (
                              <span
                                style={{
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  padding: '2px 7px',
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
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontWeight: '600',
                                  fontSize: '0.7rem',
                                }}
                              >
                                ✅ รับแล้ว
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── Auction current/future: text only, no circle ── */
                      <div style={{ flex: 1, paddingRight: '36px' }}>
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
                        {/* Assigned member info */}
                        {(() => {
                          const assignedTo = getAssignedTo(period);
                          if (assignedTo && assignedTo !== 'NONE') {
                            const assignedMember = allMembers.find((m) => m.id === assignedTo);
                            const isCreator = assignedTo === circle.creator_id;
                            return (
                              <div
                                style={{
                                  fontSize: '0.78rem',
                                  color: isCreator ? '#b45309' : '#1e293b',
                                  fontWeight: '700',
                                  marginTop: '2px',
                                }}
                              >
                                {isCreator
                                  ? `👤 ${assignedMember?.name || 'ท้าวแชร์'} (ท้าวแชร์)`
                                  : `👤 ${assignedMember?.custom_nickname || assignedMember?.name || 'สมาชิก'}`}
                              </div>
                            );
                          }
                          return null;
                        })()}
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
                    )}

                    {/* Action Buttons */}
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
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: '#f1f5f9',
                          border: 'none',
                          padding: '6px',
                          borderRadius: '10px',
                          color: '#64748b',
                          zIndex: 2,
                        }}
                      >
                        ⚙️
                      </button>
                    )}
                    {(!isFuture || circle.status === 'OPEN') && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '50%',
                          right: '16px',
                          transform: `translateY(-50%) ${isExpanded ? 'rotate(180deg)' : 'rotate(0)'}`,
                          transition: 'all 0.3s',
                          color: '#cbd5e1',
                        }}
                      >
                        ▼
                      </span>
                    )}
                  </div>

                  {/* Winner Summary removed — info is now in the card header */}
                  {false && winner && !isExpanded && (
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
                            {/* Admin: Payment Summary Dashboard */}
                            {isCircleAdmin && (
                              <div
                                style={{
                                  flex: '1 1 100%',
                                  padding: '16px',
                                  background: '#fefce8',
                                  borderRadius: '14px',
                                  border: '1px solid #facc15',
                                  marginBottom: '8px',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    color: '#854d0e',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  📋 สรุปการชำระเงินงวดที่ {period}
                                </div>
                                {(() => {
                                  // Determine who needs to pay and who has paid
                                  const uniqueMemberIds = [...new Set(players.map((p) => p.member_id))];
                                  const winnerId = isStairType
                                    ? (getAssignedTo(period) === 'NONE' ? null : getAssignedTo(period))
                                    : (() => {
                                        const periodBidsList = bids
                                          .filter((b) => b.period === period)
                                          .sort((a, b) => b.bid_amount - a.bid_amount);
                                        return periodBidsList[0]?.member_id || null;
                                      })();

                                  const memberStatuses = uniqueMemberIds.map((mId) => {
                                    const memberName =
                                      allMembers.find((m) => m.id === mId)?.custom_nickname ||
                                      players.find((p) => p.member_id === mId)?.member_name ||
                                      'สมาชิก';
                                    const isWinner = mId === winnerId;
                                    const approvedSlips = slips.filter(
                                      (s) => s.period === period && s.member_id === mId && s.status === 'APPROVED'
                                    );
                                    const pendingSlips = slips.filter(
                                      (s) => s.period === period && s.member_id === mId && s.status === 'PENDING'
                                    );
                                    const totalPaid = approvedSlips.reduce((sum, s) => sum + Number(s.amount), 0);
                                    const handsCount = players.filter((p) => p.member_id === mId).length;
                                    const requiredAmt = handsCount * (circle.amount_per_hand || 0);
                                    const hasPaidEnough = totalPaid >= requiredAmt;

                                    if (isWinner) {
                                      return { mId, memberName, status: 'WINNER', totalPaid, requiredAmt };
                                    }
                                    if (hasPaidEnough) {
                                      return { mId, memberName, status: 'PAID', totalPaid, requiredAmt };
                                    }
                                    if (pendingSlips.length > 0) {
                                      return { mId, memberName, status: 'PENDING', totalPaid, requiredAmt };
                                    }
                                    return { mId, memberName, status: 'UNPAID', totalPaid, requiredAmt };
                                  });

                                  const unpaid = memberStatuses.filter((m) => m.status === 'UNPAID');
                                  const pending = memberStatuses.filter((m) => m.status === 'PENDING');
                                  const paid = memberStatuses.filter((m) => m.status === 'PAID');

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {unpaid.length > 0 && (
                                        <div>
                                          <div
                                            style={{
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              color: '#991b1b',
                                              marginBottom: '4px',
                                            }}
                                          >
                                            ❌ ยังไม่จ่าย ({unpaid.length} คน):
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {unpaid.map((m) => (
                                              <span
                                                key={m.mId}
                                                style={{
                                                  fontSize: '0.72rem',
                                                  background: '#fee2e2',
                                                  color: '#991b1b',
                                                  padding: '2px 8px',
                                                  borderRadius: '6px',
                                                  fontWeight: '600',
                                                }}
                                              >
                                                {m.memberName}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {pending.length > 0 && (
                                        <div>
                                          <div
                                            style={{
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              color: '#92400e',
                                              marginBottom: '4px',
                                            }}
                                          >
                                            ⏳ รอตรวจสอบ ({pending.length} คน):
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {pending.map((m) => (
                                              <span
                                                key={m.mId}
                                                style={{
                                                  fontSize: '0.72rem',
                                                  background: '#fef3c7',
                                                  color: '#92400e',
                                                  padding: '2px 8px',
                                                  borderRadius: '6px',
                                                  fontWeight: '600',
                                                }}
                                              >
                                                {m.memberName}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {paid.length > 0 && (
                                        <div>
                                          <div
                                            style={{
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              color: '#166534',
                                              marginBottom: '4px',
                                            }}
                                          >
                                            ✅ จ่ายแล้ว ({paid.length} คน):
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {paid.map((m) => (
                                              <span
                                                key={m.mId}
                                                style={{
                                                  fontSize: '0.72rem',
                                                  background: '#dcfce7',
                                                  color: '#166534',
                                                  padding: '2px 8px',
                                                  borderRadius: '6px',
                                                  fontWeight: '600',
                                                }}
                                              >
                                                {m.memberName}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {(unpaid.length > 0 || pending.length > 0) && (
                                        <button
                                          type="button"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              const res = await callAction('notify_unpaid_members', {
                                                circle_id: circleId,
                                                period,
                                                caller_role: dbUser.role,
                                              });
                                              if (res.status === 'success') toast.success(res.message);
                                              else toast.error(res.message);
                                            } catch {
                                              toast.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
                                            }
                                          }}
                                          style={{
                                            marginTop: '8px',
                                            padding: '8px 14px',
                                            background: '#f59e0b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            alignSelf: 'flex-start',
                                          }}
                                        >
                                          🔔 ส่งแจ้งเตือนให้ผู้ที่ยังไม่จ่าย
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Bingo/Auction Logic */}
                            {circle.type === 'ประมูล (เปียแข่งดอก)' && (
                              <>
                                {isCurrent &&
                                  (isBiddingClosed(period) ? (
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
                                  ) : !isBiddingWindowOpen(period) ? (
                                    <div
                                      style={{
                                        flex: '1 1 45%',
                                        padding: '12px',
                                        fontSize: '0.85rem',
                                        background: '#f8fafc',
                                        borderRadius: '12px',
                                        color: '#94a3b8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        border: '1px solid #e2e8f0',
                                        cursor: 'default',
                                      }}
                                    >
                                      🕐 ยังไม่ถึงเวลาประมูล
                                    </div>
                                  ) : (
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
                                  ))}

                                {/* QR Code for member payment */}
                                {canPay && !isCircleAdmin && qrDataUrl && myBank && (
                                  <div
                                    style={{
                                      flex: '1 1 100%',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '16px',
                                      background: '#f8fafc',
                                      borderRadius: '12px',
                                      border: '1px dashed #cbd5e1',
                                    }}
                                  >
                                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                                      📱 สแกน QR โอนเงิน
                                    </div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={qrDataUrl}
                                      alt="QR Code โอนเงิน"
                                      style={{ width: '180px', height: '180px', borderRadius: '8px' }}
                                    />
                                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                                      <div style={{ fontWeight: '600' }}>{myBank.bank_name}</div>
                                      <div>{myBank.account_no}</div>
                                      <div>{myBank.account_name}</div>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(myBank.account_no || '')}
                                    >
                                      📋 คัดลอกเลขบัญชี
                                    </Button>
                                  </div>
                                )}

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

                                {isCircleAdmin && !isCompleted && (
                                  <>
                                    {isCurrent && !isBiddingClosed(period) && (
                                      <>
                                        {/* เริ่มประมูล: only during bidding window */}
                                        {isBiddingWindowOpen(period) && (
                                          <button
                                            onClick={async () => {
                                              try {
                                                const res = await callAction('notify_bid_start', {
                                                  circle_id: circleId,
                                                  period,
                                                  caller_role: dbUser.role,
                                                });
                                                if (res.status === 'success') {
                                                  toast.success(res.message);
                                                  localStorage.setItem(
                                                    `bid_notified_${circleId}_${period}`,
                                                    '1'
                                                  );
                                                  setNotifiedBidPeriods(
                                                    (prev) => new Set([...prev, period])
                                                  );
                                                } else toast.error(res.message);
                                              } catch {
                                                toast.error('เกิดข้อผิดพลาดในการส่งการแจ้งเตือน');
                                              }
                                            }}
                                            className="btn-primary"
                                            style={{
                                              flex: '1 1 100%',
                                              padding: '10px',
                                              fontSize: '0.8rem',
                                              background: '#10b981',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '6px',
                                            }}
                                          >
                                            🔔 เริ่มประมูล (แจ้งสมาชิก)
                                          </button>
                                        )}
                                        {/* ปิดประมูล: enabled when notified OR when a bid already exists (e.g. after random selection) */}
                                        {notifiedBidPeriods.has(period) ||
                                        bids.some((b) => b.period === period) ? (
                                          <button
                                            onClick={() =>
                                              handleCircleAction('close_bidding', period)
                                            }
                                            className="btn-primary"
                                            style={{
                                              flex: '1 1 45%',
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
                                        ) : (
                                          <button
                                            onClick={() =>
                                              toast.error(
                                                'กรุณากด "เริ่มประมูล (แจ้งสมาชิก)" ก่อนปิดประมูล'
                                              )
                                            }
                                            style={{
                                              flex: '1 1 45%',
                                              padding: '10px',
                                              fontSize: '0.75rem',
                                              background: '#e2e8f0',
                                              color: '#94a3b8',
                                              border: 'none',
                                              borderRadius: '8px',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              gap: '4px',
                                              cursor: 'not-allowed',
                                            }}
                                          >
                                            <span>🔒</span> ปิดประมูล
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {/* สุ่มผู้ชนะ: only after window time has expired (or admin closed), no clear winner */}
                                    {isCurrent &&
                                      (isBiddingWindowExpired(period) || isBiddingClosed(period)) &&
                                      !Boolean(getAssignedTo(period)) &&
                                      getHasNoClearWinner(period) && (
                                        <button
                                          onClick={() =>
                                            handleCircleAction('random_select_bidder', period)
                                          }
                                          className="btn-primary"
                                          style={{
                                            flex: '1 1 45%',
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
                                      )}
                                    {/* ปิดงวด: after bidding closed or pre-assigned */}
                                    {(isBiddingClosed(period) ||
                                      Boolean(getAssignedTo(period))) && (
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
                                    )}
                                  </>
                                )}
                              </>
                            )}

                            {/* Staircase/Fixed Interest Logic */}
                            {circle.type === 'ขั้นบันได (ดอกคงที่)' && (
                              <>
                                {/* QR Code for member payment */}
                                {canPay && !isCircleAdmin && qrDataUrl && myBank && (
                                  <div
                                    style={{
                                      flex: '1 1 100%',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '16px',
                                      background: '#f8fafc',
                                      borderRadius: '12px',
                                      border: '1px dashed #cbd5e1',
                                    }}
                                  >
                                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                                      📱 สแกน QR โอนเงิน
                                    </div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={qrDataUrl}
                                      alt="QR Code โอนเงิน"
                                      style={{ width: '180px', height: '180px', borderRadius: '8px' }}
                                    />
                                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                                      <div style={{ fontWeight: '600' }}>{myBank.bank_name}</div>
                                      <div>{myBank.account_no}</div>
                                      <div>{myBank.account_name}</div>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(myBank.account_no || '')}
                                    >
                                      📋 คัดลอกเลขบัญชี
                                    </Button>
                                  </div>
                                )}

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

                                {isCircleAdmin && !isCompleted && (
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
                                    <span>🇭</span> ปิดงวดการส่งเงิน
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )
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

                          // Deduction: winner's unpaid installments for this period
                          const winnerHandsCount = winnerMemberId
                            ? players.filter((pl) => pl.member_id === winnerMemberId).length
                            : 0;
                          const winnerApprovedAmt = winnerMemberId
                            ? slips
                                .filter(
                                  (s) =>
                                    s.period === period &&
                                    s.member_id === winnerMemberId &&
                                    s.status === 'APPROVED'
                                )
                                .reduce((sum, s) => sum + Number(s.amount), 0)
                            : 0;
                          const winnerDeduction = Math.max(
                            0,
                            winnerHandsCount * circle.amount_per_hand - winnerApprovedAmt
                          );

                          return [...players]
                            .sort((a, b) => a.hand_no - b.hand_no)
                            .map((p) => {
                              const pBid = bids.find(
                                (b) => b.period === period && b.member_id === p.member_id
                              );
                              const pSlip =
                                slips.find(
                                  (s) =>
                                    s.period === period &&
                                    s.member_id === p.member_id &&
                                    s.status === 'APPROVED'
                                ) ||
                                slips.find(
                                  (s) => s.period === period && s.member_id === p.member_id
                                );
                              const isMe = dbUser && p.member_id === dbUser.id;
                              const status = handStatus[p.hand_no];
                              const isDead = status === 'DEAD';
                              const isActive = status === 'ACTIVE';
                              const isWinner =
                                p.member_id === winnerMemberId && isActive && biddingIsClosed;

                              // Net Amount = gross - bid_interest - winner's unpaid installments
                              const netAmount =
                                circle.total_hands * circle.amount_per_hand -
                                (periodWinner?.bid_amount || 0) -
                                winnerDeduction;

                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '12px',
                                    borderRadius: '14px',
                                    background: isWinner && !isCompleted ? '#fffbeb' : '#f8fafc',
                                    border:
                                      isWinner && !isCompleted
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
                                        {isWinner && !isCompleted ? '🏆 ' : ''}
                                        {allMembers.find((m) => m.id === p.member_id)
                                          ?.custom_nickname || p.member_name}{' '}
                                        {isDead ? '(มือตาย)' : ''}
                                      </span>
                                      {!isStairType && pBid && !isWinner && isActive && (
                                        <span
                                          style={{
                                            fontSize: '0.75rem',
                                            color:
                                              pBid.bid_amount === 0 ? '#8b5cf6' : 'var(--primary)',
                                            fontWeight: '600',
                                          }}
                                        >
                                          {pBid.bid_amount === 0
                                            ? '(สุ่มชนะ)'
                                            : `(เปีย ${
                                                isCompleted || isCircleAdmin || isMe
                                                  ? pBid.bid_amount.toLocaleString()
                                                  : '***'
                                              })`}
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      {pSlip && pSlip.status !== 'REJECTED' ? (
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
                                      ) : p.member_id === winnerMemberId &&
                                        currentPayout &&
                                        currentPayout.status !== 'REJECTED' ? (
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: '#fef3c7',
                                            color: '#92400e',
                                          }}
                                        >
                                          🔸 หักแล้ว
                                        </span>
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

                                  {isWinner && !isCompleted && (
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
                                      {winnerDeduction > 0 && (
                                        <span style={{ fontSize: '0.7rem', color: '#b45309' }}>
                                          (หักค่างวด {winnerDeduction.toLocaleString()} ฿)
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
                                                deduction: winnerDeduction,
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
                  {m.custom_nickname || m.name} ({m.nickname || m.id})
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
                {(circle?.status === 'ACTIVE' || circle?.status === 'CLOSED') && (
                  <div
                    style={{
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '10px',
                      border: '1px solid #facc15',
                      fontSize: '0.8rem',
                      color: '#92400e',
                      fontWeight: '600',
                    }}
                  >
                    ⚠️ วงแชร์เริ่มดำเนินการไปแล้ว บางข้อมูลไม่สามารถแก้ไขได้
                  </div>
                )}
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
            {payoutModal.deduction > 0 ? (
              <>
                ยอดก่อนหัก:{' '}
                <b className="text-base">
                  {(payoutModal.amount + payoutModal.deduction).toLocaleString()} ฿
                </b>{' '}
                · หักค่างวด{' '}
                <b className="text-base text-orange-500">
                  {payoutModal.deduction.toLocaleString()} ฿
                </b>
                <br />
              </>
            ) : null}
            ยอดรับสุทธิ:{' '}
            <b className="text-xl text-primary">{payoutModal.amount.toLocaleString()} ฿</b>
          </p>

          {payoutModal.winner_id === dbUser?.id ? (
            <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              ท้าวแชร์เป็นผู้ชนะงวดนี้เอง ไม่จำเป็นต้องแนบสลิป
              กดยืนยันเพื่อบันทึกและแจ้งสมาชิกคนอื่น
            </p>
          ) : (
            <>
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
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setPayoutModal({ ...payoutModal, open: false })}
              disabled={uploadLoading}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handlePayoutSubmit}
              disabled={
                uploadLoading ||
                (payoutModal.winner_id !== dbUser?.id &&
                  paymentMode === 'TRANSFER' &&
                  !selectedFile)
              }
              className="flex-1"
            >
              {uploadLoading
                ? 'กำลังส่ง...'
                : payoutModal.winner_id === dbUser?.id
                  ? '✅ ยืนยันการชำระเงิน'
                  : paymentMode === 'CASH'
                    ? '✅ ยืนยันการจ่ายเงินสด'
                    : '🚀 ส่งหลักฐานการโอน'}
            </Button>
          </DialogFooter>
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
              {inspectPayoutModal.payout.image_url ? (
                <button
                  type="button"
                  onClick={() => setImageViewer(inspectPayoutModal.payout.image_url)}
                  className="block w-full overflow-hidden rounded-2xl border border-border bg-muted/40 transition hover:opacity-90"
                  title="แตะเพื่อดูรูปขนาดใหญ่"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inspectPayoutModal.payout.image_url}
                    alt="Admin Slip"
                    className="max-h-[350px] w-full cursor-zoom-in object-contain"
                  />
                </button>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  ไม่มีรูปสลิปแนบมา (ชำระเป็นเงินสด)
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => handleVerifyPayout(inspectPayoutModal.payout.id, 'REJECTED')}
                >
                  ❌ ไม่อนุมัติ
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => handleVerifyPayout(inspectPayoutModal.payout.id, 'APPROVED')}
                >
                  ✅ อนุมัติ
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
            <DialogTitle>🔍 ตรวจสอบการชำระเงิน</DialogTitle>
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
                <button
                  type="button"
                  onClick={() => setImageViewer(reviewSlipModal.slip!.image_url)}
                  className="block w-full overflow-hidden rounded-2xl border border-border bg-muted/40 transition hover:opacity-90"
                  title="แตะเพื่อดูรูปขนาดใหญ่"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reviewSlipModal.slip.image_url}
                    alt="Payment Slip"
                    className="max-h-[350px] w-full cursor-zoom-in object-contain"
                  />
                </button>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  ไม่มีรูปสลิปแนบมา
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => handleVerifySlip(reviewSlipModal.slip!.id, 'REJECTED')}
                >
                  ❌ ไม่อนุมัติ
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => handleVerifySlip(reviewSlipModal.slip!.id, 'APPROVED')}
                >
                  ✅ อนุมัติ
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox — click slip to view fullscreen with pinch-zoom & pan */}
      {imageViewer && <ImageLightbox url={imageViewer} onClose={() => setImageViewer(null)} />}
    </>
  );
}

function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stateRef = useRef({
    scale: 1,
    tx: 0,
    ty: 0,
    // pointer tracking
    pointers: new Map<number, { x: number; y: number }>(),
    startDist: 0,
    startScale: 1,
    startMid: { x: 0, y: 0 },
    startTx: 0,
    startTy: 0,
    lastTap: 0,
  });
  const [, forceRender] = useState(0);
  const apply = () => {
    const el = imgRef.current;
    if (!el) return;
    const { scale, tx, ty } = stateRef.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const setScale = (next: number, anchorX: number, anchorY: number) => {
    const s = stateRef.current;
    const newScale = clamp(next, 1, 6);
    // zoom around anchor (relative to viewport center of image)
    const factor = newScale / s.scale;
    s.tx = anchorX - factor * (anchorX - s.tx);
    s.ty = anchorY - factor * (anchorY - s.ty);
    s.scale = newScale;
    // when fully zoomed out, recenter
    if (newScale === 1) {
      s.tx = 0;
      s.ty = 0;
    }
    apply();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 2) {
      const pts = Array.from(s.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      s.startDist = Math.hypot(dx, dy) || 1;
      s.startScale = s.scale;
      s.startMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      s.startTx = s.tx;
      s.startTy = s.ty;
    } else if (s.pointers.size === 1) {
      s.startMid = { x: e.clientX, y: e.clientY };
      s.startTx = s.tx;
      s.startTy = s.ty;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 2) {
      const pts = Array.from(s.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const newScale = clamp(s.startScale * (dist / s.startDist), 1, 6);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      // anchor zoom around the midpoint at gesture start
      const factor = newScale / s.startScale;
      s.tx = s.startTx + (mid.x - s.startMid.x) - (factor - 1) * (s.startMid.x - s.startTx);
      s.ty = s.startTy + (mid.y - s.startMid.y) - (factor - 1) * (s.startMid.y - s.startTy);
      s.scale = newScale;
      apply();
    } else if (s.pointers.size === 1 && s.scale > 1) {
      // pan only when zoomed
      s.tx = s.startTx + (e.clientX - s.startMid.x);
      s.ty = s.startTy + (e.clientY - s.startMid.y);
      apply();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = stateRef.current;
    s.pointers.delete(e.pointerId);
    if (s.pointers.size < 2 && s.scale === 1) {
      s.tx = 0;
      s.ty = 0;
      apply();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ax = e.clientX - rect.left - rect.width / 2;
    const ay = e.clientY - rect.top - rect.height / 2;
    const next = s.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
    setScale(next, ax, ay);
    forceRender((n) => n + 1);
  };

  const onClickBackground = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const onImgClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const s = stateRef.current;
    if (now - s.lastTap < 300) {
      // double tap → toggle 1x / 2.5x at tap point
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const ax = e.clientX - rect.left - rect.width / 2;
        const ay = e.clientY - rect.top - rect.height / 2;
        setScale(s.scale > 1 ? 1 : 2.5, ax, ay);
        forceRender((n) => n + 1);
      }
      s.lastTap = 0;
    } else {
      s.lastTap = now;
    }
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/95" />
        <DialogPrimitive.Content
          ref={containerRef as any}
          onWheel={onWheel}
          onClick={onClickBackground}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden outline-none"
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">สลิปขนาดใหญ่</DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="fixed top-4 right-4 z-[101] flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg"
            aria-label="ปิด"
          >
            ✕
          </DialogPrimitive.Close>
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-[101] -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">
            บีบ 2 นิ้วเพื่อซูม · แตะ 2 ครั้งเพื่อขยาย
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={url}
            alt="สลิปขนาดใหญ่"
            draggable={false}
            onClick={onImgClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-h-[95vh] max-w-[95vw] select-none object-contain will-change-transform"
            style={{ touchAction: 'none', transformOrigin: 'center center' }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
