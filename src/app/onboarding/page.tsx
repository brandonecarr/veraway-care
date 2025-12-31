'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Building2, User, ChevronRight, CheckCircle2, UserPlus, Lock, X, Mail, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FacilityInfo {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
}

interface ClinicianInvite {
  name: string;
  email: string;
  job_role: string;
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

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<'coordinator' | 'clinician'>('coordinator');
  const [facility, setFacility] = useState<FacilityInfo | null>(null);

  // Step 1: Facility information
  const [facilityForm, setFacilityForm] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
  });

  // Step 2: Clinician invites - array to hold multiple clinicians
  const [clinicians, setClinicians] = useState<ClinicianInvite[]>([]);
  const [currentClinician, setCurrentClinician] = useState<ClinicianInvite>({
    name: '',
    email: '',
    job_role: '',
  });

  // Step 3: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/');
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email || '');
    setUserName(user.user_metadata?.name || user.user_metadata?.full_name || '');

    // Fetch user's facility information with contact details and onboarding status
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          facility_id,
          onboarding_completed_at,
          facilities!users_organization_id_fkey(
            id,
            name,
            slug,
            subscription_tier,
            address_line1,
            address_line2,
            city,
            state,
            zip_code,
            phone,
            email
          )
        `)
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
      }

      // If onboarding is already completed, redirect to dashboard
      if (userData?.onboarding_completed_at && userData?.facilities) {
        const facilityData = Array.isArray(userData.facilities)
          ? userData.facilities[0]
          : userData.facilities;
        const dashboardUrl = facilityData?.slug ? `/${facilityData.slug}/dashboard` : '/dashboard';
        router.push(dashboardUrl);
        return;
      }

      if (userData?.facilities) {
        const facilityData = Array.isArray(userData.facilities)
          ? userData.facilities[0]
          : userData.facilities;
        setFacility(facilityData as FacilityInfo);

        // Pre-fill facility form with existing data
        setFacilityForm({
          address_line1: facilityData.address_line1 || '',
          address_line2: facilityData.address_line2 || '',
          city: facilityData.city || '',
          state: facilityData.state || '',
          zip_code: facilityData.zip_code || '',
          phone: facilityData.phone || '',
          email: facilityData.email || '',
        });
      }

      // Fetch user's role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, job_role')
        .eq('user_id', user.id)
        .eq('facility_id', userData?.facility_id)
        .single();

      if (roleData?.role) {
        setUserRole(roleData.role as 'coordinator' | 'clinician');
        // Pre-fill job role for clinicians
        if (roleData.role === 'clinician' && roleData.job_role) {
          setCurrentClinician({
            ...currentClinician,
            job_role: roleData.job_role,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching facility data:', error);
    }

    setIsLoading(false);
  };

  const handleStep1Submit = async () => {
    // Validate required fields
    if (!facilityForm.address_line1 || !facilityForm.city || !facilityForm.state || !facilityForm.zip_code) {
      toast.error('Please fill in all required facility information');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/onboarding/update-facility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facility?.id,
          ...facilityForm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update facility information');
        return;
      }

      toast.success('Facility information verified');
      setCurrentStep(2);
    } catch (error) {
      console.error('Error updating facility:', error);
      toast.error('Failed to update facility information');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddClinician = () => {
    // Validate current clinician form
    if (!currentClinician.name || !currentClinician.email || !currentClinician.job_role) {
      toast.error('Please fill in all clinician fields');
      return;
    }

    // Check for duplicate email
    if (clinicians.some(c => c.email.toLowerCase() === currentClinician.email.toLowerCase())) {
      toast.error('A clinician with this email has already been added');
      return;
    }

    // Add to list
    setClinicians([...clinicians, currentClinician]);

    // Reset form
    setCurrentClinician({
      name: '',
      email: '',
      job_role: '',
    });

    toast.success('Clinician added to invite list');
  };

  const handleRemoveClinician = (index: number) => {
    setClinicians(clinicians.filter((_, i) => i !== index));
    toast.success('Clinician removed from invite list');
  };

  const handleStep2Submit = async () => {
    // Allow continuing without adding clinicians (optional during onboarding)
    if (clinicians.length === 0) {
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);

    try {
      // Send invites for all clinicians
      const invitePromises = clinicians.map(clinician =>
        fetch('/api/onboarding/invite-clinician', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facility_id: facility?.id,
            ...clinician,
          }),
        })
      );

      const responses = await Promise.all(invitePromises);
      const results = await Promise.all(responses.map(r => r.json()));

      // Check if any failed
      const failedInvites = results.filter((_, i) => !responses[i].ok);

      if (failedInvites.length > 0) {
        toast.error(`Failed to send ${failedInvites.length} invite(s)`);
        return;
      }

      toast.success(`${clinicians.length} clinician invite(s) sent successfully`);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error inviting clinicians:', error);
      toast.error('Failed to send invites');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clinician-specific: Confirm job role (Step 1 for clinicians)
  const handleClinicianJobRoleSubmit = async () => {
    if (!currentClinician.job_role) {
      toast.error('Please select your job role');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Update the user's job role in user_roles table
      const { error } = await supabase
        .from('user_roles')
        .update({ job_role: currentClinician.job_role })
        .eq('user_id', userId)
        .eq('facility_id', facility?.id);

      if (error) {
        console.error('Error updating job role:', error);
        toast.error('Failed to update job role');
        return;
      }

      toast.success('Job role confirmed');
      setCurrentStep(2); // Move to password step (which is step 2 for clinicians)
    } catch (error) {
      console.error('Error updating job role:', error);
      toast.error('Failed to update job role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Mark onboarding as completed
      const { error: updateError } = await supabase
        .from('users')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to mark onboarding as complete:', updateError);
        // Don't block the user, just log the error
      }

      toast.success('Account setup complete! Redirecting to dashboard...');

      // Redirect to facility-specific dashboard
      const dashboardUrl = facility?.slug ? `/${facility.slug}/dashboard` : '/dashboard';
      setTimeout(() => {
        router.push(dashboardUrl);
      }, 1500);
    } catch (error) {
      console.error('Error setting password:', error);
      toast.error('Failed to set password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Different steps for coordinators vs clinicians
  const coordinatorSteps = [
    { number: 1, title: 'Verify Facility', icon: Building2 },
    { number: 2, title: 'Invite Clinicians', icon: UserPlus },
    { number: 3, title: 'Set Password', icon: Lock },
  ];

  const clinicianSteps = [
    { number: 1, title: 'Confirm Job Role', icon: Briefcase },
    { number: 2, title: 'Set Password', icon: Lock },
  ];

  const steps = userRole === 'clinician' ? clinicianSteps : coordinatorSteps;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
      <Card className="w-full max-w-3xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Welcome to Veraway Care
          </h1>
          <p className="text-[#666]">
            Complete your account setup to get started
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center max-w-2xl w-full">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center w-full">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors',
                      currentStep > step.number
                        ? 'bg-[#2D7A7A] border-[#2D7A7A] text-white'
                        : currentStep === step.number
                        ? 'bg-white border-[#2D7A7A] text-[#2D7A7A]'
                        : 'bg-white border-[#D4D4D4] text-[#666]'
                    )}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-xs mt-2 text-center font-medium',
                      currentStep >= step.number ? 'text-[#1A1A1A]' : 'text-[#666]'
                    )}
                  >
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-4 transition-colors',
                      currentStep > step.number ? 'bg-[#2D7A7A]' : 'bg-[#D4D4D4]'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User Information Card */}
        <div className="mb-6 bg-[#2D7A7A]/5 border border-[#2D7A7A]/20 rounded-lg p-4">
          <div className="flex flex-col gap-3">
            {/* User/Coordinator Section */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-[#2D7A7A] rounded-lg flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#666] uppercase tracking-wide font-semibold">
                  {userRole === 'clinician' ? 'Clinician' : 'Coordinator'}
                </p>
                <p className="font-semibold text-[#1A1A1A] truncate">{userName || userEmail}</p>
              </div>
            </div>

            {/* Divider */}
            {facility && <div className="border-t border-[#2D7A7A]/10" />}

            {/* Facility Section */}
            {facility && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-[#2D7A7A] rounded-lg flex-shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#666] uppercase tracking-wide font-semibold">Facility</p>
                  <p className="font-semibold text-[#1A1A1A] truncate">{facility.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 1: Verify Facility Information (Coordinators) OR Confirm Job Role (Clinicians) */}
        {currentStep === 1 && userRole === 'coordinator' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-[#1A1A1A]">Verify Facility Information</h2>
              <p className="text-sm text-[#666] mb-4">
                Please verify and complete your facility's contact information
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  value={facilityForm.address_line1}
                  onChange={(e) => setFacilityForm({ ...facilityForm, address_line1: e.target.value })}
                  placeholder="e.g., 123 Main Street"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={facilityForm.address_line2}
                  onChange={(e) => setFacilityForm({ ...facilityForm, address_line2: e.target.value })}
                  placeholder="e.g., Suite 100"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={facilityForm.city}
                    onChange={(e) => setFacilityForm({ ...facilityForm, city: e.target.value })}
                    placeholder="e.g., Boston"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={facilityForm.state}
                    onChange={(e) => setFacilityForm({ ...facilityForm, state: e.target.value })}
                    placeholder="e.g., MA"
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="zip_code">ZIP Code *</Label>
                <Input
                  id="zip_code"
                  value={facilityForm.zip_code}
                  onChange={(e) => setFacilityForm({ ...facilityForm, zip_code: e.target.value })}
                  placeholder="e.g., 02101"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={facilityForm.phone}
                  onChange={(e) => setFacilityForm({ ...facilityForm, phone: e.target.value })}
                  placeholder="e.g., (617) 555-0100"
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
                  placeholder="e.g., contact@facility.com"
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              onClick={handleStep1Submit}
              disabled={isSubmitting}
              className="w-full bg-[#2D7A7A] hover:bg-[#236060]"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 1: Confirm Job Role (Clinicians) */}
        {currentStep === 1 && userRole === 'clinician' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-[#1A1A1A]">Confirm Your Job Role</h2>
              <p className="text-sm text-[#666] mb-4">
                Please confirm your job role to complete your profile
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="clinician_job_role">Job Role *</Label>
                <Select
                  value={currentClinician.job_role}
                  onValueChange={(value) => setCurrentClinician({ ...currentClinician, job_role: value })}
                >
                  <SelectTrigger className="mt-1" id="clinician_job_role">
                    <SelectValue placeholder="Select your job role" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#666] mt-2">
                  This information helps us customize your experience
                </p>
              </div>
            </div>

            <Button
              onClick={handleClinicianJobRoleSubmit}
              disabled={isSubmitting}
              className="w-full bg-[#2D7A7A] hover:bg-[#236060]"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Invite Clinicians (Coordinators only) */}
        {currentStep === 2 && userRole === 'coordinator' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-[#1A1A1A]">Invite Your Team</h2>
              <p className="text-sm text-[#666] mb-4">
                Add clinicians to your facility. You can add more team members later from the dashboard.
              </p>
            </div>

            {/* Clinician Form */}
            <div className="border border-[#E0E0E0] rounded-lg p-4 space-y-4 bg-[#FAFAF8]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clinician_name">Name</Label>
                  <Input
                    id="clinician_name"
                    value={currentClinician.name}
                    onChange={(e) => setCurrentClinician({ ...currentClinician, name: e.target.value })}
                    placeholder="e.g., Jane Smith"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="clinician_email">Email</Label>
                  <Input
                    id="clinician_email"
                    type="email"
                    value={currentClinician.email}
                    onChange={(e) => setCurrentClinician({ ...currentClinician, email: e.target.value })}
                    placeholder="e.g., jane.smith@example.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="job_role">Job Role</Label>
                <Select
                  value={currentClinician.job_role}
                  onValueChange={(value) => setCurrentClinician({ ...currentClinician, job_role: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a job role" />
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
                onClick={handleAddClinician}
                variant="outline"
                className="w-full border-[#2D7A7A] text-[#2D7A7A] hover:bg-[#2D7A7A] hover:text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add to Invite List
              </Button>
            </div>

            {/* Invited Clinicians List */}
            {clinicians.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">
                    Clinicians to Invite ({clinicians.length})
                  </h3>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {clinicians.map((clinician, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white border border-[#E0E0E0] rounded-lg hover:border-[#2D7A7A] transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#2D7A7A]/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-[#2D7A7A]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#1A1A1A] truncate">{clinician.name}</p>
                          <div className="flex items-center gap-3 text-xs text-[#666]">
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              {clinician.email}
                            </span>
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <Briefcase className="w-3 h-3" />
                              {clinician.job_role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRemoveClinician(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clinicians.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-[#E0E0E0] rounded-lg">
                <UserPlus className="w-12 h-12 text-[#666] mx-auto mb-2" />
                <p className="text-sm text-[#666]">No clinicians added yet</p>
                <p className="text-xs text-[#999] mt-1">You can skip this step and add team members later</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleStep2Submit}
                disabled={isSubmitting}
                className="flex-1 bg-[#2D7A7A] hover:bg-[#236060]"
              >
                {isSubmitting ? 'Sending Invites...' : clinicians.length > 0 ? `Send ${clinicians.length} Invite${clinicians.length > 1 ? 's' : ''}` : 'Skip for Now'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2/3: Set Password (Step 2 for clinicians, Step 3 for coordinators) */}
        {((currentStep === 2 && userRole === 'clinician') || (currentStep === 3 && userRole === 'coordinator')) && (
          <form onSubmit={handleStep3Submit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-[#1A1A1A]">Set Your Password</h2>
              <p className="text-sm text-[#666] mb-4">
                Create a secure password to protect your account
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="password">New Password *</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-1"
                  minLength={8}
                />
                <p className="text-xs text-[#666] mt-1">
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <Label htmlFor="confirm_password">Confirm Password *</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="mt-1"
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setCurrentStep(userRole === 'clinician' ? 1 : 2)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#2D7A7A] hover:bg-[#236060]"
              >
                {isSubmitting ? 'Completing Setup...' : 'Complete Setup'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
