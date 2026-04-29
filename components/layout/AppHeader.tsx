'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

/**
 * Format the display name shown in the header.
 * - Admins / SuperAdmins show their `house_name` if available
 * - Members show "Nickname (RealName)" or whichever is set
 * - Falls back to LIFF profile display name, then app name
 */
function getDisplayName(profile: { displayName?: string } | null, dbUser: any) {
  const isOwner = ['SUPERADMIN', 'ADMIN'].includes(dbUser?.role);
  if (isOwner && dbUser?.house_name) return dbUser.house_name;
  if (dbUser) {
    if (dbUser.nickname && dbUser.name && dbUser.nickname !== dbUser.name) {
      return `${dbUser.nickname} (${dbUser.name})`;
    }
    return dbUser.nickname || dbUser.name;
  }
  return profile?.displayName || 'GreenShare';
}

function getInitials(name: string) {
  if (!name) return 'GS';
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function AppHeader() {
  const { profile, dbUser } = useUser() as any;

  const displayName = getDisplayName(profile, dbUser);
  const isOwner = ['SUPERADMIN', 'ADMIN'].includes(dbUser?.role);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[70px] items-center justify-between border-b border-border bg-background/95 px-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col justify-center">
        <span className="text-base font-bold leading-tight text-foreground">{displayName}</span>
        {dbUser && (
          <span className="mt-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-primary">
            {dbUser.role}
            {isOwner && ` • รหัสบ้าน: ${dbUser.id}`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="กิจกรรม">
          <Link href="/activity">
            <Bell className="size-5" />
          </Link>
        </Button>

        <Link href="/profile" aria-label="โปรไฟล์">
          <Avatar className="size-9 border-2 border-background shadow-md">
            {profile?.pictureUrl ? (
              <AvatarImage src={profile.pictureUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
