'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Users, Bell, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'หน้าแรก', icon: Home, path: '/' },
  { label: 'ไทม์ไลน์', icon: BarChart3, path: '/circles/view' },
  { label: 'สมาชิก', icon: Users, path: '/members' },
  { label: 'กิจกรรม', icon: Bell, path: '/activity' },
  { label: 'ตั้งค่า', icon: Settings, path: '/profile' },
];

function isItemActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname.startsWith(path);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-2 bottom-3 z-50 flex h-[72px] items-center justify-around rounded-2xl border border-white/40 bg-white/70 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-lg"
      aria-label="ส่วนนำทางหลัก"
    >
      {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
        const active = isItemActive(pathname, path);
        return (
          <Link
            key={path}
            href={path}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className={cn('size-6 transition-transform', active && 'scale-110')} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
