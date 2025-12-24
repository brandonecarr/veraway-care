'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Users, FileText, Moon, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  icon: typeof Home;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/patients', icon: Users, label: 'Patients' },
  { href: '/dashboard/archive', icon: Archive, label: 'Archive' },
  { href: '/dashboard/audit-log', icon: FileText, label: 'Audit' },
  { href: '/dashboard/handoffs', icon: Moon, label: 'Handoffs' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#D4D4D4] px-2 pb-safe"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
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
