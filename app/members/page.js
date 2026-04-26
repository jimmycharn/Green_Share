"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Members() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbUser, setDbUser] = useState(null);
  const [members, setMembers] = useState([]);
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
      
      if (user.status !== 'success') {
        setMessage({ type: "error", text: "โหลดข้อมูลผู้ใช้ล้มเหลว" });
        setIsInitializing(false);
        return;
      }
      setDbUser(user);
      
      fetchMembers(user.id);
      
    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
      setIsInitializing(false);
    }
  };

  const fetchMembers = async (memberId) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_members',
          member_id: memberId
        })
      });
      const data = await res.json();
      
      if(data.status === 'success'){
        setMembers(data.members);
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch(err) {
      setMessage({ type: "error", text: "โหลดข้อมูลสมาชิกล้มเหลว" });
    }
    setIsInitializing(false);
  };

  const handleCopyInviteLink = () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const link = `https://liff.line.me/${liffId}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: "success", text: "คัดลอกลิงก์สำเร็จ ส่งชวนเพื่อนในไลน์ได้เลย!" });
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container">
          <div className="loader"></div>
          <h3 style={{ color: "var(--primary)" }}>กำลังโหลดสมาชิก...</h3>
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
        <h2 style={{ flex: 1, textAlign: "center", fontSize: "1.4rem", margin: 0, paddingRight: "40px" }}>👥 สมาชิกของบ้าน</h2>
      </div>

      {message.text && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>
          {message.text}
        </div>
      )}

      {/* Global Invite Section */}
      <div className="glass-panel" style={{ textAlign: "center", marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "1.2rem", color: "var(--primary)" }}>เพิ่มสมาชิกลงบ้านแชร์</h3>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "16px" }}>ส่งลิงก์ด้านล่างให้เพื่อนเพื่อดึงเข้าสู่ระบบบ้านแชร์</p>
        <button 
          onClick={handleCopyInviteLink}
          style={{ padding: "16px", background: "var(--primary)", color: "white", border: "none", borderRadius: "12px", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", width: "100%" }}
        >
          🔗 คัดลอกลิงก์เชิญเข้าบ้านแชร์
        </button>
      </div>

      <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "#475569" }}>รายชื่อสมาชิกทั้งหมด ({members.length})</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>ยังไม่มีสมาชิก...</div>
        ) : (
          members.map(m => (
            <div key={m.id} className="glass-panel" style={{ padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "1.1rem", display: "block" }}>{m.name}</strong>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>เบอร์: {m.phone || "-"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <span className={m.status === 'ACTIVE' ? "badge badge-active" : "badge badge-admin"} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                  {m.status}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>{m.role}</span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
