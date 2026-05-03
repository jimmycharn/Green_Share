'use client';

import { useEffect, useMemo, useCallback } from 'react';
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
  Repeat,
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
  amount_per_hand: z.coerce.number().min(0, 'ยอดงวดต้องไม่ติดลบ'),
  total_hands: z.coerce.number().int().positive('จำนวนมือต้องมากกว่า 0'),
  start_date: z.string().min(1, 'กรุณาเลือกวันที่เริ่มต้น'),
  period_type: z.enum(['MONTHLY', 'BIMONTHLY', 'DAILY']),
  period_interval: z.coerce.number().int().min(1),
  period_value: z.string().optional(),
  bimonthly_day1: z.coerce.number().int().min(1).max(31).optional(),
  bimonthly_day2: z.coerce.number().int().min(1).max(31).optional(),
  bimonthly_mode: z.enum(['CUSTOM', 'FIRST_LAST']).optional(),
  interest_method: z.enum(['หักดอก', 'ไม่หักดอก']),
  bid_start_time: z.string().min(1),
  bid_end_time: z.string().min(1),
  min_bid: z.coerce.number().min(0),
  max_bid: z.coerce.number().min(0),
  notify_hours: z.coerce.number().min(0),
  close_mode: z.enum(['แอดมินปิดเอง', 'ปิดอัตโนมัติ']),
  line_group_url: z.string().url('กรุณากรอก URL ที่ถูกต้อง').optional().or(z.literal('')),
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
      period_type: 'MONTHLY',
      period_interval: 1,
      period_value: '',
      bimonthly_day1: 1,
      bimonthly_day2: 15,
      bimonthly_mode: 'CUSTOM',
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
  const startDate = watch('start_date');
  const periodType = watch('period_type');
  const periodInterval = watch('period_interval');
  const bimonthlyDay1 = watch('bimonthly_day1');
  const bimonthlyDay2 = watch('bimonthly_day2');
  const bimonthlyMode = watch('bimonthly_mode');
  const circleType = watch('type');
  const isStepInterest = circleType === 'ขั้นบันได (ดอกคงที่)';

  const totalAmount =
    !isStepInterest && Number.isFinite(amountPerHand) && Number.isFinite(totalHands)
      ? Number(amountPerHand) * Number(totalHands)
      : 0;

  // Compute period_value from bimonthly fields
  const computedPeriodValue = useMemo(() => {
    if (periodType === 'BIMONTHLY') {
      if (bimonthlyMode === 'FIRST_LAST') return 'FIRST_LAST';
      const d1 = Math.min(bimonthlyDay1 || 1, bimonthlyDay2 || 15);
      const d2 = Math.max(bimonthlyDay1 || 1, bimonthlyDay2 || 15);
      return `${d1},${d2}`;
    }
    if (periodType === 'MONTHLY') {
      // Use the day from start_date
      if (startDate) {
        const day = new Date(startDate + 'T00:00:00').getDate();
        return String(day);
      }
    }
    return '';
  }, [periodType, bimonthlyMode, bimonthlyDay1, bimonthlyDay2, startDate]);

  // Preview period dates (client-side calculation, matching backend logic)
  const previewDates = useMemo(() => {
    if (!startDate || !totalHands || totalHands <= 0) return [];
    const hands = Math.min(Number(totalHands), 100);
    const interval = Number(periodInterval) || 1;
    const start = new Date(startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return [];

    const fmt = (d: Date) =>
      d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const dates: { period: number; label: string }[] = [];

    if (periodType === 'MONTHLY') {
      const dayOfMonth = start.getDate();
      for (let i = 0; i < hands; i++) {
        if (i === 0) {
          dates.push({ period: 1, label: fmt(start) });
          continue;
        }
        const d = new Date(start);
        d.setMonth(d.getMonth() + i * interval);
        d.setDate(Math.min(dayOfMonth, daysIn(d.getFullYear(), d.getMonth())));
        dates.push({ period: i + 1, label: fmt(d) });
      }
    } else if (periodType === 'BIMONTHLY') {
      const isFL = bimonthlyMode === 'FIRST_LAST';
      let d1 = isFL ? 1 : bimonthlyDay1 || 1;
      let d2 = isFL ? -1 : bimonthlyDay2 || 15;
      if (!isFL && d1 > d2) [d1, d2] = [d2, d1];
      let year = start.getFullYear(),
        month = start.getMonth();
      const allDates: Date[] = [];
      for (let m = 0; m < hands && allDates.length < hands; m++) {
        const dv1 = Math.min(d1, daysIn(year, month));
        const dv2 = isFL ? daysIn(year, month) : Math.min(d2, daysIn(year, month));
        const dt1 = new Date(year, month, dv1);
        const dt2 = new Date(year, month, dv2);
        if (dt1 >= start && allDates.length < hands) allDates.push(dt1);
        if (dt2 >= start && dt2.getTime() !== dt1.getTime() && allDates.length < hands)
          allDates.push(dt2);
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      while (allDates.length < hands) {
        const dv1 = Math.min(d1, daysIn(year, month));
        const dv2 = isFL ? daysIn(year, month) : Math.min(d2, daysIn(year, month));
        allDates.push(new Date(year, month, dv1));
        if (allDates.length < hands && dv2 !== dv1) allDates.push(new Date(year, month, dv2));
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      allDates.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 0; i < Math.min(hands, allDates.length); i++) {
        dates.push({ period: i + 1, label: fmt(allDates[i]!) });
      }
    } else {
      // DAILY
      for (let i = 0; i < hands; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * interval);
        dates.push({ period: i + 1, label: fmt(d) });
      }
    }
    return dates;
  }, [
    startDate,
    totalHands,
    periodType,
    periodInterval,
    bimonthlyDay1,
    bimonthlyDay2,
    bimonthlyMode,
  ]);

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
      period_type: values.period_type,
      period_interval: values.period_interval,
      period_value: computedPeriodValue,
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
          <Field
            icon={<Tag className="size-4" />}
            label="ชื่อวง"
            error={errors.circle_name?.message}
          >
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

          {!isStepInterest && (
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
          )}

          <div className="grid grid-cols-2 gap-4">
            {!isStepInterest ? (
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
            ) : null}

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

          {!isStepInterest && (
            <Field icon={<Calculator className="size-4" />} label="ยอดรวมทั้งหมด">
              <div
                className={cn(
                  'flex items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-5 py-5 text-2xl font-bold',
                  totalAmount ? 'text-primary' : 'text-muted-foreground/60'
                )}
              >
                {totalAmount ? totalAmount.toLocaleString() : 'คำนวณอัตโนมัติ'}
              </div>
            </Field>
          )}

          <div className={cn('grid gap-4', isStepInterest ? 'grid-cols-1' : 'grid-cols-2')}>
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
            {!isStepInterest && (
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
            )}
          </div>

          {/* ───── Frequency Picker ───── */}
          <div className="-mx-2.5 rounded-3xl border border-border bg-gradient-to-b from-emerald-50/60 to-background p-5">
            <h4 className="m-0 mb-4 flex items-center gap-2 px-1 text-base font-bold text-muted-foreground">
              <Repeat className="size-4" /> ความถี่ของงวด
            </h4>

            {/* Segmented Control */}
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">
              {(
                [
                  { value: 'MONTHLY', label: '🗓️ รายเดือน' },
                  { value: 'BIMONTHLY', label: '📆 ครึ่งเดือน' },
                  { value: 'DAILY', label: '📋 รายวัน' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-xl px-2 py-2.5 text-center text-xs font-bold transition-all',
                    periodType === opt.value
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <input
                    type="radio"
                    {...register('period_type')}
                    value={opt.value}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Sub-options based on type */}
            {periodType === 'MONTHLY' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">ทุก</span>
                <select
                  {...register('period_interval')}
                  className="h-9 w-16 rounded-xl border-2 border-muted bg-background px-2 text-center text-sm font-bold outline-none focus:border-primary"
                >
                  {[1, 2, 3, 4, 6].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">เดือน</span>
              </div>
            )}

            {periodType === 'BIMONTHLY' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all',
                      bimonthlyMode === 'CUSTOM'
                        ? 'border-primary bg-primary/5 font-bold text-primary'
                        : 'border-muted text-muted-foreground'
                    )}
                  >
                    <input
                      type="radio"
                      {...register('bimonthly_mode')}
                      value="CUSTOM"
                      className="sr-only"
                    />
                    กำหนดวันเอง
                  </label>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all',
                      bimonthlyMode === 'FIRST_LAST'
                        ? 'border-primary bg-primary/5 font-bold text-primary'
                        : 'border-muted text-muted-foreground'
                    )}
                  >
                    <input
                      type="radio"
                      {...register('bimonthly_mode')}
                      value="FIRST_LAST"
                      className="sr-only"
                    />
                    ต้นเดือน + สิ้นเดือน
                  </label>
                </div>
                {bimonthlyMode === 'CUSTOM' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">วันที่</span>
                    <Input
                      {...register('bimonthly_day1')}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      className="h-9 w-14 rounded-xl border-2 px-2 text-center text-sm font-bold"
                    />
                    <span className="text-muted-foreground">กับ</span>
                    <Input
                      {...register('bimonthly_day2')}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      className="h-9 w-14 rounded-xl border-2 px-2 text-center text-sm font-bold"
                    />
                    <span className="text-muted-foreground">ของทุกเดือน</span>
                  </div>
                )}
              </div>
            )}

            {periodType === 'DAILY' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">ทุก</span>
                <select
                  {...register('period_interval')}
                  className="h-9 w-16 rounded-xl border-2 border-muted bg-background px-2 text-center text-sm font-bold outline-none focus:border-primary"
                >
                  {[1, 2, 3, 5, 7, 10, 14, 15, 30].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">วัน</span>
              </div>
            )}

            {/* Preview */}
            {previewDates.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border bg-background p-3">
                <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <CalendarDays className="size-3.5" /> ตัวอย่างวันที่งวด
                </p>
                <div className="flex flex-col gap-1">
                  {previewDates.slice(0, 5).map((pd) => (
                    <div key={pd.period} className="flex items-center gap-2 text-sm">
                      <span className="inline-flex size-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {pd.period}
                      </span>
                      <span className="text-foreground">{pd.label}</span>
                      {pd.period === 1 && (
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          เริ่มต้น
                        </span>
                      )}
                    </div>
                  ))}
                  {previewDates.length > 5 && (
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                      ...อีก {previewDates.length - 5} งวด (จนถึง{' '}
                      {previewDates[previewDates.length - 1]!.label})
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bidding settings group */}
          {!isStepInterest && (
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
          )}

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
