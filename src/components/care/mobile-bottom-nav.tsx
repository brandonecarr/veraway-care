'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Users, FileText, Archive, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFacilityPath } from '@/hooks/use-facility-slug';

interface NavItem {
  path: string; // Relative path without facility slug
  icon: typeof Home;
  label: string;
}

const navItems: NavItem[] = [
  { path: '', icon: Home, label: 'Home' }, // Empty string for base dashboard
  { path: 'messages', icon: MessageSquare, label: 'Messages' },
  { path: 'patients', icon: Users, label: 'Patients' },
  { path: 'archive', icon: Archive, label: 'Archive' },
  { path: 'after-shift-reports', icon: FileText, label: 'Reports' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const getPath = useFacilityPath();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#D4D4D4] px-2 pb-safe"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const href = getPath(item.path);
          const isActive = pathname === href;
          return (
            <button
              key={item.path}
              onClick={() => router.push(href)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors touch-manipulation',
                'min-w-[64px] min-h-[48px]',
                isActive
                  ? 'text-[#2D7A7A] bg-[#2D7A7A]/10'
                  : 'text-muted-foreground hover:text-[#1A1A1A] active:bg-gray-100'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5',
                isActive && 'stroke-[2.5]'
              )} />
              <span className={cn(
                'text-[10px] font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
