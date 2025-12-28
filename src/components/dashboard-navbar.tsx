'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '../../supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { UserCircle, Home, Users, FileText, Moon, Menu, X, BarChart3, Archive } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { NotificationCenter } from './care/notification-center'
import { useIsMobile } from '@/hooks/use-mobile'
import { useFacilityPath } from '@/hooks/use-facility-slug'

export default function DashboardNavbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const getPath = useFacilityPath()

  const navLinks = [
    { path: '', label: 'Dashboard', icon: Home },
    { path: 'analytics', label: 'Analytics', icon: BarChart3 },
    { path: 'patients', label: 'Patients', icon: Users },
    { path: 'archive', label: 'Archive', icon: Archive },
    { path: 'audit-log', label: 'Audit Log', icon: FileText },
    { path: 'after-shift-reports', label: 'Shift Reports', icon: FileText },
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
                <Button variant="ghost" size="icon">
                  <UserCircle className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(getPath('settings'))}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  await supabase.auth.signOut()
                  router.push("/")
                }}>
                  Sign out
                </DropdownMenuItem>
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
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 mt-6">
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
                <div className="border-t border-[#D4D4D4] my-4" />
                <Button
                  variant="ghost"
                  className="justify-start h-12 text-base"
                  onClick={() => handleNavClick('settings')}
                >
                  <UserCircle className="h-5 w-5 mr-3" />
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
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
