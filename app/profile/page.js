"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();
  const [view, setView] = useState("menu"); // "menu" or "edit"
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    phone: "",
    bank_account: ""
  });
  
  const [message, setMessage] = useState({ type: "", text: "" });

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
      await window.liff.init({ liffId });
      
      if (!window.liff.isLoggedIn()) {
        window.liff.login();
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
        setFormData({
          name: resData.name || "",
          nickname: resData.nickname || "",
          phone: resData.phone || "",
          bank_account: resData.bank_account || ""
        });
      }
      
      setIsInitializing(false);
    } catch (err) {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ" });
      setIsInitializing(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          line_id: profile.userId,
          name: formData.name,
          nickname: formData.nickname,
          phone: formData.phone,
          bank_account: formData.bank_account
        })
      });
      
      const resData = await res.json();
      
      if (resData.status === 'success') {
        setMessage({ type: "success", text: "บันทึกข้อมูลเรียบร้อยแล้ว!" });
        // Optionally go back to menu after success
        setTimeout(() => setView("menu"), 1500);
      } else {
        setMessage({ type: "error", text: resData.message || "บันทึกไม่สำเร็จ" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
    }
    
    setIsSaving(false);
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

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';

  return (
    <div className="animate-fade-in">
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
      
      {view === "menu" ? (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
            <h3 style={{ margin: "0 0 4px 6px", fontSize: "1.1rem", fontWeight: "800" }}>จัดการข้อมูล</h3>
            <button 
                onClick={() => setView("edit")}
                className="glass-panel" 
                style={{ 
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", 
                    padding: "20px 24px", border: "1px solid var(--glass-border)", cursor: "pointer",
                    textAlign: "left", fontSize: "1.1rem", fontWeight: "700" 
                }}
            >
                <span>จัดการโปรไฟล์</span>
                <span style={{ fontSize: "1.2rem", color: "#94a3b8" }}>❯</span>
            </button>

            {isAdmin && (
                <Link 
                    href="/admin" 
                    className="glass-panel" 
                    style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center", 
                        padding: "20px 24px", border: "1px solid var(--glass-border)", cursor: "pointer",
                        textDecoration: "none", color: "inherit", fontSize: "1.1rem", fontWeight: "700" 
                    }}
                >
                    <span>แอดมินตั้งค่า(ขั้นสูง)</span>
                    <span style={{ fontSize: "1.2rem", color: "#94a3b8" }}>❯</span>
                </Link>
            )}

            <div style={{ padding: "10px", textAlign: "center", marginTop: "20px" }}>
                 <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>เวอร์ชันแอป 1.2.0 (Redesign)</p>
            </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <button onClick={() => setView("menu")} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--primary)" }}>❮</button>
                <h3 style={{ margin: 0 }}>แก้ไขข้อมูลโปรไฟล์</h3>
            </div>

            {message.text && (
              <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "12px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600", fontSize: "0.9rem" }}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ชื่อ-นามสกุลจริง</label>
                <input 
                  type="text" name="name" value={formData.name} onChange={handleChange} required
                  className="glass-panel" style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ชื่อเล่น</label>
                <input 
                  type="text" name="nickname" value={formData.nickname} onChange={handleChange} required
                  className="glass-panel" style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>เบอร์โทรศัพท์</label>
                <input 
                  type="tel" name="phone" value={formData.phone} onChange={handleChange} required
                  className="glass-panel" style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ข้อมูลธนาคารสำหรับรับเงิน</label>
                <textarea 
                  name="bank_account" value={formData.bank_account} onChange={handleChange} rows="3" required
                  className="glass-panel" style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)", resize: "none" }}
                ></textarea>
              </div>

              <button type="submit" disabled={isSaving} className="btn-primary" style={{ marginTop: "10px" }}>
                {isSaving ? "กำลังบันทึก..." : "💾 ยืนยันการเปลี่ยนแปลง"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
