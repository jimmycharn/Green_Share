'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { authHeaders } from '@/lib/authHeaders';

export default function ViewCircles() {
  const { dbUser, isLoading: isUserLoading } = useUser();
  const [circles, setCircles] = useState([]);
  const [isLoadingCircles, setIsLoadingCircles] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('OPEN'); // OPEN or CLOSED

  useEffect(() => {
    if (dbUser) {
      fetchCircles(dbUser.id);
    }
  }, [dbUser]);

  const fetchCircles = async (memberId) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'get_circles', member_id: memberId }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCircles(data.circles || []);
      } else {
        setMessage(data.message || 'ไม่สามารถดึงวงแชร์ได้');
      }
    } catch (err) {
      setMessage('การเชื่อมต่อขัดข้อง');
      console.error('Failed to fetch circles', err);
    }
    setIsLoadingCircles(false);
  };

  if (isUserLoading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <h3 style={{ color: 'var(--primary)' }}>กำลังโหลด...</h3>
      </div>
    );
  }

  // Filter circles based on active tab and participation
  const filteredCircles = circles.filter(
    (c) =>
      c.is_participant &&
      (activeTab === 'OPEN'
        ? c.status === 'OPEN' || c.status === 'ACTIVE'
        : c.status === 'CLOSED' || c.status === 'DEAD')
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>วงแชร์ของคุณ</h2>
      </div>

      {/* Modern Tabs */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          padding: '6px',
          borderRadius: '18px',
        }}
      >
        <button
          onClick={() => setActiveTab('OPEN')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '14px',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s',
            background: activeTab === 'OPEN' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'OPEN' ? 'white' : '#64748b',
          }}
        >
          กำลังเปิดอยู่
        </button>
        <button
          onClick={() => setActiveTab('CLOSED')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '14px',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s',
            background: activeTab === 'CLOSED' ? 'var(--primary-gradient)' : 'transparent',
            color: activeTab === 'CLOSED' ? 'white' : '#64748b',
          }}
        >
          สรุปยอดแล้ว
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px',
            marginBottom: '20px',
            borderRadius: '12px',
            background: '#fee2e2',
            color: '#991b1b',
            textAlign: 'center',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          {message}
        </div>
      )}

      {/* Circle List Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
        {isLoadingCircles ? (
          <div
            className="glass-panel"
            style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}
          >
            กำลังโหลดวงแชร์...
          </div>
        ) : filteredCircles.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📭</span>
            <h3 style={{ color: '#94a3b8', fontWeight: '600' }}>ยังไม่มีวงแชร์ในหมวดนี้</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>เข้าร่วมวงแชร์ใหม่ได้ที่หน้าแรก</p>
          </div>
        ) : (
          filteredCircles.map((circle) => (
            <Link
              href={`/circles/${circle.id}`}
              key={circle.id}
              className="glass-panel"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
                padding: '20px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '8px',
                  }}
                >
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700' }}>
                    {circle.name}
                  </h3>
                  <span
                    className={circle.status === 'ACTIVE' ? 'badge badge-success' : 'badge-warning'}
                    style={{ fontSize: '0.6rem' }}
                  >
                    {circle.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    🏷️ {circle.type}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--primary)',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    💰 {circle.amount_per_hand.toLocaleString()} บ.
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    🔢 {circle.total_hands} มือ
                  </div>
                </div>
              </div>
              <div style={{ color: '#94a3b8' }}>❯</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
