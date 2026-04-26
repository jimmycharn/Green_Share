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
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: userProfile.displayName,
          nickname: userProfile.displayName,
          line_id: userProfile.userId,
          phone: '', 
          bank_account: ''
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
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.6rem", margin: 0, color: "var(--foreground)" }}>📝 ข้อมูลส่วนตัว</h2>
      </div>

      <div className="glass-panel" style={{ padding: "24px" }}>
        {message.text && (
          <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>ชื่อ-นามสกุลจริง</label>
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
              placeholder="นายใจดี มีเงินแบ่ง"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>ชื่อเล่น</label>
            <input 
              type="text" 
              name="nickname" 
              value={formData.nickname} 
              onChange={handleChange} 
              required
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
              placeholder="พี่ใจดี"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>เบอร์โทรศัพท์ (ใส่ตัวเลขติดกัน)</label>
            <input 
              type="tel" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
              required
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
              placeholder="0801234567"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>เลขบัญชีธนาคาร (ย่อธนาคาร - เลข - ชื่อ)</label>
            <textarea 
              name="bank_account" 
              value={formData.bank_account} 
              onChange={handleChange} 
              rows="3"
              required
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem", resize: "vertical" }}
              placeholder="KBANK 012-3-45678-9 นายใจดี มีเงินแบ่ง"
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            style={{ marginTop: "10px", padding: "16px", background: "var(--primary)", color: "white", border: "none", borderRadius: "12px", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
          </button>
        </form>
      </div>
    </div>
  );
}
