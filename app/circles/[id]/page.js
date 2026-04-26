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
  const [selectedHand, setSelectedHand] = useState("");

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

      const regRes = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: userProfile.displayName,
          nickname: userProfile.displayName,
          line_id: userProfile.userId,
        })
      });
      const user = await regRes.json();
      
      if (user.status !== 'success') {
        setMessage({ type: "error", text: "ไม่สามารถเข้าถึงข้อมูลสมาชิก" });
        setIsInitializing(false);
        return;
      }
      setDbUser(user);

      // Fetch circle details
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
      body: JSON.stringify({
        action: 'get_circle_detail',
        circle_id: circleId
      })
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

  const handleJoin = async () => {
    if (!selectedHand) return;
    
    const confirmJoin = confirm(`ยืนยันการจองมือที่ ${selectedHand}?`);
    if (!confirmJoin) return;

    setMessage({ type: "", text: "" });
    
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join_circle',
          circle_id: circleId,
          hand_no: selectedHand,
          member_id: dbUser.id
        })
      });
      
      const resData = await res.json();
      if (resData.status === 'success') {
        setMessage({ type: "success", text: "จองมือสำเร็จ!" });
        fetchCircleDetail(); // Refresh
      } else {
        setMessage({ type: "error", text: resData.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
    }
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container">
          <div className="loader"></div>
          <h3 style={{ color: "var(--primary)" }}>กำลังโหลดรายละเอียดวง...</h3>
        </div>
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

  // Calculate available hands
  const occupiedHands = players.map(p => p.hand_no);
  const totalHandsArray = Array.from({ length: circle.total_hands }, (_, i) => i + 1);

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.6rem", margin: 0, color: "var(--foreground)" }}>วง: {circle.name}</h2>
      </div>

      {message.text && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>
          {message.text}
        </div>
      )}

      {/* Circle Info */}
      <div className="glass-panel" style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#64748b" }}>ประเภท:</span>
          <strong>{circle.type}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#64748b" }}>ส่งงวดละ:</span>
          <strong>{circle.amount_per_hand} บาท</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#64748b" }}>ยอดรับรวม:</span>
          <strong>{circle.total_amount} บาท</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#64748b" }}>สถานะ:</span>
          <span className="badge badge-active">{circle.status}</span>
        </div>
        
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button 
            onClick={() => {
              const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
              const link = `https://liff.line.me/${liffId}/circles/${circle.id}`;
              navigator.clipboard.writeText(link);
              setMessage({ type: "success", text: "คัดลอกลิงก์สำเร็จ ส่งใน LINE ได้เลย!" });
            }}
            style={{ flex: 1, padding: "12px", background: "white", color: "var(--primary)", border: "2px solid var(--primary)", textAlign: "center", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
          >
            📋 ก็อปลิงก์เชิญเพื่อน
          </button>
          
          {circle.line_group_url && (
            <a href={circle.line_group_url} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "12px", background: "#00B900", color: "white", textAlign: "center", borderRadius: "8px", fontWeight: "bold", textDecoration: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
              💬 เข้ากลุ่มแชท
            </a>
          )}
        </div>
      </div>

      {/* Join Hand Form */}
      <div className="glass-panel" style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>✋ จองมือแชร์</h3>
        <div style={{ display: "flex", gap: "12px" }}>
          <select 
            value={selectedHand} 
            onChange={(e) => setSelectedHand(e.target.value)}
            style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="">-- เลือกมือที่ว่าง --</option>
            {totalHandsArray.map(hand => {
              const isOccupied = occupiedHands.includes(hand);
              return (
                <option key={hand} value={hand} disabled={isOccupied}>
                  มือที่ {hand} {isOccupied ? "(จองแล้ว)" : ""}
                </option>
              );
            })}
          </select>
          <button 
            onClick={handleJoin}
            disabled={!selectedHand}
            style={{ padding: "0 20px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", opacity: !selectedHand ? 0.5 : 1 }}
          >
            ยืนยัน
          </button>
        </div>
      </div>

      {/* Players List */}
      <div className="glass-panel">
        <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>👥 รายชื่อคนเล่น ({players.length}/{circle.total_hands})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {totalHandsArray.map(hand => {
            const player = players.find(p => p.hand_no === hand);
            
            return (
              <div key={hand} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: player ? "rgba(16, 185, 129, 0.1)" : "#f1f5f9", borderRadius: "8px", border: "1px solid", borderColor: player ? "rgba(16, 185, 129, 0.3)" : "transparent" }}>
                <span style={{ fontWeight: "bold", color: player ? "var(--primary)" : "#94a3b8" }}>มือที่ {hand}</span>
                <span style={{ color: player ? "var(--foreground)" : "#94a3b8" }}>
                  {player ? player.member_name : "ว่าง"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
