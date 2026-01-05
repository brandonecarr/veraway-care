import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import PricingCard from "@/components/pricing-card";
import Footer from "@/components/footer";
import { createClient } from "../../supabase/server";
import {
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Shield,
  Users,
  Activity,
  Clock,
  TrendingUp,
  FileText,
  Bell,
  BarChart3,
  UserCheck,
  MessageSquare,
  Star,
  ChevronRight,
  Heart
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let user = null;
  let plans = null;

  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;

    const { data: plansData } = await supabase.functions.invoke('get-plans');
    plans = plansData;
  } catch (error) {
    console.error('Error initializing supabase:', error);
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />

      {/* Trust Indicators */}
      <section className="py-12 bg-[#FAFAF8] border-b border-[#E0E0E0]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <p className="text-sm text-[#666] uppercase tracking-wide font-medium">Trusted by leading hospice organizations</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center opacity-60">
            {/* Placeholder for logos */}
            <div className="h-12 w-32 bg-gradient-to-r from-[#2D7A7A]/20 to-[#81B29A]/20 rounded flex items-center justify-center">
              <span className="text-xs font-semibold text-[#2D7A7A]">Healthcare Partner</span>
            </div>
            <div className="h-12 w-32 bg-gradient-to-r from-[#2D7A7A]/20 to-[#81B29A]/20 rounded flex items-center justify-center">
              <span className="text-xs font-semibold text-[#2D7A7A]">Medical Center</span>
            </div>
            <div className="h-12 w-32 bg-gradient-to-r from-[#2D7A7A]/20 to-[#81B29A]/20 rounded flex items-center justify-center">
              <span className="text-xs font-semibold text-[#2D7A7A]">Care Facility</span>
            </div>
            <div className="h-12 w-32 bg-gradient-to-r from-[#2D7A7A]/20 to-[#81B29A]/20 rounded flex items-center justify-center">
              <span className="text-xs font-semibold text-[#2D7A7A]">Health Systems</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-br from-[#2D7A7A] to-[#236060] text-white relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="p-6">
              <div className="text-5xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>98%</div>
              <div className="text-[#81B29A] font-medium text-sm uppercase tracking-wide">Issue Resolution Rate</div>
            </div>
            <div className="p-6">
              <div className="text-5xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>45min</div>
              <div className="text-[#81B29A] font-medium text-sm uppercase tracking-wide">Average Response Time</div>
            </div>
            <div className="p-6">
              <div className="text-5xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>10k+</div>
              <div className="text-[#81B29A] font-medium text-sm uppercase tracking-wide">Issues Tracked</div>
            </div>
            <div className="p-6">
              <div className="text-5xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>500+</div>
              <div className="text-[#81B29A] font-medium text-sm uppercase tracking-wide">Healthcare Professionals</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#2D7A7A]/10 rounded-full mb-4">
              <span className="text-sm font-semibold text-[#2D7A7A] uppercase tracking-wide">Platform Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
              Everything You Need for Better Care Coordination
            </h2>
            <p className="text-lg text-[#666] max-w-3xl mx-auto leading-relaxed">
              Streamline patient care with our comprehensive platform designed specifically for healthcare coordination teams
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: <Bell className="w-6 h-6" />,
                title: "Real-Time Issue Tracking",
                description: "Monitor patient issues as they happen with instant notifications and updates for your entire care team"
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Team Collaboration",
                description: "Seamless communication between coordinators and clinicians for faster issue resolution"
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: "Advanced Analytics",
                description: "Gain insights into care patterns, response times, and team performance with comprehensive reporting"
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "HIPAA Compliant",
                description: "Bank-grade security with full HIPAA compliance to protect sensitive patient information"
              },
              {
                icon: <Clock className="w-6 h-6" />,
                title: "Handoff Management",
                description: "Smooth transitions between shifts with structured handoff protocols and documentation"
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Complete Audit Trail",
                description: "Track every action and change with detailed audit logs for compliance and accountability"
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group p-8 bg-[#FAFAF8] rounded-2xl border border-[#E0E0E0] hover:border-[#2D7A7A] hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#2D7A7A] to-[#236060] flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
                  {feature.title}
                </h3>
                <p className="text-[#666] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-[#FAFAF8]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#2D7A7A]/10 rounded-full mb-4">
              <span className="text-sm font-semibold text-[#2D7A7A] uppercase tracking-wide">Simple Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
              Start Coordinating in Minutes
            </h2>
            <p className="text-lg text-[#666] max-w-2xl mx-auto">
              Get your team up and running with our streamlined onboarding process
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Create Your Hospice",
                  description: "Set up your hospice profile and customize settings to match your workflow",
                  icon: <UserCheck className="w-6 h-6" />
                },
                {
                  step: "02",
                  title: "Invite Your Team",
                  description: "Add coordinators and clinicians with role-based access and permissions",
                  icon: <Users className="w-6 h-6" />
                },
                {
                  step: "03",
                  title: "Start Tracking Issues",
                  description: "Begin documenting patient issues and coordinating care across your team",
                  icon: <Activity className="w-6 h-6" />
                }
              ].map((step, index) => (
                <div key={index} className="relative">
                  {/* Connector line */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-20 left-1/2 w-full h-0.5 bg-gradient-to-r from-[#2D7A7A] to-[#81B29A] opacity-20"></div>
                  )}

                  <div className="relative bg-white rounded-2xl p-8 border-2 border-[#E0E0E0] hover:border-[#2D7A7A] transition-all duration-300 h-full">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2D7A7A] to-[#236060] flex items-center justify-center text-white text-2xl font-bold mb-4 relative z-10" style={{ fontFamily: 'Space Grotesk' }}>
                        {step.step}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-[#2D7A7A]/10 flex items-center justify-center text-[#2D7A7A] mb-4">
                        {step.icon}
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
                        {step.title}
                      </h3>
                      <p className="text-[#666] leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <div>
              <div className="inline-block px-4 py-2 bg-[#2D7A7A]/10 rounded-full mb-4">
                <span className="text-sm font-semibold text-[#2D7A7A] uppercase tracking-wide">Why Choose Us</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
                Built for Healthcare Professionals
              </h2>
              <p className="text-lg text-[#666] mb-8 leading-relaxed">
                Veraway Care is designed from the ground up to meet the unique needs of healthcare coordination teams, combining powerful features with intuitive design.
              </p>

              <div className="space-y-4">
                {[
                  "Reduce response times by up to 60% with real-time notifications",
                  "Eliminate communication gaps between care team members",
                  "Ensure compliance with comprehensive audit trails",
                  "Make data-driven decisions with powerful analytics",
                  "Seamless handoffs between shifts and team members"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2D7A7A]/10 flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#2D7A7A]" />
                    </div>
                    <p className="text-[#1A1A1A] leading-relaxed">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Placeholder for image/illustration */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-[#2D7A7A] to-[#236060] p-8">
                <div className="bg-white rounded-xl p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#2D7A7A]/10 flex items-center justify-center">
                      <Heart className="w-5 h-5 text-[#2D7A7A]" />
                    </div>
                    <div>
                      <div className="h-3 w-32 bg-[#E0E0E0] rounded"></div>
                      <div className="h-2 w-24 bg-[#E0E0E0] rounded mt-2"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-[#E0E0E0] rounded"></div>
                    <div className="h-2 w-5/6 bg-[#E0E0E0] rounded"></div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#81B29A]/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-[#81B29A]" />
                      </div>
                      <div>
                        <div className="h-3 w-24 bg-[#E0E0E0] rounded"></div>
                        <div className="h-2 w-16 bg-[#E0E0E0] rounded mt-2"></div>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-green-100 rounded-full">
                      <div className="h-2 w-12 bg-green-500 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-[#E0E0E0] rounded"></div>
                    <div className="h-2 w-4/5 bg-[#E0E0E0] rounded"></div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#81B29A]/20 backdrop-blur-sm flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-[#2D7A7A]" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-[#2D7A7A]/20 backdrop-blur-sm flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-[#2D7A7A]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-[#FAFAF8]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#2D7A7A]/10 rounded-full mb-4">
              <span className="text-sm font-semibold text-[#2D7A7A] uppercase tracking-wide">Testimonials</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
              Trusted by Healthcare Teams
            </h2>
            <p className="text-lg text-[#666] max-w-2xl mx-auto">
              See what coordinators and clinicians are saying about Veraway Care
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                quote: "Veraway Care has transformed how we coordinate patient care. Response times have decreased significantly and our team communication has never been better.",
                author: "Sarah Johnson",
                role: "Care Coordinator",
                facility: "Memorial Health Center"
              },
              {
                quote: "The handoff feature alone has saved us countless hours. We can now transition between shifts seamlessly without missing critical patient information.",
                author: "Dr. Michael Chen",
                role: "Medical Director",
                facility: "Riverside Medical Group"
              },
              {
                quote: "As a clinician, I appreciate how easy it is to stay informed about patient issues. The mobile interface is intuitive and the notifications keep me in the loop.",
                author: "Emily Rodriguez, RN",
                role: "Registered Nurse",
                facility: "Lakeside Care Facility"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 border border-[#E0E0E0] hover:shadow-lg transition-shadow duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#F4D06F] text-[#F4D06F]" />
                  ))}
                </div>
                <p className="text-[#1A1A1A] mb-6 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="border-t border-[#E0E0E0] pt-4">
                  <p className="font-bold text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-[#666]">{testimonial.role}</p>
                  <p className="text-xs text-[#999] mt-1">{testimonial.facility}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-white" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#2D7A7A]/10 rounded-full mb-4">
              <span className="text-sm font-semibold text-[#2D7A7A] uppercase tracking-wide">Pricing</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk' }}>
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-[#666] max-w-2xl mx-auto">
              Choose the perfect plan for your hospice. No hidden fees, no surprises.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans?.map((item: any) => (
              <PricingCard key={item.id} item={item} user={user} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-[#2D7A7A] to-[#236060] text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Space Grotesk' }}>
            Ready to Transform Your Care Coordination?
          </h2>
          <p className="text-xl text-[#81B29A] mb-10 max-w-2xl mx-auto leading-relaxed">
            Join hundreds of hospice organizations already using Veraway Care to deliver better patient outcomes
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/sign-up"
              className="inline-flex items-center px-8 py-4 text-[#2D7A7A] bg-white rounded-xl hover:bg-[#FAFAF8] transition-all duration-300 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-105"
              style={{ fontFamily: 'Space Grotesk' }}
            >
              Start Free Trial
              <ChevronRight className="ml-2 w-5 h-5" />
            </a>

            <a
              href="#pricing"
              className="inline-flex items-center px-8 py-4 text-white bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 text-lg font-medium border-2 border-white/30"
            >
              View Pricing
            </a>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-[#81B29A]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
