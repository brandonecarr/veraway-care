import Link from 'next/link'
import { createClient } from '../../supabase/server'
import { Button } from './ui/button'
import { User, UserCircle, Heart, ArrowRight } from 'lucide-react'
import UserProfile from './user-profile'

export default async function Navbar() {
  const supabase = createClient()

  const { data: { user } } = await (await supabase).auth.getUser()


  return (
    <nav className="sticky top-0 w-full border-b border-[#E0E0E0] bg-white/80 backdrop-blur-md z-50 py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link href="/" prefetch className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2D7A7A] to-[#236060] flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
            Veraway Care
          </span>
        </Link>

        {/* Navigation Links - Hidden on mobile, shown on desktop */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#pricing"
            className="text-sm font-medium text-[#666] hover:text-[#2D7A7A] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="#features"
            className="text-sm font-medium text-[#666] hover:text-[#2D7A7A] transition-colors"
          >
            Features
          </Link>
          <Link
            href="#about"
            className="text-sm font-medium text-[#666] hover:text-[#2D7A7A] transition-colors"
          >
            About
          </Link>
        </div>

        <div className="flex gap-3 items-center">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block"
              >
                <Button className="bg-[#2D7A7A] hover:bg-[#236060] text-white">
                  Dashboard
                </Button>
              </Link>
              <UserProfile  />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-medium text-[#666] hover:text-[#2D7A7A] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#2D7A7A] to-[#236060] rounded-lg hover:shadow-lg transition-all duration-300"
                style={{ fontFamily: 'Space Grotesk' }}
              >
                Get Started
                <ArrowRight className="ml-1.5 w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
