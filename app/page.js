"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";

export default function Home() {
  const [status, setStatus] = useState("⏳ กำลังเริ่มระบบ...");
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    // Check if liff is already available on mount (in case it loaded fast)
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
          nickname: userProfile.displayName, // fallback
          line_id: userProfile.userId,
          phone: '', 
          bank_account: '',
          house: houseParam
        })
      });
      const resData = await res.json();
      
      if (resData.status === 'success') {
        setDbUser(resData); // Holds id, role, member_status etc.
      }
      
      setIsInitializing(false);

    } catch (err) {
      setStatus("Error: " + (err.message || err.toString()));
      setIsInitializing(false);
    }
  };

  const handleLoginClick = () => {
    if (window.liff) {
      window.liff.login();
    }
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script 
          src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" 
          onLoad={handleScriptLoad}
        />
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
          <button 
            onClick={handleLoginClick} 
            className="btn-primary"
            style={{ width: "100%", fontSize: "1.1rem", background: "#00B900" }}
          >
            💬 เข้าสู่ระบบด้วย LINE
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div className="glass-panel">
          <h3 style={{ color: "var(--danger)", margin: 0 }}>{status}</h3>
        </div>
      </div>
    );
  }

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';

  return (
    <div className="animate-fade-in">
      <Script 
        src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" 
        onLoad={handleScriptLoad}
      />

      {/* Welcome Message */}
      <div style={{ marginBottom: "24px", marginTop: "10px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "800", margin: 0 }}>สวัสดีครับ! 🌿</h2>
        <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.9rem" }}>วันนี้มีอะไรให้ช่วยจัดการไหมครับ?</p>
      </div>

      {/* Main Actions Summary */}
      <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", fontWeight: "700" }}>เมนูแนะนำ</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
        <Link href="/circles/view" className="glass-panel" style={{ textDecoration: "none", color: "inherit", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ fontSize: "2rem" }}>📊</div>
          <div style={{ fontWeight: "700" }}>วงแชร์ทั้งหมด</div>
        </Link>
        <Link href="/circles/create" className="glass-panel" style={{ textDecoration: "none", color: "inherit", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ fontSize: "2rem" }}>➕</div>
          <div style={{ fontWeight: "700" }}>เปิดวงใหม่</div>
        </Link>
      </div>

      {/* Recent Circles Section (Mockup / Future API Integration) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "700" }}>วงแชร์ที่เล่นอยู่</h3>
        <Link href="/circles/view" style={{ fontSize: "0.9rem", color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>ดูทั้งหมด</Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Placeholder for real circles */}
        <div className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "1rem" }}>กำลังโหลดข้อมูลวงแชร์...</div>
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>แตะเพื่อดูรายละเอียด</div>
          </div>
          <div style={{ fontSize: "1.2rem" }}>❯</div>
        </div>
      </div>
    </div>
  );
}
