"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CreateCircle() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dbUser, setDbUser] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    circle_name: "",
    type: "ดอกหัก",
    amount_per_hand: "",
    total_hands: "",
    line_group_url: ""
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

      // Ensure user is registered and get DB data
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
        setDbUser(resData);
      } else {
        setMessage({ type: "error", text: "ไม่สามารถดึงข้อมูลสมาชิกได้" });
      }
      
      setIsInitializing(false);
    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อ LIFF ขัดข้อง" });
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

    // Calculate total amount assuming total_amount = amount_per_hand * total_hands (simplified logic, adjust as needed)
    const amountPerHand = parseFloat(formData.amount_per_hand);
    const totalHands = parseInt(formData.total_hands);
    const totalAmount = amountPerHand * totalHands;

    if (isNaN(amountPerHand) || isNaN(totalHands)) {
      setMessage({ type: "error", text: "กรุณากรอกตัวเลขให้ถูกต้อง" });
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_circle',
          creator_id: dbUser.id,
          circle_name: formData.circle_name,
          type: formData.type,
          amount_per_hand: amountPerHand,
          total_hands: totalHands,
          total_amount: totalAmount,
          line_group_url: formData.line_group_url
        })
      });
      
      const resData = await res.json();
      
      if (resData.status === 'success') {
        setMessage({ type: "success", text: "สร้างวงแชร์สำเร็จ! (ID: " + resData.id + ")" });
        setFormData({
          circle_name: "",
          type: "ดอกหัก",
          amount_per_hand: "",
          total_hands: "",
          line_group_url: ""
        });
      } else {
        setMessage({ type: "error", text: resData.message || "สร้างล้มเหลว" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "มีปัญหาขณะส่งข้อมูล กรุณาลองใหม่" });
    }
    
    setIsSaving(false);
  };

  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container">
          <div className="loader"></div>
          <h3 style={{ color: "var(--primary)" }}>กำลังตรวจสอบสิทธิ์...</h3>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.6rem", margin: 0, color: "var(--foreground)" }}>💰 ตั้งวงแชร์ใหม่</h2>
      </div>

      <div className="glass-panel" style={{ padding: "24px" }}>
        {message.text && (
          <div style={{ padding: "12px", marginBottom: "20px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>ชื่อวงแชร์</label>
            <input 
              type="text" 
              name="circle_name" 
              value={formData.circle_name} 
              onChange={handleChange} 
              required
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
              placeholder="e.g., วงรวยข้ามคืน"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>ประเภทระบบดอก</label>
            <select 
              name="type" 
              value={formData.type} 
              onChange={handleChange}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
            >
              <option value="ดอกหัก">แบบดอกหัก (นิยม)</option>
              <option value="ดอกตาม">แบบดอกตาม</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>ส่งงวดละ (บาท)</label>
              <input 
                type="number" 
                name="amount_per_hand" 
                value={formData.amount_per_hand} 
                onChange={handleChange} 
                required
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
                placeholder="1000"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>จำนวนมือทั้งหมด</label>
              <input 
                type="number" 
                name="total_hands" 
                value={formData.total_hands} 
                onChange={handleChange} 
                required
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem", color: "#475569" }}>ลิงก์เข้ากลุ่มแชท LINE (กรุ๊ปคุยกันในวง)</label>
            <input 
              type="url" 
              name="line_group_url" 
              value={formData.line_group_url} 
              onChange={handleChange} 
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
              placeholder="https://line.me/R/ti/g/..."
            />
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "6px" }}>* เอาลิงก์กลุ่มปกติของคุณมาแปะ ลูกวงจะกดเข้าทางนี้</p>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            style={{ marginTop: "10px", padding: "16px", background: "var(--primary)", color: "white", border: "none", borderRadius: "12px", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? "กำลังสร้างวงแชร์..." : "✨ ยืนยันสร้างวงแชร์"}
          </button>
        </form>
      </div>
    </div>
  );
}
