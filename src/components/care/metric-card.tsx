'use client';

import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  onClick,
  className
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        'p-4 md:p-6 transition-all duration-200 border shadow-card',
        onClick && 'cursor-pointer hover:shadow-card-hover hover-lift touch-manipulation select-none press-scale',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        {Icon && (
          <div className="p-1.5 md:p-2 rounded-lg bg-brand-teal/10">
            <Icon className="w-4 h-4 md:w-5 md:h-5 text-brand-teal" />
          </div>
        )}
      </div>
      
      <div className="space-y-1 md:space-y-2">
        <p className="text-metric-hero-mobile md:text-metric-hero font-display">
          {value}
        </p>
        {subtitle && (
          <p className="text-metadata text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            'inline-flex items-center gap-1 text-xs font-medium mt-2',
            trend.value > 0 ? 'text-green-600' : 'text-red-600'
          )}>
            <span>{trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
