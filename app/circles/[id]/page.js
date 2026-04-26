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
          <div className="animate-fade-in" style={{ position: "relative", paddingLeft: "20px" }}>
            <div style={{ position: "absolute", left: "0", top: "10px", bottom: "10px", width: "2px", background: "#e2e8f0" }}></div>
            {totalHandsArray.map(period => {
              const winnerBid = bids.filter(b => b.period === period).sort((a,b) => b.bid_amount - a.bid_amount)[0];
              const winner = winnerBid ? players.find(p => p.member_id === winnerBid.member_id) : null;
              const handSlips = slips.filter(s => s.period === period);
              const isCompleted = period < circle.current_period;
              const isCurrent = period === circle.current_period;
              return (
                <div key={period} style={{ position: "relative", marginBottom: "32px" }}>
                  <div style={{ position: "absolute", left: "-26px", top: "6px", width: "12px", height: "12px", borderRadius: "50%", background: isCompleted ? "var(--primary)" : "white", border: isCurrent ? "3px solid var(--primary)" : "2px solid #e2e8f0" }}></div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem" }}>งวดที่ {period}</h3>
                      <span className={`badge ${isCompleted ? 'badge-success' : (isCurrent ? 'badge-warning' : '')}`}>{isCompleted ? "สำเร็จ" : (isCurrent ? "กำลังลุ้น" : "รอดำเนินการ")}</span>
                  </div>
                  {(isCompleted || isCurrent) && winner && (
                      <div className="glass-panel" style={{ background: "var(--primary-gradient)", color: "white", marginBottom: "12px", padding: "16px" }}>
                          🏆 {winner.member_name} - บิดชนะ {winnerBid.bid_amount.toLocaleString()} ฿
                      </div>
                  )}
                  {(isCompleted || isCurrent) && (
                      <button onClick={() => setSlipModal({ open: true, period: period })} className="btn-primary" style={{ width: "100%", padding: "8px", background: "rgba(16, 185, 129, 0.1)", color: "var(--primary)" }}>{isCurrent ? "📤 ส่งสลิป / ตรวจสอบ" : "📄 ดูสลิปทั้งหมด"}</button>
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
    </>
  );
}
