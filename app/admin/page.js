"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbUser, setDbUser] = useState(null);
  const [circles, setCircles] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (typeof window !== "undefined" && window.liff) {
      initLiff();
    }
  }, []);

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
      
      if (user.status !== 'success' || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
        alert("ไม่มีสิทธิ์เข้าถึง (Access Denied)");
        router.push('/');
        return;
      }
      
      setDbUser(user);
      fetchAdminData(user.id);
      
    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
      setIsInitializing(false);
    }
  };

  const fetchAdminData = async (memberId) => {
    // For admin, we could fetch all circles or just circles they created.
    // We'll reuse get_circles for now which fetches recent ones.
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_circles',
          member_id: memberId
        })
      });
      
      const resData = await res.json();
      if (resData.status === 'success') {
        // Option: Filter only circles created by this admin
        // const myCircles = resData.circles.filter(c => c.creator_id === memberId || userRole === 'SUPERADMIN');
        setCircles(resData.circles);
      }
      setIsInitializing(false);
    } catch (err) {
      setMessage({ type: "error", text: "ดึงข้อมูลล้มเหลว" });
      setIsInitializing(false);
    }
  };

  const handleRandomWinner = async (circleId) => {
    const confirmRandom = confirm(`ยืนยันการสุ่มผู้ชนะวงนี้ (เฉพาะ Admin)?`);
    if(!confirmRandom) return;

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'random_select_bidder',
          caller_role: dbUser.role,
          circle_id: circleId
        })
      });
      const data = await res.json();
      
      if(data.status === 'success'){
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch(err) {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container">
          <div className="loader"></div>
          <h3 style={{ color: "var(--primary)" }}>กำลังตรวจสอบสิทธิ์ Admin...</h3>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
        <Link href="/" style={{ padding: "8px 12px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", fontWeight: "bold", color: "var(--foreground)" }}>
          ← กลับ
        </Link>
        <h2 style={{ flex: 1, textAlign: "center", fontSize: "1.4rem", margin: 0, paddingRight: "40px" }}>🔧 ระบบแอดมิน</h2>
      </div>

      {message.text && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>
          {message.text}
        </div>
      )}

      <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "#475569" }}>การจัดการวงแชร์ (เฉพาะสิทธิ์ผู้ดูแล)</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {circles.length === 0 ? (
          <p style={{ textAlign: "center", color: "#94a3b8" }}>ไม่มีข้อมูลวงแชร์ในระบบ</p>
        ) : (
          circles.map(circle => (
            <div key={circle.id} className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.05)", paddingBottom: "8px" }}>
                <h4 style={{ margin: 0, fontSize: "1.1rem" }}>{circle.name}</h4>
                <span className="badge badge-active">{circle.status}</span>
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#64748b" }}>
                <span>มือทั้งหมด: {circle.total_hands}</span>
                <span>งวดละ: {circle.amount_per_hand}</span>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button 
                  onClick={() => handleRandomWinner(circle.id)}
                  style={{ flex: 1, padding: "10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                >
                  🎲 สุ่มจับผู้ชนะวงนี้
                </button>
                <Link 
                  href={`/circles/${circle.id}`}
                  style={{ flex: 1, padding: "10px", background: "var(--secondary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", textAlign: "center", textDecoration: "none" }}
                >
                  ดูรายละเอียดวง
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
