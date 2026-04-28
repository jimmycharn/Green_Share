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

  const handleApproveMember = async (houseId, targetName) => {
    if (!window.confirm(`ยืนยันการรับคุณ ${targetName} เข้าบ้านแชร์?`)) return;
    
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_house_member',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          house_id: houseId,
          new_status: 'ACTIVE'
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
      setMessage({ type: "error", text: "อนุมัติสมาชิกล้มเหลว" });
    }
  };

  const handleUpdateRole = async (targetMemberId, newRole) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_member_role',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          member_id: targetMemberId,
          new_role: newRole
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
      setMessage({ type: "error", text: "เปลี่ยนยศล้มเหลว" });
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

      {/* 1. Tabs Selection at the TOP (Only for Superadmin) */}
      {dbUser.role === 'SUPERADMIN' && (
        <div style={{ 
          display: "flex", gap: "0", marginBottom: "24px", 
          background: "#334155", padding: "6px", borderRadius: "20px",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <button 
            onClick={() => setActiveTab("my_house")}
            style={{ 
              flex: 1, padding: "12px", borderRadius: "15px", border: "none", 
              background: activeTab === 'my_house' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'my_house' ? 'white' : '#94a3b8',
              fontWeight: "700", transition: "0.3s", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
            }}
          >
            🏠 บ้านแชร์ฉัน
          </button>
          <button 
            onClick={() => setActiveTab("other_houses")}
            style={{ 
              flex: 1, padding: "12px", borderRadius: "15px", border: "none", 
              background: activeTab === 'other_houses' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'other_houses' ? 'white' : '#94a3b8',
              fontWeight: "700", transition: "0.3s", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
            }}
          >
            🏘️ บ้านแชร์อื่น
          </button>
        </div>
      )}

      {/* 2. Invite Section (Only shows in My House or for regular Admins) */}
      {(activeTab === 'my_house' || dbUser.role === 'ADMIN') && (
        <div className="glass-panel" style={{ textAlign: "center", marginBottom: "32px", border: "1px dashed var(--primary)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🤝</div>
          <h3 style={{ marginBottom: "8px", fontSize: "1.2rem", fontWeight: "700" }}>ชวนเพื่อนเข้าบ้าน</h3>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px", padding: "0 20px" }}>ส่งลิงก์ให้เพื่อนเพื่อเข้าร่วมเป็นสมาชิกในบ้านแชร์ของคุณ</p>
          <button onClick={handleCopyInviteLink} className="btn-primary" style={{ width: "100%" }}>🔗 คัดลอกลิงก์เชิญ</button>
        </div>
      )}

      {isLoadingMembers ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>กำลังโหลด...</div>
      ) : activeTab === 'my_house' ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "800", marginBottom: "8px", color: "#f8fafc" }}>ท้าวแชร์</h3>
          {/* Superadmin Card (Self) */}
          <MemberCard member={dbUser} isSelf={true} />
          
          <h3 style={{ fontSize: "1.1rem", fontWeight: "800", marginTop: "24px", marginBottom: "8px", color: "#f8fafc" }}>
            ลูกบ้าน ({myHouseMembers.length})
          </h3>
          {myHouseMembers.map(m => (
            <MemberCard 
              key={m.id} 
              member={m} 
              dbUser={dbUser} 
              handleApprove={handleApproveMember} 
              handleDelete={handleDeleteMember}
              handleUpdateRole={handleUpdateRole}
            />
          ))}
          {myHouseMembers.length === 0 && <div style={{ textAlign: "center", padding: "30px", color: "#64748b", background: "rgba(255,255,255,0.05)", borderRadius: "20px" }}>ยังไม่มีลูกบ้าน</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "800", marginBottom: "12px", color: "#f8fafc" }}>ท้าวแชร์ท่านอื่น ({otherAdmins.length})</h3>
          {otherAdmins.map(admin => (
            <div key={admin.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div 
                onClick={() => setExpandedAdmin(expandedAdmin === admin.id ? null : admin.id)}
                className="glass-panel" 
                style={{ 
                  padding: "20px", cursor: "pointer", 
                  background: expandedAdmin === admin.id ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.05)",
                  border: expandedAdmin === admin.id ? "2px solid var(--primary)" : "1px solid var(--glass-border)",
                  transition: "0.3s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "50px", height: "50px", borderRadius: "15px", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", color: "white" }}>👑</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "800", fontSize: "1.1rem" }}>{admin.house_name || admin.name}</div>
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{admin.nickname} ({admin.name})</div>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "700" }}>ท้าวแชร์</div>
                  <div style={{ fontSize: "1.2rem", transform: expandedAdmin === admin.id ? "rotate(180deg)" : "rotate(0deg)", transition: "0.3s", marginLeft: "10px" }}>⌄</div>
                </div>
              </div>
              
              {/* Accordion Content */}
              {expandedAdmin === admin.id && (
                <div className="animate-slide-up" style={{ paddingLeft: "20px", borderLeft: "3px solid var(--primary)", display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px", marginBottom: "20px" }}>
                  {getMembersByAdmin(admin.id).map(m => (
                    <MemberCard 
                      key={m.id} 
                      member={m} 
                      dbUser={dbUser} 
                      handleApprove={handleApproveMember} 
                      handleDelete={handleDeleteMember}
                      handleUpdateRole={handleUpdateRole}
                      mini={true}
                    />
                  ))}
                  {getMembersByAdmin(admin.id).length === 0 && <div style={{ fontSize: "0.9rem", color: "#64748b", padding: "15px", background: "rgba(255,255,255,0.02)", borderRadius: "15px" }}>ยังไม่มีลูกวง</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reusable Member Card Component
function MemberCard({ member, dbUser, handleApprove, handleDelete, handleUpdateRole, isSelf = false, mini = false }) {
  return (
    <div className="glass-panel" style={{ 
      padding: mini ? "14px" : "18px", 
      display: "flex", 
      alignItems: "center", 
      gap: mini ? "12px" : "18px",
      background: isSelf ? "rgba(16, 185, 129, 0.05)" : "rgba(255,255,255,0.05)"
    }}>
      <div style={{ 
        width: mini ? "40px" : "50px", height: mini ? "40px" : "50px", 
        borderRadius: "15px", background: isSelf ? "var(--primary-gradient)" : "#1e293b", 
        display: "flex", alignItems: "center", justifyContent: "center", 
        fontSize: mini ? "1.1rem" : "1.3rem", border: "1px solid var(--glass-border)", color: "white"
      }}>
        {isSelf || member.role === 'ADMIN' ? "👑" : "👤"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: "800", fontSize: mini ? "0.95rem" : "1.05rem", color: "#f8fafc" }}>
          {member.nickname || member.name} {isSelf && "(ฉัน)"}
        </div>
        {!mini && <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>📞 {member.phone || "ไม่ระบุ"}</div>}
      </div>
      <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--primary)", marginBottom: "4px" }}>
            {['SUPERADMIN', 'ADMIN'].includes(member.role) ? 'ท้าวแชร์' : (member.house_status === 'PENDING' ? 'รออนุมัติ' : 'สมาชิก')}
          </div>
          
          {/* Role Selector */}
          {!isSelf && dbUser?.role === 'SUPERADMIN' && member.house_status === 'ACTIVE' && (
            <select 
              value={member.role} 
              onChange={(e) => handleUpdateRole(member.id, e.target.value)}
              style={{ 
                display: "block", fontSize: "0.75rem", marginTop: "4px", padding: "4px 8px", 
                borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "white"
              }}
            >
              <option value="MEMBER">MEMBER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          )}
        </div>
        
        {!isSelf && member.house_status === 'PENDING' && ['SUPERADMIN', 'ADMIN'].includes(dbUser?.role) && (
          <button onClick={() => handleApprove(member.house_id, member.name)} className="btn-approve-mini">อนุมัติ</button>
        )}

        {!isSelf && ['SUPERADMIN', 'ADMIN'].includes(dbUser?.role) && (
          <button onClick={() => handleDelete(member.id, member.name)} className="btn-delete-mini">🗑️</button>
        )}
      </div>
      <style jsx>{`
        .btn-approve-mini { background: #dcfce7; color: #166534; border: none; padding: 8px 12px; borderRadius: 10px; cursor: pointer; fontSize: 0.75rem; fontWeight: 800; }
        .btn-delete-mini { background: #fee2e2; color: #ef4444; border: none; padding: 8px; borderRadius: 10px; cursor: pointer; display: flex; alignItems: center; justifyContent: center; }
      `}</style>
    </div>
  );
}

