/**
 * Performance monitoring utilities
 * Helps track and debug performance issues in development
 */

interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
}

const performanceLog: PerformanceEntry[] = [];
const MAX_LOG_SIZE = 100;

/**
 * Measure the duration of an async operation
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV !== 'development') {
    return operation();
  }

  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;

    logPerformance(name, duration);

    if (duration > 1000) {
      console.warn(`[Slow Operation] ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Failed Operation] ${name} failed after ${duration.toFixed(2)}ms`);
    throw error;
  }
}

/**
 * Measure the duration of a sync operation
 */
export function measureSync<T>(name: string, operation: () => T): T {
  if (process.env.NODE_ENV !== 'development') {
    return operation();
  }

  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;

  logPerformance(name, duration);

  if (duration > 16) {
    console.warn(`[Slow Sync Operation] ${name} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

function logPerformance(name: string, duration: number): void {
  performanceLog.push({
    name,
    duration,
    timestamp: Date.now(),
  });

  // Keep log size manageable
  if (performanceLog.length > MAX_LOG_SIZE) {
    performanceLog.shift();
  }
}

/**
 * Get performance statistics for a specific operation
 */
export function getPerformanceStats(name: string): {
  count: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
} | null {
  const entries = performanceLog.filter((e) => e.name === name);
  if (entries.length === 0) return null;

  const durations = entries.map((e) => e.duration);
  return {
    count: entries.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
  };
}

/**
 * Get all performance logs (for debugging)
 */
export function getPerformanceLogs(): PerformanceEntry[] {
  return [...performanceLog];
}

/**
 * Clear performance logs
 */
export function clearPerformanceLogs(): void {
  performanceLog.length = 0;
}

/**
 * Create a performance mark for React DevTools Profiler
 */
export function mark(name: string): void {
  if (process.env.NODE_ENV === 'development' && typeof performance !== 'undefined') {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measureMark(name: string, startMark: string, endMark: string): void {
  if (process.env.NODE_ENV === 'development' && typeof performance !== 'undefined') {
    try {
      performance.measure(name, startMark, endMark);
    } catch {
      // Marks may not exist
    }
  }
}
