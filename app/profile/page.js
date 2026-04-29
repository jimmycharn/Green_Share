'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { authHeaders } from '@/lib/authHeaders';

export default function Profile() {
  const { profile, dbUser, isLoading: isUserLoading } = useUser();
  const [view, setView] = useState('menu'); // "menu" or "edit"
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    bank_account: '',
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (dbUser) {
      setFormData({
        name: dbUser.name || '',
        nickname: dbUser.nickname || '',
        phone: dbUser.phone || '',
        bank_account: dbUser.bank_account || '',
      });
    }
  }, [dbUser]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'update_profile',
          line_id: profile.userId,
          name: formData.name,
          nickname: formData.nickname,
          phone: formData.phone,
          bank_account: formData.bank_account,
        }),
      });

      const resData = await res.json();

      if (resData.status === 'success') {
        setMessage({ type: 'success', text: 'บันทึกข้อมูลเรียบร้อยแล้ว!' });
        setTimeout(() => setView('menu'), 1500);
      } else {
        setMessage({ type: 'error', text: resData.message || 'บันทึกไม่สำเร็จ' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'การเชื่อมต่อขัดข้อง' });
    }

    setIsSaving(false);
  };

  if (isUserLoading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: 'var(--primary)' }}>กำลังโหลด...</h3>
      </div>
    );
  }

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';

  return (
    <div className="animate-fade-in">
      {view === 'menu' ? (
        <div
          className="animate-fade-in"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}
        >
          <h3 style={{ margin: '0 0 4px 6px', fontSize: '1.1rem', fontWeight: '800' }}>
            จัดการข้อมูล
          </h3>
          <button
            onClick={() => setView('edit')}
            className="glass-panel"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '1.1rem',
              fontWeight: '700',
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          >
            <span>จัดการโปรไฟล์</span>
            <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>❯</span>
          </button>

          {isAdmin && (
            <Link
              href="/admin"
              className="glass-panel"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '1.1rem',
                fontWeight: '700',
              }}
            >
              <span>แอดมินตั้งค่า(ขั้นสูง)</span>
              <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>❯</span>
            </Link>
          )}

          <div style={{ padding: '10px', textAlign: 'center', marginTop: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>เวอร์ชันแอป 1.3.0 (Optimized)</p>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}
            >
              <button
                onClick={() => setView('menu')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: 'var(--primary)',
                }}
              >
                ❮
              </button>
              <h3 style={{ margin: 0 }}>แก้ไขข้อมูลโปรไฟล์</h3>
            </div>

            {message.text && (
              <div
                style={{
                  padding: '12px',
                  marginBottom: '20px',
                  borderRadius: '12px',
                  background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: message.type === 'success' ? '#166534' : '#991b1b',
                  textAlign: 'center',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                }}
              >
                {message.text}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    color: '#64748b',
                  }}
                >
                  ชื่อ-นามสกุลจริง
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="glass-panel"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    background: 'rgba(255,255,255,0.5)',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    color: '#64748b',
                  }}
                >
                  ชื่อเล่น
                </label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  required
                  className="glass-panel"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    background: 'rgba(255,255,255,0.5)',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    color: '#64748b',
                  }}
                >
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="glass-panel"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    background: 'rgba(255,255,255,0.5)',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    color: '#64748b',
                  }}
                >
                  ข้อมูลธนาคารสำหรับรับเงิน
                </label>
                <textarea
                  name="bank_account"
                  value={formData.bank_account}
                  onChange={handleChange}
                  rows="3"
                  required
                  className="glass-panel"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    background: 'rgba(255,255,255,0.5)',
                    resize: 'none',
                  }}
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary"
                style={{ marginTop: '10px' }}
              >
                {isSaving ? 'กำลังบันทึก...' : '💾 ยืนยันการเปลี่ยนแปลง'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
