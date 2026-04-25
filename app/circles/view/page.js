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

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
        <Link href="/" style={{ padding: "8px 12px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", fontWeight: "bold", color: "var(--foreground)" }}>
          ← กลับ
        </Link>
        <h2 style={{ flex: 1, textAlign: "center", fontSize: "1.4rem", margin: 0, paddingRight: "40px" }}>📊 วงแชร์ทั้งหมด</h2>
      </div>

      {message && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b", textAlign: "center", fontWeight: "600" }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {circles.length === 0 && !message ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "10px" }}>📭</span>
            <h3 style={{ color: "#64748b" }}>ยังไม่มีวงแชร์ที่เปิดให้เล่น</h3>
          </div>
        ) : (
          circles.map((circle) => (
            <Link 
              href={`/circles/${circle.id}`} 
              key={circle.id}
              className="glass-panel"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", transition: "transform 0.2s" }}
            >
              <div>
                <h3 style={{ fontSize: "1.2rem", margin: "0 0 6px 0", color: "var(--primary)" }}>{circle.name}</h3>
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
