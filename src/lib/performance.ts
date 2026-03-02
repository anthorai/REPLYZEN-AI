// Performance monitoring utilities

interface PerformanceMetrics {
  ttfb: number;
  fcp: number;
  lcp: number;
  fid: number;
  cls: number;
}

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      this.initObservers();
    }
  }

  private initObservers() {
    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        this.metrics.lcp = lastEntry.startTime;
        this.logMetric("LCP", lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(lcpObserver);
    } catch (e) {
      console.warn("LCP observation not supported");
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.fid = entry.processingStart - entry.startTime;
          this.logMetric("FID", this.metrics.fid);
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
      this.observers.push(fidObserver);
    } catch (e) {
      console.warn("FID observation not supported");
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.metrics.cls = clsValue;
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(clsObserver);
    } catch (e) {
      console.warn("CLS observation not supported");
    }

    // First Contentful Paint
    try {
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformanceEntry) => {
          if (entry.name === "first-contentful-paint") {
            this.metrics.fcp = entry.startTime;
            this.logMetric("FCP", entry.startTime);
          }
        });
      });
      paintObserver.observe({ entryTypes: ["paint"] });
      this.observers.push(paintObserver);
    } catch (e) {
      console.warn("Paint observation not supported");
    }
  }

  private logMetric(name: string, value: number) {
    console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);
    
    // Send to analytics in production
    if (import.meta.env.PROD && "gtag" in window) {
      (window as any).gtag("event", "web_vitals", {
        event_category: "Web Vitals",
        event_label: name,
        value: Math.round(value),
        non_interaction: true,
      });
    }
  }

  // Measure API call duration
  measureApiCall<T>(name: string, promise: Promise<T>): Promise<T> {
    const start = performance.now();
    
    return promise
      .then((result) => {
        const duration = performance.now() - start;
        console.log(`[API] ${name}: ${duration.toFixed(2)}ms`);
        
        // Log slow API calls
        if (duration > 1000) {
          console.warn(`[API] Slow call detected: ${name} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
      })
      .catch((error) => {
        const duration = performance.now() - start;
        console.error(`[API] ${name} failed after ${duration.toFixed(2)}ms:`, error);
        throw error;
      });
  }

  // Measure component render time
  measureRender(componentName: string, fn: () => void) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    
    if (duration > 16) { // Longer than one frame (60fps)
      console.warn(`[Render] ${componentName} took ${duration.toFixed(2)}ms`);
    }
  }

  // Get current metrics
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  // Mark a performance milestone
  mark(name: string) {
    if ("performance" in window) {
      performance.mark(name);
      console.log(`[Performance] Mark: ${name}`);
    }
  }

  // Measure between two marks
  measure(name: string, startMark: string, endMark: string) {
    if ("performance" in window) {
      try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name);
        if (entries.length > 0) {
          const duration = entries[0].duration;
          console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
          return duration;
        }
      } catch (e) {
        console.warn(`[Performance] Could not measure ${name}:`, e);
      }
    }
    return null;
  }

  // Cleanup
  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for measuring component performance
export function usePerformanceMark(markName: string) {
  if (typeof window !== "undefined") {
    performanceMonitor.mark(`${markName}_start`);
    
    // Use requestAnimationFrame to measure after render
    requestAnimationFrame(() => {
      performanceMonitor.mark(`${markName}_end`);
      performanceMonitor.measure(
        markName,
        `${markName}_start`,
        `${markName}_end`
      );
    });
  }
}

// Utility to debounce function calls
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Utility to throttle function calls
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Preload critical resources
export function preloadResource(href: string, as: "script" | "style" | "image" | "font") {
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = href;
    link.as = as;
    
    if (as === "font") {
      link.crossOrigin = "anonymous";
    }
    
    document.head.appendChild(link);
  }
}

// Lazy load non-critical resources
export function lazyLoadImage(src: string, callback?: () => void) {
  if (typeof window !== "undefined" && "IntersectionObserver" in window) {
    const img = new Image();
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.disconnect();
        }
      });
    });
    
    img.onload = () => callback?.();
    observer.observe(img);
    
    return img;
  } else {
    // Fallback for browsers without IntersectionObserver
    const img = new Image();
    img.src = src;
    img.onload = () => callback?.();
    return img;
  }
}
