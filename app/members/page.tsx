'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Building2,
  ChevronDown,
  Crown,
  Home as HomeIcon,
  Link2,
  Loader2,
  Phone,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction, swrFetcher } from '@/lib/api';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'MEMBER' | string;

type Member = {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: Role;
  house_id?: string;
  house_status?: 'ACTIVE' | 'PENDING' | string;
  house_name?: string;
  member_houses?: { admin_id: string }[];
};

const ADMIN_ROLES = new Set(['SUPERADMIN', 'ADMIN']);

export default function MembersPage() {
  const { dbUser, isLoading: isUserLoading } = useUser() as any;
  const confirm = useConfirm();
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);

  const memberId = dbUser?.id;
  const {
    data: response,
    isLoading: isLoadingMembers,
    mutate,
  } = useSWR<{ status: string; members?: Member[]; message?: string }>(
    memberId ? ['get_members', { member_id: memberId }] : null,
    swrFetcher as any,
  );

  const members: Member[] = response?.status === 'success' ? response.members ?? [] : [];

  const handleDelete = async (target: Member) => {
    const ok = await confirm({
      title: 'ลบสมาชิก',
      description: `คุณแน่ใจหรือไม่ว่าต้องการลบคุณ ${target.name} ออกจากระบบโดยสมบูรณ์?`,
      destructive: true,
    });
    if (!ok) return;

    const result = await callAction('full_delete_member', {
      caller_role: dbUser.role,
      member_id: target.id,
    });
    if (result.status === 'success') {
      toast.success(result.message || 'ลบสมาชิกสำเร็จ');
      mutate();
    } else {
      toast.error(result.message || 'ลบสมาชิกล้มเหลว');
    }
  };

  const handleApprove = async (target: Member) => {
    const ok = await confirm({
      title: 'อนุมัติสมาชิก',
      description: `ยืนยันการรับคุณ ${target.name} เข้าบ้านแชร์?`,
    });
    if (!ok) return;

    const result = await callAction('approve_house_member', {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      house_id: target.house_id,
      new_status: 'ACTIVE',
    });
    if (result.status === 'success') {
      toast.success(result.message || 'อนุมัติสมาชิกสำเร็จ');
      mutate();
    } else {
      toast.error(result.message || 'อนุมัติสมาชิกล้มเหลว');
    }
  };

  const handleUpdateRole = async (target: Member, newRole: Role) => {
    const result = await callAction('update_member_role', {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      member_id: target.id,
      new_role: newRole,
    });
    if (result.status === 'success') {
      toast.success(result.message || 'เปลี่ยนยศสำเร็จ');
      mutate();
    } else {
      toast.error(result.message || 'เปลี่ยนยศล้มเหลว');
    }
  };

  const handleCopyInvite = () => {
    if (!dbUser) return;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const link = `https://liff.line.me/${liffId}?house=${dbUser.id}`;
    navigator.clipboard.writeText(link);
    toast.success('คัดลอกลิงก์สำเร็จ ส่งชวนเพื่อนในไลน์ได้เลย!');
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!dbUser) {
    return (
      <Card className="my-10 p-10 text-center text-muted-foreground">
        กรุณาเข้าสู่ระบบเพื่อดูข้อมูลสมาชิก
      </Card>
    );
  }

  const isAdmin = ADMIN_ROLES.has(dbUser.role);
  const isSuperadmin = dbUser.role === 'SUPERADMIN';

  let myHouseAdmin: Member | null = null;
  let myHouseMembers: Member[] = [];

  if (isAdmin) {
    myHouseAdmin = dbUser as Member;
    myHouseMembers = members.filter(
      (m) =>
        m.id !== dbUser.id &&
        !ADMIN_ROLES.has(m.role) &&
        m.member_houses?.some((h) => h.admin_id === dbUser.id),
    );
  } else {
    myHouseAdmin = members.find((m) => ADMIN_ROLES.has(m.role)) ?? null;
    myHouseMembers = members.filter((m) => !ADMIN_ROLES.has(m.role));
  }

  const otherAdmins = isSuperadmin
    ? members.filter((m) => m.role === 'ADMIN' && m.id !== dbUser.id)
    : [];

  const getMembersByAdmin = (adminId: string) =>
    members.filter(
      (m) => m.id !== adminId && m.member_houses?.some((h) => h.admin_id === adminId),
    );

  const myHouseContent = (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <Card className="mb-2 border-2 border-dashed border-primary/50 bg-primary/5 p-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Link2 className="size-7 text-primary" />
            </div>
          </div>
          <h3 className="mb-1 text-lg font-bold">ชวนเพื่อนเข้าบ้าน</h3>
          <p className="mb-4 px-2 text-sm text-muted-foreground">
            ส่งลิงก์ให้เพื่อนเพื่อเข้าร่วมเป็นสมาชิกในบ้านแชร์ของคุณ
          </p>
          <Button onClick={handleCopyInvite} className="w-full">
            <Link2 className="size-4" /> คัดลอกลิงก์เชิญ
          </Button>
        </Card>
      )}

      <SectionTitle>ท้าวแชร์</SectionTitle>
      {myHouseAdmin ? (
        <MemberCard member={myHouseAdmin} dbUser={dbUser} isSelf={myHouseAdmin.id === dbUser.id} />
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">ไม่พบข้อมูลท้าวแชร์</Card>
      )}

      <SectionTitle className="mt-4">ลูกบ้าน ({myHouseMembers.length})</SectionTitle>
      {isLoadingMembers ? (
        <>
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[88px] w-full rounded-xl" />
        </>
      ) : myHouseMembers.length === 0 ? (
        <Card className="border-dashed bg-muted/30 p-7 text-center text-sm text-muted-foreground">
          ยังไม่มีลูกบ้าน
        </Card>
      ) : (
        myHouseMembers.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            dbUser={dbUser}
            onApprove={handleApprove}
            onDelete={handleDelete}
            onUpdateRole={handleUpdateRole}
          />
        ))
      )}
    </div>
  );

  const otherHousesContent = (
    <div className="flex flex-col gap-3">
      <SectionTitle>ท้าวแชร์ท่านอื่น ({otherAdmins.length})</SectionTitle>
      {otherAdmins.map((admin) => {
        const expanded = expandedAdmin === admin.id;
        const subMembers = getMembersByAdmin(admin.id);
        return (
          <div key={admin.id} className="flex flex-col gap-2">
            <Card
              onClick={() => setExpandedAdmin(expanded ? null : admin.id)}
              className={cn(
                'flex cursor-pointer items-center gap-4 p-5 transition-all',
                expanded
                  ? 'border-2 border-primary bg-primary/5'
                  : 'hover:border-primary/30 hover:shadow-md',
              )}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                <Crown className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-extrabold">
                  {admin.house_name || admin.name}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {admin.nickname} ({admin.name})
                </div>
              </div>
              <span className="text-xs font-bold text-primary">ท้าวแชร์</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(admin);
                }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`ลบ ${admin.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
              <ChevronDown
                className={cn(
                  'size-5 text-muted-foreground transition-transform',
                  expanded && 'rotate-180',
                )}
              />
            </Card>

            {expanded && (
              <div className="ml-2 flex flex-col gap-2 border-l-2 border-primary/40 pl-4">
                {subMembers.length === 0 ? (
                  <Card className="border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                    ยังไม่มีลูกวง
                  </Card>
                ) : (
                  subMembers.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      dbUser={dbUser}
                      onApprove={handleApprove}
                      onDelete={handleDelete}
                      onUpdateRole={handleUpdateRole}
                      mini
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!isSuperadmin) {
    return <div className="animate-fade-in">{myHouseContent}</div>;
  }

  return (
    <div className="animate-fade-in">
      <Tabs defaultValue="my_house" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="my_house" className="gap-2">
            <HomeIcon className="size-4" /> บ้านแชร์ฉัน
          </TabsTrigger>
          <TabsTrigger value="other_houses" className="gap-2">
            <Building2 className="size-4" /> บ้านแชร์อื่น
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my_house">{myHouseContent}</TabsContent>
        <TabsContent value="other_houses">{otherHousesContent}</TabsContent>
      </Tabs>
    </div>
  );
}

/* ----- Sub-components ----- */

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn('mb-1 text-base font-extrabold text-foreground', className)}>{children}</h3>;
}

function MemberCard({
  member,
  dbUser,
  onApprove,
  onDelete,
  onUpdateRole,
  isSelf = false,
  mini = false,
}: {
  member: Member;
  dbUser: any;
  onApprove?: (m: Member) => void;
  onDelete?: (m: Member) => void;
  onUpdateRole?: (m: Member, role: Role) => void;
  isSelf?: boolean;
  mini?: boolean;
}) {
  const isMemberAdmin = ADMIN_ROLES.has(member.role);
  const isPending = member.house_status === 'PENDING';
  const canManage = !isSelf && ADMIN_ROLES.has(dbUser?.role);
  const canChangeRole =
    !isSelf && dbUser?.role === 'SUPERADMIN' && member.house_status === 'ACTIVE';

  return (
    <Card
      className={cn(
        'flex items-center gap-4',
        mini ? 'p-3.5' : 'p-4',
        isSelf && 'border-primary bg-primary/5',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-2xl text-white',
          mini ? 'size-10' : 'size-12',
          isMemberAdmin ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-slate-700',
        )}
      >
        {isMemberAdmin ? (
          <Crown className={mini ? 'size-5' : 'size-6'} />
        ) : (
          <UserIcon className={mini ? 'size-5' : 'size-6'} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-extrabold', mini ? 'text-sm' : 'text-base')}>
          {member.nickname || member.name} {isSelf && <span className="text-primary">(ฉัน)</span>}
        </div>
        {!mini && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="size-3.5" />
            <span className="truncate">{member.phone || 'ไม่ระบุ'}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {isPending && (
            <Badge variant="warning" className="text-[0.55rem]">
              รออนุมัติ
            </Badge>
          )}
          <span
            className={cn(
              'text-xs font-extrabold',
              isMemberAdmin ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isMemberAdmin ? 'ท้าวแชร์' : member.role}
          </span>
        </div>

        {canChangeRole && onUpdateRole && (
          <select
            value={member.role}
            onChange={(e) => onUpdateRole(member, e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="MEMBER">MEMBER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {isPending && onApprove && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onApprove(member)}
              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            >
              อนุมัติ
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onDelete(member)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`ลบ ${member.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
