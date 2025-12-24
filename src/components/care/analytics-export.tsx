'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsExportProps {
  data: any;
  filename?: string;
  className?: string;
}

export function AnalyticsExport({ data, filename = 'analytics-export', className }: AnalyticsExportProps) {
  const exportToCSV = () => {
    try {
      // Convert analytics data to CSV format
      const csvData = convertAnalyticsToCSV(data);
      
      // Create blob and download
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Analytics data exported successfully');
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast.error('Failed to export analytics data');
    }
  };

  return (
    <Button
      onClick={exportToCSV}
      variant="outline"
      size="sm"
      className={className}
    >
      <Download className="w-4 h-4 mr-2" />
      Export to CSV
    </Button>
  );
}

function convertAnalyticsToCSV(data: any): string {
  const rows: string[] = [];
  
  // Add header
  rows.push('Analytics Export - ' + new Date().toISOString());
  rows.push('');
  
  // Response Time Trends
  if (data.responseTimeTrends && data.responseTimeTrends.length > 0) {
    rows.push('Response Time Trends');
    rows.push('Date,Average Response Time (hours),Issue Count');
    data.responseTimeTrends.forEach((item: any) => {
      rows.push(`${item.date},${item.avgResponseTime},${item.count}`);
    });
    rows.push('');
  }
  
  // Resolution Velocity
  if (data.resolutionVelocity && data.resolutionVelocity.length > 0) {
    rows.push('Resolution Velocity');
    rows.push('Date,Resolved Count,Average Hours');
    data.resolutionVelocity.forEach((item: any) => {
      rows.push(`${item.date},${item.resolved},${item.avgHours}`);
    });
    rows.push('');
  }
  
  // Clinician Workload
  if (data.clinicianWorkload && data.clinicianWorkload.length > 0) {
    rows.push('Clinician Workload');
    rows.push('Name,Email,Assigned,Resolved,Overdue,Avg Completion Time (hours)');
    data.clinicianWorkload.forEach((item: any) => {
      rows.push(`${item.name},${item.email},${item.assignedCount},${item.resolvedCount},${item.overdueCount},${item.avgCompletionTime}`);
    });
    rows.push('');
  }
  
  // Issue Type Distribution
  if (data.issueTypeDistribution && data.issueTypeDistribution.length > 0) {
    rows.push('Issue Type Distribution Over Time');
    rows.push('Date,Issue Type,Count');
    data.issueTypeDistribution.forEach((day: any) => {
      day.distribution.forEach((item: any) => {
        rows.push(`${day.date},${item.type},${item.count}`);
      });
    });
    rows.push('');
  }
  
  return rows.join('\n');
}
