"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbUser, setDbUser] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Dashboard data
  const [pendingMembers, setPendingMembers] = useState([]);
  const [houseMembers, setHouseMembers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [activeTab, setActiveTab] = useState("pending"); // pending | roles | banks

  // Search state for roles tab
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [roleModal, setRoleModal] = useState({ open: false, member: null, newRole: "" });
  const [bankAssignModal, setBankAssignModal] = useState({ open: false, houseId: "", currentBankId: "", selectedBankId: "" });
  const [bankFormModal, setBankFormModal] = useState({ open: false, mode: "add", bankId: "", bank_name: "", account_no: "", account_name: "" });

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
        router.push('/');
        return;
      }

      const userProfile = await window.liff.getProfile();
      const houseParam = new URLSearchParams(window.location.search).get('house');
      const regRes = await fetch('/api/action', {
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
      const user = await regRes.json();

      if (user.status !== 'success' || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        alert("ไม่มีสิทธิ์เข้าถึง (Access Denied)");
        router.push('/');
        return;
      }

      setDbUser(user);
      fetchDashboard(user.id, user.role);

    } catch (err) {
      setMessage({ type: "error", text: "การเชื่อมต่อขัดข้อง" });
      setIsInitializing(false);
    }
  };

  const fetchDashboard = async (callerId, callerRole) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_admin_dashboard', caller_id: callerId, caller_role: callerRole })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPendingMembers(data.pendingMembers || []);
        setHouseMembers(data.houseMembers || []);
        setBanks(data.banks || []);
      }
    } catch (err) {
      setMessage({ type: "error", text: "ดึงข้อมูลล้มเหลว" });
    }
    setIsInitializing(false);
  };

  const refresh = () => fetchDashboard(dbUser.id, dbUser.role);

  // ============ Handlers ============
  const handleApprove = async (houseId) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_house_member', caller_id: dbUser.id, caller_role: dbUser.role, house_id: houseId, new_status: 'ACTIVE' })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const handleReject = async (houseId) => {
    if (!confirm("ปฏิเสธสมาชิกคนนี้?")) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_house_member', caller_id: dbUser.id, caller_role: dbUser.role, house_id: houseId })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const handleBlock = async (houseId) => {
    if (!confirm("บล็อคสมาชิกคนนี้?")) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_house_member', caller_id: dbUser.id, caller_role: dbUser.role, house_id: houseId, new_status: 'BLOCKED' })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const handleRemove = async (houseId) => {
    if (!confirm("ลบสมาชิกออกจากบ้าน?")) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_house_member', caller_id: dbUser.id, caller_role: dbUser.role, house_id: houseId })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const submitRoleChange = async () => {
    if (!roleModal.newRole || !roleModal.member) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_member_role', caller_id: dbUser.id, caller_role: dbUser.role, member_id: roleModal.member.id, new_role: roleModal.newRole })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      setRoleModal({ open: false, member: null, newRole: "" });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const submitBankAssign = async () => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_member_bank', caller_id: dbUser.id, caller_role: dbUser.role, house_id: bankAssignModal.houseId, bank_id: bankAssignModal.selectedBankId || null })
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      setBankAssignModal({ open: false, houseId: "", currentBankId: "", selectedBankId: "" });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const submitBankForm = async () => {
    const { mode, bankId, bank_name, account_no, account_name } = bankFormModal;
    if (!bank_name || !account_no || !account_name) { setMessage({ type: "error", text: "กรุณากรอกข้อมูลให้ครบ" }); return; }

    const payload = mode === 'add'
      ? { action: 'add_bank', caller_id: dbUser.id, caller_role: dbUser.role, bank_name, account_no, account_name }
      : { action: 'edit_bank', caller_id: dbUser.id, caller_role: dbUser.role, bank_id: bankId, bank_name, account_no, account_name };

    try {
      const res = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      setBankFormModal({ open: false, mode: "add", bankId: "", bank_name: "", account_no: "", account_name: "" });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const handleDeleteBank = async (bankId) => {
    if (!confirm("ลบบัญชีนี้?")) return;
    try {
      const res = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_bank', caller_id: dbUser.id, caller_role: dbUser.role, bank_id: bankId }) });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const handleSetDefault = async (bankId) => {
    try {
      const res = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_default_bank', caller_id: dbUser.id, caller_role: dbUser.role, bank_id: bankId }) });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch { setMessage({ type: "error", text: "ผิดพลาด" }); }
  };

  const handleCopyInviteLink = () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const link = `https://liff.line.me/${liffId}?house=${dbUser.id}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: "success", text: "คัดลอกลิงก์เชิญเข้าบ้านแชร์แล้ว!" });
  };

  // ============ Loading ============
  if (isInitializing) {
    return (
      <div style={{ padding: "20px", minHeight: "100vh" }}>
        <Script src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" onLoad={handleScriptLoad} />
        <div className="loader-container"><div className="loader"></div><h3 style={{ color: "var(--primary)" }}>กำลังตรวจสอบสิทธิ์...</h3></div>
      </div>
    );
  }

  // ============ Filtered members ============
  const filteredMembers = houseMembers.filter(h => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return h.member?.name?.toLowerCase().includes(q) || h.member?.nickname?.toLowerCase().includes(q) || h.member?.phone?.includes(q);
  });

  // Available roles for modal
  const availableRoles = dbUser?.role === 'SUPERADMIN'
    ? ['MEMBER', 'MANAGER', 'ADMIN', 'SUPERADMIN']
    : ['MEMBER', 'MANAGER', 'ADMIN'];

  // ============ TAB CONTENT ============
  const renderPendingTab = () => (
    <div>
      {/* Invite Button */}
      <button onClick={handleCopyInviteLink} style={{ width: "100%", padding: "14px", background: "var(--primary)", color: "white", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", marginBottom: "20px", fontSize: "1rem", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
        🔗 คัดลอกลิงก์เชิญเข้าบ้าน
      </button>

      {pendingMembers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>✅</div>
          <p>ไม่มีรายการรออนุมัติ</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {pendingMembers.map(h => (
            <div key={h.id} className="glass-panel" style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ display: "block", fontSize: "1.05rem" }}>{h.member?.name || "?"}</strong>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>📱 {h.member?.phone || "-"}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => handleApprove(h.id)} style={{ padding: "8px 14px", background: "#dcfce7", color: "#166534", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem" }}>✅ รับ</button>
                <button onClick={() => handleReject(h.id)} style={{ padding: "8px 14px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem" }}>❌ ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRolesTab = () => (
    <div>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "1.1rem", color: "#94a3b8" }}>🔍</span>
        <input
          type="text" placeholder="ค้นหาชื่อ..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
        />
      </div>

      {filteredMembers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <p>ไม่มีสมาชิกในบ้าน</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredMembers.map(h => {
            const m = h.member;
            if (!m) return null;
            const assignedBank = h.bank;
            const isBlocked = h.status === 'BLOCKED';

            return (
              <div key={h.id} className="glass-panel" style={{ padding: "14px", opacity: isBlocked ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{m.name}</strong>
                    {assignedBank && (
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                        🏦 {assignedBank.bank_name} | {assignedBank.account_no}
                      </div>
                    )}
                    {!assignedBank && (
                      <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "2px" }}>
                        ✅ ใช้บัญชีหลัก
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold", background: m.role === 'SUPERADMIN' ? '#fef3c7' : m.role === 'ADMIN' ? '#e0f2fe' : '#f1f5f9', color: m.role === 'SUPERADMIN' ? '#92400e' : m.role === 'ADMIN' ? '#0369a1' : '#475569' }}>
                    {m.role}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button onClick={() => setRoleModal({ open: true, member: m, newRole: m.role })} style={{ padding: "6px 12px", background: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                    👑 ตั้งยศ
                  </button>
                  <button onClick={() => setBankAssignModal({ open: true, houseId: h.id, currentBankId: h.assigned_bank_id || "", selectedBankId: h.assigned_bank_id || "" })} style={{ padding: "6px 12px", background: "#f3e8ff", color: "#7c3aed", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                    🏦 ตั้งบัญชี
                  </button>
                  {!isBlocked ? (
                    <button onClick={() => handleBlock(h.id)} style={{ padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                      🚫 บล็อค
                    </button>
                  ) : (
                    <button onClick={() => handleApprove(h.id)} style={{ padding: "6px 12px", background: "#dcfce7", color: "#166534", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                      🔓 ปลดบล็อค
                    </button>
                  )}
                  <button onClick={() => handleRemove(h.id)} style={{ padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                    🗑️ ลบ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderBanksTab = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontSize: "0.95rem", color: "#64748b" }}>📋 รายการบัญชีธนาคาร</span>
        <button onClick={() => setBankFormModal({ open: true, mode: "add", bankId: "", bank_name: "", account_no: "", account_name: "" })} style={{ padding: "8px 16px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.9rem" }}>
          + เพิ่มบัญชี
        </button>
      </div>

      {banks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🏦</div>
          <p>ยังไม่มีบัญชี กดปุ่ม "เพิ่มบัญชี" ด้านบน</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {banks.map(b => (
            <div key={b.id} className="glass-panel" style={{ padding: "14px", borderLeft: b.is_default ? "4px solid var(--primary)" : "4px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "1.05rem" }}>{b.bank_name}</strong>
                    {b.is_default && <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "4px", background: "#dcfce7", color: "#166534", fontWeight: "bold" }}>✔ บัญชีหลัก</span>}
                    <button onClick={() => { navigator.clipboard.writeText(`${b.bank_name}\n${b.account_no}\n${b.account_name}`); setMessage({ type: "success", text: "คัดลอกข้อมูลบัญชีแล้ว!" }); }} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px", cursor: "pointer", fontSize: "0.75rem", color: "#64748b" }} title="คัดลอกข้อมูลบัญชี">📋</button>
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "var(--primary)", fontFamily: "monospace" }}>{b.account_no}</div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{b.account_name}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {!b.is_default && (
                  <button onClick={() => handleSetDefault(b.id)} style={{ padding: "6px 12px", background: "#fef3c7", color: "#92400e", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                    ⭐ ตั้งเป็นหลัก
                  </button>
                )}
                <button onClick={() => setBankFormModal({ open: true, mode: "edit", bankId: b.id, bank_name: b.bank_name, account_no: b.account_no, account_name: b.account_name })} style={{ padding: "6px 12px", background: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                  ✏️ แก้ไข
                </button>
                <button onClick={() => handleDeleteBank(b.id)} style={{ padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem" }}>
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============ RENDER ============
  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
        <span style={{ fontSize: "2rem" }}>🔧</span>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "var(--foreground)" }}>{dbUser?.name}</h2>
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold", background: "#fef3c7", color: "#92400e" }}>{dbUser?.role}</span>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "4px", fontWeight: "bold", background: "#dcfce7", color: "#166534" }}>{dbUser?.member_status}</span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: "1.1rem", color: "#475569", marginBottom: "16px" }}>🔑 ผู้ดูแลระบบ</p>

      {/* Message */}
      {message.text && (
        <div style={{ padding: "12px", marginBottom: "16px", borderRadius: "8px", background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", textAlign: "center", fontWeight: "600" }}>{message.text}</div>
      )}

      {/* Tab Bar */}
      <div style={{ display: "flex", borderRadius: "14px", overflow: "hidden", marginBottom: "20px", background: "linear-gradient(135deg, #8b5cf6, #a78bfa, #7c3aed)", padding: "6px" }}>
        {[
          { key: "pending", icon: "⏳", label: "รอ", sublabel: "อนุมัติ", count: pendingMembers.length },
          { key: "roles", icon: "👥", label: "จัดการ", sublabel: "สิทธิ์" },
          { key: "banks", icon: "🏦", label: "บัญชี", sublabel: "ธนาคาร" }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "12px 6px", border: "none", borderRadius: "10px", cursor: "pointer",
              background: activeTab === tab.key ? "rgba(255,255,255,0.95)" : "transparent",
              color: activeTab === tab.key ? "#6d28d9" : "rgba(255,255,255,0.9)",
              fontWeight: "bold", textAlign: "center", transition: "all 0.2s ease", position: "relative",
              fontSize: "0.85rem"
            }}
          >
            <div style={{ fontSize: "1.3rem" }}>{tab.icon}</div>
            <div>{tab.label}</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>{tab.sublabel}</div>
            {tab.count > 0 && (
              <span style={{ position: "absolute", top: "4px", right: "8px", background: "#ef4444", color: "white", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: "bold" }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "pending" && renderPendingTab()}
      {activeTab === "roles" && renderRolesTab()}
      {activeTab === "banks" && renderBanksTab()}

      {/* ============ MODALS ============ */}

      {/* Role Change Modal */}
      {roleModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "380px", padding: "24px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>👑 ตั้งยศให้ {roleModal.member?.name}</h3>
            <select value={roleModal.newRole} onChange={e => setRoleModal({ ...roleModal, newRole: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px" }}>
              {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setRoleModal({ open: false, member: null, newRole: "" })} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={submitRoleChange} style={{ flex: 1, padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Assign Modal */}
      {bankAssignModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "380px", padding: "24px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>🏦 กำหนดบัญชีรับโอนให้สมาชิก</h3>
            <select value={bankAssignModal.selectedBankId} onChange={e => setBankAssignModal({ ...bankAssignModal, selectedBankId: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px" }}>
              <option value="">-- ใช้บัญชีหลัก (Default) --</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} | {b.account_no} ({b.account_name})</option>)}
            </select>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setBankAssignModal({ open: false, houseId: "", currentBankId: "", selectedBankId: "" })} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={submitBankAssign} style={{ flex: 1, padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Form Modal (Add / Edit) */}
      {bankFormModal.open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "400px", padding: "24px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>{bankFormModal.mode === 'add' ? '➕ เพิ่มบัญชีธนาคาร' : '✏️ แก้ไขบัญชีธนาคาร'}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", color: "#475569", fontWeight: "600" }}>ชื่อธนาคาร</label>
                <select value={bankFormModal.bank_name} onChange={e => setBankFormModal({ ...bankFormModal, bank_name: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white" }}>
                  <option value="">-- เลือกธนาคาร --</option>
                  <option value="กสิกรไทย (KBANK)">กสิกรไทย (KBANK)</option>
                  <option value="กรุงเทพ (BBL)">กรุงเทพ (BBL)</option>
                  <option value="กรุงไทย (KTB)">กรุงไทย (KTB)</option>
                  <option value="ไทยพาณิชย์ (SCB)">ไทยพาณิชย์ (SCB)</option>
                  <option value="กรุงศรี (BAY)">กรุงศรี (BAY)</option>
                  <option value="ทหารไทยธนชาต (TTB)">ทหารไทยธนชาต (TTB)</option>
                  <option value="ออมสิน (GSB)">ออมสิน (GSB)</option>
                  <option value="ธ.ก.ส. (BAAC)">ธ.ก.ส. (BAAC)</option>
                  <option value="อิสลามแห่งประเทศไทย (ISBT)">อิสลามแห่งประเทศไทย (ISBT)</option>
                  <option value="ซีไอเอ็มบี (CIMB)">ซีไอเอ็มบี (CIMB)</option>
                  <option value="ยูโอบี (UOB)">ยูโอบี (UOB)</option>
                  <option value="แลนด์ แอนด์ เฮ้าส์ (LHBANK)">แลนด์ แอนด์ เฮ้าส์ (LHBANK)</option>
                  <option value="ทิสโก้ (TISCO)">ทิสโก้ (TISCO)</option>
                  <option value="เกียรตินาคินภัทร (KKP)">เกียรตินาคินภัทร (KKP)</option>
                  <option value="อาคารสงเคราะห์ (GHB)">อาคารสงเคราะห์ (GHB)</option>
                  <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", color: "#475569", fontWeight: "600" }}>เลขบัญชี</label>
                <input type="text" value={bankFormModal.account_no} onChange={e => setBankFormModal({ ...bankFormModal, account_no: e.target.value })} placeholder="123-4-56789-0" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", color: "#475569", fontWeight: "600" }}>ชื่อบัญชี</label>
                <input type="text" value={bankFormModal.account_name} onChange={e => setBankFormModal({ ...bankFormModal, account_name: e.target.value })} placeholder="นายท้าว หลัก" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setBankFormModal({ open: false, mode: "add", bankId: "", bank_name: "", account_no: "", account_name: "" })} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={submitBankForm} style={{ flex: 1, padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>{bankFormModal.mode === 'add' ? 'เพิ่มบัญชี' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
