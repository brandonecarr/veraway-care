'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileCheck, AlertTriangle, User, Calendar, Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getBenefitPeriodDays } from '@/types/care-coordination';

interface PatientRecert {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  benefit_period: number;
  days_remaining: number;
  period_days: number;
  admitted_date: string;
}

export function RecertificationClient() {
  const params = useParams();
  const slug = params?.slug as string;
  const [patients, setPatients] = useState<PatientRecert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPatientsNeedingRecert();
  }, []);

  const fetchPatientsNeedingRecert = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/patients/recertification');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPatients(data.patients || []);
    } catch (error) {
      console.error('Error fetching recertification patients:', error);
      toast.error('Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRecert = async (patientId: string, patientName: string) => {
    setProcessingIds(prev => new Set(prev).add(patientId));

    try {
      const response = await fetch(`/api/patients/recertification/${patientId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm recertification');
      }

      const data = await response.json();
      toast.success(`${patientName} recertified successfully`, {
        description: `Moved from BP${data.previous_period} to BP${data.new_period}`,
      });

      // Remove the patient from the list
      setPatients(prev => prev.filter(p => p.id !== patientId));
    } catch (error: any) {
      console.error('Recertification error:', error);
      toast.error(error.message || 'Failed to confirm recertification');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(patientId);
        return newSet;
      });
    }
  };

  const getDaysRemainingColor = (days: number) => {
    if (days <= 0) return 'bg-red-500 text-white';
    if (days <= 3) return 'bg-orange-500 text-white';
    return 'bg-amber-500 text-white';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${slug}/dashboard`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPatientsNeedingRecert}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-amber-100">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">
                Patients Requiring Recertification
              </p>
              <p className="text-sm text-amber-700 mt-1">
                These patients have 7 days or less remaining in their current benefit period.
                Confirm recertification to advance them to the next period.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-green-100">
              <FileCheck className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All Caught Up!</h3>
              <p className="text-muted-foreground mt-1">
                No patients currently require recertification.
              </p>
            </div>
            <Link href={`/${slug}/dashboard`}>
              <Button variant="outline" className="mt-2">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(patient => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-gray-100">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {patient.first_name} {patient.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        MRN: {patient.mrn}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Benefit Period */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Period</span>
                  <Badge variant="outline" className="font-semibold">
                    BP{patient.benefit_period}
                  </Badge>
                </div>

                {/* Days Remaining */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Days Remaining</span>
                  <Badge className={getDaysRemainingColor(patient.days_remaining)}>
                    <Clock className="w-3 h-3 mr-1" />
                    {patient.days_remaining} {patient.days_remaining === 1 ? 'day' : 'days'}
                  </Badge>
                </div>

                {/* Period Length Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Period length</span>
                  <span>{patient.period_days} days</span>
                </div>

                {/* Next Period Info */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Next: BP{Math.min(patient.benefit_period + 1, 6)}
                      ({getBenefitPeriodDays(Math.min(patient.benefit_period + 1, 6))} days)
                    </span>
                  </div>
                </div>

                {/* Confirm Button */}
                <Button
                  className="w-full bg-[#2D7A7A] hover:bg-[#236060]"
                  onClick={() => handleConfirmRecert(patient.id, `${patient.first_name} ${patient.last_name}`)}
                  disabled={processingIds.has(patient.id)}
                >
                  {processingIds.has(patient.id) ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-2" />
                      Confirm Recertification
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
