'use client';

import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[600px] px-4 pb-[90px] pt-[80px]">{children}</main>
      <BottomNav />
    </>
  );
}
