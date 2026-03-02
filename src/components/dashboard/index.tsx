// Action-Oriented Dashboard for Replyzen
//
// This is NOT an analytics dashboard.
// This is NOT a data visualization page.
//
// This is an ACTION CONTROL PANEL.
//
// Clarity reduces friction.
// Friction reduction increases daily usage.
// Daily usage increases stickiness.

export { DashboardMain } from './dashboard-main';
export { ActionSection } from './sections/action-section';
export { AutoSentSection } from './sections/auto-sent-section';
export { WaitingSection } from './sections/waiting-section';
export { UsageSection } from './sections/usage-section';
export { EmptyState } from './components/empty-state';
export { LoadingState } from './components/loading-state';
export { ErrorState } from './components/error-state';
export { DashboardHeader } from './components/dashboard-header';

export type {
  // Core dashboard types
  DashboardSummary,
  DashboardState,
  DashboardActions,
  DashboardConfig,
  
  // Thread and log types
  ActionThread,
  AutoSentLog,
  WaitingThread,
  UsageSummary,
  
  // Component props
  ActionSectionProps,
  AutoSentSectionProps,
  WaitingSectionProps,
  UsageSectionProps,
  EmptyStateProps,
  DashboardHeaderProps,
  
  // Analytics and metrics
  DashboardMetrics,
  DashboardAnalytics,
  DashboardApiResponse,
  
  // State management
  DashboardLoadingState,
  DashboardRefreshConfig,
  DashboardUserPreferences,
  
  // Notifications and errors
  DashboardNotification,
  DashboardError,
  DashboardFilters
} from './types';

// Convenience factory for creating dashboard components
export function createDashboard(config?: Partial<DashboardConfig>) {
  return {
    DashboardMain,
    ActionSection,
    AutoSentSection,
    WaitingSection,
    UsageSection,
    EmptyState,
    LoadingState,
    ErrorState,
    DashboardHeader
  };
}

// Main export for easy usage
export default createDashboard;
