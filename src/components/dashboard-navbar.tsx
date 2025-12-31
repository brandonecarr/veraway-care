'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '../../supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet'
import { Button } from './ui/button'
import { Avatar, AvatarFallback } from './ui/avatar'
import { UserCircle, Home, Users, FileText, Menu, BarChart3, Archive, MessageSquare, Settings, LogOut, User } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { NotificationCenter } from './care/notification-center'
import { useIsMobile } from '@/hooks/use-mobile'
import { useFacilityPath } from '@/hooks/use-facility-slug'

interface UserInfo {
  name: string;
  email: string;
  role: string;
  jobRole?: string;
}

export default function DashboardNavbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const getPath = useFacilityPath()

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('name, email, facility_id')
        .eq('id', user.id)
        .single();

      if (userData) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role, job_role')
          .eq('user_id', user.id)
          .eq('facility_id', userData.facility_id)
          .maybeSingle();

        setUserInfo({
          name: userData.name || user.email?.split('@')[0] || 'User',
          email: userData.email || user.email || '',
          role: roleData?.role || 'clinician',
          jobRole: roleData?.job_role,
        });
      }
    };

    fetchUserInfo();
  }, [supabase]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayRole = () => {
    if (!userInfo) return '';
    if (userInfo.role === 'coordinator') return 'Coordinator';
    return userInfo.jobRole || 'Clinician';
  };

  const navLinks = [
    { path: '', label: 'Dashboard', icon: Home },
    { path: 'analytics', label: 'Analytics', icon: BarChart3 },
    { path: 'patients', label: 'Patients', icon: Users },
    { path: 'archive', label: 'Archive', icon: Archive },
    { path: 'audit-log', label: 'Audit Log', icon: FileText },
    { path: 'after-shift-reports', label: 'Shift Reports', icon: FileText },
    { path: 'messages', label: 'Message Center', icon: MessageSquare },
  ]

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false)
    router.push(getPath(path))
  }

  return (
    <nav className="w-full border-b border-[#D4D4D4] bg-white py-4 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href={getPath('')} prefetch className="text-xl font-bold text-[#1A1A1A]">
            CareTrack
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => {
              const href = getPath(link.path);
              return (
                <Link key={link.path} href={href} prefetch>
                  <Button
                    variant="ghost"
                    className={pathname === href ? 'bg-[#FAFAF8]' : ''}
                  >
                    <link.icon className="h-4 w-4 mr-2" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
        
        <div className="flex gap-2 md:gap-4 items-center">
          <NotificationCenter />
          
          {/* Desktop User Menu */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8 bg-[#2D7A7A]">
                    <AvatarFallback className="bg-[#2D7A7A] text-white text-sm font-medium">
                      {userInfo ? getInitials(userInfo.name) : '??'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-0">
                {/* User Info Header */}
                <div className="px-4 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 bg-[#2D7A7A]">
                      <AvatarFallback className="bg-[#2D7A7A] text-white text-sm font-medium">
                        {userInfo ? getInitials(userInfo.name) : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {userInfo?.name || 'Loading...'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getDisplayRole()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <DropdownMenuItem
                    onClick={() => router.push(getPath('settings'))}
                    className="px-4 py-2.5 cursor-pointer"
                  >
                    <User className="h-4 w-4 mr-3 text-gray-500" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push(getPath('settings'))}
                    className="px-4 py-2.5 cursor-pointer"
                  >
                    <Settings className="h-4 w-4 mr-3 text-gray-500" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="my-0" />

                <div className="py-2">
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut()
                      router.push("/")
                    }}
                    className="px-4 py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Hamburger Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
              {/* User Info Header */}
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 bg-[#2D7A7A]">
                    <AvatarFallback className="bg-[#2D7A7A] text-white font-medium">
                      {userInfo ? getInitials(userInfo.name) : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {userInfo?.name || 'Loading...'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {getDisplayRole()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => {
                  const href = getPath(link.path);
                  return (
                    <Button
                      key={link.path}
                      variant={pathname === href ? 'secondary' : 'ghost'}
                      className="justify-start h-12 text-base"
                      onClick={() => handleNavClick(link.path)}
                    >
                      <link.icon className="h-5 w-5 mr-3" />
                      {link.label}
                    </Button>
                  );
                })}
                <div className="border-t border-[#D4D4D4] my-3" />
                <Button
                  variant="ghost"
                  className="justify-start h-12 text-base"
                  onClick={() => handleNavClick('settings')}
                >
                  <User className="h-5 w-5 mr-3" />
                  Profile
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start h-12 text-base"
                  onClick={() => handleNavClick('settings')}
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start h-12 text-base text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    setMobileMenuOpen(false)
                    router.push("/")
                  }}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
