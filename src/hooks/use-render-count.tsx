'use client';

import { useRef, useEffect } from 'react';

/**
 * Development-only hook to track component render counts
 * Helps identify components that are re-rendering too frequently
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   useRenderCount('MyComponent');
 *   // ...
 * }
 * ```
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Only log if renders exceed threshold (potential performance issue)
      if (renderCount.current > 5) {
        console.warn(
          `[Performance] ${componentName} has rendered ${renderCount.current} times`
        );
      }
    }
  });

  return renderCount.current;
}

/**
 * Development-only hook to measure component render time
 * Logs a warning if render takes longer than threshold
 */
export function useRenderTime(componentName: string, thresholdMs = 16): void {
  const startTime = useRef(performance.now());

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const renderTime = performance.now() - startTime.current;
      if (renderTime > thresholdMs) {
        console.warn(
          `[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render (threshold: ${thresholdMs}ms)`
        );
      }
      // Reset for next render
      startTime.current = performance.now();
    }
  });
}

/**
 * Development-only hook to track why a component re-rendered
 * Logs which props changed between renders
 */
export function useWhyDidYouRender<T extends Record<string, unknown>>(
  componentName: string,
  props: T
): void {
  const previousProps = useRef<T | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && previousProps.current) {
      const changedProps: string[] = [];
      const allKeys = new Set([
        ...Object.keys(previousProps.current),
        ...Object.keys(props),
      ]);

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps.push(key);
        }
      });

      if (changedProps.length > 0) {
        console.log(
          `[WhyDidYouRender] ${componentName} re-rendered due to:`,
          changedProps
        );
      }
    }
    previousProps.current = props;
  });
}
