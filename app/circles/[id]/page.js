"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

export default function CircleDetail() {
  const router = useRouter();
  const params = useParams();
  const circleId = params.id;
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbUser, setDbUser] = useState(null);
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
    if (isCircleAdmin && allMembers.length === 0) {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_members', member_id: dbUser.id })
      }).then(res => res.json()).then(data => {
        if (data.status === 'success') setAllMembers(data.members);
      }).catch(err => console.log(err));
    }
  }, [isCircleAdmin, dbUser, allMembers.length]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.liff) {
      initLiff();
    }
  }, [circleId]);

  const handleScriptLoad = () => {
    if (window.liff) {
      initLiff();
    }
  };

  const initLiff = async () => {
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      await window.liff.init({ liffId });
      
      if (!window.liff.isLoggedIn()) {
        router.push('/');
        return;
      }
      
      const userProfile = await window.liff.getProfile();

      const houseParam = new URLSearchParams(window.location.search).get('house');
      const regRes = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: userProfile.displayName,
          nickname: userProfile.displayName,
          line_id: userProfile.userId,
          house: houseParam
        })
      });
      const user = await regRes.json();
      
      if (user.status !== 'success') {
        setMessage({ type: "error", text: "ไม่สามารถเข้าถึงข้อมูลสมาชิก" });
        setIsInitializing(false);
        return;
      }
      setDbUser(user);
      fetchCircleDetail();
      
    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
      setIsInitializing(false);
    }
  };

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
    setMessage({ type: "", text: "" });
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
    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
    }
  };

  const submitAdminModal = async () => {
    if (!adminSelectedUserId) return;
    const isJoin = adminModal.mode === 'JOIN';
    
    if (!isJoin && !confirm("ยืนยันการโอนมือให้สมาชิกท่านนี้?")) return;
    
    setMessage({ type: "", text: "" });
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
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') {
        setAdminModal({ open: false, mode: "", handNo: "" });
        fetchCircleDetail();
      }
    } catch { 
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); 
    }
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
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') fetchCircleDetail();
    } catch { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  const handleCancelHand = async (e, handNo) => {
    e.stopPropagation(); // Prevent triggering row click
    if (!confirm(`ยืนยันการยกเลิกจองมือที่ ${handNo}?`)) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_hand', circle_id: circleId, hand_no: handNo, caller_id: dbUser.id, caller_role: dbUser.role })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') fetchCircleDetail();
    } catch { setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" }); }
  };

  const openAdminChangeModal = (e, handNo) => {
    e.stopPropagation();
    setAdminModal({ open: true, mode: 'CHANGE', handNo });
    setAdminSelectedUserId("");
  };

  const handleEmptyHandClick = (handNo) => {
    if (circle.status !== 'OPEN') return; // Cannot join if not open
    if (isCircleAdmin) {
      setAdminModal({ open: true, mode: 'JOIN', handNo });
      setAdminSelectedUserId(dbUser.id); // Default to themselves
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
      if (data.status === 'success') {
        fetchCircleDetail();
      } else alert(data.message);
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

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container"><div className="loader"></div><h3 style={{ color: "var(--primary)" }}>กำลังโหลดรายละเอียดวง...</h3></div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <h3>{message.text || "โหลดข้อมูลล้มเหลว"}</h3>
        <Link href="/circles/view" style={{ color: "var(--primary)" }}>กลับหน้ารวมวงแชร์</Link>
      </div>
    );
  }

  const totalHandsArray = Array.from({ length: circle.total_hands }, (_, i) => i + 1);

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto", position: "relative" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.6rem", margin: 0, color: "var(--foreground)" }}>วง: {circle.name}</h2>
      </div>

      {message.text && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>{message.text}</div>
      )}

      {/* Circle Info */}
      <div className="glass-panel" style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "#64748b" }}>ประเภท:</span><strong>{circle.type}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "#64748b" }}>ส่งงวดละ:</span><strong>{circle.amount_per_hand} บาท</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "#64748b" }}>ยอดรับรวม:</span><strong>{circle.total_amount} บาท</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "#64748b" }}>สถานะ:</span><span className="badge badge-active">{circle.status}</span></div>
        
        {isCircleAdmin && circle.status === 'OPEN' && (
          <button onClick={handleStartCircle} style={{ width: "100%", padding: "12px", background: "var(--primary)", color: "white", textAlign: "center", borderRadius: "8px", fontWeight: "bold", border: "none", marginTop: "8px", cursor: "pointer" }}>✅ กดปุ่มนี้เพื่อเริ่มวงแชร์ (เปิดดำเนินการ)</button>
        )}
        
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button onClick={() => { navigator.clipboard.writeText(`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circle.id}`); setMessage({ type: "success", text: "คัดลอกลิงก์สำเร็จ ส่งใน LINE ได้เลย!" }); }} style={{ flex: 1, padding: "12px", background: "white", color: "var(--primary)", border: "2px solid var(--primary)", textAlign: "center", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>📋 ก็อปลิงก์เชิญเพื่อน</button>
          
          {circle.line_group_url && (
            <a href={circle.line_group_url} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "12px", background: "#00B900", color: "white", textAlign: "center", borderRadius: "8px", fontWeight: "bold", textDecoration: "none" }}>💬 เข้ากลุ่มแชท</a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button 
          onClick={() => setActiveTab("members")} 
          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: activeTab === "members" ? "var(--primary)" : "white", color: activeTab === "members" ? "white" : "#64748b", fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
        >
          👥 รายชื่อคนเล่น
        </button>
        <button 
          onClick={() => setActiveTab("timeline")} 
          disabled={circle.status === 'OPEN'}
          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: activeTab === "timeline" ? "var(--primary)" : "white", color: activeTab === "timeline" ? "white" : "#64748b", fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", opacity: circle.status === 'OPEN' ? 0.5 : 1 }}
        >
          📊 ติดตามงวดแชร์
        </button>
      </div>

      {/* Players List Tab */}
      {activeTab === "members" && (
        <div className="glass-panel" style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>👥 รายชื่อคนเล่น ({players.length}/{circle.total_hands})</h3>
          {circle.status === 'OPEN' && <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "16px", fontStyle: "italic" }}>💡 แตะที่ช่อง "ว่าง" เพื่อจองมือแชร์</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {totalHandsArray.map(hand => {
              const player = players.find(p => p.hand_no === hand);
              const isEmpty = !player;
              const canClickToJoin = isEmpty && circle.status === 'OPEN';
              
              let controls = null;
              if (player) {
                if (circle.status === 'OPEN' && (isCircleAdmin || player.member_id === dbUser.id)) {
                  controls = <button onClick={(e) => handleCancelHand(e, hand)} style={{ background: "#fee2e2", color: "#991b1b", border: "none", padding: "6px 10px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}>❌ ยกเลิก</button>;
                } else if (circle.status === 'ACTIVE' && isCircleAdmin) {
                  controls = <button onClick={(e) => openAdminChangeModal(e, hand)} style={{ background: "#e0f2fe", color: "#0284c7", border: "none", padding: "6px 10px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer", fontWeight: "bold" }}>🔄 เปลี่ยนมือ</button>;
                }
              }

              return (
                <div 
                  key={hand} 
                  onClick={() => canClickToJoin ? handleEmptyHandClick(hand) : null}
                  style={{ 
                    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", 
                    background: player ? "rgba(16, 185, 129, 0.1)" : (canClickToJoin ? "#fff" : "#f1f5f9"), 
                    borderRadius: "8px", border: "1px solid", 
                    borderColor: player ? "rgba(16, 185, 129, 0.3)" : (canClickToJoin ? "#cbd5e1" : "transparent"),
                    cursor: canClickToJoin ? "pointer" : "default",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div>
                    <span style={{ fontWeight: "bold", color: player ? "var(--primary)" : "#64748b", display: "inline-block", width: "60px" }}>มือที่ {hand}</span>
                    <span style={{ color: player ? "var(--foreground)" : "#94a3b8" }}>{player ? player.member_name : (canClickToJoin ? "👉 กดที่นี่เพื่อจอง" : "ว่าง")}</span>
                  </div>
                  {controls && <div>{controls}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {Array.from({ length: circle.current_period }, (_, i) => circle.current_period - i).map(period => {
            const winnerBid = bids.filter(b => b.period === period).sort((a,b) => b.bid_amount - a.bid_amount)[0];
            const winner = winnerBid ? players.find(p => p.member_id === winnerBid.member_id) : null;
            const handSlips = slips.filter(s => s.period === period);
            const isCurrent = period === circle.current_period;

            return (
              <div key={period} className="glass-panel" style={{ borderLeft: isCurrent ? "5px solid var(--primary)" : "5px solid #cbd5e1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", color: isCurrent ? "var(--primary)" : "var(--foreground)" }}>งวดที่ {period}</h4>
                    {winner ? (
                      <div style={{ fontSize: "0.9rem", color: "#475569" }}>
                        🏆 เปียได้: <span style={{ fontWeight: "bold", color: "#f59e0b" }}>{winner.member_name}</span> (+ {winnerBid.bid_amount} บาท)
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>รอยืนยันผู้เปียได้...</div>
                    )}
                  </div>
                  {isCurrent && <span className="badge badge-active">งวดล่าสุด</span>}
                </div>

                <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "8px", fontWeight: "bold" }}>สถานะการจ่ายเงิน:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "8px" }}>
                    {players.map(player => {
                      const slip = handSlips.find(s => s.member_id === player.member_id);
                      const isPaid = slip?.status === 'APPROVED';
                      const isPending = slip?.status === 'PENDING';

                      return (
                        <div key={player.id} style={{ textAlign: "center" }}>
                          <div style={{ 
                            width: "24px", height: "24px", borderRadius: "50%", margin: "0 auto 4px auto", 
                            background: isPaid ? "#10b981" : (isPending ? "#f59e0b" : "#e2e8f0"),
                            display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px"
                          }}>
                            {isPaid ? "✓" : (isPending ? "⏳" : "")}
                          </div>
                          <div style={{ fontSize: "0.7rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.member_name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                   <button 
                    onClick={() => setSlipModal({ open: true, period: period })}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid var(--primary)", background: "white", color: "var(--primary)", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}
                   >
                     {isCurrent ? "🧾 ส่งสลิป" : "👁️ ดูหลักฐาน"}
                   </button>
                   {isCircleAdmin && isCurrent && (
                     <button style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "white", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}>
                       📢 แจ้งเตือนบอท
                     </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Action Modal for Join / Change */}
      {adminModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "400px", padding: "24px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>{adminModal.mode === 'JOIN' ? `📝 จองมือที่ ${adminModal.handNo}` : `🔄 โอนมือที่ ${adminModal.handNo}`}</h3>
            
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "#64748b", fontWeight: "bold" }}>
              {adminModal.mode === 'JOIN' ? "เลือกคนรับสิทธิ์จอง (คุณสามารถจองแทนคนอื่นได้)" : "เลือกคนที่จะมารับมือนี้แทน"}
            </label>

            <select 
              value={adminSelectedUserId} 
              onChange={(e) => setAdminSelectedUserId(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "20px" }}
            >
               {adminModal.mode === 'JOIN' && <option value={dbUser.id}>-- จองเป็นชื่อตัวเอง --</option>}
               {adminModal.mode === 'CHANGE' && <option value="">-- เลือกสมาชิกในบ้านแชร์ --</option>}
              
              {allMembers.filter(m => adminModal.mode === 'JOIN' ? m.id !== dbUser.id : true).map(m => (
                <option key={m.id} value={m.id}>{m.name} (โทร {m.phone || "-"})</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setAdminModal({ open: false, mode: "", handNo: "" })} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>ยกเลิก</button>
              <button 
                onClick={submitAdminModal} 
                disabled={!adminSelectedUserId}
                style={{ flex: 1, padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", opacity: !adminSelectedUserId ? 0.5 : 1 }}
              >
                ยืนยัน{adminModal.mode === 'JOIN' ? "จอง" : "โอน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Management Modal */}
      {slipModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0 }}>🧾 งวดที่ {slipModal.period}</h3>
              <button onClick={() => setSlipModal({ open: false, period: null })} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>

            {/* List of Slips for this period */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "0.9rem", color: "#64748b", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>สลิปที่ส่งแล้ว</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                {slips.filter(s => s.period === slipModal.period).length === 0 && <p style={{ fontSize: "0.85rem", color: "#94a3b8", textAlign: "center" }}>ยังไม่มีการส่งสลิป</p>}
                {slips.filter(s => s.period === slipModal.period).map(slip => {
                  const member = players.find(p => p.member_id === slip.member_id);
                  return (
                    <div key={slip.id} style={{ display: "flex", gap: "12px", background: "#f8fafc", padding: "10px", borderRadius: "10px", alignItems: "center" }}>
                      <img src={slip.image_url} alt="Slip" style={{ width: "50px", height: "50px", borderRadius: "6px", objectFit: "cover", cursor: "pointer" }} onClick={() => window.open(slip.image_url)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{member?.member_name || "Unknown"}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "bold" }}>{slip.amount} บาท</div>
                      </div>
                      <div>
                        {slip.status === 'APPROVED' ? (
                          <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: "bold" }}>✅ อนุมัติแล้ว</span>
                        ) : (
                          isCircleAdmin ? (
                            <button onClick={() => handleVerifySlip(slip.id)} style={{ padding: "6px 12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer" }}>อนุมัติ</button>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: "bold" }}>⏳ รอยืนยัน</span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleUploadSlip} style={{ borderTop: "2px dashed #e2e8f0", paddingTop: "20px" }}>
              <h4 style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "12px" }}>📤 ส่งสลิปใหม่</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "4px" }}>ระบุยอดเงิน</label>
                  <input 
                    type="number" 
                    placeholder="ตัวอย่าง: 1000"
                    value={uploadData.amount}
                    onChange={(e) => setUploadData({...uploadData, amount: e.target.value})}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "4px" }}>ลิงก์รูปภาพสลิป (URL)</label>
                  <input 
                    type="text" 
                    placeholder="https://..."
                    value={uploadData.image_url}
                    onChange={(e) => setUploadData({...uploadData, image_url: e.target.value})}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "4px" }}>หมายเหตุ (ถ้ามี)</label>
                  <input 
                    type="text" 
                    placeholder="โอนจากกรุงไทย / จ่ายสด"
                    value={uploadData.note}
                    onChange={(e) => setUploadData({...uploadData, note: e.target.value})}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <button type="submit" style={{ width: "100%", padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", marginTop: "8px" }}>ยืนยันการส่งสลิป</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
