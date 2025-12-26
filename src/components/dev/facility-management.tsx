'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Users, Mail, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Facility {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  max_users: number;
  is_active: boolean;
  created_at: string;
  coordinator_count: number;
  coordinators_registered: boolean;
}

export function FacilityManagement() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dev/facilities');
      if (response.ok) {
        const data = await response.json();
        setFacilities(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to load facilities');
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      toast.error('Failed to load facilities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (facility: Facility) => {
    if (facility.coordinator_count > 0 && !facility.coordinators_registered) {
      // Resend scenario - call API directly (only if not all registered)
      try {
        const response = await fetch('/api/dev/resend-invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facility_id: facility.id }),
        });

        if (response.ok) {
          const result = await response.json();
          toast.success(result.message);
          fetchFacilities(); // Refresh to update coordinator count
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to resend invites');
        }
      } catch (error) {
        console.error('Error resending invites:', error);
        toast.error('Failed to resend invites');
      }
    } else {
      // New invite scenario - open modal
      setSelectedFacility(facility);
      setShowInviteDialog(true);
    }
  };

  const handleViewDetails = (facility: Facility) => {
    setSelectedFacility(facility);
    setShowDetailsDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-[#666]">Loading facilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Facility Management
          </h2>
          <p className="text-sm text-[#666]">
            Create and manage healthcare facilities
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#2D7A7A] hover:bg-[#236060] gap-2">
              <Plus className="h-4 w-4" />
              Create Facility
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Facility</DialogTitle>
            </DialogHeader>
            <CreateFacilityForm
              onSuccess={() => {
                setShowCreateDialog(false);
                fetchFacilities();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Facilities Grid */}
      {facilities.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-[#999] mx-auto mb-4" />
          <p className="text-[#666] mb-2">No facilities yet</p>
          <p className="text-sm text-[#999] mb-4">
            Create your first facility to get started
          </p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#2D7A7A] hover:bg-[#236060]"
          >
            Create Facility
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {facilities.map((facility) => (
            <Card key={facility.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-[#2D7A7A]/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-[#2D7A7A]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1A1A1A]">{facility.name}</h3>
                    <p className="text-xs text-[#666]">{facility.slug}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    facility.is_active
                      ? 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]'
                      : 'bg-[#999]/10 text-[#999] border-[#999]'
                  }
                >
                  {facility.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">Tier:</span>
                  <span className="font-medium capitalize">{facility.subscription_tier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">Max Users:</span>
                  <span className="font-medium">{facility.max_users}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">Coordinators:</span>
                  <span className="font-medium">{facility.coordinator_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">Created:</span>
                  <span className="font-medium">
                    {new Date(facility.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {facility.coordinator_count > 0 && facility.coordinators_registered ? (
                  <Button
                    onClick={() => handleViewDetails(facility)}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Users className="h-4 w-4" />
                    View Details
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleInvite(facility)}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {facility.coordinator_count > 0 ? 'Resend Invite' : 'Invite Coordinator'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedFacility && selectedFacility.coordinator_count > 0
                ? 'Resend Coordinator Invite'
                : 'Invite Facility Coordinator'}
            </DialogTitle>
          </DialogHeader>
          {selectedFacility && (
            <InviteCoordinatorForm
              facility={selectedFacility}
              onSuccess={() => {
                setShowInviteDialog(false);
                setSelectedFacility(null);
                fetchFacilities(); // Refresh to update coordinator count
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coordinator Details</DialogTitle>
          </DialogHeader>
          {selectedFacility && (
            <CoordinatorDetails
              facility={selectedFacility}
              onClose={() => {
                setShowDetailsDialog(false);
                setSelectedFacility(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateFacilityForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subscription_tier: 'free',
    max_users: 10,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/dev/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Facility created successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create facility');
      }
    } catch (error) {
      console.error('Error creating facility:', error);
      toast.error('Failed to create facility');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Facility Name *</label>
        <Input
          required
          value={formData.name}
          onChange={(e) => {
            const name = e.target.value;
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            setFormData({ ...formData, name, slug });
          }}
          placeholder="e.g., Memorial Hospital"
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Slug (URL) *</label>
        <Input
          required
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          placeholder="e.g., memorial-hospital"
          className="mt-1"
        />
        <p className="text-xs text-[#666] mt-1">URL-friendly identifier</p>
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Subscription Tier</label>
        <select
          value={formData.subscription_tier}
          onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
          className="w-full mt-1 px-3 py-2 border border-[#D4D4D4] rounded-md"
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Max Users</label>
        <Input
          type="number"
          min="1"
          value={formData.max_users}
          onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
          className="mt-1"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting} className="bg-[#2D7A7A] hover:bg-[#236060]">
          {isSubmitting ? 'Creating...' : 'Create Facility'}
        </Button>
      </div>
    </form>
  );
}

function InviteCoordinatorForm({
  facility,
  onSuccess,
}: {
  facility: Facility;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/dev/invite-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          facility_id: facility.id,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Coordinator invited successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to invite coordinator');
      }
    } catch (error) {
      console.error('Error inviting coordinator:', error);
      toast.error('Failed to invite coordinator');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Facility:</strong> {facility.name}
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Coordinator Name *</label>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., John Doe"
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Email *</label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coordinator@facility.com"
          className="mt-1"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting} className="bg-[#2D7A7A] hover:bg-[#236060]">
          {isSubmitting
            ? facility.coordinator_count > 0 ? 'Resending...' : 'Sending Invite...'
            : facility.coordinator_count > 0 ? 'Resend Invite' : 'Send Invite'}
        </Button>
      </div>
    </form>
  );
}

interface Coordinator {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

function CoordinatorDetails({
  facility,
  onClose,
}: {
  facility: Facility;
  onClose: () => void;
}) {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCoordinators();
  }, [facility.id]);

  const fetchCoordinators = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/dev/coordinators?facility_id=${facility.id}`);
      if (response.ok) {
        const data = await response.json();
        setCoordinators(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to load coordinators');
      }
    } catch (error) {
      console.error('Error fetching coordinators:', error);
      toast.error('Failed to load coordinators');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-4 border-[#2D7A7A] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Facility:</strong> {facility.name}
        </p>
      </div>

      {coordinators.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[#666]">No coordinators found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coordinators.map((coordinator) => (
            <Card key={coordinator.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-[#2D7A7A]/10 rounded-full">
                  <Users className="w-5 h-5 text-[#2D7A7A]" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-[#1A1A1A]">{coordinator.name}</h4>
                  <p className="text-sm text-[#666]">{coordinator.email}</p>
                  <p className="text-xs text-[#999] mt-1">
                    Registered: {new Date(coordinator.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </div>
    </div>
  );
}
