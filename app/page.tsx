'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, Plus, Trash2, Wallet, MessageCircle } from 'lucide-react';
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
import { useState } from 'react';

type Circle = {
  id: string;
  name: string;
  status: 'OPEN' | 'ACTIVE' | 'CLOSED' | string;
  amount_per_hand: number;
  is_participant?: boolean;
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
    swrFetcher as any,
  );

  const circles = circlesResponse?.status === 'success' ? circlesResponse.circles ?? [] : [];

  const [pendingDelete, setPendingDelete] = useState<Circle | null>(null);

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';
  const newCircles = circles.filter((c) => c.status === 'OPEN').slice(0, 5);
  const joinedCircles = circles
    .filter((c) => c.is_participant && (c.status === 'ACTIVE' || c.status === 'OPEN'))
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
        <CircleList
          loading={isLoadingCircles}
          items={newCircles}
          emptyText="ยังไม่มีวงแชร์เปิดใหม่ในขณะนี้"
          isAdmin={isAdmin}
          onDelete={(c) => setPendingDelete(c)}
        />
      </Section>

      {/* Playing Circles */}
      <Section
        title="วงแชร์ที่เล่นอยู่"
        action={
          <Link
            href="/circles/view"
            className="text-sm font-semibold text-primary hover:underline"
          >
            ดูทั้งหมด
          </Link>
        }
      >
        <CircleList
          loading={isLoadingCircles}
          items={joinedCircles}
          emptyText="คุณยังไม่มีวงแชร์ที่กำลังเล่นอยู่"
          isAdmin={isAdmin}
          showStatus
          onDelete={(c) => setPendingDelete(c)}
        />
      </Section>

      {/* Confirm delete */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
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

function CircleList({
  loading,
  items,
  emptyText,
  isAdmin,
  showStatus,
  onDelete,
}: {
  loading: boolean;
  items: Circle[];
  emptyText: string;
  isAdmin: boolean;
  showStatus?: boolean;
  onDelete: (c: Circle) => void;
}) {
  if (loading) {
    return (
      <>
        <Skeleton className="h-[68px] w-full rounded-xl" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed bg-muted/30 px-5 py-7 text-center text-sm text-muted-foreground">
        {emptyText}
      </Card>
    );
  }

  return (
    <>
      {items.map((circle) => (
        <CircleRow
          key={circle.id}
          circle={circle}
          isAdmin={isAdmin}
          showStatus={showStatus}
          onDelete={onDelete}
        />
      ))}
    </>
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
        'group flex items-center justify-between rounded-xl border border-primary/10 bg-card px-5 py-4 shadow-sm transition-all',
        'hover:border-primary/30 hover:shadow-md active:scale-[0.99]',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold">{circle.name}</span>
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
          <span>ส่งงวดละ {circle.amount_per_hand.toLocaleString()} ฿</span>
        </div>
      </div>
      <ChevronRight className="size-5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
