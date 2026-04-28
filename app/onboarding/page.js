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
    <div className="onboarding-container animate-fade-in">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-icon">✨</div>
          <h2>ข้อมูลส่วนตัว</h2>
          <p>กรุณากรอกข้อมูลให้ครบถ้วนเพื่อเปิดบัญชี GreenShare</p>
        </div>

        {error && (
          <div className="error-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="input-group-grid">
            <div className="form-group">
              <label>ชื่อ-นามสกุล</label>
              <input 
                type="text" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="ชื่อจริงของคุณ"
              />
            </div>

            <div className="form-group">
              <label>ชื่อเล่น</label>
              <input 
                type="text" 
                required 
                value={formData.nickname} 
                onChange={e => setFormData({...formData, nickname: e.target.value})}
                placeholder="ชื่อเรียกสั้นๆ"
              />
            </div>
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
            <label>เลขบัญชีธนาคาร (สำหรับรับเงิน)</label>
            <input 
              type="text" 
              required 
              value={formData.bank_account} 
              onChange={e => setFormData({...formData, bank_account: e.target.value})}
              placeholder="เช่น กสิกร 123-4-56789-0"
            />
          </div>

          <div className="role-selection">
            <label style={{ display: "block", marginBottom: "12px", fontWeight: "600", fontSize: "0.9rem" }}>คุณต้องการสมัครในฐานะใด?</label>
            <div className="role-options">
              <div 
                className={`role-card ${formData.role === 'MEMBER' ? 'active' : ''}`}
                onClick={() => setFormData({...formData, role: "MEMBER"})}
              >
                <div className="role-icon">👤</div>
                <div className="role-text">สมาชิกวง</div>
                <div className="role-check">✓</div>
              </div>
              <div 
                className={`role-card ${formData.role === 'ADMIN' ? 'active' : ''}`}
                onClick={() => setFormData({...formData, role: "ADMIN"})}
              >
                <div className="role-icon">🏠</div>
                <div className="role-text">ท้าวแชร์</div>
                <div className="role-check">✓</div>
              </div>
            </div>
          </div>

          {formData.role === 'ADMIN' ? (
            <div className="form-group animate-slide-up">
              <label>ชื่อบ้านแชร์ของคุณ</label>
              <input 
                type="text" 
                required 
                value={formData.house_name} 
                onChange={e => setFormData({...formData, house_name: e.target.value})}
                placeholder="เช่น บ้านแชร์เงินล้าน"
              />
              <span className="input-hint">ชื่อนี้จะแสดงให้ลูกวงเห็นในหน้าแรก</span>
            </div>
          ) : (
            <div className="form-group animate-slide-up">
              <label>รหัสบ้านแชร์ (รับจากท้าวแชร์)</label>
              <input 
                type="text" 
                required 
                value={formData.house_code} 
                onChange={e => setFormData({...formData, house_code: e.target.value})}
                placeholder="กรอกรหัส 5 หลัก (เช่น M0001)"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="btn-submit"
          >
            {isSubmitting ? (
              <span className="btn-loader"></span>
            ) : "บันทึกข้อมูลและเข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
  );
}
