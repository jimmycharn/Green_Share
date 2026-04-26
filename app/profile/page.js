"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  
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
      setProfile(userProfile);

      // Fetch latest data from database
      const houseParam = new URLSearchParams(window.location.search).get('house');
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: userProfile.displayName,
          nickname: userProfile.displayName,
          line_id: userProfile.userId,
          phone: '', 
          bank_account: '',
          house: houseParam
        })
      });
      const resData = await res.json();
      
      if (resData.status === 'success') {
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
          <h3 style={{ color: "var(--primary)" }}>กำลังโหลดข้อมูลบัญชี...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
      
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <img 
          src={profile?.pictureUrl} 
          alt="Profile" 
          style={{ width: "60px", height: "60px", borderRadius: "20px", border: "2px solid white", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }} 
        />
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "700", margin: 0 }}>{profile?.displayName}</h2>
          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>จัดการข้อมูลส่วนตัวของคุณ</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "24px" }}>
        {message.text && (
          <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "12px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600", fontSize: "0.9rem" }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ชื่อ-นามสกุลจริง</label>
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required
              className="glass-panel"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
              placeholder="นายใจดี มีเงินแบ่ง"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ชื่อเล่น</label>
            <input 
              type="text" 
              name="nickname" 
              value={formData.nickname} 
              onChange={handleChange} 
              required
              className="glass-panel"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
              placeholder="พี่ใจดี"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>เบอร์โทรศัพท์</label>
            <input 
              type="tel" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
              required
              className="glass-panel"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
              placeholder="080xxxxxxx"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ข้อมูลธนาคารสำหรับรับเงิน</label>
            <textarea 
              name="bank_account" 
              value={formData.bank_account} 
              onChange={handleChange} 
              rows="3"
              required
              className="glass-panel"
              style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)", resize: "none" }}
              placeholder="ระบุ: ธนาคาร - เลขบัญชี - ชื่อบัญชี"
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-primary"
            style={{ marginTop: "10px" }}
          >
            {isSaving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
          </button>
        </form>
      </div>

      <div style={{ marginTop: "32px", paddingBottom: "20px" }}>
        <button onClick={() => window.location.href = '/admin'} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "0.85rem", textDecoration: "underline", cursor: "pointer", width: "100%" }}>
          ⚙️ การจัดการขั้นสูง (สำหรับแอดมิน)
        </button>
      </div>
    </div>
  );
}
