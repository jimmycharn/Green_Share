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
      <div style={{ padding: "20px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h2 style={{ marginBottom: "20px", color: "var(--foreground)" }}>ยินดีต้อนรับสู่ Green Share</h2>
        <p style={{ marginBottom: "30px", color: "#64748b" }}>กรุณาเข้าสู่ระบบผ่านแอป LINE เพื่อดำเนินการต่อ</p>
        <button 
          onClick={handleLoginClick} 
          style={{ padding: "16px 32px", fontSize: "18px", background: "#00B900", color: "#fff", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", width: "100%", maxWidth: "300px", margin: "0 auto", boxShadow: "0 4px 14px rgba(0, 185, 0, 0.4)" }}
        >
          💬 เข้าสู่ระบบด้วย LINE
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h3 style={{ color: "var(--danger)" }}>{status}</h3>
      </div>
    );
  }

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header Profile Section */}
      <div className="glass-panel" style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <img 
            src={profile.pictureUrl} 
            alt="Profile" 
            style={{ width: "90px", height: "90px", borderRadius: "50%", border: "4px solid white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", objectFit: "cover" }} 
          />
        </div>
        <h2 style={{ marginTop: "12px", fontSize: "1.5rem", fontWeight: "600" }}>{profile.displayName}</h2>
        
        <div className="badge-collection">
          {isAdmin && <span className="badge badge-admin">SUPERADMIN</span>}
          <span className="badge badge-active">{dbUser?.member_status || "ACTIVE"}</span>
        </div>
      </div>

      <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", paddingLeft: "4px", color: "#475569" }}>เมนูหลัก</h3>
      
      {/* Main Action Grid */}
      <div className="dashboard-grid">
        <Link href="/circles/view" className="btn-dashboard btn-blue" style={{ gridColumn: "span 2" }}>
          <span className="icon">📊</span>
          <span>วงแชร์</span>
        </Link>
        <Link href="/members" className="btn-dashboard btn-green">
          <span className="icon">👥</span>
          <span>สมาชิก</span>
        </Link>
        <Link href="/profile" className="btn-dashboard btn-orange" style={{ gridColumn: isAdmin ? "span 1" : "span 2" }}>
          <span className="icon">📝</span>
          <span>แก้ไขข้อมูล</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="btn-dashboard btn-purple" style={{ gridColumn: "span 2" }}>
            <span className="icon">🔧</span>
            <span>ระบบหลังบ้าน</span>
          </Link>
        )}
      </div>
    </div>
  );
}
