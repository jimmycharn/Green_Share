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
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Hand Management States
  const [allMembers, setAllMembers] = useState([]);
  const [adminModal, setAdminModal] = useState({ open: false, mode: "", handNo: "" });
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

      {/* Players List */}
      <div className="glass-panel">
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
    </div>
  );
}
