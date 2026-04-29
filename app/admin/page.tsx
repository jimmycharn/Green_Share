'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Ban,
  Check,
  ClipboardCopy,
  Copy,
  Crown,
  Edit2,
  Landmark,
  Link2,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Unlock,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction, swrFetcher } from '@/lib/api';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Role = 'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPERADMIN';

type MemberInfo = {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: Role;
};

type Bank = {
  id: string;
  bank_name: string;
  account_no: string;
  account_name: string;
  is_default?: boolean;
};

type HouseRow = {
  id: string;
  status?: 'ACTIVE' | 'PENDING' | 'BLOCKED' | string;
  assigned_bank_id?: string | null;
  member?: MemberInfo;
  bank?: Bank | null;
};

type DashboardData = {
  status: string;
  pendingMembers?: HouseRow[];
  houseMembers?: HouseRow[];
  banks?: Bank[];
  message?: string;
};

const BANK_OPTIONS = [
  'กสิกรไทย (KBANK)',
  'กรุงเทพ (BBL)',
  'กรุงไทย (KTB)',
  'ไทยพาณิชย์ (SCB)',
  'กรุงศรี (BAY)',
  'ทหารไทยธนชาต (TTB)',
  'ออมสิน (GSB)',
  'ธ.ก.ส. (BAAC)',
  'พร้อมเพย์ (PromptPay)',
];

export default function AdminDashboard() {
  const router = useRouter();
  const confirm = useConfirm();
  const { dbUser, isLoading: isUserLoading } = useUser() as any;

  const [searchQuery, setSearchQuery] = useState('');
  const [roleModal, setRoleModal] = useState<{
    open: boolean;
    member: MemberInfo | null;
    newRole: Role | '';
  }>({ open: false, member: null, newRole: '' });
  const [bankAssignModal, setBankAssignModal] = useState<{
    open: boolean;
    houseId: string;
    selectedBankId: string;
  }>({ open: false, houseId: '', selectedBankId: '' });
  const [bankFormModal, setBankFormModal] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    bankId: string;
    bank_name: string;
    account_no: string;
    account_name: string;
  }>({
    open: false,
    mode: 'add',
    bankId: '',
    bank_name: '',
    account_no: '',
    account_name: '',
  });

  // Access guard
  useEffect(() => {
    if (!isUserLoading && dbUser && !['ADMIN', 'SUPERADMIN'].includes(dbUser.role)) {
      toast.error('ไม่มีสิทธิ์เข้าถึง (Access Denied)');
      router.push('/');
    }
  }, [dbUser, isUserLoading, router]);

  const isAuthorized = dbUser && ['ADMIN', 'SUPERADMIN'].includes(dbUser.role);

  const { data, isLoading, mutate } = useSWR<DashboardData>(
    isAuthorized ? ['get_admin_dashboard', { caller_id: dbUser.id, caller_role: dbUser.role }] : null,
    swrFetcher as any,
  );

  const pendingMembers: HouseRow[] = data?.pendingMembers ?? [];
  const houseMembers: HouseRow[] = data?.houseMembers ?? [];
  const banks: Bank[] = data?.banks ?? [];

  const filteredMembers = houseMembers.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.member?.name?.toLowerCase().includes(q) ||
      h.member?.nickname?.toLowerCase().includes(q) ||
      h.member?.phone?.includes(q)
    );
  });

  const availableRoles: Role[] =
    dbUser?.role === 'SUPERADMIN'
      ? ['MEMBER', 'MANAGER', 'ADMIN', 'SUPERADMIN']
      : ['MEMBER', 'MANAGER', 'ADMIN'];

  /* ----- Mutations ----- */

  const callAndRefresh = async (
    action: string,
    payload: Record<string, unknown>,
    successMsg?: string,
  ) => {
    const result = await callAction(action, {
      caller_id: dbUser.id,
      caller_role: dbUser.role,
      ...payload,
    });
    if (result.status === 'success') {
      toast.success(successMsg || result.message || 'สำเร็จ');
      mutate();
      return true;
    }
    toast.error(result.message || 'ผิดพลาด');
    return false;
  };

  const handleApprove = (houseId: string) =>
    callAndRefresh('approve_house_member', { house_id: houseId, new_status: 'ACTIVE' });

  const handleReject = async (houseId: string) => {
    const ok = await confirm({
      title: 'ปฏิเสธสมาชิก',
      description: 'ปฏิเสธสมาชิกคนนี้?',
      destructive: true,
    });
    if (ok) callAndRefresh('remove_house_member', { house_id: houseId });
  };

  const handleBlock = async (houseId: string) => {
    const ok = await confirm({
      title: 'บล็อกสมาชิก',
      description: 'บล็อกสมาชิกคนนี้?',
      destructive: true,
    });
    if (ok) callAndRefresh('approve_house_member', { house_id: houseId, new_status: 'BLOCKED' });
  };

  const handleRemove = async (houseId: string) => {
    const ok = await confirm({
      title: 'ลบสมาชิก',
      description: 'ลบสมาชิกออกจากบ้าน?',
      destructive: true,
    });
    if (ok) callAndRefresh('remove_house_member', { house_id: houseId });
  };

  const submitRoleChange = async () => {
    if (!roleModal.newRole || !roleModal.member) return;
    const ok = await callAndRefresh('update_member_role', {
      member_id: roleModal.member.id,
      new_role: roleModal.newRole,
    });
    if (ok) setRoleModal({ open: false, member: null, newRole: '' });
  };

  const submitBankAssign = async () => {
    const ok = await callAndRefresh('assign_member_bank', {
      house_id: bankAssignModal.houseId,
      bank_id: bankAssignModal.selectedBankId || null,
    });
    if (ok) setBankAssignModal({ open: false, houseId: '', selectedBankId: '' });
  };

  const submitBankForm = async () => {
    const { mode, bankId, bank_name, account_no, account_name } = bankFormModal;
    if (!bank_name || !account_no || !account_name) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    const action = mode === 'add' ? 'add_bank' : 'edit_bank';
    const payload =
      mode === 'add'
        ? { bank_name, account_no, account_name }
        : { bank_id: bankId, bank_name, account_no, account_name };
    const ok = await callAndRefresh(action, payload);
    if (ok)
      setBankFormModal({
        open: false,
        mode: 'add',
        bankId: '',
        bank_name: '',
        account_no: '',
        account_name: '',
      });
  };

  const handleDeleteBank = async (bankId: string) => {
    const ok = await confirm({
      title: 'ลบบัญชี',
      description: 'ลบบัญชีนี้?',
      destructive: true,
    });
    if (ok) callAndRefresh('delete_bank', { bank_id: bankId });
  };

  const handleSetDefault = (bankId: string) => callAndRefresh('set_default_bank', { bank_id: bankId });

  const handleCopyInviteLink = () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const link = `https://liff.line.me/${liffId}?house=${dbUser.id}`;
    navigator.clipboard.writeText(link);
    toast.success('คัดลอกลิงก์เชิญเข้าบ้านแชร์แล้ว!');
  };

  /* ----- Render guards ----- */

  if (isUserLoading || !isAuthorized) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="font-semibold text-primary">กำลังตรวจสอบสิทธิ์ Admin...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
          <Wrench className="size-6" />
        </div>
        <div>
          <h2 className="m-0 text-2xl font-extrabold">แผงควบคุมแอดมิน</h2>
          <p className="m-0 text-sm text-muted-foreground">จัดการสมาชิกและบัญชีธนาคารของบ้าน</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="gap-1.5">
            รออนุมัติ
            {pendingMembers.length > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[0.65rem]">
                {pendingMembers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Users className="size-4" /> สมาชิก
          </TabsTrigger>
          <TabsTrigger value="banks" className="gap-1.5">
            <Landmark className="size-4" /> ธนาคาร
          </TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="pending" className="flex flex-col gap-4">
          <Card className="border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center">
            <h4 className="m-0 mb-2 text-base font-bold">ชวนสมาชิกใหม่</h4>
            <p className="mb-4 text-sm text-muted-foreground">
              ส่งลิงก์ให้สมาชิกเพื่อขอเข้าร่วมบ้านแชร์ของคุณ
            </p>
            <Button onClick={handleCopyInviteLink} className="w-full">
              <Link2 className="size-4" /> คัดลอกลิงก์เชิญ
            </Button>
          </Card>

          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : pendingMembers.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 border-dashed bg-muted/30 px-6 py-14 text-center">
              <Check className="size-12 text-primary/60" />
              <h3 className="text-base font-semibold text-muted-foreground">
                ไม่มีรายการรออนุมัติ
              </h3>
            </Card>
          ) : (
            pendingMembers.map((h) => (
              <Card key={h.id} className="flex items-center justify-between p-5">
                <div className="min-w-0">
                  <strong className="block truncate text-base">
                    {h.member?.name || 'ไม่ระบุชื่อ'}
                  </strong>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3.5" />
                    {h.member?.phone || '-'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(h.id)}>
                    อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(h.id)}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    ปฏิเสธ
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Roles tab */}
        <TabsContent value="roles" className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ค้นหาสมาชิก (ชื่อ, เบอร์โทร)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-2xl pl-10"
            />
          </div>

          {isLoading ? (
            <>
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </>
          ) : filteredMembers.length === 0 ? (
            <Card className="border-dashed bg-muted/30 p-10 text-center text-muted-foreground">
              ไม่พบสมาชิกตามเงื่อนไข
            </Card>
          ) : (
            filteredMembers.map((h) => {
              const m = h.member;
              if (!m) return null;
              const isBlocked = h.status === 'BLOCKED';
              return (
                <Card
                  key={h.id}
                  className={cn(
                    'p-5 transition-all',
                    isBlocked && 'border-l-4 border-l-destructive opacity-60',
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-base">{m.name}</strong>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Landmark className="size-3.5" />
                        {h.bank
                          ? `${h.bank.bank_name} (${h.bank.account_no})`
                          : 'ใช้บัญชีหลักของบ้าน'}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-primary text-primary">
                      {m.role}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={() => setRoleModal({ open: true, member: m, newRole: m.role })}
                    >
                      <Crown className="size-3.5" /> ปรับตำแหน่ง
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                      onClick={() =>
                        setBankAssignModal({
                          open: true,
                          houseId: h.id,
                          selectedBankId: h.assigned_bank_id || '',
                        })
                      }
                    >
                      <Landmark className="size-3.5" /> เลือกธนาคาร
                    </Button>
                    {isBlocked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        onClick={() => handleApprove(h.id)}
                      >
                        <Unlock className="size-3.5" /> ปลดล็อก
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        onClick={() => handleBlock(h.id)}
                      >
                        <Ban className="size-3.5" /> บล็อก
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      onClick={() => handleRemove(h.id)}
                    >
                      <Trash2 className="size-3.5" /> ลบออก
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Banks tab */}
        <TabsContent value="banks" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-base font-bold">บัญชีรับเงินของบ้าน</h3>
            <Button
              size="sm"
              onClick={() =>
                setBankFormModal({
                  open: true,
                  mode: 'add',
                  bankId: '',
                  bank_name: '',
                  account_no: '',
                  account_name: '',
                })
              }
            >
              <Plus className="size-4" /> เพิ่มบัญชี
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : banks.length === 0 ? (
            <Card className="border-dashed bg-muted/30 p-10 text-center text-muted-foreground">
              ยังไม่มีข้อมูลบัญชีธนาคาร
            </Card>
          ) : (
            banks.map((b) => (
              <Card
                key={b.id}
                className={cn(
                  'p-5 transition-all',
                  b.is_default ? 'border-l-[6px] border-l-primary' : '',
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-base">{b.bank_name}</strong>
                      {b.is_default && (
                        <Badge variant="success" className="text-[0.6rem]">
                          หลัก
                        </Badge>
                      )}
                    </div>
                    <div className="my-1 text-xl font-bold text-primary">{b.account_no}</div>
                    <div className="text-sm text-muted-foreground">{b.account_name}</div>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${b.bank_name}\n${b.account_no}\n${b.account_name}`,
                      );
                      toast.success('คัดลอกข้อมูลบัญชีแล้ว');
                    }}
                    aria-label="คัดลอกบัญชี"
                  >
                    <ClipboardCopy className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!b.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-primary text-primary hover:bg-primary/10"
                      onClick={() => handleSetDefault(b.id)}
                    >
                      <Star className="size-3.5" /> ตั้งเป็นหลัก
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    onClick={() =>
                      setBankFormModal({
                        open: true,
                        mode: 'edit',
                        bankId: b.id,
                        bank_name: b.bank_name,
                        account_no: b.account_no,
                        account_name: b.account_name,
                      })
                    }
                  >
                    <Pencil className="size-3.5" /> แก้ไข
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    onClick={() => handleDeleteBank(b.id)}
                    aria-label="ลบบัญชี"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Role Modal */}
      <Dialog
        open={roleModal.open}
        onOpenChange={(o) => !o && setRoleModal({ open: false, member: null, newRole: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="size-5" /> ปรับตำแหน่ง
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">
            เลือกตำแหน่งใหม่ให้คุณ <strong>{roleModal.member?.name}</strong>
          </p>
          <select
            value={roleModal.newRole}
            onChange={(e) => setRoleModal({ ...roleModal, newRole: e.target.value as Role })}
            className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setRoleModal({ open: false, member: null, newRole: '' })}
            >
              ยกเลิก
            </Button>
            <Button type="button" className="flex-1" onClick={submitRoleChange}>
              ยืนยันเปลี่ยน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Assign Modal */}
      <Dialog
        open={bankAssignModal.open}
        onOpenChange={(o) =>
          !o && setBankAssignModal({ open: false, houseId: '', selectedBankId: '' })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="size-5" /> กำหนดบัญชีธนาคาร
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">
            เลือกบัญชีที่จะให้สมาชิกคนนี้โอนเงินเข้า
          </p>
          <select
            value={bankAssignModal.selectedBankId}
            onChange={(e) =>
              setBankAssignModal({ ...bankAssignModal, selectedBankId: e.target.value })
            }
            className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
          >
            <option value="">-- ใช้บัญชีหลักของบ้าน --</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bank_name} | {b.account_no}
              </option>
            ))}
          </select>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() =>
                setBankAssignModal({ open: false, houseId: '', selectedBankId: '' })
              }
            >
              ยกเลิก
            </Button>
            <Button type="button" className="flex-1" onClick={submitBankAssign}>
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Form Modal */}
      <Dialog
        open={bankFormModal.open}
        onOpenChange={(o) =>
          !o &&
          setBankFormModal({
            open: false,
            mode: 'add',
            bankId: '',
            bank_name: '',
            account_no: '',
            account_name: '',
          })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bankFormModal.mode === 'add' ? (
                <>
                  <Plus className="size-5" /> เพิ่มบัญชีใหม่
                </>
              ) : (
                <>
                  <Edit2 className="size-5" /> แก้ไขข้อมูลบัญชี
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5 block text-sm font-bold text-muted-foreground">
                เลือกธนาคาร
              </Label>
              <select
                value={bankFormModal.bank_name}
                onChange={(e) =>
                  setBankFormModal({ ...bankFormModal, bank_name: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm"
              >
                <option value="">-- เลือกธนาคาร --</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-bold text-muted-foreground">
                เลขที่บัญชี
              </Label>
              <Input
                type="text"
                value={bankFormModal.account_no}
                onChange={(e) =>
                  setBankFormModal({ ...bankFormModal, account_no: e.target.value })
                }
                placeholder="xxx-x-xxxxx-x"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-bold text-muted-foreground">
                ชื่อบัญชี
              </Label>
              <Input
                type="text"
                value={bankFormModal.account_name}
                onChange={(e) =>
                  setBankFormModal({ ...bankFormModal, account_name: e.target.value })
                }
                placeholder="นายใจดี มีสุข"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() =>
                setBankFormModal({
                  open: false,
                  mode: 'add',
                  bankId: '',
                  bank_name: '',
                  account_no: '',
                  account_name: '',
                })
              }
            >
              ยกเลิก
            </Button>
            <Button type="button" className="flex-1" onClick={submitBankForm}>
              {bankFormModal.mode === 'add' ? 'เพิ่มบัญชี' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
