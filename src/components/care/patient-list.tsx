'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, ArrowUpDown, Filter } from 'lucide-react';
import type { Patient } from '@/types/care-coordination';
import { BENEFIT_PERIODS, getBenefitPeriodDays, getBenefitPeriodDaysRemaining } from '@/types/care-coordination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface PatientListProps {
  onSelectPatient?: (patient: Patient) => void;
}

export function PatientList({ onSelectPatient }: PatientListProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'mrn' | 'admission'>('name');

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/patients');
      const result = await response.json();
      // API returns { data: [], count: number }
      const data = result.data || result;
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients');
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchPatients();
      return;
    }

    try {
      const response = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error searching patients:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this patient?')) return;

    try {
      const response = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Patient deleted');
        fetchPatients();
      } else {
        toast.error('Failed to delete patient');
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error('Failed to delete patient');
    }
  };

  const filteredPatients = patients
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
        case 'mrn':
          return a.mrn.localeCompare(b.mrn);
        case 'admission':
          if (!a.admission_date) return 1;
          if (!b.admission_date) return -1;
          return new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime();
        default:
          return 0;
      }
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-[#666]">Loading patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
          <Input
            placeholder="Search by name or MRN..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 border-[#D4D4D4]"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Status: {statusFilter === 'all' ? 'All' : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                All Patients
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                Active Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
                Inactive Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy('name')}>
                Sort by Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('mrn')}>
                Sort by MRN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('admission')}>
                Sort by Admission Date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#2D7A7A] hover:bg-[#236060] gap-2">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Patient</DialogTitle>
              </DialogHeader>
              <PatientForm
                onSuccess={() => {
                  setShowCreateDialog(false);
                  fetchPatients();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#D4D4D4] rounded-lg">
          <p className="text-[#666] mb-2">No patients found</p>
          <p className="text-sm text-[#999]">
            {patients.length === 0 ? 'Create your first patient to get started' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#666]">
              Showing {filteredPatients.length} of {patients.length} patients
            </p>
          </div>
          <div className="space-y-3">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="bg-white border border-[#D4D4D4] rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedPatient(patient);
                setShowDetailDialog(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-[#1A1A1A]">
                      {patient.last_name}, {patient.first_name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={
                        patient.status === 'active'
                          ? 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]'
                          : 'bg-[#999]/10 text-[#999] border-[#999]'
                      }
                    >
                      {patient.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-[#666] space-y-1">
                    <p>
                      <span className="font-medium">MRN:</span> {patient.mrn}
                    </p>
                    {patient.date_of_birth && (
                      <p>
                        <span className="font-medium">DOB:</span>{' '}
                        {new Date(patient.date_of_birth).toLocaleDateString()}
                      </p>
                    )}
                    {patient.diagnosis && (
                      <p>
                        <span className="font-medium">Diagnosis:</span> {patient.diagnosis}
                      </p>
                    )}
                    {patient.benefit_period && (
                      <p className="flex items-center gap-2">
                        <span className="font-medium">Benefit Period {patient.benefit_period}</span>
                        {(() => {
                          const daysRemaining = getBenefitPeriodDaysRemaining(patient.admitted_date, patient.benefit_period);
                          if (daysRemaining === null) return null;
                          const isUrgent = daysRemaining <= 14;
                          return (
                            <Badge
                              variant="outline"
                              className={isUrgent
                                ? 'bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]'
                                : 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]'
                              }
                            >
                              {daysRemaining} days remaining
                            </Badge>
                          );
                        })()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPatient(patient);
                      setShowEditDialog(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(patient.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-[#E07A5F]" />
                  </Button>
                </div>
              </div>
            </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          <PatientForm
            patient={selectedPatient}
            onSuccess={() => {
              setShowEditDialog(false);
              setSelectedPatient(null);
              fetchPatients();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Patient Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <PatientDetail 
              patient={selectedPatient} 
              onEdit={() => {
                setShowDetailDialog(false);
                setShowEditDialog(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientForm({ patient, onSuccess }: { patient?: Patient | null; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    benefit_period: patient?.benefit_period || 1,
    mrn: patient?.mrn || '',
    first_name: patient?.first_name || '',
    last_name: patient?.last_name || '',
    date_of_birth: patient?.date_of_birth || '',
    admission_date: patient?.admission_date || '',
    diagnosis: patient?.diagnosis || '',
    status: patient?.status || 'active',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = patient ? `/api/patients/${patient.id}` : '/api/patients';
      const method = patient ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(patient ? 'Patient updated successfully' : 'Patient created successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || `Failed to ${patient ? 'update' : 'create'} patient`);
      }
    } catch (error) {
      console.error(`Error ${patient ? 'updating' : 'creating'} patient:`, error);
      toast.error(`Failed to ${patient ? 'update' : 'create'} patient`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Benefit Period *</label>
        <Select
          value={String(formData.benefit_period)}
          onValueChange={(value) => setFormData({ ...formData, benefit_period: parseInt(value) })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select benefit period" />
          </SelectTrigger>
          <SelectContent>
            {BENEFIT_PERIODS.map((period) => (
              <SelectItem key={period} value={String(period)}>
                BP{period} ({getBenefitPeriodDays(period)} days)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          BP1-2: 90 days | BP3+: 60 days (face-to-face required)
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">MRN *</label>
        <Input
          required
          value={formData.mrn}
          onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
          placeholder="Medical Record Number"
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#1A1A1A]">First Name *</label>
          <Input
            required
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="First name"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#1A1A1A]">Last Name *</label>
          <Input
            required
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="Last name"
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Date of Birth</label>
        <Input
          type="date"
          value={formData.date_of_birth}
          onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Admission Date</label>
        <Input
          type="date"
          value={formData.admission_date}
          onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-[#1A1A1A]">Diagnosis</label>
        <Input
          value={formData.diagnosis}
          onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
          placeholder="Primary diagnosis"
          className="mt-1"
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting} className="bg-[#2D7A7A] hover:bg-[#236060]">
          {isSubmitting ? (patient ? 'Updating...' : 'Creating...') : (patient ? 'Update Patient' : 'Create Patient')}
        </Button>
      </div>
    </form>
  );
}

function PatientDetail({ patient, onEdit }: { patient: Patient; onEdit: () => void }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPatientIssues();
  }, [patient.id]);

  const fetchPatientIssues = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/issues?patient_id=${patient.id}`);
      if (response.ok) {
        const data = await response.json();
        setIssues(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching patient issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-[#2D7A7A]/10 text-[#2D7A7A] border-[#2D7A7A]';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-700 border-blue-500';
      case 'overdue':
        return 'bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]';
      case 'resolved':
        return 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Information */}
      <div className="bg-[#FAFAF8] border border-[#D4D4D4] rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {patient.last_name}, {patient.first_name}
            </h2>
            <Badge
              variant="outline"
              className={
                patient.status === 'active'
                  ? 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]'
                  : 'bg-[#999]/10 text-[#999] border-[#999]'
              }
            >
              {patient.status}
            </Badge>
          </div>
          <Button onClick={onEdit} variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[#666] mb-1">MRN</p>
            <p className="font-medium font-mono">{patient.mrn}</p>
          </div>
          {patient.date_of_birth && (
            <div>
              <p className="text-[#666] mb-1">Date of Birth</p>
              <p className="font-medium">{new Date(patient.date_of_birth).toLocaleDateString()}</p>
            </div>
          )}
          {patient.admission_date && (
            <div>
              <p className="text-[#666] mb-1">Admission Date</p>
              <p className="font-medium">{new Date(patient.admission_date).toLocaleDateString()}</p>
            </div>
          )}
          {patient.diagnosis && (
            <div>
              <p className="text-[#666] mb-1">Diagnosis</p>
              <p className="font-medium">{patient.diagnosis}</p>
            </div>
          )}
          {patient.benefit_period && (
            <div>
              <p className="text-[#666] mb-1">Benefit Period</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">BP{patient.benefit_period}</p>
                {(() => {
                  const daysRemaining = getBenefitPeriodDaysRemaining(patient.admitted_date, patient.benefit_period);
                  if (daysRemaining === null) return null;
                  const isUrgent = daysRemaining <= 14;
                  return (
                    <Badge
                      variant="outline"
                      className={isUrgent
                        ? 'bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]'
                        : 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]'
                      }
                    >
                      {daysRemaining} days remaining
                    </Badge>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Issue History */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Issue History ({issues.length})
        </h3>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-[#666]">Loading issues...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[#D4D4D4] rounded-lg">
            <p className="text-[#666]">No issues found for this patient</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="bg-white border border-[#D4D4D4] rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm text-[#666]">#{issue.issue_number}</span>
                      <Badge variant="secondary" className="text-xs">
                        {issue.issue_type}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(issue.status)}>
                        {issue.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    {issue.notes && (
                      <p className="text-sm text-[#666] mb-2">{issue.notes}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-[#999]">
                      <span>Created {new Date(issue.created_at).toLocaleDateString()}</span>
                      {issue.assignee && (
                        <span>Assigned to {issue.assignee.name || issue.assignee.email?.split('@')[0]}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
