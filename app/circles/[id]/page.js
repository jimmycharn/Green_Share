"use client";

import { useEffect, useState } from "react";
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
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("members"); // "members" or "timeline"
  
  // Hand Management States
  const [allMembers, setAllMembers] = useState([]);
  const [adminModal, setAdminModal] = useState({ open: false, mode: "", handNo: "" });
  const [slipModal, setSlipModal] = useState({ open: false, period: null });
  const [uploadData, setUploadData] = useState({ amount: "", note: "", image_url: "" });
  const [adminSelectedUserId, setAdminSelectedUserId] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState(null);
  const [bidModal, setBidModal] = useState({ open: false, period: null });
  const [configModal, setConfigModal] = useState({ open: false, period: null });
  const [bidAmount, setBidAmount] = useState("");
  const [settingsData, setSettingsData] = useState({
    bid_start_time: "12:00",
    bid_end_time: "18:00",
    min_bid: "0",
    max_bid: "1000",
    notify_hours: "24",
    close_mode: "แอดมินปิดเอง",
    interest_method: "หักดอก"
  });
  
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
      body: JSON.stringify({ action: 'get_circle_detail', circle_id: circleId })
    });
    const resData = await res.json();
    if (resData.status === 'success') {
      setCircle(resData.circle);
      setPlayers(resData.players || []);
      setBids(resData.bids || []);
      setSlips(resData.slips || []);
    } else {
      setMessage({ type: "error", text: resData.message || "ไม่พบวงแชร์นี้" });
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

  const handleUploadSlip = async (e) => {
    e.preventDefault();
    if (!uploadData.amount) return alert("กรุณาระบุยอดเงิน");
    try {
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
          image_url: uploadData.image_url
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUploadData({ amount: "", note: "", image_url: "" });
        setSlipModal({ open: false, period: null });
        fetchCircleDetail();
        setMessage({ type: "success", text: "ส่งสลิปเรียบร้อย!" });
      } else alert(data.message);
    } catch { alert("การเชื่อมต่อขัดข้อง"); }
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    if (!bidAmount) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_bid', circle_id: circleId, period: bidModal.period, member_id: dbUser.id, bid_amount: bidAmount })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setBidModal({ open: false, period: null });
        setBidAmount("");
        fetchCircleDetail();
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

  const toggleAccordion = (period) => {
    setExpandedPeriod(expandedPeriod === period ? null : period);
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
            onClick={() => setActiveTab("members")} 
            style={{ flex: 1, padding: "12px", borderRadius: "14px", border: "none", fontWeight: "700", cursor: "pointer", transition: "all 0.3s", background: activeTab === "members" ? "var(--primary-gradient)" : "transparent", color: activeTab === "members" ? "white" : "#64748b" }}
          >
            👥 รายชื่อคนเล่น
          </button>
          <button 
            onClick={() => setActiveTab("timeline")} 
            disabled={circle.status === 'OPEN'}
            style={{ flex: 1, padding: "12px", borderRadius: "14px", border: "none", fontWeight: "700", cursor: "pointer", transition: "all 0.3s", background: activeTab === "timeline" ? "var(--primary-gradient)" : "transparent", color: activeTab === "timeline" ? "white" : "#64748b", opacity: circle.status === 'OPEN' ? 0.5 : 1 }}
          >
            📊 ติดตามงวด
          </button>
        </div>

        {activeTab === "members" ? (
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
        ) : (
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
                        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                          <button onClick={() => setBidModal({ open: true, period })} className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: "0.9rem" }}>🔨 ประมูล (เปีย)</button>
                          <button onClick={() => setSlipModal({ open: true, period })} className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: "0.9rem", background: "var(--secondary)" }}>📤 ส่งสลิป</button>
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
                        {players.map(p => {
                          const pBid = bids.find(b => b.period === period && b.member_id === p.member_id);
                          const pSlip = slips.find(s => s.period === period && s.member_id === p.member_id);
                          const isMe = dbUser && p.member_id === dbUser.id;
                          
                          return (
                            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "10px", background: "#f8fafc", border: isMe ? "1px solid #cbd5e1" : "none" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
                                <span>{p.member_name}</span>
                                {pBid && (
                                  <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: "600" }}>
                                    (เปีย {isCompleted || isCircleAdmin || isMe ? pBid.bid_amount.toLocaleString() : "***"})
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {pSlip ? (
                                  <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", background: pSlip.status === 'APPROVED' ? "#dcfce7" : "#fef3c7", color: pSlip.status === 'APPROVED' ? "#166534" : "#92400e" }}>
                                    {pSlip.status === 'APPROVED' ? "✅ จ่ายแล้ว" : "⏳ รออนุมัติ"}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", background: "#fee2e2", color: "#991b1b" }}>❌ ยังไม่จ่าย</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals - Placed OUTSIDE the animated content to fix fixed positioning */}
      {adminModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "95%", maxWidth: "420px", padding: "30px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "95%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ margin: 0 }}>📊 งวดที่ {slipModal.period}</h3>
              <button onClick={() => setSlipModal({ open: false })} style={{ background: "none", border: "none", fontSize: "1.5rem" }}>✕</button>
            </div>
            {slips.filter(s => s.period === slipModal.period).map(slip => {
                const member = players.find(p => p.member_id === slip.member_id);
                return (
                    <div key={slip.id} style={{ display: "flex", gap: "12px", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "12px", marginBottom: "10px" }}>
                        <div onClick={() => window.open(slip.image_url)} style={{ width: "50px", height: "50px", borderRadius: "8px", overflow: "hidden" }}><img src={slip.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "700" }}>{member?.member_name}</div>
                            <div style={{ color: "var(--primary)", fontWeight: "700" }}>{slip.amount.toLocaleString()} ฿</div>
                        </div>
                        {isCircleAdmin && slip.status === 'PENDING' && <button onClick={() => handleVerifySlip(slip.id)} className="badge badge-success" style={{ border: "none" }}>อนุมัติ</button>}
                    </div>
                );
            })}
            {slipModal.period === circle.current_period && (
                <form onSubmit={handleUploadSlip} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
                    <input type="number" placeholder="ยอดเงิน" value={uploadData.amount} onChange={(e) => setUploadData({...uploadData, amount: e.target.value})} required className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                    <input type="text" placeholder="ลิงก์สลิป" value={uploadData.image_url} onChange={(e) => setUploadData({...uploadData, image_url: e.target.value})} required className="glass-panel" style={{ width: "100%", padding: "12px" }} />
                    <button type="submit" className="btn-primary">ส่งสลิป</button>
                </form>
            )}
          </div>
        </div>
      )}
      {/* Bid Modal */}
      {bidModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "95%", maxWidth: "400px", padding: "30px" }}>
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

      {/* Config Modal (Matching User Image) */}
      {configModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "95%", maxWidth: "480px", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
               <h3 style={{ margin: 0 }}>⚙️ ตั้งค่า (เฉพาะงวด {configModal.period})</h3>
               <button onClick={() => setConfigModal({ open: false, period: null })} style={{ background: "none", border: "none", fontSize: "1.2rem" }}>✕</button>
            </div>
            
            <form onSubmit={handleUpdateSettings} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
                     <option value="ปิดอัตโนมัติ">ปิดอัตโนมัติ</option>
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

              <button type="submit" className="btn-primary" style={{ marginTop: "10px" }}>บันทึกการตั้งค่า</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
