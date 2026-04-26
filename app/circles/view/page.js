"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ViewCircles() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [circles, setCircles] = useState([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("OPEN"); // OPEN or CLOSED

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

      // Ensure user is registered before giving them access
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
      const dbUser = await regRes.json();
      
      if (dbUser.status !== 'success') {
        setMessage("โหลดข้อมูลผู้ใช้ล้มเหลว");
        setIsInitializing(false);
        return;
      }

      // Fetch circles
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_circles',
          member_id: dbUser.id
        })
      });
      
      const resData = await res.json();
      
      if (resData.status === 'success') {
        setCircles(resData.circles);
      } else {
        setMessage(resData.message || "ไม่สามารถดึงวงแชร์ได้");
      }
      
      setIsInitializing(false);
    } catch (err) {
      setMessage("การเชื่อมต่อขัดข้อง");
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container">
          <div className="loader"></div>
          <h3 style={{ color: "var(--primary)" }}>กำลังโหลดวงแชร์...</h3>
        </div>
      </div>
    );
  }

  // Filter circles based on active tab
  const filteredCircles = circles.filter(c => 
    activeTab === "OPEN" ? (c.status === "OPEN" || c.status === "ACTIVE") : (c.status === "CLOSED" || c.status === "DEAD")
  );

  return (
    <div className="animate-fade-in">
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />

      {/* Header & Quick Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0 }}>วงแชร์ของคุณ</h2>
        <Link 
          href="/circles/create" 
          className="btn-primary"
          style={{ padding: "10px 16px", fontSize: "0.9rem" }}
        >
          + สร้างวงใหม่
        </Link>
      </div>

      {/* Modern Tabs */}
      <div className="glass-panel" style={{ display: "flex", gap: "8px", marginBottom: "24px", padding: "6px", borderRadius: "18px" }}>
        <button 
          onClick={() => setActiveTab("OPEN")}
          style={{ flex: 1, padding: "12px", borderRadius: "14px", border: "none", fontWeight: "700", cursor: "pointer", transition: "all 0.3s", background: activeTab === "OPEN" ? "var(--primary-gradient)" : "transparent", color: activeTab === "OPEN" ? "white" : "#64748b" }}
        >
          กำลังเปิดอยู่
        </button>
        <button 
          onClick={() => setActiveTab("CLOSED")}
          style={{ flex: 1, padding: "12px", borderRadius: "14px", border: "none", fontWeight: "700", cursor: "pointer", transition: "all 0.3s", background: activeTab === "CLOSED" ? "var(--primary-gradient)" : "transparent", color: activeTab === "CLOSED" ? "white" : "#64748b" }}
        >
          สรุปยอดแล้ว
        </button>
      </div>

      {message && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "12px", background: "#fee2e2", color: "#991b1b", textAlign: "center", fontWeight: "600", fontSize: "0.9rem" }}>
          {message}
        </div>
      )}

      {/* Circle List Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "20px" }}>
        {filteredCircles.length === 0 && !message ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "16px" }}>📭</span>
            <h3 style={{ color: "#94a3b8", fontWeight: "600" }}>ยังไม่มีวงแชร์ในหมวดนี้</h3>
            <p style={{ fontSize: "0.9rem", color: "#64748b" }}>คุณสามารถสร้างวงแชร์ใหม่ได้ที่ปุ่มด้านบน</p>
          </div>
        ) : (
          filteredCircles.map((circle) => (
            <Link 
              href={`/circles/${circle.id}`} 
              key={circle.id}
              className="glass-panel"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", padding: "20px" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "700" }}>{circle.name}</h3>
                    <span className={circle.status === 'ACTIVE' ? "badge badge-success" : "badge-warning"} style={{ fontSize: "0.6rem" }}>
                        {circle.status}
                    </span>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                    🏷️ {circle.type}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                    💰 {circle.amount_per_hand} บ.
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                    🔢 {circle.total_hands} มือ
                  </div>
                </div>
              </div>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                ❯
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
