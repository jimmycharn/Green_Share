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
    type: "ประมูล (เปียแข่งดอก)",
    amount_per_hand: "",
    total_hands: "",
    line_group_url: "",
    start_date: new Date().toISOString().split('T')[0]
  });
  
  const [message, setMessage] = useState({ type: "", text: "" });

  // Auto-calculate Total Amount
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (formData.amount_per_hand && formData.total_hands) {
      setTotalAmount(parseFloat(formData.amount_per_hand) * parseInt(formData.total_hands));
    } else {
      setTotalAmount(0);
    }
  }, [formData.amount_per_hand, formData.total_hands]);

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
          line_group_url: formData.line_group_url,
          start_date: formData.start_date
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
    <div className="animate-fade-in" style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
      
      {/* Header Layout from Image 2 */}
      <div style={{ 
        background: "linear-gradient(to right, #48bb78, #38a169)", 
        padding: "30px 24px", 
        borderRadius: "0 0 30px 30px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        boxShadow: "0 4px 15px rgba(56, 161, 105, 0.2)",
        marginBottom: "20px"
      }}>
        <div style={{ 
          background: "rgba(255, 255, 255, 0.2)", 
          padding: "15px", 
          borderRadius: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <span style={{ fontSize: "2rem" }}>👥</span>
        </div>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "800", margin: 0, color: "white" }}>รายละเอียดวงแชร์</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.9)", margin: "4px 0 0 0", fontSize: "0.95rem" }}>กรอกข้อมูลให้ครบถ้วน</p>
        </div>
      </div>

      <div style={{ padding: "0 16px 40px 16px" }}>
        <div className="glass-panel" style={{ padding: "28px 24px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
          {message.text && (
            <div style={{ padding: "14px", marginBottom: "24px", borderRadius: "12px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "700", fontSize: "0.9rem" }}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                <span style={{ fontSize: "1.1rem" }}>🏷️</span> ชื่อวง
              </label>
              <input 
                type="text" 
                name="circle_name" 
                value={formData.circle_name} 
                onChange={handleChange} 
                required
                className="input-glow"
                style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", backgroundColor: "white", outline: "none", transition: "all 0.2s" }}
                placeholder="เช่น วงเพื่อนซี้, วงครอบครัว"
              />
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                <span style={{ fontSize: "1.1rem" }}>⚙️</span> ประเภทวง
              </label>
              <div style={{ position: "relative" }}>
                <select 
                  name="type" 
                  value={formData.type} 
                  onChange={handleChange}
                  className="input-glow"
                  style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", backgroundColor: "white", outline: "none", appearance: "none", backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='currentColor'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpolyline%20points='6%209%2012%2015%2018%209'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center", backgroundSize: "18px" }}
                >
                  <option value="ประมูล (เปียแข่งดอก)">🎯 บิงโก (ประมูลราคาสูงสุด)</option>
                  <option value="ขั้นบันได (ดอกคงที่)">📊 ขั้นบันได (ดอกคงที่)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                  <span style={{ fontSize: "1.1rem" }}>💰</span> งวดละ (บาท)
                </label>
                <input 
                  type="number" 
                  name="amount_per_hand" 
                  value={formData.amount_per_hand} 
                  onChange={handleChange} 
                  required
                  className="input-glow"
                  style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", backgroundColor: "white", outline: "none" }}
                  placeholder="10000"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                  <span style={{ fontSize: "1.1rem" }}>🖐️</span> จำนวนมือ
                </label>
                <input 
                  type="number" 
                  name="total_hands" 
                  value={formData.total_hands} 
                  onChange={handleChange} 
                  required
                  className="input-glow"
                  style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", backgroundColor: "white", outline: "none" }}
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                <span style={{ fontSize: "1.1rem" }}>🧮</span> ยอดรวมทั้งหมด
              </label>
              <div style={{ 
                width: "100%", 
                padding: "20px", 
                borderRadius: "18px", 
                border: "2px dashed #cbd5e1", 
                fontSize: "1.3rem", 
                fontWeight: "700",
                backgroundColor: "#f8fafc",
                textAlign: "center",
                color: totalAmount ? "#10b981" : "#94a3b8"
              }}>
                {totalAmount ? totalAmount.toLocaleString() : "คำนวณอัตโนมัติ"}
              </div>
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                <span style={{ fontSize: "1.1rem" }}>📅</span> วันที่เริ่มต้น
              </label>
              <input 
                type="date" 
                name="start_date" 
                value={formData.start_date} 
                onChange={handleChange} 
                className="input-glow"
                style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", backgroundColor: "white", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: "700", fontSize: "0.9rem", color: "#334155" }}>
                <span style={{ fontSize: "1.1rem" }}>🔗</span> ลิงก์กลุ่มแชท (Line group URL)
              </label>
              <input 
                type="url" 
                name="line_group_url" 
                value={formData.line_group_url} 
                onChange={handleChange} 
                className="input-glow"
                style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "1.5px solid #edf2f7", fontSize: "1rem", backgroundColor: "white", outline: "none" }}
                placeholder="https://line.me/R/ti/g/..."
              />
            </div>

            <button 
              type="submit" 
              disabled={isSaving}
              style={{ 
                marginTop: "10px", 
                padding: "18px", 
                fontSize: "1.2rem", 
                fontWeight: "800",
                background: "linear-gradient(to right, #48bb78, #38a169)",
                color: "white",
                border: "none",
                borderRadius: "20px",
                cursor: "pointer",
                boxShadow: "0 10px 20px rgba(56, 161, 105, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px"
              }}
            >
              {isSaving ? "🔄 กำลังสร้าง..." : <span>➕ สร้างวงแชร์</span>}
            </button>
          </form>

          <div style={{ marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#64748b", fontSize: "0.9rem" }}>
            <span style={{ fontSize: "1.1rem" }}>ℹ️</span>
            <span>หลังสร้างวงแล้วสามารถเพิ่มสมาชิกได้ทันที</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .input-glow:focus {
          border-color: #48bb78 !important;
          box-shadow: 0 0 0 4px rgba(72, 187, 120, 0.1) !important;
        }
      `}</style>
    </div>
  );
}
