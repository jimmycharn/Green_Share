'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export default function Onboarding() {
  const router = useRouter();
  const { profile, dbUser, isLoading: isUserLoading } = useUser();
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    bank_account: '',
    role: 'MEMBER', // MEMBER or ADMIN
    house_name: '',
    house_code: '', // admin_id to join
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If already in DB, redirect home
    if (dbUser) {
      router.push('/');
      return;
    }

    // Pre-fill from LINE profile
    if (profile) {
      const urlParams = new URLSearchParams(window.location.search);
      const houseParam =
        urlParams.get('house') ||
        (window.location.hash.includes('house=')
          ? new URLSearchParams(window.location.hash.split('?')[1]).get('house')
          : null);

      setFormData((prev) => ({
        ...prev,
        name: profile.displayName || '',
        nickname: profile.displayName || '',
        house_code: houseParam || '',
      }));
    }
  }, [profile, dbUser, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile) return;
    setIsSubmitting(true);
    setError('');

    try {
      // Perform the ACTUAL registration now
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${typeof window !== 'undefined' && window.liff?.getIDToken ? window.liff.getIDToken() || '' : ''}`,
        },
        body: JSON.stringify({
          action: 'register',
          line_id: profile.userId,
          ...formData,
        }),
      });
      const data = await res.json();

      if (data.status === 'success') {
        // Success! Redirect home and refresh user context
        window.location.href = '/';
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('การเชื่อมต่อขัดข้อง กรุณาลองใหม่ครับ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        ></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- Styles ---
  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
      fontFamily: "'Inter', sans-serif",
    },
    card: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '40px',
      padding: '40px 30px',
      width: '100%',
      maxWidth: '460px',
      boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.15)',
      border: '1px solid rgba(16, 185, 129, 0.1)',
      textAlign: 'center',
    },
    header: {
      marginBottom: '30px',
    },
    avatar: {
      width: '90px',
      height: '90px',
      borderRadius: '30px',
      marginBottom: '20px',
      border: '4px solid white',
      boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
      objectFit: 'cover',
    },
    title: {
      fontSize: '1.8rem',
      fontWeight: '900',
      color: '#064e3b',
      margin: '0 0 8px 0',
    },
    subtitle: {
      fontSize: '0.95rem',
      color: '#64748b',
      margin: 0,
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      textAlign: 'left',
    },
    label: {
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: '700',
      color: '#374151',
      marginBottom: '8px',
      paddingLeft: '4px',
    },
    input: {
      width: '100%',
      padding: '16px 20px',
      borderRadius: '20px',
      border: '2px solid #f1f5f9',
      background: '#f8fafc',
      fontSize: '1rem',
      color: '#1e293b',
      outline: 'none',
      transition: '0.3s',
    },
    roleContainer: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '15px',
    },
    roleBtn: (active) => ({
      padding: '20px 10px',
      borderRadius: '25px',
      border: `3px solid ${active ? '#10b981' : '#f1f5f9'}`,
      background: active ? '#ecfdf5' : 'white',
      cursor: 'pointer',
      transition: '0.3s',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
    }),
    roleIcon: {
      fontSize: '2.2rem',
    },
    roleText: {
      fontWeight: '800',
      fontSize: '0.9rem',
      color: '#064e3b',
    },
    submitBtn: {
      width: '100%',
      padding: '20px',
      borderRadius: '22px',
      border: 'none',
      background: 'linear-gradient(to right, #10b981, #059669)',
      color: 'white',
      fontSize: '1.1rem',
      fontWeight: '800',
      cursor: 'pointer',
      boxShadow: '0 15px 30px rgba(16, 185, 129, 0.3)',
      marginTop: '10px',
      transition: '0.3s',
    },
    error: {
      padding: '15px',
      background: '#fff1f2',
      color: '#be123c',
      borderRadius: '18px',
      fontSize: '0.85rem',
      fontWeight: '700',
      marginBottom: '20px',
      border: '1px solid rgba(190, 18, 60, 0.1)',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          {profile?.pictureUrl && (
            <img src={profile.pictureUrl} alt="Profile" style={styles.avatar} />
          )}
          <h2 style={styles.title}>ลงทะเบียน 🌱</h2>
          <p style={styles.subtitle}>
            สวัสดีครับคุณ {profile?.displayName} <br />
            มาร่วมเป็นส่วนหนึ่งของ GreenShare กันนะครับ
          </p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={styles.label}>ชื่อจริง ✍️</label>
              <input
                style={styles.input}
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label style={styles.label}>ชื่อเล่น ✨</label>
              <input
                style={styles.input}
                type="text"
                required
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={styles.label}>เบอร์โทรศัพท์ 📱</label>
            <input
              style={styles.input}
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="08X-XXXXXXX"
            />
          </div>

          <div>
            <label style={styles.label}>เลขบัญชีธนาคาร 💰</label>
            <input
              style={styles.input}
              type="text"
              required
              value={formData.bank_account}
              onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              placeholder="ชื่อธนาคาร และ เลขบัญชี"
            />
          </div>

          <div>
            <label style={styles.label}>คุณต้องการสมัครเป็นอะไรครับ? 😊</label>
            <div style={styles.roleContainer}>
              <div
                style={styles.roleBtn(formData.role === 'MEMBER')}
                onClick={() => setFormData({ ...formData, role: 'MEMBER' })}
              >
                <span style={styles.roleIcon}>🌻</span>
                <span style={styles.roleText}>สมาชิกวงแชร์</span>
              </div>
              <div
                style={styles.roleBtn(formData.role === 'ADMIN')}
                onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
              >
                <span style={styles.roleIcon}>👑</span>
                <span style={styles.roleText}>ท้าวแชร์</span>
              </div>
            </div>
          </div>

          {formData.role === 'ADMIN' ? (
            <div style={{ animation: 'fadeIn 0.5s ease' }}>
              <label style={styles.label}>ตั้งชื่อบ้านแชร์ของคุณ 🏠</label>
              <input
                style={styles.input}
                type="text"
                required
                value={formData.house_name}
                onChange={(e) => setFormData({ ...formData, house_name: e.target.value })}
                placeholder="เช่น บ้านแชร์มหาเศรษฐี"
              />
            </div>
          ) : (
            <div style={{ animation: 'fadeIn 0.5s ease' }}>
              <label style={styles.label}>รหัสบ้านแชร์ที่ต้องการเข้า 🔑</label>
              <input
                style={{ ...styles.input, textTransform: 'uppercase' }}
                type="text"
                required
                value={formData.house_code}
                onChange={(e) => setFormData({ ...formData, house_code: e.target.value })}
                placeholder="รหัสของท้าวแชร์ (เช่น M0001)"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.submitBtn,
              opacity: isSubmitting ? 0.7 : 1,
              transform: isSubmitting ? 'scale(0.98)' : 'none',
            }}
          >
            {isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'สมัครสมาชิกและเข้าสู่แอป 🚀'}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #cbd5e1; }
        input:focus { border-color: #10b981 !important; background: white !important; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
      `}</style>
    </div>
  );
}
