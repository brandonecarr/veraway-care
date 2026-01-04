'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';
import { NotificationPreferences } from '@/components/care/notification-preferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  User, Building2, Users, Bell, CreditCard, FileText, MessageSquare,
  Mail, Briefcase, CheckCircle, Clock, XCircle, UserPlus, X, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  job_role?: string;
}

interface HospiceInfo {
  id: string;
  name: string;
  slug: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  job_role?: string;
  has_completed_onboarding: boolean;
  created_at: string;
}

const JOB_ROLES = [
  { value: 'RN', label: 'RN - Registered Nurse' },
  { value: 'LVN/LPN', label: 'LVN/LPN - Licensed Vocational/Practical Nurse' },
  { value: 'HHA', label: 'HHA - Home Health Aide' },
  { value: 'MSW', label: 'MSW - Medical Social Worker' },
  { value: 'Chaplain', label: 'Chaplain' },
  { value: 'MD', label: 'MD - Medical Doctor' },
  { value: 'NP', label: 'NP - Nurse Practitioner' },
];

const CONTACT_TYPES = [
  { value: 'bug', label: 'Report a Bug' },
  { value: 'feature', label: 'Request a Feature' },
  { value: 'support', label: 'Technical Support' },
  { value: 'feedback', label: 'General Feedback' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hospice, setHospice] = useState<HospiceInfo | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isCoordinator, setIsCoordinator] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  });

  // Hospice form
  const [hospiceForm, setHospiceForm] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
  });

  // Staff invite form
  const [staffInviteForm, setStaffInviteForm] = useState({
    name: '',
    email: '',
    job_role: '',
  });

  // Connect form
  const [connectForm, setConnectForm] = useState({
    type: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      router.push('/sign-in');
      return;
    }

    // Get user profile and role
    const { data: userData } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        hospice_id,
        hospices(id, name, slug, address_line1, address_line2, city, state, zip_code, phone, email)
      `)
      .eq('id', user.id)
      .single();

    if (userData) {
      setProfileForm({
        name: userData.name || '',
        email: userData.email || '',
      });

      // Get user role - filter by hospice_id to get the correct role for this hospice
      console.log('Settings: Fetching role for user:', user.id, 'hospice:', userData.hospice_id);

      // First, get ALL roles for this user to diagnose issues
      const { data: allRoles, error: allRolesError } = await supabase
        .from('user_roles')
        .select('role, job_role, hospice_id')
        .eq('user_id', user.id);

      console.log('Settings: ALL roles for user:', { allRoles, allRolesError });

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, job_role')
        .eq('user_id', user.id)
        .eq('hospice_id', userData.hospice_id)
        .maybeSingle();

      console.log('Settings: Filtered role result:', { roleData, roleError });

      const userIsCoordinator = roleData?.role === 'coordinator';
      console.log('Settings: Setting isCoordinator to:', userIsCoordinator);

      setUserProfile({
        id: user.id,
        name: userData.name || '',
        email: userData.email || '',
        role: roleData?.role || 'clinician',
        job_role: roleData?.job_role,
      });

      setIsCoordinator(userIsCoordinator);

      // Get hospice info
      if (userData.hospices) {
        const hospiceData = Array.isArray(userData.hospices)
          ? userData.hospices[0]
          : userData.hospices;

        setHospice(hospiceData);
        setHospiceForm({
          name: hospiceData.name || '',
          address_line1: hospiceData.address_line1 || '',
          address_line2: hospiceData.address_line2 || '',
          city: hospiceData.city || '',
          state: hospiceData.state || '',
          zip_code: hospiceData.zip_code || '',
          phone: hospiceData.phone || '',
          email: hospiceData.email || '',
        });

        // Get staff members if coordinator
        if (roleData?.role === 'coordinator') {
          loadStaffMembers(userData.hospice_id);
        }
      }
    }

    setIsLoading(false);
  };

  const loadStaffMembers = async (hospiceId: string) => {
    try {
      const response = await fetch('/api/settings/staff');
      if (response.ok) {
        const data = await response.json();
        setStaffMembers(data);
      } else {
        console.error('Failed to load staff members');
        setStaffMembers([]);
      }
    } catch (error) {
      console.error('Error loading staff members:', error);
      setStaffMembers([]);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('users')
        .update({
          name: profileForm.name,
        })
        .eq('id', userProfile?.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      loadUserData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHospice = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('hospices')
        .update({
          name: hospiceForm.name,
          address_line1: hospiceForm.address_line1,
          address_line2: hospiceForm.address_line2,
          city: hospiceForm.city,
          state: hospiceForm.state,
          zip_code: hospiceForm.zip_code,
          phone: hospiceForm.phone,
          email: hospiceForm.email,
        })
        .eq('id', hospice?.id);

      if (error) throw error;

      toast.success('Hospice information updated successfully');
      loadUserData();
    } catch (error) {
      console.error('Error updating hospice:', error);
      toast.error('Failed to update hospice information');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteStaff = async () => {
    if (!staffInviteForm.name || !staffInviteForm.email || !staffInviteForm.job_role) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/onboarding/invite-clinician', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospice_id: hospice?.id,
          ...staffInviteForm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to send invite');
        return;
      }

      toast.success('Clinician invited successfully');
      setStaffInviteForm({ name: '', email: '', job_role: '' });
      if (hospice?.id) {
        loadStaffMembers(hospice.id);
      }
    } catch (error) {
      console.error('Error inviting clinician:', error);
      toast.error('Failed to send invite');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendInvite = async (staffEmail: string) => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/resend-clinician-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospice_id: hospice?.id,
          email: staffEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to resend invite');
        return;
      }

      toast.success('Invite resent successfully');
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Failed to resend invite');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) {
      return;
    }

    try {
      const supabase = createClient();

      // Remove user from hospice
      const { error } = await supabase
        .from('users')
        .update({ hospice_id: null })
        .eq('id', staffId);

      if (error) throw error;

      toast.success('Staff member removed');
      if (hospice?.id) {
        loadStaffMembers(hospice.id);
      }
    } catch (error) {
      console.error('Error removing staff:', error);
      toast.error('Failed to remove staff member');
    }
  };

  const handleSendMessage = async () => {
    if (!connectForm.type || !connectForm.subject || !connectForm.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSaving(true);

    try {
      // Here you would send this to your support system
      // For now, we'll just show a success message
      toast.success('Message sent! We\'ll get back to you soon.');
      setConnectForm({ type: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSaving(false);
    }
  };

  const navItems = [
    { id: 'profile', label: 'Profile', icon: User, visible: true },
    { id: 'hospice', label: 'Hospice Profile', icon: Building2, visible: isCoordinator },
    { id: 'staff', label: 'Staff', icon: Users, visible: isCoordinator },
    { id: 'notifications', label: 'Notifications', icon: Bell, visible: true },
    { id: 'subscription', label: 'Subscription', icon: CreditCard, visible: isCoordinator },
    { id: 'billing', label: 'Billing', icon: FileText, visible: isCoordinator },
    { id: 'connect', label: 'Connect', icon: MessageSquare, visible: true },
  ].filter(item => item.visible);

  console.log('Settings: Rendering with isCoordinator:', isCoordinator, 'isLoading:', isLoading, 'navItems:', navItems.map(n => n.id));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <DashboardNavbar />
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full"></div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <DashboardNavbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-2">Settings</h1>
          <p className="text-sm md:text-base text-gray-600">
            Manage your account, hospice, and preferences
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Vertical Navigation */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <Card className="p-2">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                      activeTab === item.id
                        ? 'bg-[#2D7A7A] text-white'
                        : 'text-[#1A1A1A] hover:bg-[#F5F5F5]'
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
            </Card>
          </aside>

          {/* Content Area */}
          <main className="flex-1">
            {/* Profile Section */}
            {activeTab === 'profile' && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Profile</h2>
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  {userProfile?.job_role && (
                    <div>
                      <Label>Job Role</Label>
                      <Input
                        value={userProfile.job_role}
                        disabled
                        className="mt-1 bg-gray-50"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-[#2D7A7A] hover:bg-[#236060]"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </Card>
            )}

            {/* Hospice Profile Section */}
            {activeTab === 'hospice' && isCoordinator && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Hospice Profile</h2>
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <Label htmlFor="hospice_name">Hospice Name</Label>
                    <Input
                      id="hospice_name"
                      value={hospiceForm.name}
                      onChange={(e) => setHospiceForm({ ...hospiceForm, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address1">Address Line 1</Label>
                    <Input
                      id="address1"
                      value={hospiceForm.address_line1}
                      onChange={(e) => setHospiceForm({ ...hospiceForm, address_line1: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address2">Address Line 2</Label>
                    <Input
                      id="address2"
                      value={hospiceForm.address_line2}
                      onChange={(e) => setHospiceForm({ ...hospiceForm, address_line2: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={hospiceForm.city}
                        onChange={(e) => setHospiceForm({ ...hospiceForm, city: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={hospiceForm.state}
                        onChange={(e) => setHospiceForm({ ...hospiceForm, state: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={hospiceForm.zip_code}
                      onChange={(e) => setHospiceForm({ ...hospiceForm, zip_code: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={hospiceForm.phone}
                      onChange={(e) => setHospiceForm({ ...hospiceForm, phone: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hospice_email">Hospice Email</Label>
                    <Input
                      id="hospice_email"
                      type="email"
                      value={hospiceForm.email}
                      onChange={(e) => setHospiceForm({ ...hospiceForm, email: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleSaveHospice}
                    disabled={isSaving}
                    className="bg-[#2D7A7A] hover:bg-[#236060]"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </Card>
            )}

            {/* Staff Section */}
            {activeTab === 'staff' && isCoordinator && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Staff Management</h2>

                {/* Invite Form */}
                <div className="mb-8 p-4 bg-[#FAFAF8] rounded-lg border border-[#E0E0E0]">
                  <h3 className="font-semibold text-lg mb-4">Invite New Clinician</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      placeholder="Name"
                      value={staffInviteForm.name}
                      onChange={(e) => setStaffInviteForm({ ...staffInviteForm, name: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={staffInviteForm.email}
                      onChange={(e) => setStaffInviteForm({ ...staffInviteForm, email: e.target.value })}
                    />
                    <Select
                      value={staffInviteForm.job_role}
                      onValueChange={(value) => setStaffInviteForm({ ...staffInviteForm, job_role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job role" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleInviteStaff}
                    disabled={isSaving}
                    className="mt-4 bg-[#2D7A7A] hover:bg-[#236060]"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {isSaving ? 'Sending...' : 'Send Invite'}
                  </Button>
                </div>

                {/* Staff List */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Team Members ({staffMembers.length})</h3>
                  {staffMembers.length === 0 ? (
                    <p className="text-gray-500 py-8 text-center">No staff members yet</p>
                  ) : (
                    staffMembers.map((staff) => (
                      <div
                        key={staff.id}
                        className="flex items-start justify-between p-4 bg-white border border-[#E0E0E0] rounded-lg"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#2D7A7A]/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-[#2D7A7A]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{staff.name}</p>
                              {staff.has_completed_onboarding ? (
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                              )}
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{staff.email}</span>
                              </div>
                              {staff.job_role && (
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3 flex-shrink-0" />
                                  <span>{staff.job_role}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          {!staff.has_completed_onboarding && staff.id !== userProfile?.id && (
                            <Button
                              onClick={() => handleResendInvite(staff.email)}
                              variant="outline"
                              size="sm"
                              disabled={isSaving}
                              className="border-[#2D7A7A] text-[#2D7A7A] hover:bg-[#2D7A7A] hover:text-white"
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Resend
                            </Button>
                          )}
                          {staff.id !== userProfile?.id && (
                            <Button
                              onClick={() => handleRemoveStaff(staff.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}

            {/* Notifications Section */}
            {activeTab === 'notifications' && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Notification Preferences</h2>
                <NotificationPreferences />
              </Card>
            )}

            {/* Subscription Section */}
            {activeTab === 'subscription' && isCoordinator && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Subscription</h2>
                <div className="max-w-2xl">
                  <div className="p-6 bg-[#FAFAF8] rounded-lg border border-[#E0E0E0]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold capitalize">{hospice?.name}</h3>
                        <p className="text-gray-600">Current Plan</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#2D7A7A]">Free</p>
                        <p className="text-sm text-gray-600">$0/month</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[#E0E0E0]">
                      <p className="text-sm text-gray-600">
                        You're currently on the Free plan. Upgrade options coming soon!
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Billing Section */}
            {activeTab === 'billing' && isCoordinator && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Billing</h2>
                <div className="max-w-2xl">
                  <p className="text-gray-600 mb-4">Your billing and invoice history</p>
                  <div className="border border-[#E0E0E0] rounded-lg p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No invoices yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Your payment history will appear here
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Connect Section */}
            {activeTab === 'connect' && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Connect with Us</h2>
                <div className="max-w-2xl space-y-4">
                  <p className="text-gray-600">
                    Have a question, bug report, or feature request? We'd love to hear from you!
                  </p>

                  <div>
                    <Label htmlFor="contact_type">Type</Label>
                    <Select
                      value={connectForm.type}
                      onValueChange={(value) => setConnectForm({ ...connectForm, type: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={connectForm.subject}
                      onChange={(e) => setConnectForm({ ...connectForm, subject: e.target.value })}
                      placeholder="Brief description of your message"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={connectForm.message}
                      onChange={(e) => setConnectForm({ ...connectForm, message: e.target.value })}
                      placeholder="Provide details about your bug, feature request, or question..."
                      className="mt-1 min-h-[150px]"
                    />
                  </div>

                  <Button
                    onClick={handleSendMessage}
                    disabled={isSaving}
                    className="bg-[#2D7A7A] hover:bg-[#236060]"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSaving ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </Card>
            )}
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
