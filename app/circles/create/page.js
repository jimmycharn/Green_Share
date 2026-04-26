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
        window.liff.login();
        return;
      }
      
      const userProfile = await window.liff.getProfile();

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
        setMessage({ type: "success", text: "สร้างวงแชร์สำเร็จ! กำลังพาทีมไปดูวงใหม่..." });
        setTimeout(() => {
            router.push(`/circles/${resData.id}`);
        }, 1500);
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
          <h3 style={{ color: "var(--primary)" }}>กำลังเตรียมความพร้อม...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
      
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: "800", margin: 0 }}>💰 ตั้งวงแชร์ใหม่</h2>
        <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.9rem" }}>เริ่มต้นความรวยไปด้วยกัน เตรียมข้อมูลให้พร้อม</p>
      </div>

      <div className="glass-panel" style={{ padding: "28px 24px" }}>
        {message.text && (
          <div style={{ padding: "14px", marginBottom: "24px", borderRadius: "12px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "700", fontSize: "0.9rem" }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ชื่อวงแชร์</label>
            <input 
              type="text" 
              name="circle_name" 
              value={formData.circle_name} 
              onChange={handleChange} 
              required
              className="glass-panel"
              style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
              placeholder="เช่น วงรวยข้ามปี, เพื่อนรักหักเหลี่ยมโหด"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ประเภทระบบดอก</label>
            <select 
              name="type" 
              value={formData.type} 
              onChange={handleChange}
              className="glass-panel"
              style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)", appearance: "none" }}
            >
              <option value="ดอกหัก">แบบดอกหัก (นิยม)</option>
              <option value="ดอกตาม">แบบดอกตาม</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ส่งงวดละ (บาท)</label>
              <input 
                type="number" 
                name="amount_per_hand" 
                value={formData.amount_per_hand} 
                onChange={handleChange} 
                required
                className="glass-panel"
                style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
                placeholder="1000"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>จำนวนมือ</label>
              <input 
                type="number" 
                name="total_hands" 
                value={formData.total_hands} 
                onChange={handleChange} 
                required
                className="glass-panel"
                style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "0.85rem", color: "#64748b" }}>ลิงก์กลุ่มแชท (LINE Group URL)</label>
            <input 
              type="url" 
              name="line_group_url" 
              value={formData.line_group_url} 
              onChange={handleChange} 
              className="glass-panel"
              style={{ width: "100%", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", background: "rgba(255,255,255,0.5)" }}
              placeholder="https://line.me/R/ti/g/..."
            />
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "8px", fontStyle: "italic" }}>* ลูกวงจะกดเข้ากลุ่มแชทผ่านลิงก์ที่ระบุนี้</p>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-primary"
            style={{ marginTop: "12px", padding: "18px", fontSize: "1.1rem" }}
          >
            {isSaving ? "🔄 กำลังเนรมิตวงแชร์..." : "✨ ยืนยันเปิดวงใหม่"}
          </button>
        </form>
      </div>

      <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>เมื่อกดสร้างแล้ว จะไม่สามารถเปลี่ยน 'ประเภทเดี๋ยวดอก' ได้<br/>กรุณาตรวจสอบข้อมูลให้ถูกต้อง</p>
      </div>
    </div>
  );
}
