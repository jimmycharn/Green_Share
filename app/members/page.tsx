'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Building2,
  Crown,
  Home as HomeIcon,
  Landmark,
  Link2,
  Loader2,
  Pencil,
  Phone,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction, swrFetcher } from '@/lib/api';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'MEMBER' | string;

type Member = {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: Role;
  picture_url?: string | null;
  house_id?: string;
  house_status?: 'ACTIVE' | 'PENDING' | 'BLOCKED' | string;
  house_name?: string;
  assigned_bank_id?: string | null;
  custom_nickname?: string | null;
  member_houses?: { id?: string; admin_id: string; status?: string }[];
};

/** Display name precedence: admin's custom nickname → LINE nickname → registered name. */
function displayNameOf(m: Member): string {
  return m.custom_nickname?.trim() || m.nickname?.trim() || m.name;
}

type Bank = {
  id: string;
  bank_name: string;
  account_no: string;
  account_name: string;
  is_default?: boolean;
};

const ADMIN_ROLES = new Set(['SUPERADMIN', 'ADMIN']);

export default function MembersPage() {
  const { dbUser, isLoading: isUserLoading } = useUser() as any;
  const confirm = useConfirm();
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [settingsMember, setSettingsMember] = useState<Member | null>(null);
  const [settingsView, setSettingsView] = useState<'menu' | 'role' | 'bank' | 'transfer'>('menu');

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

  // Fetch caller's banks (for bank-assignment action). Only for admin roles.
  const isCallerAdmin =
    !!dbUser && (dbUser.role === 'SUPERADMIN' || dbUser.role === 'ADMIN');
  const { data: dashboardResp } = useSWR<{ status: string; banks?: Bank[] }>(
    isCallerAdmin && memberId
      ? ['get_admin_dashboard', { caller_id: memberId, caller_role: dbUser.role }]
      : null,
    swrFetcher as any,
  );
  const myBanks: Bank[] = dashboardResp?.banks ?? [];

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
      setSettingsMember(null);
      mutate();
    } else {
      toast.error(result.message || 'เปลี่ยนยศล้มเหลว');
    }
  };

  const handleBlockToggle = async (target: Member) => {
    const isBlocked = target.house_status === 'BLOCKED';
    const ok = await confirm({
      title: isBlocked ? 'ปลดบล็อกสมาชิก' : 'บล็อกสมาชิก',
      description: `ยืนยัน${isBlocked ? 'ปลดบล็อก' : 'บล็อก'}คุณ ${target.name}?`,
      destructive: !isBlocked,
    });
    if (!ok) return;

    const result = await callAction('approve_house_member', {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      house_id: target.house_id,
      new_status: isBlocked ? 'ACTIVE' : 'BLOCKED',
    });
    if (result.status === 'success') {
      toast.success(result.message || 'สำเร็จ');
      setSettingsMember(null);
      mutate();
    } else {
      toast.error(result.message || 'ดำเนินการล้มเหลว');
    }
  };

  const handleTransfer = async (target: Member, newAdminId: string) => {
    const targetAdmin = members.find((m) => m.id === newAdminId);
    const ok = await confirm({
      title: 'ย้ายสมาชิก',
      description: `ยืนยันย้าย ${target.name} ไปบ้านของ ${targetAdmin?.name || newAdminId}?`,
    });
    if (!ok) return;
    const result = await callAction('transfer_member', {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      house_id: target.house_id,
      new_admin_id: newAdminId,
    });
    if (result.status === 'success') {
      toast.success(result.message || 'ย้ายเรียบร้อย');
      setSettingsMember(null);
      mutate();
    } else {
      toast.error(result.message || 'ย้ายล้มเหลว');
    }
  };

  const handleSetNickname = async (target: Member, nickname: string) => {
    const result = await callAction('set_member_nickname', {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      member_id: target.id,
      nickname,
    });
    if (result.status === 'success') {
      toast.success(result.message || 'ตั้งชื่อเล่นเรียบร้อย');
      setSettingsMember(null);
      mutate();
    } else {
      toast.error(result.message || 'ตั้งชื่อเล่นล้มเหลว');
    }
  };

  const handleAssignBank = async (target: Member, bankId: string | null) => {
    const result = await callAction('assign_member_bank', {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      house_id: target.house_id,
      bank_id: bankId,
    });
    if (result.status === 'success') {
      toast.success(result.message || 'กำหนดบัญชีเรียบร้อย');
      setSettingsMember(null);
      mutate();
    } else {
      toast.error(result.message || 'กำหนดบัญชีล้มเหลว');
    }
  };

  const openSettings = (m: Member) => {
    setSettingsView('menu');
    setSettingsMember(m);
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
            onSettings={openSettings}
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
              <Avatar className="size-12 shrink-0 rounded-2xl">
                {admin.picture_url ? (
                  <AvatarImage
                    src={admin.picture_url}
                    alt={admin.nickname || admin.name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                  <Crown className="size-6" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-extrabold">
                  {displayNameOf(admin)}
                </div>
                <div className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                  <Phone className="size-3.5" />
                  <span className="truncate">{admin.phone || 'ไม่ระบุ'}</span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-primary">ท้าวแชร์</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  openSettings(admin);
                }}
                aria-label={`ตั้งค่า ${admin.name}`}
              >
                <Settings className="size-5" />
              </Button>
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
                      onSettings={openSettings}
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

  // List of admin members (potential transfer targets) — includes SUPERADMIN/ADMIN.
  const adminMembers = members.filter((m) => ADMIN_ROLES.has(m.role));

  const settingsDialog = (
    <SettingsDialog
      member={settingsMember}
      view={settingsView}
      setView={setSettingsView}
      onClose={() => setSettingsMember(null)}
      onUpdateRole={handleUpdateRole}
      onBlockToggle={handleBlockToggle}
      onAssignBank={handleAssignBank}
      onSetNickname={handleSetNickname}
      onTransfer={handleTransfer}
      onDelete={handleDelete}
      banks={myBanks}
      admins={adminMembers}
      callerRole={dbUser.role}
      callerId={dbUser.id}
    />
  );

  if (!isSuperadmin) {
    return (
      <div className="animate-fade-in">
        {myHouseContent}
        {settingsDialog}
      </div>
    );
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
      {settingsDialog}
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
  onSettings,
  isSelf = false,
  mini = false,
}: {
  member: Member;
  dbUser: any;
  onApprove?: (m: Member) => void;
  onSettings?: (m: Member) => void;
  isSelf?: boolean;
  mini?: boolean;
}) {
  const isMemberAdmin = ADMIN_ROLES.has(member.role);
  const isPending = member.house_status === 'PENDING';
  const isBlocked = member.house_status === 'BLOCKED';
  const canManage = !isSelf && !isMemberAdmin && ADMIN_ROLES.has(dbUser?.role);

  return (
    <Card
      className={cn(
        'flex items-center gap-3',
        mini ? 'p-3.5' : 'p-4',
        isSelf && 'border-primary bg-primary/5',
        isBlocked && 'opacity-60',
      )}
    >
      <Avatar
        className={cn(
          'shrink-0 rounded-2xl',
          mini ? 'size-10' : 'size-12',
        )}
      >
        {member.picture_url ? (
          <AvatarImage
            src={member.picture_url}
            alt={displayNameOf(member)}
            className="object-cover"
          />
        ) : null}
        <AvatarFallback
          className={cn(
            'rounded-2xl text-white',
            isMemberAdmin
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
              : 'bg-slate-700',
          )}
        >
          {isMemberAdmin ? (
            <Crown className={mini ? 'size-5' : 'size-6'} />
          ) : (
            <UserIcon className={mini ? 'size-5' : 'size-6'} />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className={cn('flex items-center gap-2 truncate font-extrabold', mini ? 'text-sm' : 'text-base')}>
          <span className="truncate">{displayNameOf(member)}</span>
          {isSelf && <span className="text-primary">(ฉัน)</span>}
          {isPending && (
            <Badge variant="warning" className="text-[0.55rem]">
              รออนุมัติ
            </Badge>
          )}
          {isBlocked && (
            <Badge variant="destructive" className="text-[0.55rem]">
              ถูกบล็อก
            </Badge>
          )}
        </div>
        <div
          className={cn(
            'flex items-center gap-1 truncate text-muted-foreground',
            mini ? 'text-xs' : 'text-sm',
          )}
        >
          <Phone className={mini ? 'size-3' : 'size-3.5'} />
          <span className="truncate">{member.phone || 'ไม่ระบุ'}</span>
        </div>
      </div>

      {isMemberAdmin && (
        <span className="shrink-0 text-xs font-extrabold text-primary">ท้าวแชร์</span>
      )}

      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
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
          {onSettings && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onSettings(member)}
              aria-label={`ตั้งค่า ${member.name}`}
            >
              <Settings className="size-5" />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/* ----- Settings Dialog ----- */

function SettingsDialog({
  member,
  view,
  setView,
  onClose,
  onUpdateRole,
  onBlockToggle,
  onAssignBank,
  onSetNickname,
  onTransfer,
  onDelete,
  banks,
  admins,
  callerRole,
  callerId,
}: {
  member: Member | null;
  view: 'menu' | 'role' | 'bank' | 'transfer';
  setView: (v: 'menu' | 'role' | 'bank' | 'transfer') => void;
  onClose: () => void;
  onUpdateRole: (m: Member, role: Role) => void;
  onBlockToggle: (m: Member) => void;
  onAssignBank: (m: Member, bankId: string | null) => void;
  onSetNickname: (m: Member, nickname: string) => void;
  onTransfer: (m: Member, newAdminId: string) => void;
  onDelete: (m: Member) => void;
  banks: Bank[];
  admins: Member[];
  callerRole: Role;
  callerId: string;
}) {
  // Local draft for the nickname input (resets each time a different member is opened).
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [transferQuery, setTransferQuery] = useState('');
  useEffect(() => {
    setNicknameDraft(member?.custom_nickname ?? '');
    setTransferQuery('');
  }, [member?.id, member?.custom_nickname]);

  if (!member) return null;

  const isBlocked = member.house_status === 'BLOCKED';
  const inMyHouse = member.member_houses?.some((h) => h.admin_id === callerId);
  const canChangeRole = callerRole === 'SUPERADMIN' && member.house_status === 'ACTIVE';
  // Nicknames are private to the viewer.
  // • SUPERADMIN can label anyone.
  // • ADMIN can label only members in their own house.
  const canEditNickname = callerRole === 'SUPERADMIN' || (callerRole === 'ADMIN' && !!inMyHouse);
  // Transfer is a Superadmin-only action and only makes sense for non-admin members
  // (you don't transfer the Superadmin's own admins between houses).
  const canTransfer =
    callerRole === 'SUPERADMIN' && !ADMIN_ROLES.has(member.role) && !!member.house_id;
  const nicknameChanged = (nicknameDraft || '').trim() !== (member.custom_nickname || '').trim();

  const currentAdminId = member.member_houses?.find((h) => h.id === member.house_id)?.admin_id;
  const transferCandidates = admins.filter((a) => a.id !== currentAdminId && a.id !== member.id);
  const filteredCandidates = transferCandidates.filter((a) => {
    const q = transferQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.id.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.nickname || '').toLowerCase().includes(q) ||
      (a.custom_nickname || '').toLowerCase().includes(q)
    );
  });

  // Roles available based on caller permissions
  const ROLE_OPTIONS: { value: Role; label: string }[] = [
    { value: 'MEMBER', label: 'MEMBER' },
    { value: 'MANAGER', label: 'MANAGER' },
    { value: 'ADMIN', label: 'ADMIN' },
  ];

  return (
    <Dialog
      open={!!member}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate text-lg">
            <span className="truncate">{displayNameOf(member)}</span>
            <Badge variant="outline" className="shrink-0">
              {member.role}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <Landmark className="size-3.5" />
            {member.assigned_bank_id ? 'ใช้บัญชีเฉพาะที่กำหนด' : 'ใช้บัญชีหลักของบ้าน'}
          </DialogDescription>
        </DialogHeader>

        {view === 'menu' && canEditNickname && (
          <div className="flex flex-col gap-1.5 pt-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Pencil className="size-3.5" /> ตั้งชื่อเล่น (สำหรับมุมมองของคุณ)
            </label>
            <div className="flex gap-2">
              <Input
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder={member.nickname || member.name}
                maxLength={120}
              />
              <Button
                type="button"
                disabled={!nicknameChanged}
                onClick={() => onSetNickname(member, nicknameDraft.trim())}
              >
                บันทึก
              </Button>
            </div>
            {(member.custom_nickname || nicknameDraft) && (
              <span className="text-[0.7rem] text-muted-foreground">
                ชื่อจริง: {member.name}
                {member.nickname && member.nickname !== member.name && ` · LINE: ${member.nickname}`}
              </span>
            )}
          </div>
        )}

        {view === 'menu' && canTransfer && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setView('transfer')}
            className="justify-center gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <ArrowRightLeft className="size-4" /> ย้ายไปบ้านแชร์อื่น
          </Button>
        )}

        {view === 'menu' && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canChangeRole}
              onClick={() => setView('role')}
              className="justify-center gap-2"
            >
              <ShieldCheck className="size-4" /> ปรับตำแหน่ง
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!inMyHouse}
              onClick={() => setView('bank')}
              className="justify-center gap-2"
            >
              <Landmark className="size-4" /> เลือกธนาคาร
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onBlockToggle(member)}
              className={cn(
                'justify-center gap-2',
                !isBlocked &&
                  'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800',
              )}
            >
              <Ban className="size-4" />
              {isBlocked ? 'ปลดบล็อก' : 'บล็อก'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onDelete(member)}
              className="justify-center gap-2 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" /> ลบออก
            </Button>
          </div>
        )}

        {view === 'role' && (
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-1 text-muted-foreground"
              onClick={() => setView('menu')}
            >
              <ArrowLeft className="size-4" /> ย้อนกลับ
            </Button>
            {ROLE_OPTIONS.map((opt) => {
              const active = member.role === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  disabled={active}
                  onClick={() => onUpdateRole(member, opt.value)}
                  className="justify-between"
                >
                  <span>{opt.label}</span>
                  {active && <span className="text-xs">ตำแหน่งปัจจุบัน</span>}
                </Button>
              );
            })}
          </div>
        )}

        {view === 'transfer' && (
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-1 text-muted-foreground"
              onClick={() => setView('menu')}
            >
              <ArrowLeft className="size-4" /> ย้อนกลับ
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={transferQuery}
                onChange={(e) => setTransferQuery(e.target.value)}
                placeholder="ค้นหาจากชื่อหรือ ID…"
                className="pl-9"
              />
            </div>
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {filteredCandidates.length === 0 ? (
                <Card className="border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  {transferCandidates.length === 0
                    ? 'ยังไม่มีบ้านแชร์อื่นให้ย้ายไป'
                    : 'ไม่พบผลลัพธ์'}
                </Card>
              ) : (
                filteredCandidates.map((a) => (
                  <Button
                    key={a.id}
                    type="button"
                    variant="outline"
                    onClick={() => onTransfer(member, a.id)}
                    className="h-auto justify-start gap-3 p-3 text-left"
                  >
                    <Avatar className="size-9 shrink-0 rounded-xl">
                      {a.picture_url ? (
                        <AvatarImage src={a.picture_url} alt={displayNameOf(a)} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                        <Crown className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{displayNameOf(a)}</div>
                      <div className="truncate font-mono text-[0.7rem] text-muted-foreground">
                        ID: {a.id}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[0.6rem]">
                      {a.role}
                    </Badge>
                  </Button>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'bank' && (
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-1 text-muted-foreground"
              onClick={() => setView('menu')}
            >
              <ArrowLeft className="size-4" /> ย้อนกลับ
            </Button>
            <Button
              type="button"
              variant={!member.assigned_bank_id ? 'default' : 'outline'}
              disabled={!member.assigned_bank_id}
              onClick={() => onAssignBank(member, null)}
              className="justify-start gap-2"
            >
              <Landmark className="size-4" /> ใช้บัญชีหลักของบ้าน
            </Button>
            {banks.length === 0 ? (
              <Card className="border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                ยังไม่มีบัญชีธนาคารในบ้าน
              </Card>
            ) : (
              banks.map((b) => {
                const active = member.assigned_bank_id === b.id;
                return (
                  <Button
                    key={b.id}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    disabled={active}
                    onClick={() => onAssignBank(member, b.id)}
                    className="h-auto justify-start gap-2 py-3 text-left"
                  >
                    <Landmark className="size-4 shrink-0" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-bold">{b.bank_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.account_no} • {b.account_name}
                      </span>
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
