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
    const link = `https://liff.line.me/${liffId}?house=${dbUser.id}`;
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
    <div className="animate-fade-in">
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
      
      {message.text && (
        <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "12px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600", fontSize: "0.9rem" }}>
          {message.text}
        </div>
      )}

      {/* Global Invite Section */}
      <div className="glass-panel" style={{ textAlign: "center", marginBottom: "32px", border: "1px dashed var(--primary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🤝</div>
        <h3 style={{ marginBottom: "8px", fontSize: "1.2rem", fontWeight: "700" }}>ชวนเพื่อนเข้าบ้าน</h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px", padding: "0 20px" }}>ส่งลิงก์ให้เพื่อนเพื่อเข้าร่วมเป็นสมาชิกในบ้านแชร์ของคุณ</p>
        <button 
          onClick={handleCopyInviteLink}
          className="btn-primary"
          style={{ width: "100%" }}
        >
          🔗 คัดลอกลิงก์เชิญ
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1.1rem", margin: 0, fontWeight: "700" }}>สมาชิกทั้งหมด ({members.length})</h3>
        <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>เรียงตามล่าสุด</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {members.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            ยังไม่มีสมาชิกในบ้านนี้
          </div>
        ) : (
          members.map(m => (
            <div key={m.id} className="glass-panel" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "45px", height: "45px", borderRadius: "12px", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", border: "1px solid var(--glass-border)" }}>
                👤
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", fontSize: "1rem" }}>{m.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>📞 {m.phone || "ไม่ระบุเบอร์"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={m.status === 'ACTIVE' ? "badge badge-success" : "badge-warning"} style={{ fontSize: "0.65rem" }}>
                  {m.status}
                </span>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px", fontWeight: "600" }}>{m.role}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
