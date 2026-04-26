"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";

export default function Home() {
  const [status, setStatus] = useState("⏳ กำลังเริ่มระบบ...");
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [circles, setCircles] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingCircles, setIsLoadingCircles] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.liff) {
      initLiff();
    }
  }, []);

  const handleScriptLoad = () => {
    if (window.liff) initLiff();
  };

  const initLiff = async () => {
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setStatus("Error: LIFF ID is not setup");
        setIsInitializing(false);
        return;
      }
      await window.liff.init({ liffId });
      if (!window.liff.isLoggedIn()) {
        setNeedsLogin(true);
        setIsInitializing(false);
        return;
      }
      
      const userProfile = await window.liff.getProfile();
      setProfile(userProfile);

      const houseParam = new URLSearchParams(window.location.search).get('house');
      const res = await fetch('/api/action', {
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
      const resData = await res.json();
      
      if (resData.status === 'success') {
        setDbUser(resData);
        fetchCircles(resData.id);
      }
      
      setIsInitializing(false);

    } catch (err) {
      setStatus("Error: " + (err.message || err.toString()));
      setIsInitializing(false);
    }
  };

  const fetchCircles = async (memberId) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_circles', member_id: memberId })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCircles(data.circles || []);
      }
    } catch (err) {
      console.error("Failed to fetch circles", err);
    }
    setIsLoadingCircles(false);
  };

  const handleLoginClick = () => {
    if (window.liff) window.liff.login();
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container">
          <div className="loader"></div>
          <h3 style={{ color: "var(--primary)" }}>กำลังโหลดข้อมูล...</h3>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", minHeight: "80vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div className="glass-panel" style={{ padding: "40px 24px", width: "100%", maxWidth: "400px" }}>
          <div style={{ fontSize: "4rem", marginBottom: "20px" }}>🌿</div>
          <h2 style={{ marginBottom: "12px", fontSize: "1.8rem" }}>GreenShare</h2>
          <p style={{ marginBottom: "32px", color: "#64748b", lineHeight: "1.6" }}>ระบบจัดการวงแชร์พรีเมียม<br/>ใช้งานง่าย ปลอดภัย ตรวจสอบได้</p>
          <button onClick={handleLoginClick} className="btn-primary" style={{ width: "100%", fontSize: "1.1rem", background: "#00B900" }}>💬 เข้าสู่ระบบด้วย LINE</button>
        </div>
      </div>
    );
  }

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';
  const newCircles = circles.filter(c => c.status === 'OPEN').slice(0, 5);
  const activeCircles = circles.filter(c => c.status === 'ACTIVE').slice(0, 5);

  return (
    <div className="animate-fade-in">
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />

      <div style={{ marginBottom: "24px", marginTop: "10px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "800", margin: 0 }}>สวัสดีครับ! 🌿</h2>
        <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.9rem" }}>วันนี้มีอะไรให้ช่วยจัดการไหมครับ?</p>
      </div>

      {/* New Circles Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "700" }}>วงแชร์เปิดใหม่</h3>
        {isAdmin && (
            <Link href="/circles/create" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", color: "white", background: "var(--primary-gradient)", padding: "6px 14px", borderRadius: "12px", textDecoration: "none", fontWeight: "700", boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)" }}>
                <span>+</span> เปิดวงใหม่
            </Link>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
        {isLoadingCircles ? (
           <div className="glass-panel" style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</div>
        ) : newCircles.length === 0 ? (
           <div className="glass-panel" style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
              ยังไม่มีวงแชร์เปิดใหม่ในขณะนี้
           </div>
        ) : (
           newCircles.map(circle => (
            <Link 
              href={`/circles/${circle.id}`} 
              key={circle.id}
              className="glass-panel"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", padding: "16px 20px", border: "1px solid rgba(16, 185, 129, 0.1)" }}
            >
              <div>
                <div style={{ fontWeight: "700", fontSize: "1rem" }}>{circle.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>💰 ส่งงวดละ {circle.amount_per_hand.toLocaleString()} ฿</div>
              </div>
              <div style={{ color: "#94a3b8" }}>❯</div>
            </Link>
           ))
        )}
      </div>

      {/* Playing Circles Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "700" }}>วงแชร์ที่เล่นอยู่</h3>
        <Link href="/circles/view" style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>ดูทั้งหมด</Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {isLoadingCircles ? (
           <div className="glass-panel" style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</div>
        ) : activeCircles.length === 0 ? (
           <div className="glass-panel" style={{ padding: "30px 20px", textAlign: "center", color: "#94a3b8" }}>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>คุณยังไม่มีวงแชร์ที่กำลังเล่นอยู่</p>
           </div>
        ) : (
           activeCircles.map(circle => (
            <Link 
              href={`/circles/${circle.id}`} 
              key={circle.id}
              className="glass-panel"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", padding: "16px 20px" }}
            >
              <div>
                <div style={{ fontWeight: "700", fontSize: "1rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    {circle.name}
                    <span className="badge badge-success" style={{ fontSize: "0.55rem", padding: "2px 6px" }}>{circle.status}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>💰 ส่งงวดละ {circle.amount_per_hand.toLocaleString()} ฿</div>
              </div>
              <div style={{ color: "#94a3b8" }}>❯</div>
            </Link>
           ))
        )}
      </div>
    </div>
  );
}
