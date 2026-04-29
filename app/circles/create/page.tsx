'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CalendarDays,
  Calculator,
  Clock,
  Coins,
  Hand,
  Info,
  Link as LinkIcon,
  Loader2,
  Plus,
  Scale,
  Scissors,
  Settings2,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction } from '@/lib/api';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  circle_name: z.string().min(1, 'กรุณากรอกชื่อวง').max(120),
  type: z.enum(['ประมูล (เปียแข่งดอก)', 'ขั้นบันได (ดอกคงที่)']),
  bid_permission: z.enum(['NONE', 'PARTIAL', 'ALL']),
  amount_per_hand: z.coerce.number().positive('ยอดงวดต้องมากกว่า 0'),
  total_hands: z.coerce.number().int().positive('จำนวนมือต้องมากกว่า 0'),
  start_date: z.string().min(1, 'กรุณาเลือกวันที่เริ่มต้น'),
  interest_method: z.enum(['หักดอก', 'ไม่หักดอก']),
  bid_start_time: z.string().min(1),
  bid_end_time: z.string().min(1),
  min_bid: z.coerce.number().min(0),
  max_bid: z.coerce.number().min(0),
  notify_hours: z.coerce.number().min(0),
  close_mode: z.enum(['แอดมินปิดเอง', 'ปิดอัตโนมัติ']),
  line_group_url: z
    .string()
    .url('กรุณากรอก URL ที่ถูกต้อง')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

const inputClass =
  'h-12 w-full rounded-2xl border-2 border-muted bg-background px-4 text-base outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10';
const compactClass =
  'h-11 w-full rounded-xl border-2 border-muted bg-background px-3 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10';

export default function CreateCirclePage() {
  const router = useRouter();
  const { dbUser } = useUser() as any;

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      circle_name: '',
      type: 'ประมูล (เปียแข่งดอก)',
      interest_method: 'ไม่หักดอก',
      amount_per_hand: 1000,
      total_hands: 10,
      line_group_url: '',
      start_date: today,
      bid_start_time: '08:00',
      bid_end_time: '13:00',
      min_bid: 200,
      max_bid: 500,
      notify_hours: 1,
      close_mode: 'ปิดอัตโนมัติ',
      bid_permission: 'ALL',
    },
  });

  const amountPerHand = watch('amount_per_hand');
  const totalHands = watch('total_hands');
  const totalAmount =
    Number.isFinite(amountPerHand) && Number.isFinite(totalHands)
      ? Number(amountPerHand) * Number(totalHands)
      : 0;

  useEffect(() => {
    if (!dbUser) return;
  }, [dbUser]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!dbUser) {
      toast.error('กรุณารอข้อมูลสมาชิกโหลดสักครู่...');
      return;
    }

    const result = await callAction<{ id?: string }>('create_circle', {
      creator_id: dbUser.id,
      circle_name: values.circle_name,
      type: values.type,
      amount_per_hand: values.amount_per_hand,
      total_hands: values.total_hands,
      total_amount: totalAmount,
      line_group_url: values.line_group_url,
      start_date: values.start_date,
      interest_method: values.interest_method,
      bid_start_time: values.bid_start_time,
      bid_end_time: values.bid_end_time,
      min_bid: values.min_bid,
      max_bid: values.max_bid,
      notify_hours: values.notify_hours,
      close_mode: values.close_mode,
      bid_permission: values.bid_permission,
    });

    if (result.status === 'success' && result.id) {
      toast.success('สร้างวงแชร์สำเร็จ!');
      router.push(`/circles/${result.id}`);
    } else {
      toast.error(result.message || 'สร้างวงแชร์ไม่สำเร็จ');
    }
  };

  return (
    <div className="animate-fade-in -mx-2">
      {/* Header */}
      <div className="mt-2.5 flex items-center gap-4 rounded-t-3xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-7 text-white shadow-md">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20">
          <Users className="size-7" />
        </div>
        <div>
          <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold">
            <Sparkles className="size-5" /> ข้อมูลวงแชร์
          </h2>
          <p className="m-0 mt-0.5 text-sm text-white/90">กรอกรายละเอียดให้ครบถ้วน</p>
        </div>
      </div>

      <Card className="rounded-t-none rounded-b-3xl px-3.5 py-6 shadow-sm sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Field icon={<Tag className="size-4" />} label="ชื่อวง" error={errors.circle_name?.message}>
            <Input
              {...register('circle_name')}
              placeholder="เช่น วงเพื่อนซี้, วงครอบครัว"
              className="h-12 rounded-2xl border-2 px-4 text-base"
            />
          </Field>

          <Field
            icon={<Settings2 className="size-4" />}
            label="ประเภทวง"
            error={errors.type?.message}
          >
            <select {...register('type')} className={inputClass}>
              <option value="ประมูล (เปียแข่งดอก)">🎯 บิงโก (ประมูลราคาสูงสุด)</option>
              <option value="ขั้นบันได (ดอกคงที่)">📊 ขั้นบันได (ดอกคงที่)</option>
            </select>
          </Field>

          <Field
            icon={<Scale className="size-4" />}
            label="สิทธิประมูล (Auction Permission)"
            error={errors.bid_permission?.message}
          >
            <select {...register('bid_permission')} className={inputClass}>
              <option value="NONE">ไม่ต้องชำระก่อน (Free to bid)</option>
              <option value="PARTIAL">ต้องชำระบางมือก่อนอย่างน้อย 1 มือ</option>
              <option value="ALL">ต้องชำระทุกมือก่อนในงวดนั้น</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              icon={<Coins className="size-4" />}
              label="งวดละ (บาท)"
              error={errors.amount_per_hand?.message}
            >
              <Input
                {...register('amount_per_hand')}
                type="number"
                inputMode="numeric"
                placeholder="10000"
                className="h-12 rounded-2xl border-2 px-4 text-base"
              />
            </Field>
            <Field
              icon={<Hand className="size-4" />}
              label="จำนวนมือ"
              error={errors.total_hands?.message}
            >
              <Input
                {...register('total_hands')}
                type="number"
                inputMode="numeric"
                placeholder="10"
                className="h-12 rounded-2xl border-2 px-4 text-base"
              />
            </Field>
          </div>

          <Field icon={<Calculator className="size-4" />} label="ยอดรวมทั้งหมด">
            <div
              className={cn(
                'flex items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-5 py-5 text-2xl font-bold',
                totalAmount ? 'text-primary' : 'text-muted-foreground/60',
              )}
            >
              {totalAmount ? totalAmount.toLocaleString() : 'คำนวณอัตโนมัติ'}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              icon={<CalendarDays className="size-4" />}
              label="วันที่เริ่มต้น"
              error={errors.start_date?.message}
            >
              <Input
                {...register('start_date')}
                type="date"
                className="h-12 rounded-2xl border-2 px-4 text-base"
              />
            </Field>
            <Field
              icon={<Scissors className="size-4" />}
              label="วิธีคิดดอก"
              error={errors.interest_method?.message}
            >
              <select {...register('interest_method')} className={inputClass}>
                <option value="หักดอก">หักดอก (Interest Deduct)</option>
                <option value="ไม่หักดอก">ไม่หักดอก (Interest Add)</option>
              </select>
            </Field>
          </div>

          {/* Bidding settings group */}
          <div className="-mx-2.5 rounded-3xl border border-border bg-muted/40 p-5">
            <h4 className="m-0 mb-4 flex items-center gap-2 px-1 text-base font-bold text-muted-foreground">
              <Settings2 className="size-4" /> ตั้งค่าการประมูลพื้นฐาน
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <CompactField
                icon={<Clock className="size-3.5" />}
                label="เวลาเปิดประมูล"
                error={errors.bid_start_time?.message}
              >
                <Input {...register('bid_start_time')} type="time" className={compactClass} />
              </CompactField>
              <CompactField
                icon={<Clock className="size-3.5" />}
                label="เวลาปิดประมูล"
                error={errors.bid_end_time?.message}
              >
                <Input {...register('bid_end_time')} type="time" className={compactClass} />
              </CompactField>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <CompactField
                icon={<Coins className="size-3.5" />}
                label="ดอกต่ำสุด"
                error={errors.min_bid?.message}
              >
                <Input
                  {...register('min_bid')}
                  type="number"
                  inputMode="numeric"
                  className={compactClass}
                />
              </CompactField>
              <CompactField
                icon={<Coins className="size-3.5" />}
                label="ดอกสูงสุด"
                error={errors.max_bid?.message}
              >
                <Input
                  {...register('max_bid')}
                  type="number"
                  inputMode="numeric"
                  className={compactClass}
                />
              </CompactField>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <CompactField
                icon={<Clock className="size-3.5" />}
                label="แจ้งเตือนก่อน (ชม.)"
                error={errors.notify_hours?.message}
              >
                <Input
                  {...register('notify_hours')}
                  type="number"
                  inputMode="numeric"
                  className={compactClass}
                />
              </CompactField>
              <CompactField
                icon={<Settings2 className="size-3.5" />}
                label="โหมดปิดงวด"
                error={errors.close_mode?.message}
              >
                <select {...register('close_mode')} className={compactClass}>
                  <option value="แอดมินปิดเอง">แอดมินปิดเอง</option>
                  <option value="ปิดอัตโนมัติ">ปิดอัตโนมัติ</option>
                </select>
              </CompactField>
            </div>
          </div>

          <Field
            icon={<LinkIcon className="size-4" />}
            label="ลิงก์กลุ่มแชท (Line group URL)"
            error={errors.line_group_url?.message}
          >
            <Input
              {...register('line_group_url')}
              type="url"
              placeholder="https://line.me/R/ti/g/..."
              className="h-12 rounded-2xl border-2 px-4 text-base"
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-base font-extrabold shadow-[0_10px_20px_rgba(56,161,105,0.3)] hover:from-emerald-600 hover:to-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" /> กำลังสร้าง...
              </>
            ) : (
              <>
                <Plus className="size-5" /> สร้างวงแชร์
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4" />
          <span>หลังสร้างวงแล้วสามารถเพิ่มสมาชิกได้ทันที</span>
        </div>
      </Card>
    </div>
  );
}

/* ----- sub-components ----- */

function Field({
  icon,
  label,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {error && <p className="mt-1.5 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function CompactField({
  icon,
  label,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
