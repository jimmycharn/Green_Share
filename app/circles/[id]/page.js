"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Script from "next/script";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

export default function CircleDetail() {
  const router = useRouter();
  const params = useParams();
  const circleId = params.id;
  const { dbUser, profile, liff, isLoading: isUserLoading } = useUser();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [circle, setCircle] = useState(null);
  const [players, setPlayers] = useState([]);
  const [bids, setBids] = useState([]);
  const [slips, setSlips] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState(""); // Will be set after fetch
  
  // Hand Management States
  const [allMembers, setAllMembers] = useState([]);
  const [adminModal, setAdminModal] = useState({ open: false, mode: "", handNo: "" });
  const [slipModal, setSlipModal] = useState({ open: false, period: null });
  const [uploadData, setUploadData] = useState({ amount: "", note: "", image_url: "" });
  const [adminSelectedUserId, setAdminSelectedUserId] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState(null);
  const [bidModal, setBidModal] = useState({ open: false, period: null });
  const [configModal, setConfigModal] = useState({ open: false, period: null, mode: "" });
  const [payoutModal, setPayoutModal] = useState({ open: false, period: null, winner_id: null, winner_name: "", amount: 0 });
  const [inspectPayoutModal, setInspectPayoutModal] = useState({ open: false, payout: null });
  const [bidAmount, setBidAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("TRANSFER");
  const [myBank, setMyBank] = useState(null);
  const [settingsData, setSettingsData] = useState({
    name: "",
    line_group_url: "",
    bid_start_time: "12:00",
    bid_end_time: "18:00",
    min_bid: "0",
    max_bid: "1000",
    notify_hours: "24",
    close_mode: "แอดมินปิดเอง",
    interest_method: "หักดอก"
  });
  
  // File Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const isCircleAdmin = dbUser && circle && (['SUPERADMIN', 'ADMIN'].includes(dbUser.role) || dbUser.id === circle.creator_id);

  useEffect(() => {
    if (dbUser && circleId) {
       fetchCircleDetail();
    }
  }, [dbUser, circleId]);

  useEffect(() => {
    if (isCircleAdmin && allMembers.length === 0) {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_members', member_id: dbUser.id })
      }).then(res => res.json()).then(data => {
        if (data.status === 'success') setAllMembers(data.members);
      }).catch(err => console.log(err));
    }
  }, [isCircleAdmin, dbUser]);

  const fetchCircleDetail = async () => {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_circle_detail', circle_id: circleId, member_id: dbUser?.id })
    });
    const data = await res.json();
    if (data.status === 'success') {
      setCircle(data.circle);
      setPlayers(data.players || []);
      setBids(data.bids || []);
      setSlips(data.slips || []);
      setPayouts(data.payouts || []);
      setMyBank(data.myBank);
      
      // Conditional Default Tab
      if (!activeTab) {
        if (data.circle.status === 'ACTIVE') {
          setActiveTab("timeline");
        } else {
          setActiveTab("members");
        }
      }
    } else {
      setMessage({ type: "error", text: data.message || "ไม่พบวงแชร์นี้" });
    }
    setIsInitializing(false);
  };

  const handleMemberJoin = async (handNo) => {
    const confirmJoin = confirm(`ยืนยันการจองมือที่ ${handNo}?`);
    if (!confirmJoin) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_circle', circle_id: circleId, hand_no: handNo, member_id: dbUser.id })
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        setMessage({ type: "success", text: "จองมือสำเร็จ!" });
        fetchCircleDetail();
      } else setMessage({ type: "error", text: resData.message });
    } catch (err) { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  const submitAdminModal = async () => {
    if (!adminSelectedUserId) return;
    const isJoin = adminModal.mode === 'JOIN';
    if (!isJoin && !confirm("ยืนยันการโอนมือให้สมาชิกท่านนี้?")) return;
    try {
      const payload = isJoin 
        ? { action: 'join_circle', circle_id: circleId, hand_no: adminModal.handNo, member_id: adminSelectedUserId }
        : { action: 'change_hand_owner', circle_id: circleId, hand_no: adminModal.handNo, new_member_id: adminSelectedUserId, caller_id: dbUser.id, caller_role: dbUser.role };

      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setAdminModal({ open: false, mode: "", handNo: "" });
        fetchCircleDetail();
        setMessage({ type: "success", text: data.message });
      } else setMessage({ type: "error", text: data.message });
    } catch { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  const handleStartCircle = async () => {
    if (!confirm("ยืนยันการเริ่มวงแชร์? ระบบจะปิดรับการจองมือตามปกติและเปลี่ยนสถานะเป็น ACTIVE")) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_circle', circle_id: circleId, caller_role: dbUser.role })
      });
      const data = await res.json();
      if (data.status === 'success') fetchCircleDetail();
      setMessage({ type: data.status, text: data.message });
    } catch { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  const handleCancelHand = async (e, handNo) => {
    e.stopPropagation();
    if (!confirm(`ยืนยันการยกเลิกจองมือที่ ${handNo}?`)) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_hand', circle_id: circleId, hand_no: handNo, caller_id: dbUser.id, caller_role: dbUser.role })
      });
      const data = await res.json();
      if (data.status === 'success') fetchCircleDetail();
      setMessage({ type: data.status, text: data.message });
    } catch { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  const openAdminChangeModal = (e, handNo) => {
    e.stopPropagation();
    setAdminModal({ open: true, mode: 'CHANGE', handNo });
    setAdminSelectedUserId("");
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
    if (!confirm("ยืนยันการอนุมัติสลิปนี้?")) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_slip', slip_id: slipId, caller_role: dbUser.role })
      });
      const data = await res.json();
      if (data.status === 'success') fetchCircleDetail();
    } catch { alert("การเชื่อมต่อขัดข้อง"); }
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
    if (!uploadData.amount) return alert("กรุณาระบุยอดเงิน");
    
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
          
        if (uploadError) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + uploadError.message);
        
        const { data: { publicUrl } } = supabase.storage
          .from('slips')
          .getPublicUrl(uploadRes.path);
          
        finalImageUrl = publicUrl;
      }

      // 2. Submit Action
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'upload_slip', 
          circle_id: circleId, 
          member_id: dbUser.id,
          period: slipModal.period,
          amount: uploadData.amount,
          note: uploadData.note,
          image_url: finalImageUrl,
          is_cash: paymentMode === 'CASH'
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUploadData({ amount: "", note: "", image_url: "" });
        setSelectedFile(null);
        setFilePreview(null);
        setSlipModal({ open: false, period: null });
        fetchCircleDetail();
        setMessage({ type: "success", text: "ส่งสลิปเรียบร้อย!" });
      } else alert(data.message);
    } catch (err) { 
      alert(err.message || "การเชื่อมต่อขัดข้อง"); 
    } finally {
      setUploadLoading(false);
    }
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    if (bidAmount === "") return;
    const amount = parseFloat(bidAmount);

    // Filter non-zero bids for validation
    if (amount !== 0) {
      if (amount < circle.min_bid || amount > circle.max_bid) {
        return alert(`กรุณาระบุยอดเปียตามเงื่อนไขวงแชร์ (${circle.min_bid.toLocaleString()} - ${circle.max_bid.toLocaleString()} บาท)`);
      }
    }

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_bid', circle_id: circleId, period: bidModal.period, member_id: dbUser.id, bid_amount: amount })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setBidModal({ open: false, period: null });
        setBidAmount("");
        fetchCircleDetail();
        if (amount === 0) setMessage({ type: "success", text: "ยกเลิกการประมูลเรียบร้อย" });
      } else alert(data.message);
    } catch { alert("การเชื่อมต่อขัดข้อง"); }
  };

  const handleAdminAutoPay = async (period) => {
    const amt = getRequiredAmount(period);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'upload_slip', 
          circle_id: circleId, 
          member_id: dbUser.id,
          period: period,
          amount: amt,
          status: 'APPROVED',
          caller_role: dbUser.role
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchCircleDetail();
        setMessage({ type: "success", text: "แอดมินชำระเงินเรียบร้อย!" });
      } else alert(data.message);
    } catch { alert("การเชื่อมต่อขัดข้อง"); }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'update_circle_settings', 
            circle_id: circleId, 
            caller_role: dbUser.role,
            ...settingsData 
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setConfigModal({ open: false, period: null });
        fetchCircleDetail();
      } else alert(data.message);
    } catch { alert("การเชื่อมต่อขัดข้อง"); }
  };

  const handleCircleAction = async (action, period) => {
    let confirmMsg = "";
    if (action === 'random_select_bidder') confirmMsg = "สุ่มหาผู้ชนะสำหรับงวดนี้? (จะใช้กรณีไม่มีคนประมูลดอก)";
    if (action === 'close_bidding') confirmMsg = "ยืนยันการปิดรับประมูลของงวดนี้?";
    if (action === 'close_period') confirmMsg = "ยืนยันการปิดงวดและเริ่มงวดถัดไป? (ตรวจสอบว่าทุกคนชำระเงินเรียบร้อยแล้ว)";
    
    if (confirmMsg && !confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action, 
          circle_id: circleId, 
          period, 
          caller_role: dbUser.role 
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage({ type: "success", text: data.message });
        fetchCircleDetail();
      } else alert(data.message);
    } catch { alert("การเชื่อมต่อขัดข้อง"); }
  };

  const toggleAccordion = (period) => {
    setExpandedPeriod(expandedPeriod === period ? null : period);
  };

  const getRequiredAmount = (period) => {
    if (!circle || !dbUser) return 0;
    
    // 1. Identify all winner IDs for past periods
    const pastWinnersMap = {}; // period -> winner_id
    const bidsByP = {};
    bids.forEach(b => {
      if (b.period < period) {
        if (!bidsByP[b.period]) bidsByP[b.period] = [];
        bidsByP[b.period].push(b);
      }
    });
    Object.keys(bidsByP).forEach(p => {
      const sorted = bidsByP[p].sort((a,b) => b.bid_amount - a.bid_amount);
      pastWinnersMap[p] = sorted[0].member_id;
    });

    // 2. Count how many wins the current user has and sum their bid amounts if needed
    const userWins = [];
    Object.keys(pastWinnersMap).forEach(p => {
      if (pastWinnersMap[p] === dbUser.id) {
        const winningBid = bids.find(b => b.period === parseInt(p) && b.member_id === dbUser.id);
        if (winningBid) userWins.push(winningBid);
      }
    });

    const userHandsCount = players.filter(p => p.member_id === dbUser.id).length;
    const deadHandsCount = userWins.length;
    const liveHandsCount = userHandsCount - deadHandsCount;

    let totalAmount = 0;
    // Every hand pays the base amount
    totalAmount += userHandsCount * circle.amount_per_hand;

    // If method is 'ไม่หักดอก', dead hands also pay their respective bid amounts
    if (circle.interest_method === 'ไม่หักดอก') {
      userWins.forEach(win => {
        totalAmount += win.bid_amount;
      });
    }

    return totalAmount;
  };

  const canUserBid = (period) => {
    if (!circle || !dbUser) return false;
    
    // Permission check
    const permission = circle.bid_permission || 'NONE';
    if (permission === 'NONE') return true;
    
    const myHandsCount = players.filter(p => p.member_id === dbUser.id).length;
    if (myHandsCount === 0) return false;
    
    // Count approved slips for this user in this period
    const approvedSlips = slips.filter(s => s.member_id === dbUser.id && s.period === period && s.status === 'APPROVED');
    
    if (permission === 'PARTIAL') {
      return approvedSlips.length >= 1;
    }
    
    if (permission === 'ALL') {
      // In current logic, one slip pays for all hands.
      // We check if at least one approved slip exists.
      return approvedSlips.length >= 1;
    }
    
    return true;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("คัดลอกเลขบัญชีแล้ว!");
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
        const { error: uploadError } = await supabase.storage.from('shares').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('shares').getPublicUrl(filePath);
        finalImg = publicUrl;
      }

      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payout',
          circle_id: circleId,
          member_id: payoutModal.winner_id,
          period: payoutModal.period,
          amount: payoutModal.amount,
          image_url: finalImg,
          is_cash: paymentMode === 'CASH',
          caller_role: dbUser.role
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage({ type: "success", text: data.message });
        setPayoutModal({ ...payoutModal, open: false });
        setSelectedFile(null);
        setFilePreview(null);
        fetchCircleDetail();
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการส่งหลักฐาน" });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleVerifyPayout = async (payoutId, status) => {
    try {
       const res = await fetch('/api/action', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action: 'verify_payout', payout_id: payoutId, status, caller_id: dbUser.id })
       });
       const data = await res.json();
       if (data.status === 'success') {
         setMessage({ type: "success", text: data.message });
         setInspectPayoutModal({ open: false, payout: null });
         fetchCircleDetail();
       } else setMessage({ type: "error", text: data.message });
    } catch { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  if (isUserLoading || isInitializing) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: "var(--primary)" }}>กำลังโหลด...</h3>
      </div>
    );
  }

  if (!circle) {
    return (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div className="glass-panel">
                <h3 style={{ color: "var(--danger)" }}>{message.text || "ไม่พบข้อมูลวงแชร์"}</h3>
                <Link href="/circles/view" className="btn-primary" style={{ display: "inline-block", marginTop: "20px", textDecoration: "none" }}>กลับหน้าหลัก</Link>
            </div>
        </div>
    );
  }

  const totalHandsArray = Array.from({ length: circle.total_hands }, (_, i) => i + 1);

  return (
    <>
      <div className="animate-fade-in" style={{ paddingBottom: "40px" }}>
        
        {/* Header Circle Title */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "1.6rem", fontWeight: "800", margin: 0 }}>{circle.name}</h2>
              {isCircleAdmin && (
                <button 
                  onClick={() => {
                    setSettingsData({
                      ...circle,
                      close_mode: circle.close_mode === 'AUTO' ? 'ปิดอัตโนมัติ' : 'แอดมินปิดเอง'
                    });
                    setConfigModal({ open: true, mode: 'EDIT_CIRCLE' });
                  }}
                  style={{ background: "#f1f5f9", border: "none", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  ✏️
                </button>
              )}
              <span className={`badge ${circle.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: "0.6rem" }}>{circle.status}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.9rem", color: "#64748b" }}>ยอดวงรวม: <strong style={{ color: "var(--primary)" }}>{circle.total_amount.toLocaleString()} ฿</strong></span>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>ประเภท: {circle.type}</span>
          </div>
        </div>

        {message.text && (
          <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "12px", background: message.type === "success" ? "#dcfce7" : (message.type === "error" ? "#fee2e2" : "#e0f2fe"), color: message.type === "success" ? "#166534" : (message.type === "error" ? "#991b1b" : "#0369a1"), textAlign: "center", fontWeight: "600", fontSize: "0.85rem" }}>
              {message.text}
          </div>
        )}

        {/* Modern Tabs */}
        <div className="glass-panel" style={{ display: "flex", gap: "8px", marginBottom: "24px", padding: "6px", borderRadius: "18px" }}>
          <button 
            onClick={() => setActiveTab("timeline")} 
            disabled={circle.status === 'OPEN'}
            style={{ flex: 1, padding: "12px", borderRadius: "14px", border: "none", fontWeight: "700", cursor: "pointer", transition: "all 0.3s", background: activeTab === "timeline" ? "var(--primary-gradient)" : "transparent", color: activeTab === "timeline" ? "white" : "#64748b", opacity: circle.status === 'OPEN' ? 0.5 : 1 }}
          >
            📊 ติดตามงวด
          </button>
          <button 
            onClick={() => setActiveTab("members")} 
            style={{ flex: 1, padding: "12px", borderRadius: "14px", border: "none", fontWeight: "700", cursor: "pointer", transition: "all 0.3s", background: activeTab === "members" ? "var(--primary-gradient)" : "transparent", color: activeTab === "members" ? "white" : "#64748b" }}
          >
            👥 สมาชิกวงแชร์
          </button>
        </div>

        {activeTab === "members" && (
          <div className="animate-fade-in">
            {isCircleAdmin && circle.status === 'OPEN' && (
              <div className="glass-panel" style={{ marginBottom: "20px", textAlign: "center", border: "1px dashed var(--primary)" }}>
                <h4 style={{ margin: "0 0 12px 0" }}>จัดการวงแชร์</h4>
                <button onClick={handleStartCircle} className="btn-primary" style={{ width: "100%" }}> ✨ เริ่มเดินวง </button>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {totalHandsArray.map(hand => {
                const player = players.find(p => p.hand_no === hand);
                const canClick = !player && circle.status === 'OPEN';
                return (
                  <div key={hand} onClick={() => canClick ? handleEmptyHandClick(hand) : null} className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", opacity: !player && !canClick ? 0.6 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: player ? "var(--primary-gradient)" : "#cbd5e1", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>{hand}</div>
                      <div>
                        <div style={{ fontWeight: player ? "700" : "500", color: player ? "var(--foreground)" : "#94a3b8" }}>{player ? player.member_name : (canClick ? "ว่าง (แตะเพื่อจอง)" : "ว่าง")}</div>
                        {player && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>ส่งงวดละ {circle.amount_per_hand.toLocaleString()} ฿</div>}
                      </div>
                    </div>
                    {player && isCircleAdmin && (
                        <button onClick={(e) => openAdminChangeModal(e, hand)} style={{ background: "none", border: "1px solid #e2e8f0", padding: "4px 12px", borderRadius: "8px", color: "var(--primary)", fontSize: "0.75rem", fontWeight: "700" }}>จัดการ</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {totalHandsArray.map(period => {
              const winnerBid = bids.filter(b => b.period === period).sort((a,b) => b.bid_amount - a.bid_amount)[0];
              const winner = winnerBid ? players.find(p => p.member_id === winnerBid.member_id) : null;
              const isCompleted = period < circle.current_period;
              const isCurrent = period === circle.current_period;
              const isFuture = period > circle.current_period;
              const isExpanded = expandedPeriod === period;

              // Calculate Received Amount
              const deadHands = period - 1;
              const liveHands = circle.total_hands - deadHands;
              const receivedAmount = winnerBid ? (circle.interest_method === 'ไม่หักดอก' ? (circle.amount_per_hand * circle.total_hands) : ((circle.amount_per_hand * deadHands) + ((circle.amount_per_hand - winnerBid.bid_amount) * (liveHands - 1)))) : 0;

              return (
                <div key={period} className="glass-panel" style={{ padding: "0", overflow: "hidden", border: isCurrent ? "2px solid var(--primary)" : "1px solid var(--glass-border)" }}>
                  {/* Card Header */}
                  <div 
                    onClick={() => !isFuture ? toggleAccordion(period) : null}
                    style={{ 
                      padding: "16px 20px", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      background: isCompleted ? "rgba(16, 185, 129, 0.05)" : (isCurrent ? "rgba(16, 185, 129, 0.1)" : "transparent"),
                      cursor: isFuture ? "default" : "pointer"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ 
                        width: "40px", 
                        height: "40px", 
                        borderRadius: "12px", 
                        background: isCompleted ? "var(--primary-gradient)" : (isCurrent ? "var(--secondary)" : "#e2e8f0"),
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        fontSize: "0.9rem"
                      }}>
                        {period}
                      </div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                           งวดที่ {period} 
                           {isCurrent && <span style={{ marginLeft: "8px", color: "var(--primary)", fontSize: "0.7rem", verticalAlign: "middle" }}>⭐ กำลังดำเนินการ</span>}
                           {isFuture && <span style={{ marginLeft: "8px", color: "#94a3b8", fontSize: "0.7rem", fontWeight: "500" }}>🔒 รอดำเนินการ</span>}
                        </div>
                        {isCompleted && winner && (
                          <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                             🏆 {winner.member_name}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {isCompleted && <span style={{ fontSize: "1.2rem" }}>🏆</span>}
                      {isFuture && isCircleAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setConfigModal({ open: true, period }); setSettingsData({...circle, close_mode: circle.close_mode === 'AUTO' ? 'ปิดอัตโนมัติ' : 'แอดมินปิดเอง'}); }}
                          style={{ background: "#f1f5f9", border: "none", padding: "8px", borderRadius: "10px", color: "#64748b" }}
                        >
                          ⚙️
                        </button>
                      )}
                      {!isFuture && (
                        <span style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "all 0.3s", color: "#cbd5e1" }}>▼</span>
                      )}
                    </div>
                  </div>

                  {/* Winner Summary (For Completed) */}
                  {isCompleted && winner && !isExpanded && (
                    <div style={{ padding: "0 20px 16px 20px", display: "flex", gap: "20px", fontSize: "0.85rem", borderBottom: isExpanded ? "1px solid #f1f5f9" : "none" }}>
                      <div>
                        <span style={{ color: "#94a3b8" }}>ยอดเปีย:</span> <strong style={{ color: "var(--primary)" }}>{winnerBid.bid_amount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#94a3b8" }}>รับสุทธิ:</span> <strong style={{ color: "var(--secondary)" }}>{receivedAmount.toLocaleString()}</strong>
                      </div>
                    </div>
                  )}

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", background: "white" }}>
                      {isCurrent && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                          {/* Bingo/Auction Logic */}
                          {circle.type === "ประมูล (เปียแข่งดอก)" && (
                            <>
                              {canUserBid(period) ? (
                                <button onClick={() => setBidModal({ open: true, period })} className="btn-primary" style={{ flex: "1 1 45%", padding: "12px", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                  🔨 ประมูล (เปีย)
                                </button>
                              ) : (
                                <button onClick={() => alert(circle.bid_permission === 'PARTIAL' ? "กรุณาชำระเงินอย่างน้อย 1 มือก่อนประมูล" : "กรุณาชำระเงินให้ครบทุกมือก่อนประมูล")} className="btn-primary" style={{ flex: "1 1 45%", padding: "12px", fontSize: "0.85rem", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", cursor: "not-allowed" }}>
                                  🔨 ประมูล (ติดเงื่อนไขจ่าย)
                                </button>
                              )}
                              
                              <button 
                                onClick={() => { 
                                  if (isCircleAdmin) {
                                    if (confirm("ยืนยันการชำระเงินทุกมือสำหรับงวดนี้? (แอดมินชำระให้ตนเอง)")) {
                                      handleAdminAutoPay(period);
                                    }
                                  } else {
                                    const amt = getRequiredAmount(period); 
                                    setUploadData({...uploadData, amount: amt}); 
                                    setSlipModal({ open: true, period }); 
                                  }
                                }} 
                                className="btn-primary" 
                                style={{ flex: "1 1 45%", padding: "12px", fontSize: "0.85rem", background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                              >
                                🗳️ ชำระเงิน
                              </button>

                              {isCircleAdmin && (
                                <>
                                  <button onClick={() => handleCircleAction('random_select_bidder', period)} className="btn-primary" style={{ flex: "1 1 30%", padding: "10px", fontSize: "0.75rem", background: "#8b5cf6", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                    <span>🎲</span> สุ่มผู้ชนะ
                                  </button>
                                  <button onClick={() => handleCircleAction('close_bidding', period)} className="btn-primary" style={{ flex: "1 1 30%", padding: "10px", fontSize: "0.75rem", background: "#f59e0b", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                    <span>🔒</span> ปิดประมูล
                                  </button>
                                  <button onClick={() => handleCircleAction('close_period', period)} className="btn-primary" style={{ flex: "1 1 30%", padding: "10px", fontSize: "0.75rem", background: "#ef4444", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                    <span>🎌</span> ปิดงวด
                                  </button>
                                </>
                              )}
                            </>
                          )}

                          {/* Staircase/Fixed Interest Logic */}
                          {circle.type === "ขั้นบันได (ดอกคงที่)" && (
                            <>
                              <button 
                                onClick={() => { 
                                  if (isCircleAdmin) {
                                    if (confirm("ยืนยันการชำระเงินทุกมือสำหรับงวดนี้? (แอดมินชำระให้ตนเอง)")) {
                                      handleAdminAutoPay(period);
                                    }
                                  } else {
                                    const amt = getRequiredAmount(period); 
                                    setUploadData({...uploadData, amount: amt}); 
                                    setSlipModal({ open: true, period }); 
                                  }
                                }} 
                                className="btn-primary" 
                                style={{ flex: "1 1 100%", padding: "14px", fontSize: "1rem", background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                              >
                                🗳️ ชำระเงิน
                              </button>

                              {isCircleAdmin && (
                                <button onClick={() => handleCircleAction('close_period', period)} className="btn-primary" style={{ flex: "1 1 100%", padding: "12px", fontSize: "0.9rem", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                  <span>🎌</span> ปิดงวดการส่งเงิน
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {isCompleted && winner && (
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px", padding: "12px", borderRadius: "16px", background: "#f0fdf4" }}>
                           <div style={{ width: "48px", height: "48px", borderRadius: "12px", overflow: "hidden", background: "var(--primary-gradient)" }}>
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${winner.member_id}`} alt="winner" style={{ width: "100%", height: "100%" }} />
                           </div>
                           <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: "700" }}>🏆 {winner.member_name}</div>
                              <div style={{ fontSize: "0.8rem", color: "#166534" }}>รับสุทธิ {receivedAmount.toLocaleString()} ฿ (ดอก {winnerBid.bid_amount.toLocaleString()})</div>
                           </div>
                        </div>
                      )}

                      {/* Details: Bids & Slips */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>สถานะสมาชิกในงวดนี้:</div>
                        {(() => {
                          // 1. Identify winners of all periods BEFORE this period to count wins per member
                          const winCounts = {};
                          const bidsByP = {};
                          bids.forEach(b => {
                            if (b.period < period) {
                              if (!bidsByP[b.period]) bidsByP[b.period] = [];
                              bidsByP[b.period].push(b);
                            }
                          });
                          Object.keys(bidsByP).forEach(pKey => {
                            const sorted = bidsByP[pKey].sort((a,b) => b.bid_amount - a.bid_amount);
                            const winnerId = sorted[0].member_id;
                            winCounts[winnerId] = (winCounts[winnerId] || 0) + 1;
                          });

                          // 2. Identify status for each hand
                          const handStatus = {}; // hand_no -> status
                          const memberHands = {};
                          [...players].sort((a,b) => a.hand_no - b.hand_no).forEach(hp => {
                             if (!memberHands[hp.member_id]) memberHands[hp.member_id] = [];
                             memberHands[hp.member_id].push(hp.hand_no);
                          });
                          
                          Object.keys(memberHands).forEach(mId => {
                             const wins = winCounts[mId] || 0;
                             memberHands[mId].forEach((hNo, idx) => {
                                if (idx < wins) handStatus[hNo] = 'DEAD';
                                else if (idx === wins) handStatus[hNo] = 'ACTIVE';
                                else handStatus[hNo] = 'FUTURE';
                             });
                          });

                          // 3. Current period winner
                          const periodBids = bids.filter(b => b.period === period).sort((a,b) => b.bid_amount - a.bid_amount);
                          const periodWinner = periodBids[0];
                          const winnerMemberId = periodWinner?.member_id;
                          const currentPayout = payouts.find(po => po.period === period && po.member_id === winnerMemberId);
                          const biddingIsClosed = isCompleted || (circle.bidding_closed_period >= period) || !!currentPayout;

                          return players.map(p => {
                            const pBid = bids.find(b => b.period === period && b.member_id === p.member_id);
                            const pSlip = slips.find(s => s.period === period && s.member_id === p.member_id);
                            const isMe = dbUser && p.member_id === dbUser.id;
                            const status = handStatus[p.hand_no];
                            const isDead = status === 'DEAD';
                            const isActive = status === 'ACTIVE';
                            const isWinner = p.member_id === winnerMemberId && biddingIsClosed;

                            // Net Amount Calculation for winner: (Total Hands * Amount Per Hand) - (My Bid Amount)
                            // This depends on the circle rules, but usually:
                            const netAmount = (circle.total_hands * circle.amount_per_hand) - (periodWinner?.bid_amount || 0);

                            return (
                              <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "12px", borderRadius: "14px", background: isWinner ? "#fffbeb" : "#f8fafc", border: isWinner ? "1.5px solid #fbbf24" : (isMe ? "1.5px solid #cbd5e1" : "1px solid #f1f5f9"), opacity: isDead ? 0.6 : 1, marginBottom: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem" }}>
                                    <span style={{ fontWeight: (isActive || isWinner) ? "800" : "500", color: isWinner ? "#92400e" : (isDead ? "#94a3b8" : "#1e293b") }}>
                                      {isWinner ? "🏆 " : ""}{p.member_name} {isDead ? "(มือตาย)" : ""}
                                    </span>
                                    {pBid && !isWinner && isActive && (
                                      <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: "600" }}>
                                        (เปีย {isCompleted || isCircleAdmin || isMe ? pBid.bid_amount.toLocaleString() : "***"})
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {isWinner ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {/* Status Text for Others */}
                                        <span style={{ fontSize: "0.75rem", fontWeight: "700", color: currentPayout?.status === 'APPROVED' ? "#16a34a" : (currentPayout?.status === 'PENDING' ? "#ea580c" : "#dc2626") }}>
                                           {currentPayout?.status === 'APPROVED' ? "✅ จ่ายแล้ว" : (currentPayout?.status === 'PENDING' ? "⏳ รอตรวจสอบ" : "❌ ยังไม่จ่าย")}
                                        </span>

                                        {/* Admin Action: Pay Winner */}
                                        {isCircleAdmin && (!currentPayout || currentPayout.status === 'REJECTED') && (
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); setPayoutModal({ open: true, period, winner_id: p.member_id, winner_name: p.member_name, amount: netAmount }); }} 
                                              style={{ background: "var(--primary-gradient)", color: "white", border: "none", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "700" }}
                                           >
                                              💸 จ่ายเงิน
                                           </button>
                                        )}

                                        {/* Winner Action: Verify Admin's Slip */}
                                        {isMe && currentPayout?.status === 'PENDING' && (
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); setInspectPayoutModal({ open: true, payout: currentPayout }); }} 
                                              style={{ background: "#3b82f6", color: "white", border: "none", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "700" }}
                                           >
                                              🔍 ตรวจสอบ
                                           </button>
                                        )}
                                      </div>
                                    ) : (
                                       pSlip ? (
                                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", background: pSlip.status === 'APPROVED' ? "#dcfce7" : "#fef3c7", color: pSlip.status === 'APPROVED' ? "#166534" : "#92400e" }}>
                                            {pSlip.status === 'APPROVED' ? "✅ จ่ายแล้ว" : "⏳ รออนุมัติ"}
                                          </span>
                                       ) : (
                                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", background: "#fee2e2", color: "#991b1b" }}>❌ ยังไม่จ่าย</span>
                                       )
                                    )}
                                  </div>
                                </div>
                                
                                {isWinner && (
                                  <div style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: "600", marginTop: "2px", display: "flex", justifyContent: "space-between" }}>
                                     <span>ยอดรับสุทธิ: {netAmount.toLocaleString()} ฿</span>
                                     <span style={{ fontSize: "0.7rem", opacity: 0.8 }}> (เปีย {periodWinner.bid_amount.toLocaleString()})</span>
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
      {adminModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "10px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "420px", padding: "24px 16px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
            <h3 style={{ textAlign: "center", marginBottom: "20px" }}>{adminModal.mode === 'JOIN' ? `📌 จองมือที่ ${adminModal.handNo}` : `🔄 โอนมือที่ ${adminModal.handNo}`}</h3>
            <select value={adminSelectedUserId} onChange={(e) => setAdminSelectedUserId(e.target.value)} className="glass-panel" style={{ width: "100%", padding: "14px", marginBottom: "24px" }}>
               <option value="">-- เลือกสมาชิก --</option>
               {adminModal.mode === 'JOIN' && <option value={dbUser.id}>จองให้ตัวเอง ({dbUser.name})</option>}
               {allMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.nickname})</option>)}
            </select>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setAdminModal({ open: false })} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>ยกเลิก</button>
              <button onClick={submitAdminModal} disabled={!adminSelectedUserId} className="btn-primary" style={{ flex: 1 }}>ตกลง</button>
            </div>
            {!['JOIN'].includes(adminModal.mode) && circle.status === 'OPEN' && (
                <button onClick={(e) => { handleCancelHand(e, adminModal.handNo); setAdminModal({ open: false }); }} style={{ width: "100%", marginTop: "20px", color: "#ef4444", background: "none", border: "none", textDecoration: "underline" }}>ยกเลิกการจองมือนี้ (คืนเป็นว่าง)</button>
            )}
          </div>
        </div>
      )}

      {slipModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "10px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "480px", maxHeight: "95vh", overflowY: "auto", padding: "24px 16px" }}>
            <div style={{ 
                position: "sticky", 
                top: "-24px", 
                left: 0, 
                right: 0, 
                zIndex: 100, 
                background: "#f8fafc", 
                margin: "-24px -16px 30px -16px", 
                padding: "20px 16px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                borderBottom: "1px solid #e2e8f0" 
            }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                 <span style={{ fontSize: "1.4rem" }}>💳</span> แจ้งชำระเงิน
              </h3>
              <button onClick={() => setSlipModal({ open: false })} style={{ background: "none", border: "none", fontSize: "1.5rem", color: "#94a3b8" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "30px" }}>
                <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", boxShadow: "0 8px 16px rgba(16, 185, 129, 0.2)" }}>
                   <span style={{ fontSize: "2.4rem" }}>💰</span>
                </div>
                <div style={{ fontSize: "2.4rem", fontWeight: "800", color: "#10b981" }}>{uploadData.amount?.toLocaleString()}</div>
                <div style={{ fontSize: "1rem", color: "#64748b", fontWeight: "500" }}>บาท</div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              <button 
                onClick={() => setPaymentMode("TRANSFER")} 
                style={{ flex: 1, padding: "14px", borderRadius: "18px", border: "none", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: paymentMode === "TRANSFER" ? "#10b981" : "#f1f5f9", color: paymentMode === "TRANSFER" ? "white" : "#64748b", transition: "all 0.2s" }}
              >
                📱 โอนเงิน
              </button>
              <button 
                onClick={() => setPaymentMode("CASH")} 
                style={{ flex: 1, padding: "14px", borderRadius: "18px", border: "none", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: paymentMode === "CASH" ? "#64748b" : "#f1f5f9", color: paymentMode === "CASH" ? "white" : "#64748b", transition: "all 0.2s" }}
              >
                💵 เงินสด
              </button>
            </div>

            {paymentMode === "TRANSFER" && myBank && (
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "20px", marginBottom: "24px", border: "1px solid #e2e8f0", position: "relative" }}>
                   <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "6px", fontWeight: "600" }}>โอนเข้าบัญชีแอดมิน:</div>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>{myBank.bank_name} {myBank.account_no}</span>
                      <button onClick={() => copyToClipboard(myBank.account_no)} style={{ background: "#10b981", color: "white", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "700" }}>คัดลอก</button>
                   </div>
                   <div style={{ fontSize: "0.9rem", color: "#475569" }}>{myBank.account_name}</div>
                </div>
            )}

            <form onSubmit={handleUploadSlip} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {paymentMode === "TRANSFER" && (
                  <div style={{ border: "2px dashed #cbd5e1", borderRadius: "18px", padding: "10px", textAlign: "center", background: "#f8fafc", minHeight: "150px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <label style={{ cursor: "pointer", display: "block", width: "100%" }}>
                      {filePreview ? (
                        <div style={{ position: "relative" }}>
                          <img src={filePreview} alt="preview" style={{ width: "100%", maxHeight: "200px", objectFit: "contain", borderRadius: "12px" }} />
                          <div style={{ marginTop: "10px", fontSize: "0.85rem", color: "var(--primary)", fontWeight: "700" }}>แตะเพื่อเปลี่ยนรูป</div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: "2.4rem", marginBottom: "8px" }}>📸</div>
                          <div style={{ fontSize: "1rem", fontWeight: "700", color: "#475569" }}>แตะเพื่อเลือกรูปสลิป</div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>รองรับไฟล์ภาพ JPEG, PNG</div>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                    </label>
                  </div>
                )}
                
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "16px", top: "16px" }}>✍️</span>
                  <input 
                    type="text" 
                    placeholder="บันทึกช่วยจำ (ถ้ามี)" 
                    value={uploadData.note} 
                    onChange={(e) => setUploadData({...uploadData, note: e.target.value})} 
                    style={{ width: "100%", padding: "16px 16px 16px 44px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", outline: "none" }}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={uploadLoading || (paymentMode === 'TRANSFER' && !selectedFile)}
                  style={{ padding: "18px", fontSize: "1.1rem", fontWeight: "800", borderRadius: "20px", marginTop: "8px", opacity: (uploadLoading || (paymentMode === 'TRANSFER' && !selectedFile)) ? 0.6 : 1 }}
                >
                  {uploadLoading ? "⌛ กำลังดำเนินการ..." : "✅ ยืนยันชำระเงิน"}
                </button>
            </form>
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {bidModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "10px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "400px", padding: "24px 16px" }}>
            <h3 style={{ textAlign: "center", marginBottom: "10px" }}>🔨 ประมูล (เปีย) งวดที่ {bidModal.period}</h3>
            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "#64748b", marginBottom: "24px" }}>ระบุจำนวนดอกเบี้ยที่คุณต้องการประมูล</p>
            <form onSubmit={handleBidSubmit}>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem" }}>จำนวนดอกเบี้ย (บาท)</label>
                <input 
                  type="number" 
                  value={bidAmount} 
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="เช่น 350"
                  required 
                  className="glass-panel" 
                  style={{ width: "100%", padding: "16px", fontSize: "1.2rem", textAlign: "center", border: "1.5px solid var(--primary)" }} 
                />
                <div style={{ marginTop: "10px", fontSize: "0.75rem", color: "#94a3b8", textAlign: "center" }}>
                   ต่ำสุด {circle.min_bid.toLocaleString()} / สูงสุด {circle.max_bid.toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={() => setBidModal({ open: false, period: null })} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>ยกเลิก</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>ส่งประมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config / Edit Modal */}
      {configModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "10px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "480px", padding: "24px 16px", maxHeight: "95vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
               <h3 style={{ margin: 0 }}>⚙️ ตั้งค่า: {configModal.period ? `(งวด ${configModal.period})` : (configModal.mode === 'EDIT_CIRCLE' ? 'แก้ไขข้อมูลวงแชร์' : circle.name)}</h3>
               <button onClick={() => setConfigModal({ open: false, period: null })} style={{ background: "none", border: "none", fontSize: "1.2rem" }}>✕</button>
            </div>
            
            <form onSubmit={handleUpdateSettings} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {(configModal.mode === 'EDIT_CIRCLE') && (
                <>
                  <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "18px", border: "1px solid #e2e8f0" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem" }}>ชื่อวงแชร์</label>
                    <input 
                      type="text" 
                      value={settingsData.name} 
                      onChange={(e) => setSettingsData({...settingsData, name: e.target.value})}
                      required
                      className="glass-panel" 
                      style={{ width: "100%", padding: "12px", border: "1.5px solid #edf2f7" }} 
                    />
                  </div>
                  <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "18px", border: "1px solid #e2e8f0" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem" }}>ลิงก์กลุ่ม LINE ประจำวง</label>
                    <input 
                      type="text" 
                      value={settingsData.line_group_url} 
                      onChange={(e) => setSettingsData({...settingsData, line_group_url: e.target.value})}
                      placeholder="https://line.me/ti/g/..."
                      className="glass-panel" 
                      style={{ width: "100%", padding: "12px", border: "1.5px solid #edf2f7" }} 
                    />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>⏰ เวลาเปิด</label>
                  <input type="time" value={settingsData.bid_start_time} onChange={(e) => setSettingsData({...settingsData, bid_start_time: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>⏰ เวลาปิด</label>
                  <input type="time" value={settingsData.bid_end_time} onChange={(e) => setSettingsData({...settingsData, bid_end_time: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>💰 ดอกต่ำสุด</label>
                  <input type="number" value={settingsData.min_bid} onChange={(e) => setSettingsData({...settingsData, min_bid: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>💰 ดอกสูงสุด</label>
                  <input type="number" value={settingsData.max_bid} onChange={(e) => setSettingsData({...settingsData, max_bid: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>🔔 แจ้งเตือน (ชม.)</label>
                  <input type="number" value={settingsData.notify_hours} onChange={(e) => setSettingsData({...settingsData, notify_hours: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>🔒 โหมดปิด</label>
                  <select value={settingsData.close_mode} onChange={(e) => setSettingsData({...settingsData, close_mode: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }}>
                     <option value="แอดมินปิดเอง">แอดมินปิดเอง</option>
                     <option value="ปิดอัตโนมัติ">ปิดอัตโนมัติ (AUTO)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.8rem", fontWeight: "700" }}>✂️ วิธีคิดดอก</label>
                <select value={settingsData.interest_method} onChange={(e) => setSettingsData({...settingsData, interest_method: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px" }}>
                   <option value="หักดอก">หักดอก (Interest Deduct)</option>
                   <option value="ไม่หักดอก">ไม่หักดอก (Interest Add)</option>
                </select>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "18px", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem" }}>⚖️ สิทธิประมูล (Auction Permission)</label>
                <select value={settingsData.bid_permission} onChange={(e) => setSettingsData({...settingsData, bid_permission: e.target.value})} className="glass-panel" style={{ width: "100%", padding: "12px", border: "1.5px solid #edf2f7" }}>
                  <option value="NONE">ไม่ต้องชำระก่อน</option>
                  <option value="PARTIAL">ต้องชำระบางมือก่อนอย่างน้อย 1 มือ</option>
                  <option value="ALL">ต้องชำระทุกมือก่อนในงวดนั้น</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: "10px" }}>บันทึกข้อมูล</button>
            </form>
          </div>
        </div>
      )}
      {/* Payout Modal (Admin paying Winner) */}
      {payoutModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "10px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "420px", padding: "24px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
               <h3 style={{ margin: 0 }}>💸 จ่ายเงินให้ผู้ชนะ (งวดที่ {payoutModal.period})</h3>
               <button onClick={() => setPayoutModal({ ...payoutModal, open: false })} style={{ background: "none", border: "none", fontSize: "1.2rem" }}>✕</button>
            </div>
            
            <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "#64748b" }}>
               เตรียมโอนเงินให้ <b>{payoutModal.winner_name}</b><br/>
               ยอดรับสุทธิ: <b style={{ color: "var(--primary)", fontSize: "1.2rem" }}>{payoutModal.amount.toLocaleString()} ฿</b>
            </p>

            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "18px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", fontSize: "0.85rem" }}>วิธีการชำระ</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setPaymentMode("TRANSFER")} style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "1.5px solid", borderColor: paymentMode === 'TRANSFER' ? 'var(--primary)' : '#e2e8f0', background: paymentMode === 'TRANSFER' ? '#ecfdf5' : 'white', color: paymentMode === 'TRANSFER' ? 'var(--primary)' : '#64748b', fontWeight: "700", fontSize: "0.85rem" }}>🏦 โอนเงิน</button>
                <button onClick={() => setPaymentMode("CASH")} style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "1.5px solid", borderColor: paymentMode === 'CASH' ? 'var(--primary)' : '#e2e8f0', background: paymentMode === 'CASH' ? '#ecfdf5' : 'white', color: paymentMode === 'CASH' ? 'var(--primary)' : '#64748b', fontWeight: "700", fontSize: "0.85rem" }}>💵 เงินสด</button>
              </div>
            </div>

            {paymentMode === 'TRANSFER' && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", fontSize: "0.85rem" }}>แนบหลักฐานการโอน (สลิป)</label>
                <div 
                   onClick={() => document.getElementById('payout-file').click()}
                   style={{ width: "100%", height: "160px", border: "2px dashed #e2e8f0", borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#f8fafc", overflow: "hidden", position: "relative" }}
                >
                  {filePreview ? (
                    <img src={filePreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <>
                      <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📸</div>
                      <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>กดเพื่ออัปโหลดรูปภาพ</div>
                    </>
                  )}
                </div>
                <input 
                   id="payout-file" 
                   type="file" 
                   accept="image/*" 
                   onChange={(e) => {
                     const file = e.target.files[0];
                     if (file) { setSelectedFile(file); setFilePreview(URL.createObjectURL(file)); }
                   }} 
                   style={{ display: "none" }} 
                />
              </div>
            )}

            <button 
              onClick={handlePayoutSubmit} 
              disabled={uploadLoading}
              className="btn-primary" 
              style={{ width: "100%", padding: "14px" }}
            >
              {uploadLoading ? "กำลังส่ง..." : (paymentMode === 'CASH' ? "✅ ยืนยันการจ่ายเงินสด" : "🚀 ส่งหลักฐานการโอน")}
            </button>
          </div>
        </div>
      )}

      {/* Inspect Payout Modal (Winner reviewing Admin) */}
      {inspectPayoutModal.open && inspectPayoutModal.payout && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "10px" }}>
           <div className="glass-panel" style={{ width: "100%", maxWidth: "400px", padding: "24px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                 <h3 style={{ margin: 0 }}>🔍 ตรวจสอบยอดรับเงิน</h3>
                 <button onClick={() => setInspectPayoutModal({ open: false, payout: null })} style={{ background: "none", border: "none", fontSize: "1.2rem" }}>✕</button>
              </div>

              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                 <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "4px" }}>ยอดที่แอดมินแจ้งโอน</div>
                 <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--primary)" }}>{parseFloat(inspectPayoutModal.payout.amount).toLocaleString()} ฿</div>
              </div>

              <div style={{ width: "100%", borderRadius: "16px", overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: "20px", background: "#f8fafc" }}>
                 <img src={inspectPayoutModal.payout.image_url} style={{ width: "100%", maxHeight: "350px", objectFit: "contain" }} alt="Admin Slip" />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                 <button onClick={() => handleVerifyPayout(inspectPayoutModal.payout.id, 'REJECTED')} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #ef4444", color: "#ef4444", fontWeight: "700", background: "white" }}>❌ แจ้งสลิปผิด</button>
                 <button onClick={() => handleVerifyPayout(inspectPayoutModal.payout.id, 'APPROVED')} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "var(--primary-gradient)", color: "white", fontWeight: "700" }}>✅ ได้รับเงินแล้ว</button>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
