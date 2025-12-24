import { Skeleton } from '@/components/ui/skeleton';

export function IssueCardSkeleton() {
  return (
    <div className="border-l-4 border-brand-teal bg-white p-4 rounded-md shadow-card">
      <div className="flex justify-between items-start mb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-4 w-48 mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-md shadow-card">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-12 w-16 mb-1" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white p-6 rounded-md shadow-card h-full">
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-2/5" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
