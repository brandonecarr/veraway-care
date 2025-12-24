'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  isConnected: boolean;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({ 
  isConnected, 
  label = 'Real-time', 
  className,
  showLabel = true 
}: ConnectionStatusProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Badge
              variant={isConnected ? 'default' : 'destructive'}
              className={cn(
                'text-xs gap-1.5 transition-all cursor-help',
                isConnected 
                  ? 'bg-[#81B29A] hover:bg-[#6A9A82]' 
                  : 'bg-[#E07A5F] hover:bg-[#C96A53]',
                className
              )}
            >
              {isConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {showLabel && (
                <span>{isConnected ? 'Live' : 'Offline'}</span>
              )}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isConnected 
              ? `${label} updates are active - changes sync automatically` 
              : `${label} updates unavailable - refresh to reconnect`
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
