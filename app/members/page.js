"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

export default function Members() {
  const router = useRouter();
  const { dbUser, isLoading: isUserLoading } = useUser();
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (dbUser) {
      fetchMembers(dbUser.id);
    }
  }, [dbUser]);

  const fetchMembers = async (memberId) => {
    setIsLoadingMembers(true);
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
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleDeleteMember = async (targetMemberId, targetName) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคุณ ${targetName} ออกจากระบบโดยสมบูรณ์?`)) return;
    
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_delete_member',
          caller_role: dbUser.role,
          member_id: targetMemberId
        })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setMessage({ type: "success", text: data.message });
        fetchMembers(dbUser.id);
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "ลบสมาชิกล้มเหลว" });
    }
  };

  const handleCopyInviteLink = () => {
    if (!dbUser) return;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const link = `https://liff.line.me/${liffId}?house=${dbUser.id}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: "success", text: "คัดลอกลิงก์สำเร็จ ส่งชวนเพื่อนในไลน์ได้เลย!" });
  };

  if (isUserLoading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: "var(--primary)" }}>กำลังโหลด...</h3>
      </div>
    );
  }

  if (!dbUser) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h3 style={{ color: "#64748b" }}>กรุณาเข้าสู่ระบบเพื่อดูข้อมูลสมาชิก</h3>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
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
        {isLoadingMembers ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            กำลังโหลดสมาชิก...
          </div>
        ) : members.length === 0 ? (
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
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ textAlign: "right" }}>
                  <span className={m.status === 'ACTIVE' ? "badge badge-success" : "badge-warning"} style={{ fontSize: "0.65rem" }}>
                    {m.status}
                  </span>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px", fontWeight: "600" }}>{m.role}</div>
                </div>
                
                {/* Delete Button for Admins (not for themselves) */}
                {['SUPERADMIN', 'ADMIN'].includes(dbUser.role) && m.id !== dbUser.id && (
                  <button 
                    onClick={() => handleDeleteMember(m.id, m.name)}
                    style={{ 
                      background: "#fee2e2", 
                      color: "#ef4444", 
                      border: "none", 
                      padding: "8px", 
                      borderRadius: "8px", 
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#fecaca"}
                    onMouseOut={(e) => e.currentTarget.style.background = "#fee2e2"}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

