'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, ChevronDown, Plus, Trash2, Wallet, MessageCircle, HomeIcon, Crown, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction, swrFetcher } from '@/lib/api';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { subscribeToTable, unsubscribeChannel } from '@/lib/realtime';
import { usePolling } from '@/lib/polling';

type Circle = {
  id: string;
  name: string;
  status: 'OPEN' | 'ACTIVE' | 'CLOSED' | string;
  amount_per_hand: number;
  type?: string;
  creator_id?: string;
  creator_name?: string;
  creator_picture_url?: string | null;
  is_participant?: boolean;
  total_hands?: number;
};

export default function Home() {
  const { profile, dbUser, isLoading: isUserLoading, liff } = useUser() as any;

  const memberId = dbUser?.id;
  const {
    data: circlesResponse,
    isLoading: isLoadingCircles,
    mutate,
  } = useSWR<{ status: string; circles?: Circle[] }>(
    memberId ? ['get_circles', { member_id: memberId }] : null,
    swrFetcher as any
  );

  const circles = circlesResponse?.status === 'success' ? (circlesResponse.circles ?? []) : [];

  const [pendingDelete, setPendingDelete] = useState<Circle | null>(null);
  const [joinHouseOpen, setJoinHouseOpen] = useState(false);
  const [joinHouseCode, setJoinHouseCode] = useState('');
  const [joinHouseLoading, setJoinHouseLoading] = useState(false);

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';
  const newCircles = circles.filter((c) => c.status === 'OPEN').slice(0, 5);
  const joinedCircles = circles
    .filter((c) => {
      const isCreator = isAdmin && c.creator_id === dbUser?.id;
      return (isCreator || c.is_participant) && (c.status === 'ACTIVE' || c.status === 'OPEN');
    })
    .slice(0, 5);

  const handleDeleteCircle = async () => {
    if (!pendingDelete) return;
    const result = await callAction('delete_circle', {
      circle_id: pendingDelete.id,
      caller_role: dbUser.role,
    });
    if (result.status === 'success') {
      toast.success(`ลบวงแชร์ "${pendingDelete.name}" สำเร็จ`);
      mutate();
    } else {
      toast.error(result.message || 'การลบไม่สำเร็จ');
    }
    setPendingDelete(null);
  };

  const handleJoinHouse = async () => {
    if (!joinHouseCode.trim()) return;
    setJoinHouseLoading(true);
    try {
      const result = await callAction('request_join_house', { house_code: joinHouseCode.trim() });
      if (result.status === 'success') {
        toast.success(result.message);
        setJoinHouseOpen(false);
        setJoinHouseCode('');
        mutate();
      } else {
        toast.error(result.message || 'ไม่สามารถส่งคำขอได้');
      }
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');
    } finally {
      setJoinHouseLoading(false);
    }
  };

  // Realtime subscriptions for new circles and player joins
  useEffect(() => {
    if (!memberId) return;
    const channel = subscribeToTable(
      `home-circles-${memberId}`,
      'circles',
      null,
      () => mutate()
    );
    return () => {
      unsubscribeChannel(`home-circles-${memberId}`);
    };
  }, [memberId, mutate]);

  // Polling fallback: refresh every 5s when tab is visible
  usePolling(() => {
    if (memberId) mutate();
  }, 5000, !!memberId);

  if (isUserLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="font-semibold text-primary">กำลังโหลด...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-1 py-10">
        <Card className="w-full max-w-sm bg-white/70 p-8 text-center shadow-glass backdrop-blur-md">
          <div className="mb-5 text-6xl">🌿</div>
          <h2 className="mb-3 text-2xl font-extrabold">GreenShare</h2>
          <p className="mb-8 leading-relaxed text-muted-foreground">
            ระบบจัดการวงแชร์พรีเมียม
            <br />
            ใช้งานง่าย ปลอดภัย ตรวจสอบได้
          </p>
          <Button
            onClick={() => liff?.login()}
            size="lg"
            className="w-full bg-[#00B900] text-base hover:bg-[#009900]"
          >
            <MessageCircle className="size-5" />
            เข้าสู่ระบบด้วย LINE
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <header className="mb-6 mt-2.5">
        <h2 className="m-0 text-2xl font-extrabold">สวัสดีครับ! 🌿</h2>
        <p className="mt-1 text-sm text-muted-foreground">วันนี้มีอะไรให้ช่วยจัดการไหมครับ?</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setJoinHouseOpen(true)}
        >
          <HomeIcon className="mr-1.5 size-4 text-primary" />
          เข้าร่วมบ้านแชร์อื่น
        </Button>
      </header>

      {/* New Circles */}
      <Section
        title="วงแชร์เปิดใหม่"
        action={
          isAdmin ? (
            <Button asChild size="sm" className="rounded-xl shadow-primary">
              <Link href="/circles/create">
                <Plus className="size-4" /> เปิดวงใหม่
              </Link>
            </Button>
          ) : null
        }
      >
        <AdminCircleGroup
          loading={isLoadingCircles}
          circles={newCircles}
          emptyText="ยังไม่มีวงแชร์เปิดใหม่ในขณะนี้"
          currentUserId={dbUser?.id}
          isAdmin={isAdmin}
          onDelete={(c) => setPendingDelete(c)}
        />
      </Section>

      {/* Playing Circles */}
      <Section
        title="วงแชร์ที่เล่นอยู่"
        action={
          <Link href="/circles/view" className="text-sm font-semibold text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        }
      >
        <AdminCircleGroup
          loading={isLoadingCircles}
          circles={joinedCircles}
          emptyText="คุณยังไม่มีวงแชร์ที่กำลังเล่นอยู่"
          currentUserId={dbUser?.id}
          isAdmin={isAdmin}
          showStatus
          onDelete={(c) => setPendingDelete(c)}
        />
      </Section>

      {/* Confirm delete */}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบวงแชร์</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบวงแชร์ <strong>&quot;{pendingDelete?.name}&quot;</strong> ใช่หรือไม่?
              <br />
              การลบนี้ไม่สามารถย้อนกลับได้และข้อมูลทั้งหมดจะหายไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCircle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Join House Dialog */}
      <Dialog open={joinHouseOpen} onOpenChange={setJoinHouseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🏠 เข้าร่วมบ้านแชร์อื่น</DialogTitle>
            <DialogDescription>กรอกรหัสบ้านที่ได้รับจากท้าวแชร์</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Label htmlFor="house-code">รหัสบ้านแชร์ (house code)</Label>
            <Input
              id="house-code"
              value={joinHouseCode}
              onChange={(e) => setJoinHouseCode(e.target.value)}
              placeholder="M0001"
              onKeyDown={(e) => e.key === 'Enter' && handleJoinHouse()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setJoinHouseOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleJoinHouse} disabled={joinHouseLoading || !joinHouseCode.trim()}>
              {joinHouseLoading ? 'กำลังส่ง...' : 'ส่งคำขอ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Sub-components -------------------- */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="m-0 text-base font-bold">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function groupCirclesByAdmin(circles: Circle[]) {
  const groups = new Map<string, { creator_id: string; creator_name: string; creator_picture_url?: string | null; circles: Circle[] }>();
  for (const c of circles) {
    const cid = c.creator_id || 'unknown';
    if (!groups.has(cid)) {
      groups.set(cid, {
        creator_id: cid,
        creator_name: c.creator_name || 'ท้าวแชร์',
        creator_picture_url: c.creator_picture_url,
        circles: [],
      });
    }
    groups.get(cid)!.circles.push(c);
  }
  return Array.from(groups.values());
}

function AdminCircleGroup({
  loading,
  circles,
  emptyText,
  currentUserId,
  isAdmin,
  showStatus,
  onDelete,
}: {
  loading: boolean;
  circles: Circle[];
  emptyText: string;
  currentUserId?: string;
  isAdmin: boolean;
  showStatus?: boolean;
  onDelete: (c: Circle) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <>
        <Skeleton className="h-[72px] w-full rounded-xl" />
        <Skeleton className="h-[72px] w-full rounded-xl" />
      </>
    );
  }

  if (circles.length === 0) {
    return (
      <Card className="border-dashed bg-muted/30 px-5 py-7 text-center text-sm text-muted-foreground">
        {emptyText}
      </Card>
    );
  }

  const groups = groupCirclesByAdmin(circles);
  // Sort: current user first, then by name
  const sorted = groups.sort((a, b) => {
    if (a.creator_id === currentUserId && b.creator_id !== currentUserId) return -1;
    if (b.creator_id === currentUserId && a.creator_id !== currentUserId) return 1;
    return a.creator_name.localeCompare(b.creator_name);
  });

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map((group) => {
        const isSelf = group.creator_id === currentUserId;
        const isOpen = expanded.has(group.creator_id);
        return (
          <Card
            key={group.creator_id}
            className={cn(
              'overflow-hidden border transition-all',
              isSelf ? 'border-primary/30 bg-primary/5' : 'border-primary/10 bg-card'
            )}
          >
            {/* Admin Header — clickable */}
            <button
              type="button"
              onClick={() => {
                const next = new Set(expanded);
                if (next.has(group.creator_id)) next.delete(group.creator_id);
                else next.add(group.creator_id);
                setExpanded(next);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {group.creator_picture_url ? (
                <img
                  src={group.creator_picture_url}
                  alt=""
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100">
                  {isSelf ? (
                    <Crown className="size-5 text-emerald-600" />
                  ) : (
                    <UserIcon className="size-5 text-emerald-600" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-bold">
                    {isSelf ? 'วงแชร์ของฉัน' : group.creator_name}
                  </span>
                  {isSelf && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-700">
                      ฉัน
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {group.circles.length} วงแชร์
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'size-5 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Circles list */}
            {isOpen && (
              <div className="flex flex-col gap-2 border-t border-primary/10 px-3 pb-3 pt-2">
                {group.circles.map((circle) => (
                  <CircleRow
                    key={circle.id}
                    circle={circle}
                    isAdmin={isAdmin}
                    showStatus={showStatus}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function CircleRow({
  circle,
  isAdmin,
  showStatus,
  onDelete,
}: {
  circle: Circle;
  isAdmin: boolean;
  showStatus?: boolean;
  onDelete: (c: Circle) => void;
}) {
  return (
    <Link
      href={`/circles/${circle.id}`}
      className={cn(
        'group flex items-center justify-between rounded-xl border border-primary/10 bg-card px-4 py-3 shadow-sm transition-all',
        'hover:border-primary/30 hover:shadow-md active:scale-[0.99]'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold">{circle.name}</span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold leading-tight',
              circle.type === 'ขั้นบันได (ดอกคงที่)'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            )}
          >
            {circle.type === 'ขั้นบันได (ดอกคงที่)' ? '📊 ขั้นบันได' : '🎯 บิงโก'}
          </span>
          {showStatus && (
            <Badge variant="success" className="text-[0.55rem]">
              {circle.status}
            </Badge>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(circle);
              }}
              className="rounded p-1 text-muted-foreground opacity-60 transition-colors hover:text-destructive hover:opacity-100"
              aria-label={`ลบวงแชร์ ${circle.name}`}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Wallet className="size-3.5" />
          {circle.type === 'ขั้นบันได (ดอกคงที่)' ? (
            <span>
              กำหนดยอดชำระต่องวด{' '}
              {circle.total_hands ? (
                <span className="ml-1 font-medium"># {circle.total_hands} มือ</span>
              ) : null}
            </span>
          ) : (
            <span>
              ส่งงวดละ {circle.amount_per_hand.toLocaleString()} ฿{' '}
              {circle.total_hands ? (
                <span className="ml-1 font-medium"># {circle.total_hands} มือ</span>
              ) : null}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
