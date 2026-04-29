'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Crown, Sprout, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';

import { useUser } from '@/contexts/UserContext';
import { callAction } from '@/lib/api';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const formSchema = z
  .object({
    name: z.string().min(1, 'กรุณากรอกชื่อจริง').max(120),
    nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น').max(120),
    phone: z
      .string()
      .min(9, 'เบอร์โทรไม่ถูกต้อง')
      .max(20)
      .regex(/^[0-9\-+\s]+$/, 'เบอร์โทรต้องเป็นตัวเลข'),
    bank_account: z.string().min(3, 'กรุณากรอกข้อมูลบัญชีธนาคาร').max(120),
    role: z.enum(['MEMBER', 'ADMIN']),
    house_name: z.string().max(120).optional(),
    house_code: z.string().max(64).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'ADMIN' && !data.house_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['house_name'],
        message: 'กรุณาตั้งชื่อบ้านแชร์',
      });
    }
    if (data.role === 'MEMBER' && !data.house_code?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['house_code'],
        message: 'กรุณากรอกรหัสบ้านแชร์',
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, dbUser, isLoading: isUserLoading } = useUser() as any;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      nickname: '',
      phone: '',
      bank_account: '',
      role: 'MEMBER',
      house_name: '',
      house_code: '',
    },
  });

  const role = watch('role');

  useEffect(() => {
    if (dbUser) {
      router.push('/');
      return;
    }
    if (profile) {
      setValue('name', profile.displayName || '');
      setValue('nickname', profile.displayName || '');

      // Pre-fill house code from URL (?house=M0001) or hash
      const urlParams = new URLSearchParams(window.location.search);
      const houseParam =
        urlParams.get('house') ||
        (window.location.hash.includes('house=')
          ? new URLSearchParams(window.location.hash.split('?')[1]).get('house')
          : null);
      if (houseParam) setValue('house_code', houseParam);
    }
  }, [dbUser, profile, router, setValue]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!profile) return;

    const result = await callAction('register', {
      line_id: profile.userId,
      picture_url: profile.pictureUrl || null,
      ...values,
    });

    if (result.status === 'success') {
      toast.success(result.message || 'สมัครสมาชิกสำเร็จ');
      window.location.href = '/';
    } else {
      toast.error(result.message || 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่ครับ');
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-white">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-white p-5">
      <Card className="w-full max-w-md rounded-[40px] bg-white/95 p-8 shadow-[0_25px_50px_-12px_rgba(16,185,129,0.15)] backdrop-blur-xl sm:p-10">
        {/* Header */}
        <div className="mb-7 text-center">
          {profile?.pictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.pictureUrl}
              alt="Profile"
              className="mx-auto mb-5 size-[90px] rounded-[28px] border-4 border-white object-cover shadow-md"
            />
          )}
          <h2 className="m-0 text-3xl font-black text-emerald-900">ลงทะเบียน 🌱</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            สวัสดีครับคุณ <strong>{profile?.displayName}</strong>
            <br />
            มาร่วมเป็นส่วนหนึ่งของ GreenShare กันนะครับ
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 text-left">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="ชื่อจริง ✍️" error={errors.name?.message}>
              <Input {...register('name')} autoComplete="name" />
            </FieldGroup>
            <FieldGroup label="ชื่อเล่น ✨" error={errors.nickname?.message}>
              <Input {...register('nickname')} autoComplete="nickname" />
            </FieldGroup>
          </div>

          <FieldGroup label="เบอร์โทรศัพท์ 📱" error={errors.phone?.message}>
            <Input
              {...register('phone')}
              type="tel"
              placeholder="08X-XXXXXXX"
              autoComplete="tel"
              inputMode="tel"
            />
          </FieldGroup>

          <FieldGroup label="เลขบัญชีธนาคาร 💰" error={errors.bank_account?.message}>
            <Input {...register('bank_account')} placeholder="ชื่อธนาคาร และ เลขบัญชี" />
          </FieldGroup>

          <div>
            <Label className="mb-2 block pl-1 text-sm font-bold text-foreground">
              คุณต้องการสมัครเป็นอะไรครับ? 😊
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                active={role === 'MEMBER'}
                onClick={() => setValue('role', 'MEMBER')}
                icon={<Sprout className="size-7 text-emerald-600" />}
                title="สมาชิกวงแชร์"
              />
              <RoleCard
                active={role === 'ADMIN'}
                onClick={() => setValue('role', 'ADMIN')}
                icon={<Crown className="size-7 text-amber-500" />}
                title="ท้าวแชร์"
              />
            </div>
          </div>

          {role === 'ADMIN' ? (
            <FieldGroup
              key="house_name"
              label="ตั้งชื่อบ้านแชร์ของคุณ 🏠"
              error={errors.house_name?.message}
              className="duration-300 animate-in fade-in slide-in-from-top-2"
            >
              <Input {...register('house_name')} placeholder="เช่น บ้านแชร์มหาเศรษฐี" />
            </FieldGroup>
          ) : (
            <FieldGroup
              key="house_code"
              label="รหัสบ้านแชร์ที่ต้องการเข้า 🔑"
              error={errors.house_code?.message}
              className="duration-300 animate-in fade-in slide-in-from-top-2"
            >
              <Input
                {...register('house_code')}
                placeholder="รหัสของท้าวแชร์ (เช่น M0001)"
                className="uppercase"
              />
            </FieldGroup>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="mt-2 h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-base font-extrabold shadow-[0_15px_30px_rgba(16,185,129,0.3)] hover:from-emerald-600 hover:to-emerald-800"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" /> กำลังบันทึกข้อมูล...
              </>
            ) : (
              <>
                สมัครสมาชิกและเข้าสู่แอป <Rocket className="size-5" />
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* -------------------- Sub-components -------------------- */

function FieldGroup({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block pl-1 text-sm font-bold text-foreground">{label}</Label>
      {children}
      {error && <p className="mt-1.5 pl-1 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-center gap-2 rounded-3xl border-2 p-5 transition-all',
        active
          ? 'border-primary bg-emerald-50 shadow-md'
          : 'border-muted bg-card hover:border-primary/40',
      )}
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-sm font-extrabold text-emerald-900">{title}</span>
    </button>
  );
}
