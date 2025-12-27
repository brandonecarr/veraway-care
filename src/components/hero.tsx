import Link from "next/link";
import { ArrowUpRight, Check, Play, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#FAFAF8] via-white to-[#F0F9F6]">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#2D7A7A]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#81B29A]/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
      </div>

      <div className="relative pt-20 pb-24 sm:pt-28 sm:pb-32 lg:pt-32 lg:pb-40">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-[#E0E0E0] mb-8">
                <Sparkles className="w-4 h-4 text-[#2D7A7A]" />
                <span className="text-sm font-medium text-[#1A1A1A]">
                  Modern Healthcare Coordination Platform
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#1A1A1A] mb-8 tracking-tight leading-tight" style={{ fontFamily: 'Space Grotesk' }}>
                Transform Patient Care{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2D7A7A] to-[#81B29A]">
                  Coordination
                </span>
              </h1>

              <p className="text-xl lg:text-2xl text-[#666] mb-12 max-w-3xl mx-auto leading-relaxed">
                Streamline issue tracking, enhance team communication, and deliver exceptional patient outcomes with Veraway Care
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center px-8 py-4 text-white bg-gradient-to-r from-[#2D7A7A] to-[#236060] rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 text-lg font-bold"
                  style={{ fontFamily: 'Space Grotesk' }}
                >
                  Start Free Trial
                  <ArrowUpRight className="ml-2 w-5 h-5" />
                </Link>

                <Link
                  href="#pricing"
                  className="inline-flex items-center px-8 py-4 text-[#1A1A1A] bg-white border-2 border-[#E0E0E0] rounded-xl hover:border-[#2D7A7A] hover:shadow-md transition-all duration-300 text-lg font-medium"
                >
                  <Play className="mr-2 w-5 h-5" />
                  See How It Works
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 lg:gap-8 text-sm text-[#666]">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span>HIPAA compliant</span>
                </div>
              </div>
            </div>

            {/* Product Preview/Image Placeholder */}
            <div className="relative mt-16">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-white bg-gradient-to-br from-[#2D7A7A] to-[#236060] p-8">
                {/* Simulated dashboard preview */}
                <div className="bg-white rounded-xl p-6 mb-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2D7A7A]/10"></div>
                      <div>
                        <div className="h-3 w-32 bg-[#E0E0E0] rounded mb-2"></div>
                        <div className="h-2 w-24 bg-[#E0E0E0] rounded"></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#E0E0E0]"></div>
                      <div className="w-8 h-8 rounded-lg bg-[#E0E0E0]"></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#FAFAF8] rounded-lg p-4">
                      <div className="h-2 w-12 bg-[#E0E0E0] rounded mb-2"></div>
                      <div className="h-6 w-16 bg-[#2D7A7A]/20 rounded"></div>
                    </div>
                    <div className="bg-[#FAFAF8] rounded-lg p-4">
                      <div className="h-2 w-12 bg-[#E0E0E0] rounded mb-2"></div>
                      <div className="h-6 w-16 bg-[#81B29A]/20 rounded"></div>
                    </div>
                    <div className="bg-[#FAFAF8] rounded-lg p-4">
                      <div className="h-2 w-12 bg-[#E0E0E0] rounded mb-2"></div>
                      <div className="h-6 w-16 bg-[#E07A5F]/20 rounded"></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-[#FAFAF8] rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-[#E0E0E0]"></div>
                        <div className="flex-1">
                          <div className="h-2 w-full bg-[#E0E0E0] rounded mb-2"></div>
                          <div className="h-2 w-2/3 bg-[#E0E0E0] rounded"></div>
                        </div>
                        <div className="px-3 py-1 bg-green-100 rounded-full">
                          <div className="h-2 w-12 bg-green-500 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating stats cards */}
                <div className="absolute -top-6 -right-6 bg-white rounded-xl shadow-lg p-4 hidden lg:block">
                  <div className="text-2xl font-bold text-[#2D7A7A] mb-1" style={{ fontFamily: 'Space Grotesk' }}>98%</div>
                  <div className="text-xs text-[#666]">Resolution Rate</div>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 hidden lg:block">
                  <div className="text-2xl font-bold text-[#81B29A] mb-1" style={{ fontFamily: 'Space Grotesk' }}>45min</div>
                  <div className="text-xs text-[#666]">Avg Response</div>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-[#2D7A7A]/20 to-[#81B29A]/20 blur-3xl -z-10 opacity-60"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
