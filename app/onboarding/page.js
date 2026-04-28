"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

export default function Onboarding() {
  const router = useRouter();
  const { dbUser, profile, isLoading: isUserLoading } = useUser();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    phone: "",
    bank_account: "",
    role: "MEMBER", // MEMBER or ADMIN
    house_name: "",
    house_code: "" // admin_id to join
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (dbUser && dbUser.member_status === 'ACTIVE' && dbUser.phone) {
       // Already onboarded
       router.push("/");
    }
    if (dbUser) {
      setFormData(prev => ({
        ...prev,
        name: dbUser.name || prev.name,
        nickname: dbUser.nickname || prev.nickname
      }));
    }
  }, [dbUser, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_onboarding",
          member_id: dbUser.id,
          ...formData
        })
      });
      const data = await res.json();
      
      if (data.status === "success") {
        window.location.href = "/"; // Refresh and go home
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || !dbUser) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: "var(--primary)" }}>กำลังโหลด...</h3>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: "20px 0", maxWidth: "500px", margin: "0 auto" }}>
      <div className="glass-panel" style={{ padding: "32px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>👋</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "8px" }}>ยินดีต้อนรับสู่ GreenShare</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>กรุณากรอกข้อมูลเพื่อเริ่มต้นใช้งานระบบ</p>
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "20px", fontSize: "0.85rem", fontWeight: "600", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="form-group">
            <label>ชื่อ-นามสกุล</label>
            <input 
              type="text" 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="กรอกชื่อ-นามสกุลจริง"
            />
          </div>

          <div className="form-group">
            <label>ชื่อเล่น</label>
            <input 
              type="text" 
              required 
              value={formData.nickname} 
              onChange={e => setFormData({...formData, nickname: e.target.value})}
              placeholder="ชื่อเล่นของคุณ"
            />
          </div>

          <div className="form-group">
            <label>เบอร์โทรศัพท์</label>
            <input 
              type="tel" 
              required 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="08X-XXXXXXX"
            />
          </div>

          <div className="form-group">
            <label>บทบาทการใช้งาน</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
              <div 
                onClick={() => setFormData({...formData, role: "MEMBER"})}
                style={{ 
                  padding: "16px", borderRadius: "12px", border: `2px solid ${formData.role === 'MEMBER' ? 'var(--primary)' : 'var(--glass-border)'}`,
                  background: formData.role === 'MEMBER' ? 'rgba(16, 185, 129, 0.05)' : 'none', textAlign: "center", cursor: "pointer", transition: "0.2s"
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>👤</div>
                <div style={{ fontWeight: "700", marginTop: "8px" }}>สมาชิกวง</div>
              </div>
              <div 
                onClick={() => setFormData({...formData, role: "ADMIN"})}
                style={{ 
                  padding: "16px", borderRadius: "12px", border: `2px solid ${formData.role === 'ADMIN' ? 'var(--primary)' : 'var(--glass-border)'}`,
                  background: formData.role === 'ADMIN' ? 'rgba(16, 185, 129, 0.05)' : 'none', textAlign: "center", cursor: "pointer", transition: "0.2s"
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>🏠</div>
                <div style={{ fontWeight: "700", marginTop: "8px" }}>ท้าวแชร์</div>
              </div>
            </div>
          </div>

          {formData.role === 'ADMIN' ? (
            <div className="form-group animate-fade-in">
              <label>ชื่อบ้านแชร์</label>
              <input 
                type="text" 
                required 
                value={formData.house_name} 
                onChange={e => setFormData({...formData, house_name: e.target.value})}
                placeholder="ชื่อบ้านแชร์ของคุณ (เปลี่ยนได้ภายหลัง)"
              />
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "6px" }}>* ระบบจะส่งคำขอไปหา Superadmin เพื่ออนุมัติเปิดบ้าน</p>
            </div>
          ) : (
            <div className="form-group animate-fade-in">
              <label>รหัสบ้านแชร์ (House Code)</label>
              <input 
                type="text" 
                required 
                value={formData.house_code} 
                onChange={e => setFormData({...formData, house_code: e.target.value})}
                placeholder="กรอกรหัสของท้าวแชร์ เช่น M0001"
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="btn-primary" 
            style={{ marginTop: "12px", width: "100%", height: "50px", fontSize: "1.1rem" }}
          >
            {isSubmitting ? "กำลังบันทึก..." : "เสร็จสิ้นการลงทะเบียน"}
          </button>
        </form>
      </div>
    </div>
  );
}
