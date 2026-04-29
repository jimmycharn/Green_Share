'use client';

import { useEffect, useState } from 'react';

export default function ActivityPage() {
  const [activities, setActivities] = useState([
    {
      id: 1,
      type: 'SUCCESS',
      title: 'ท้าวแชร์อนุมัติสลิป',
      desc: 'งวดที่ 3 วง: เพื่อนรักเพื่อนแค้น',
      time: '2 ชม. ที่แล้ว',
    },
    {
      id: 2,
      type: 'INFO',
      title: 'เริ่มงวดใหม่',
      desc: 'วง: แชร์บ้านน้องใหม่ เริ่มงวดที่ 1 แล้ว',
      time: '5 ชม. ที่แล้ว',
    },
    {
      id: 3,
      type: 'WARNING',
      title: 'เตือนชำระเงิน',
      desc: 'อีก 1 วันจะครบกำหนดชำระงวดที่ 5',
      time: '1 วันที่แล้ว',
    },
  ]);

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '20px' }}>กิจกรรมล่าสุด</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activities.map((act) => (
          <div
            key={act.id}
            className="glass-panel"
            style={{ display: 'flex', gap: '16px', alignItems: 'center' }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '15px',
                background:
                  act.type === 'SUCCESS'
                    ? '#dcfce7'
                    : act.type === 'WARNING'
                      ? '#fef3c7'
                      : '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              {act.type === 'SUCCESS' ? '✅' : act.type === 'WARNING' ? '⚠️' : 'ℹ️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>{act.title}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{act.desc}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                {act.time}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
        ไม่พบกิจกรรมเพิ่มเติม
      </div>
    </div>
  );
}
