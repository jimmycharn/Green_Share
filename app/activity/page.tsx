'use client';

import { CheckCircle2, AlertTriangle, Info, type LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ActivityType = 'SUCCESS' | 'WARNING' | 'INFO';

type Activity = {
  id: number;
  type: ActivityType;
  title: string;
  desc: string;
  time: string;
};

const ACTIVITIES: Activity[] = [
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
];

const ICON_MAP: Record<ActivityType, { icon: LucideIcon; bg: string; fg: string }> = {
  SUCCESS: { icon: CheckCircle2, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  WARNING: { icon: AlertTriangle, bg: 'bg-amber-100', fg: 'text-amber-600' },
  INFO: { icon: Info, bg: 'bg-sky-100', fg: 'text-sky-600' },
};

export default function ActivityPage() {
  return (
    <div className="animate-fade-in">
      <h2 className="mb-5 text-2xl font-bold">กิจกรรมล่าสุด</h2>

      <div className="flex flex-col gap-4">
        {ACTIVITIES.map((act) => {
          const meta = ICON_MAP[act.type];
          const Icon = meta.icon;
          return (
            <Card key={act.id} className="flex items-center gap-4 p-4">
              <div
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                  meta.bg,
                )}
              >
                <Icon className={cn('size-6', meta.fg)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{act.title}</div>
                <div className="text-sm text-muted-foreground">{act.desc}</div>
                <div className="mt-1 text-xs text-muted-foreground/70">{act.time}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground/70">ไม่พบกิจกรรมเพิ่มเติม</p>
    </div>
  );
}
