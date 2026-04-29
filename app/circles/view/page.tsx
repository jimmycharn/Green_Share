'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, Coins, Hash, Inbox, Loader2, Tag } from 'lucide-react';

import { useUser } from '@/contexts/UserContext';
import { swrFetcher } from '@/lib/api';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Circle = {
  id: string;
  name: string;
  status: 'OPEN' | 'ACTIVE' | 'CLOSED' | 'DEAD' | string;
  type: string;
  amount_per_hand: number;
  total_hands: number;
  is_participant?: boolean;
};

export default function ViewCirclesPage() {
  const { dbUser, isLoading: isUserLoading } = useUser() as any;
  const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED'>('OPEN');

  const memberId = dbUser?.id;
  const {
    data: circlesResponse,
    isLoading: isLoadingCircles,
    error,
  } = useSWR<{ status: string; circles?: Circle[]; message?: string }>(
    memberId ? ['get_circles', { member_id: memberId }] : null,
    swrFetcher as any,
  );

  const circles: Circle[] = circlesResponse?.status === 'success' ? circlesResponse.circles ?? [] : [];

  const filtered = circles.filter(
    (c) =>
      c.is_participant &&
      (activeTab === 'OPEN'
        ? c.status === 'OPEN' || c.status === 'ACTIVE'
        : c.status === 'CLOSED' || c.status === 'DEAD'),
  );

  if (isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold">วงแชร์ของคุณ</h2>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'OPEN' | 'CLOSED')}>
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="OPEN">กำลังเปิดอยู่</TabsTrigger>
          <TabsTrigger value="CLOSED">สรุปยอดแล้ว</TabsTrigger>
        </TabsList>

        {(['OPEN', 'CLOSED'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="flex flex-col gap-4">
            {error && (
              <Card className="border-destructive/30 bg-destructive/5 p-4 text-center text-sm font-semibold text-destructive">
                {circlesResponse?.message || 'การเชื่อมต่อขัดข้อง'}
              </Card>
            )}

            {isLoadingCircles ? (
              <>
                <Skeleton className="h-[88px] w-full rounded-xl" />
                <Skeleton className="h-[88px] w-full rounded-xl" />
              </>
            ) : filtered.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 border-dashed bg-muted/30 px-6 py-14 text-center">
                <Inbox className="size-12 text-muted-foreground/40" />
                <h3 className="text-base font-semibold text-muted-foreground">
                  ยังไม่มีวงแชร์ในหมวดนี้
                </h3>
                <p className="text-sm text-muted-foreground/70">เข้าร่วมวงแชร์ใหม่ได้ที่หน้าแรก</p>
              </Card>
            ) : (
              filtered.map((circle) => <CircleRow key={circle.id} circle={circle} />)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CircleRow({ circle }: { circle: Circle }) {
  const variant: 'success' | 'warning' | 'secondary' =
    circle.status === 'ACTIVE' ? 'success' : circle.status === 'OPEN' ? 'warning' : 'secondary';

  return (
    <Link
      href={`/circles/${circle.id}`}
      className="group flex items-center justify-between rounded-xl border border-primary/10 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="m-0 truncate text-base font-bold">{circle.name}</h3>
          <Badge variant={variant} className="text-[0.6rem]">
            {circle.status}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Tag className="size-3.5" />
            {circle.type}
          </span>
          <span className="flex items-center gap-1 font-semibold text-primary">
            <Coins className="size-3.5" />
            {circle.amount_per_hand.toLocaleString()} บ.
          </span>
          <span className="flex items-center gap-1">
            <Hash className="size-3.5" />
            {circle.total_hands} มือ
          </span>
        </div>
      </div>
      <ChevronRight className="size-5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
