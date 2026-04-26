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
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.6rem", margin: "0 0 12px 0", color: "var(--foreground)" }}>📊 วงแชร์ทั้งหมด</h2>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link 
            href="/circles/create" 
            style={{ padding: "8px 16px", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "10px", fontWeight: "bold", textDecoration: "none" }}
          >
            + สร้างวงแชร์
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", padding: "4px", background: "rgba(0,0,0,0.05)", borderRadius: "12px" }}>
        <button 
          onClick={() => setActiveTab("OPEN")}
          style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s", background: activeTab === "OPEN" ? "white" : "transparent", color: activeTab === "OPEN" ? "var(--primary)" : "#64748b", boxShadow: activeTab === "OPEN" ? "0 2px 8px rgba(0,0,0,0.05)" : "none" }}
        >
          กำลังเปิดอยู่
        </button>
        <button 
          onClick={() => setActiveTab("CLOSED")}
          style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s", background: activeTab === "CLOSED" ? "white" : "transparent", color: activeTab === "CLOSED" ? "var(--foreground)" : "#64748b", boxShadow: activeTab === "CLOSED" ? "0 2px 8px rgba(0,0,0,0.05)" : "none" }}
        >
          ปิดไปแล้ว
        </button>
      </div>

      {message && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b", textAlign: "center", fontWeight: "600" }}>
          {message}
        </div>
      )}

      {/* Circle List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filteredCircles.length === 0 && !message ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "10px" }}>📭</span>
            <h3 style={{ color: "#64748b" }}>ยังไม่มีวงแชร์ที่{activeTab === "OPEN" ? "เปิดให้เล่น" : "ปิดไปแล้ว"}</h3>
          </div>
        ) : (
          filteredCircles.map((circle) => (
            <Link 
              href={`/circles/${circle.id}`} 
              key={circle.id}
              className="glass-panel"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", transition: "transform 0.2s" }}
            >
              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 6px 0", color: activeTab === "CLOSED" ? "#64748b" : "var(--primary)" }}>{circle.name}</h3>
                <div style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px" }}>{circle.type}</span>
                  <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px" }}>ส่ง {circle.amount_per_hand} บ.</span>
                  <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px" }}>{circle.total_hands} มือ</span>
                </div>
              </div>
              <div style={{ fontSize: "1.5rem", color: "#cbd5e1" }}>›</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
