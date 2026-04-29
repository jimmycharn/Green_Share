'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { authHeaders } from '@/lib/authHeaders';

export default function AdminDashboard() {
  const router = useRouter();
  const { dbUser, isLoading: isUserLoading } = useUser();
  const [message, setMessage] = useState({ type: '', text: '' });

  // Dashboard data
  const [pendingMembers, setPendingMembers] = useState([]);
  const [houseMembers, setHouseMembers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // pending | roles | banks

  // Search state for roles tab
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [roleModal, setRoleModal] = useState({ open: false, member: null, newRole: '' });
  const [bankAssignModal, setBankAssignModal] = useState({
    open: false,
    houseId: '',
    currentBankId: '',
    selectedBankId: '',
  });
  const [bankFormModal, setBankFormModal] = useState({
    open: false,
    mode: 'add',
    bankId: '',
    bank_name: '',
    account_no: '',
    account_name: '',
  });

  useEffect(() => {
    if (dbUser) {
      if (!['ADMIN', 'SUPERADMIN'].includes(dbUser.role)) {
        alert('ไม่มีสิทธิ์เข้าถึง (Access Denied)');
        router.push('/');
        return;
      }
      fetchDashboard(dbUser.id, dbUser.role);
    }
  }, [dbUser, router]);

  const fetchDashboard = async (callerId, callerRole) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'get_admin_dashboard',
          caller_id: callerId,
          caller_role: callerRole,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPendingMembers(data.pendingMembers || []);
        setHouseMembers(data.houseMembers || []);
        setBanks(data.banks || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'ดึงข้อมูลล้มเหลว' });
    }
  };

  const refresh = () => fetchDashboard(dbUser.id, dbUser.role);

  // ============ Handlers ============
  const handleApprove = async (houseId) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'approve_house_member',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          house_id: houseId,
          new_status: 'ACTIVE',
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const handleReject = async (houseId) => {
    if (!confirm('ปฏิเสธสมาชิกคนนี้?')) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'remove_house_member',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          house_id: houseId,
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const handleBlock = async (houseId) => {
    if (!confirm('บล็อกสมาชิกคนนี้?')) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'approve_house_member',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          house_id: houseId,
          new_status: 'BLOCKED',
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const handleRemove = async (houseId) => {
    if (!confirm('ลบสมาชิกออกจากบ้าน?')) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'remove_house_member',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          house_id: houseId,
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const submitRoleChange = async () => {
    if (!roleModal.newRole || !roleModal.member) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'update_member_role',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          member_id: roleModal.member.id,
          new_role: roleModal.newRole,
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      setRoleModal({ open: false, member: null, newRole: '' });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const submitBankAssign = async () => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'assign_member_bank',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          house_id: bankAssignModal.houseId,
          bank_id: bankAssignModal.selectedBankId || null,
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      setBankAssignModal({ open: false, houseId: '', currentBankId: '', selectedBankId: '' });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const submitBankForm = async () => {
    const { mode, bankId, bank_name, account_no, account_name } = bankFormModal;
    if (!bank_name || !account_no || !account_name) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }

    const payload =
      mode === 'add'
        ? {
            action: 'add_bank',
            caller_id: dbUser.id,
            caller_role: dbUser.role,
            bank_name,
            account_no,
            account_name,
          }
        : {
            action: 'edit_bank',
            caller_id: dbUser.id,
            caller_role: dbUser.role,
            bank_id: bankId,
            bank_name,
            account_no,
            account_name,
          };

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      setBankFormModal({
        open: false,
        mode: 'add',
        bankId: '',
        bank_name: '',
        account_no: '',
        account_name: '',
      });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const handleDeleteBank = async (bankId) => {
    if (!confirm('ลบบัญชีนี้?')) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'delete_bank',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          bank_id: bankId,
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const handleSetDefault = async (bankId) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'set_default_bank',
          caller_id: dbUser.id,
          caller_role: dbUser.role,
          bank_id: bankId,
        }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      if (data.status === 'success') refresh();
    } catch {
      setMessage({ type: 'error', text: 'ผิดพลาด' });
    }
  };

  const handleCopyInviteLink = () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const link = `https://liff.line.me/${liffId}?house=${dbUser.id}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: 'success', text: 'คัดลอกลิงก์เชิญเข้าบ้านแชร์แล้ว!' });
  };

  // ============ Loading ============
  if (isUserLoading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: 'var(--primary)' }}>กำลังตรวจสอบสิทธิ์ Admin...</h3>
      </div>
    );
  }

  if (!dbUser) return null;

  // ============ Filtered members ============
  const filteredMembers = houseMembers.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.member?.name?.toLowerCase().includes(q) ||
      h.member?.nickname?.toLowerCase().includes(q) ||
      h.member?.phone?.includes(q)
    );
  });

  // Available roles for modal
  const availableRoles =
    dbUser?.role === 'SUPERADMIN'
      ? ['MEMBER', 'MANAGER', 'ADMIN', 'SUPERADMIN']
      : ['MEMBER', 'MANAGER', 'ADMIN'];

  // ============ TAB CONTENT ============
  const renderPendingTab = () => (
    <div className="animate-fade-in">
      <div
        className="glass-panel"
        style={{
          textAlign: 'center',
          marginBottom: '24px',
          padding: '24px',
          border: '1px dashed var(--primary)',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0' }}>ชวนสมาชิกใหม่</h4>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
          ส่งลิงก์ให้สมาชิกเพื่อขอเข้าร่วมบ้านแชร์ของคุณ
        </p>
        <button onClick={handleCopyInviteLink} className="btn-primary" style={{ width: '100%' }}>
          🔗 คัดลอกลิงก์เชิญ
        </button>
      </div>

      {pendingMembers.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h3 style={{ margin: 0, color: '#94a3b8' }}>ไม่มีรายการรออนุมัติ</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingMembers.map((h) => (
            <div
              key={h.id}
              className="glass-panel"
              style={{
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>
                  {h.member?.name || 'ไม่ระบุชื่อ'}
                </strong>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  📱 {h.member?.phone || '-'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleApprove(h.id)}
                  className="badge badge-success"
                  style={{ border: 'none', cursor: 'pointer', padding: '8px 16px' }}
                >
                  อนุมัติ
                </button>
                <button
                  onClick={() => handleReject(h.id)}
                  className="badge badge-danger"
                  style={{ border: 'none', cursor: 'pointer', padding: '8px 16px' }}
                >
                  ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRolesTab = () => (
    <div className="animate-fade-in">
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="🔍 ค้นหาสมาชิก (ชื่อ, เบอร์โทร)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-panel"
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
          }}
        />
      </div>

      {filteredMembers.length === 0 ? (
        <div
          className="glass-panel"
          style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}
        >
          <p>ไม่พบสมาชิกตามเงื่อนไข</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredMembers.map((h) => {
            const m = h.member;
            if (!m) return null;
            const assignedBank = h.bank;
            const isBlocked = h.status === 'BLOCKED';

            return (
              <div
                key={h.id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  opacity: isBlocked ? 0.6 : 1,
                  borderLeft: isBlocked ? '4px solid #ef4444' : '1px solid var(--glass-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{m.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      {assignedBank
                        ? `🏦 ${assignedBank.bank_name} (${assignedBank.account_no})`
                        : '✅ ใช้บัญชีหลักของบ้าน'}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: 'var(--background)',
                      color: 'var(--primary)',
                      border: '1px solid var(--primary)',
                    }}
                  >
                    {m.role}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => setRoleModal({ open: true, member: m, newRole: m.role })}
                    className="btn-primary"
                    style={{
                      padding: '10px',
                      fontSize: '0.75rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#2563eb',
                      boxShadow: 'none',
                    }}
                  >
                    👑 ปรับตำแหน่ง
                  </button>
                  <button
                    onClick={() =>
                      setBankAssignModal({
                        open: true,
                        houseId: h.id,
                        currentBankId: h.assigned_bank_id || '',
                        selectedBankId: h.assigned_bank_id || '',
                      })
                    }
                    className="btn-primary"
                    style={{
                      padding: '10px',
                      fontSize: '0.75rem',
                      background: 'rgba(139, 92, 246, 0.1)',
                      color: '#7c3aed',
                      boxShadow: 'none',
                    }}
                  >
                    🏦 เลือกธนาคาร
                  </button>
                  {!isBlocked ? (
                    <button
                      onClick={() => handleBlock(h.id)}
                      className="btn-primary"
                      style={{
                        padding: '10px',
                        fontSize: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#dc2626',
                        boxShadow: 'none',
                      }}
                    >
                      🚫 บล็อก
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(h.id)}
                      className="btn-primary"
                      style={{
                        padding: '10px',
                        fontSize: '0.75rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#059669',
                        boxShadow: 'none',
                      }}
                    >
                      🔓 ปลดล็อก
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(h.id)}
                    className="btn-primary"
                    style={{
                      padding: '10px',
                      fontSize: '0.75rem',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      boxShadow: 'none',
                    }}
                  >
                    🗑️ ลบออก
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
    <div className="animate-fade-in">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>บัญชีรับเงินของบ้าน</h3>
        <button
          onClick={() =>
            setBankFormModal({
              open: true,
              mode: 'add',
              bankId: '',
              bank_name: '',
              account_no: '',
              account_name: '',
            })
          }
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          + เพิ่มบัญชี
        </button>
      </div>

      {banks.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: '#94a3b8' }}>ยังไม่มีข้อมูลบัญชีธนาคาร</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {banks.map((b) => (
            <div
              key={b.id}
              className="glass-panel"
              style={{
                padding: '20px',
                borderLeft: b.is_default ? '6px solid var(--primary)' : '6px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1.1rem' }}>{b.bank_name}</strong>
                    {b.is_default && (
                      <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>
                        หลัก
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      color: 'var(--primary)',
                      margin: '4px 0',
                    }}
                  >
                    {b.account_no}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{b.account_name}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${b.bank_name}\n${b.account_no}\n${b.account_name}`
                    );
                    setMessage({ type: 'success', text: 'คัดลอกข้อมูลบัญชีแล้ว' });
                  }}
                  className="glass-panel"
                  style={{
                    padding: '10px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  📋
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {!b.is_default && (
                  <button
                    onClick={() => handleSetDefault(b.id)}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '0.75rem',
                      background: 'none',
                      border: '1px solid var(--primary)',
                      color: 'var(--primary)',
                      boxShadow: 'none',
                    }}
                  >
                    ⭐ ตั้งเป็นหลัก
                  </button>
                )}
                <button
                  onClick={() =>
                    setBankFormModal({
                      open: true,
                      mode: 'edit',
                      bankId: b.id,
                      bank_name: b.bank_name,
                      account_no: b.account_no,
                      account_name: b.account_name,
                    })
                  }
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '0.75rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#2563eb',
                    boxShadow: 'none',
                  }}
                >
                  ✏️ แก้ไข
                </button>
                <button
                  onClick={() => handleDeleteBank(b.id)}
                  className="btn-primary"
                  style={{
                    padding: '10px',
                    fontSize: '0.75rem',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    boxShadow: 'none',
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      {/* Admin Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '20px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)',
          }}
        >
          🛠️
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>แผงควบคุมแอดมิน</h2>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            จัดการสมาชิกและบัญชีธนาคารของบ้าน
          </div>
        </div>
      </div>

      {message.text && (
        <div
          style={{
            padding: '12px',
            marginBottom: '24px',
            borderRadius: '12px',
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            textAlign: 'center',
            fontWeight: '600',
            fontSize: '0.85rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Modern Admin Navigation */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '24px',
          padding: '6px',
          borderRadius: '18px',
          background: 'rgba(255,255,255,0.8)',
        }}
      >
        {[
          { id: 'pending', label: 'รออนุมัติ', icon: '⏳', count: pendingMembers.length },
          { id: 'roles', label: 'สมาชิก', icon: '👥' },
          { id: 'banks', label: 'ธนาคาร', icon: '🏦' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '14px',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              background: activeTab === tab.id ? 'var(--primary-gradient)' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              position: 'relative',
            }}
          >
            <span style={{ marginRight: '4px' }}>{tab.icon}</span> {tab.label}
            {tab.count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '18px',
                  height: '18px',
                  fontSize: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {activeTab === 'pending' && renderPendingTab()}
      {activeTab === 'roles' && renderRolesTab()}
      {activeTab === 'banks' && renderBanksTab()}

      {/* Modals */}
      {roleModal.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '400px', padding: '30px' }}
          >
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>👑 ปรับตำแหน่ง</h3>
            <p
              style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.9rem',
                marginBottom: '24px',
              }}
            >
              เลือกตำแหน่งใหม่ให้คุณ <strong>{roleModal.member?.name}</strong>
            </p>

            <select
              value={roleModal.newRole}
              onChange={(e) => setRoleModal({ ...roleModal, newRole: e.target.value })}
              className="glass-panel"
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '24px',
                border: '1px solid #e2e8f0',
              }}
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setRoleModal({ open: false, member: null, newRole: '' })}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: 'none',
                  fontWeight: '700',
                }}
              >
                ยกเลิก
              </button>
              <button onClick={submitRoleChange} className="btn-primary" style={{ flex: 1 }}>
                ยืนยันเปลี่ยน
              </button>
            </div>
          </div>
        </div>
      )}

      {bankAssignModal.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '400px', padding: '30px' }}
          >
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>🏦 กำหนดบัญชีธนาคาร</h3>
            <p
              style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.9rem',
                marginBottom: '24px',
              }}
            >
              เลือกบัญชีที่จะให้สมาชิกคนนี้โอนเงินเข้า
            </p>

            <select
              value={bankAssignModal.selectedBankId}
              onChange={(e) =>
                setBankAssignModal({ ...bankAssignModal, selectedBankId: e.target.value })
              }
              className="glass-panel"
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '24px',
                border: '1px solid #e2e8f0',
              }}
            >
              <option value="">-- ใช้บัญชีหลักของบ้าน --</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} | {b.account_no}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() =>
                  setBankAssignModal({
                    open: false,
                    houseId: '',
                    currentBankId: '',
                    selectedBankId: '',
                  })
                }
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: 'none',
                  fontWeight: '700',
                }}
              >
                ยกเลิก
              </button>
              <button onClick={submitBankAssign} className="btn-primary" style={{ flex: 1 }}>
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {bankFormModal.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{ width: '100%', maxWidth: '420px', padding: '30px' }}
          >
            <h3 style={{ textAlign: 'center', marginBottom: '24px' }}>
              {bankFormModal.mode === 'add' ? '➕ เพิ่มบัญชีใหม่' : '✏️ แก้ไขข้อมูลบัญชี'}
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#64748b',
                  }}
                >
                  เลือกธนาคาร
                </label>
                <select
                  value={bankFormModal.bank_name}
                  onChange={(e) =>
                    setBankFormModal({ ...bankFormModal, bank_name: e.target.value })
                  }
                  className="glass-panel"
                  style={{ width: '100%', padding: '12px' }}
                >
                  <option value="">-- เลือกธนาคาร --</option>
                  <option value="กสิกรไทย (KBANK)">กสิกรไทย (KBANK)</option>
                  <option value="กรุงเทพ (BBL)">กรุงเทพ (BBL)</option>
                  <option value="กรุงไทย (KTB)">กรุงไทย (KTB)</option>
                  <option value="ไทยพาณิชย์ (SCB)">ไทยพาณิชย์ (SCB)</option>
                  <option value="กรุงศรี (BAY)">กรุงศรี (BAY)</option>
                  <option value="ทหารไทยธนชาต (TTB)">ทหารไทยธนชาต (TTB)</option>
                  <option value="ออมสิน (GSB)">ออมสิน (GSB)</option>
                  <option value="ธ.ก.ส. (BAAC)">ธ.ก.ส. (BAAC)</option>
                  <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#64748b',
                  }}
                >
                  เลขที่บัญชี
                </label>
                <input
                  type="text"
                  value={bankFormModal.account_no}
                  onChange={(e) =>
                    setBankFormModal({ ...bankFormModal, account_no: e.target.value })
                  }
                  placeholder="xxx-x-xxxxx-x"
                  className="glass-panel"
                  style={{ width: '100%', padding: '12px' }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#64748b',
                  }}
                >
                  ชื่อบัญชี
                </label>
                <input
                  type="text"
                  value={bankFormModal.account_name}
                  onChange={(e) =>
                    setBankFormModal({ ...bankFormModal, account_name: e.target.value })
                  }
                  placeholder="นายใจดี มีสุข"
                  className="glass-panel"
                  style={{ width: '100%', padding: '12px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() =>
                  setBankFormModal({
                    open: false,
                    mode: 'add',
                    bankId: '',
                    bank_name: '',
                    account_no: '',
                    account_name: '',
                  })
                }
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: 'none',
                  fontWeight: '700',
                }}
              >
                ยกเลิก
              </button>
              <button onClick={submitBankForm} className="btn-primary" style={{ flex: 1 }}>
                {bankFormModal.mode === 'add' ? 'เพิ่มบัญชี' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
