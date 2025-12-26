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

interface FacilityInfo {
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
  email_confirmed_at: string | null;
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
  const [facility, setFacility] = useState<FacilityInfo | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isCoordinator, setIsCoordinator] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  });

  // Facility form
  const [facilityForm, setFacilityForm] = useState({
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
        facility_id,
        facilities(id, name, slug, address_line1, address_line2, city, state, zip_code, phone, email)
      `)
      .eq('id', user.id)
      .single();

    if (userData) {
      setProfileForm({
        name: userData.name || '',
        email: userData.email || '',
      });

      // Get user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, job_role')
        .eq('user_id', user.id)
        .single();

      setUserProfile({
        id: user.id,
        name: userData.name || '',
        email: userData.email || '',
        role: roleData?.role || 'clinician',
        job_role: roleData?.job_role,
      });

      setIsCoordinator(roleData?.role === 'coordinator');

      // Get facility info
      if (userData.facilities) {
        const facilityData = Array.isArray(userData.facilities)
          ? userData.facilities[0]
          : userData.facilities;

        setFacility(facilityData);
        setFacilityForm({
          name: facilityData.name || '',
          address_line1: facilityData.address_line1 || '',
          address_line2: facilityData.address_line2 || '',
          city: facilityData.city || '',
          state: facilityData.state || '',
          zip_code: facilityData.zip_code || '',
          phone: facilityData.phone || '',
          email: facilityData.email || '',
        });

        // Get staff members if coordinator
        if (roleData?.role === 'coordinator') {
          loadStaffMembers(userData.facility_id);
        }
      }
    }

    setIsLoading(false);
  };

  const loadStaffMembers = async (facilityId: string) => {
    const supabase = createClient();

    // Get all users in the facility with their roles
    const { data: users } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        created_at
      `)
      .eq('facility_id', facilityId);

    if (users) {
      // Get auth users to check email confirmation status
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

      // Get roles for all users
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role, job_role')
        .eq('facility_id', facilityId);

      const staffWithStatus = users.map(user => {
        const authUser = authUsers?.find(au => au.id === user.id);
        const userRole = roles?.find(r => r.user_id === user.id);

        return {
          ...user,
          email_confirmed_at: authUser?.email_confirmed_at || null,
          role: userRole?.role || 'clinician',
          job_role: userRole?.job_role,
        };
      });

      setStaffMembers(staffWithStatus);
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

  const handleSaveFacility = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('facilities')
        .update({
          name: facilityForm.name,
          address_line1: facilityForm.address_line1,
          address_line2: facilityForm.address_line2,
          city: facilityForm.city,
          state: facilityForm.state,
          zip_code: facilityForm.zip_code,
          phone: facilityForm.phone,
          email: facilityForm.email,
        })
        .eq('id', facility?.id);

      if (error) throw error;

      toast.success('Facility information updated successfully');
      loadUserData();
    } catch (error) {
      console.error('Error updating facility:', error);
      toast.error('Failed to update facility information');
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
          facility_id: facility?.id,
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
      if (facility?.id) {
        loadStaffMembers(facility.id);
      }
    } catch (error) {
      console.error('Error inviting clinician:', error);
      toast.error('Failed to send invite');
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

      // Remove user from facility
      const { error } = await supabase
        .from('users')
        .update({ facility_id: null })
        .eq('id', staffId);

      if (error) throw error;

      toast.success('Staff member removed');
      if (facility?.id) {
        loadStaffMembers(facility.id);
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
    { id: 'facility', label: 'Facility Profile', icon: Building2, visible: isCoordinator },
    { id: 'staff', label: 'Staff', icon: Users, visible: isCoordinator },
    { id: 'notifications', label: 'Notifications', icon: Bell, visible: true },
    { id: 'subscription', label: 'Subscription', icon: CreditCard, visible: isCoordinator },
    { id: 'billing', label: 'Billing', icon: FileText, visible: isCoordinator },
    { id: 'connect', label: 'Connect', icon: MessageSquare, visible: true },
  ].filter(item => item.visible);

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
            Manage your account, facility, and preferences
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

            {/* Facility Profile Section */}
            {activeTab === 'facility' && isCoordinator && (
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Facility Profile</h2>
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <Label htmlFor="facility_name">Facility Name</Label>
                    <Input
                      id="facility_name"
                      value={facilityForm.name}
                      onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address1">Address Line 1</Label>
                    <Input
                      id="address1"
                      value={facilityForm.address_line1}
                      onChange={(e) => setFacilityForm({ ...facilityForm, address_line1: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address2">Address Line 2</Label>
                    <Input
                      id="address2"
                      value={facilityForm.address_line2}
                      onChange={(e) => setFacilityForm({ ...facilityForm, address_line2: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={facilityForm.city}
                        onChange={(e) => setFacilityForm({ ...facilityForm, city: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={facilityForm.state}
                        onChange={(e) => setFacilityForm({ ...facilityForm, state: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={facilityForm.zip_code}
                      onChange={(e) => setFacilityForm({ ...facilityForm, zip_code: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={facilityForm.phone}
                      onChange={(e) => setFacilityForm({ ...facilityForm, phone: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="facility_email">Facility Email</Label>
                    <Input
                      id="facility_email"
                      type="email"
                      value={facilityForm.email}
                      onChange={(e) => setFacilityForm({ ...facilityForm, email: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleSaveFacility}
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
                        className="flex items-center justify-between p-4 bg-white border border-[#E0E0E0] rounded-lg"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 rounded-full bg-[#2D7A7A]/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-[#2D7A7A]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{staff.name}</p>
                              {staff.email_confirmed_at ? (
                                <CheckCircle className="w-4 h-4 text-green-600" title="Active" />
                              ) : (
                                <Clock className="w-4 h-4 text-yellow-600" title="Pending" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {staff.email}
                              </span>
                              {staff.job_role && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3" />
                                  {staff.job_role}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
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
                        <h3 className="text-xl font-semibold capitalize">{facility?.name}</h3>
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
