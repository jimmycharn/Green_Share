'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Home,
  Loader2,
  Plus,
  Save,
  Settings,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const profileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อจริง').max(120),
  nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น').max(120),
  phone: z
    .string()
    .min(9, 'เบอร์โทรไม่ถูกต้อง')
    .max(20)
    .regex(/^[0-9\-+\s]+$/, 'เบอร์โทรต้องเป็นตัวเลข'),
  bank_account: z.string().min(3, 'กรุณากรอกข้อมูลบัญชีธนาคาร').max(500),
});

type FormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { profile, dbUser, isLoading: isUserLoading } = useUser() as any;
  const [view, setView] = useState<'menu' | 'edit' | 'houses'>('menu');
  const [houses, setHouses] = useState<any[]>([]);
  const [housesLoading, setHousesLoading] = useState(false);
  const [joinHouseOpen, setJoinHouseOpen] = useState(false);
  const [joinHouseCode, setJoinHouseCode] = useState('');
  const [joinHouseLoading, setJoinHouseLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', nickname: '', phone: '', bank_account: '' },
  });

  useEffect(() => {
    if (dbUser) {
      reset({
        name: dbUser.name || '',
        nickname: dbUser.nickname || '',
        phone: dbUser.phone || '',
        bank_account: dbUser.bank_account || '',
      });
    }
  }, [dbUser, reset]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!profile) return;
    const result = await callAction('update_profile', {
      line_id: profile.userId,
      ...values,
    });
    if (result.status === 'success') {
      toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
      setView('menu');
    } else {
      toast.error(result.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const fetchHouses = async () => {
    setHousesLoading(true);
    try {
      const result = (await callAction('get_my_houses', {})) as any;
      if (result.status === 'success') {
        setHouses(result.houses || []);
      }
    } catch {
      toast.error('โหลดรายการบ้านล้มเหลว');
    } finally {
      setHousesLoading(false);
    }
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
        fetchHouses();
      } else {
        toast.error(result.message || 'ไม่สามารถส่งคำขอได้');
      }
    } catch {
      toast.error('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');
    } finally {
      setJoinHouseLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    const result = (await callAction('generate_house_invite', {})) as any;
    if (result.status === 'success' && result.invite_url) {
      navigator.clipboard.writeText(result.invite_url);
      toast.success('คัดลอกลิงก์เชิญแล้ว!');
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = dbUser?.role === 'SUPERADMIN' || dbUser?.role === 'ADMIN';

  if (view === 'menu') {
    return (
      <div className="animate-fade-in flex flex-col gap-3 pt-2.5">
        <h3 className="mx-1.5 mb-1 text-lg font-extrabold">จัดการข้อมูล</h3>

        <MenuItem
          icon={<UserCog className="size-5 text-primary" />}
          label="จัดการโปรไฟล์"
          onClick={() => setView('edit')}
        />

        <MenuItem
          icon={<Home className="size-5 text-emerald-600" />}
          label="บ้านแชร์ของฉัน"
          onClick={() => {
            fetchHouses();
            setView('houses');
          }}
        />

        {isAdmin && (
          <MenuItem
            icon={<Settings className="size-5 text-amber-500" />}
            label="แอดมินตั้งค่า (ขั้นสูง)"
            asChild
          >
            <Link href="/admin" />
          </MenuItem>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground/70">
          เวอร์ชันแอป 1.3.0 (Optimized)
        </p>
      </div>
    );
  }

  if (view === 'houses') {
    return (
      <div className="animate-fade-in flex flex-col gap-3 pt-2.5">
        <div className="mb-2 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView('menu')} aria-label="กลับ">
            <ArrowLeft className="size-5 text-primary" />
          </Button>
          <h3 className="m-0 text-lg font-extrabold">บ้านแชร์ของฉัน</h3>
        </div>

        {housesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : houses.length === 0 ? (
          <Card className="border-dashed bg-muted/30 px-5 py-7 text-center text-sm text-muted-foreground">
            ยังไม่มีบ้านแชร์ที่สังกัดอยู่
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {houses.map((h) => (
              <Card key={h.house_id} className="flex items-center gap-3 p-4">
                {h.admin_picture ? (
                  <img src={h.admin_picture} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-lg">
                    🏠
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-bold">{h.house_name}</div>
                  <div className="text-xs text-muted-foreground">ท้าวแชร์: {h.admin_name}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    h.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : h.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {h.status === 'ACTIVE'
                    ? 'ใช้งาน'
                    : h.status === 'PENDING'
                      ? 'รออนุมัติ'
                      : 'บล็อค'}
                </span>
              </Card>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() => setJoinHouseOpen(true)}
        >
          <Plus className="mr-1.5 size-4 text-primary" />
          เข้าร่วมบ้านใหม่
        </Button>

        {isAdmin && (
          <Button variant="ghost" size="sm" className="w-full" onClick={handleGenerateInvite}>
            <Copy className="mr-1.5 size-4 text-muted-foreground" />
            คัดลอกลิงก์เชิญเข้าบ้าน
          </Button>
        )}

        {/* Join House Dialog */}
        <Dialog open={joinHouseOpen} onOpenChange={setJoinHouseOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>🏠 เข้าร่วมบ้านแชร์อื่น</DialogTitle>
              <DialogDescription>กรอกรหัสบ้านที่ได้รับจากท้าวแชร์</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Label htmlFor="profile-house-code">รหัสบ้านแชร์ (house code)</Label>
              <Input
                id="profile-house-code"
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
              <Button
                onClick={handleJoinHouse}
                disabled={joinHouseLoading || !joinHouseCode.trim()}
              >
                {joinHouseLoading ? 'กำลังส่ง...' : 'ส่งคำขอ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setView('menu')}
            aria-label="กลับ"
          >
            <ArrowLeft className="size-5 text-primary" />
          </Button>
          <h3 className="m-0 text-lg font-bold">แก้ไขข้อมูลโปรไฟล์</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Field label="ชื่อ-นามสกุลจริง" error={errors.name?.message}>
            <Input {...register('name')} autoComplete="name" />
          </Field>
          <Field label="ชื่อเล่น" error={errors.nickname?.message}>
            <Input {...register('nickname')} autoComplete="nickname" />
          </Field>
          <Field label="เบอร์โทรศัพท์" error={errors.phone?.message}>
            <Input {...register('phone')} type="tel" autoComplete="tel" inputMode="tel" />
          </Field>
          <Field label="ข้อมูลธนาคารสำหรับรับเงิน" error={errors.bank_account?.message}>
            <textarea
              {...register('bank_account')}
              rows={3}
              className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>

          <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" /> กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="size-5" /> ยืนยันการเปลี่ยนแปลง
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ----- sub-components ----- */

function MenuItem({
  icon,
  label,
  onClick,
  asChild,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  const inner = (
    <Card className="flex w-full cursor-pointer items-center justify-between p-5 transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.99]">
      <span className="flex items-center gap-3 text-base font-bold">
        {icon}
        {label}
      </span>
      <ChevronRight className="size-5 text-muted-foreground/60" />
    </Card>
  );

  if (asChild && children) {
    // Wrap given <Link> child around the card
    const link = children as React.ReactElement<any>;
    return <link.type {...link.props}>{inner}</link.type>;
  }

  return (
    <button type="button" onClick={onClick} className="text-left">
      {inner}
    </button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-bold text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
