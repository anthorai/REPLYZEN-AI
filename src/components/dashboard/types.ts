export interface DashboardSummary {
  needsActionCount: number;
  needsActionThreads: ActionThread[];
  autoSentCount24h: number;
  autoSentLogs: AutoSentLog[];
  waitingCount: number;
  waitingThreads: WaitingThread[];
  usageCurrent: number;
  usageLimit: number;
  autoSendEnabled: boolean;
  userPlan: 'free' | 'pro' | 'enterprise';
  lastSyncAt?: Date;
  syncStatus: 'synced' | 'syncing' | 'error' | 'no_accounts';
  connectedAccounts: number;
}

export interface ActionThread {
  id: string;
  threadId: string;
  subject: string;
  recipientName: string;
  recipientEmail: string;
  silenceDuration: number; // in hours
  suggestedAction: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

export interface AutoSentLog {
  id: string;
  threadId: string;
  subject: string;
  recipientName: string;
  sentAt: Date;
  silenceDuration: number; // hours when sent
  status: 'sent' | 'delivered' | 'opened' | 'clicked';
  autoSendSafe: boolean;
}

export interface WaitingThread {
  id: string;
  threadId: string;
  subject: string;
  recipientName: string;
  daysRemaining: number;
  followUpDate: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface UsageSummary {
  current: number;
  limit: number;
  percentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  autoSendEnabled: boolean;
  resetDate: Date;
}

export interface DashboardConfig {
  refreshInterval: number; // milliseconds
  maxThreadsPerSection: number;
  enableAutoRefresh: boolean;
  showUpgradePrompts: boolean;
  usageWarningThreshold: number; // percentage
}

export interface DashboardState {
  data: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  config: DashboardConfig;
}

export interface DashboardActions {
  refreshData: () => Promise<void>;
  reviewAndSend: (threadId: string) => void;
  viewThread: (threadId: string) => void;
  upgradePlan: () => void;
  connectEmail: () => void;
  retrySync: () => void;
  dismissUpgradePrompt: () => void;
}

export interface DashboardSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  emptyMessage: string;
  loading?: boolean;
  error?: string;
}

export interface ActionThreadCardProps {
  thread: ActionThread;
  onReview: (threadId: string) => void;
  onView: (threadId: string) => void;
}

export interface AutoSentLogCardProps {
  log: AutoSentLog;
  onView: (threadId: string) => void;
}

export interface WaitingThreadCardProps {
  thread: WaitingThread;
  onView: (threadId: string) => void;
}

export interface UsageCardProps {
  usage: UsageSummary;
  onUpgrade?: () => void;
  showUpgradePrompt?: boolean;
}

export interface EmptyStateProps {
  type: 'no_accounts' | 'syncing' | 'error' | 'no_data';
  onAction?: () => void;
  error?: string;
}

export interface DashboardMetrics {
  totalThreads: number;
  actionRate: number; // percentage needing action
  autoSendRate: number; // percentage auto-sent
  avgResponseTime: number; // hours
  weeklyGrowth: number; // percentage
}

export interface DashboardFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  priority?: 'high' | 'medium' | 'low' | 'all';
  status?: 'action' | 'sent' | 'waiting' | 'all';
}

export interface DashboardCache {
  summary: DashboardSummary;
  timestamp: Date;
  ttl: number; // milliseconds
}

export interface DashboardAnalytics {
  dailyUsage: Array<{
    date: string;
    actionCount: number;
    sentCount: number;
  }>;
  topRecipients: Array<{
    email: string;
    name: string;
    count: number;
  }>;
  responseRates: Array<{
    threadId: string;
    subject: string;
    rate: number;
  }>;
}

export interface DashboardNotification {
  id: string;
  type: 'upgrade' | 'limit_warning' | 'sync_error' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
  dismissible: boolean;
  timestamp: Date;
}

export interface DashboardError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: Date;
}

export interface DashboardLoadingState {
  main: boolean;
  sections: {
    action: boolean;
    autoSent: boolean;
    waiting: boolean;
    usage: boolean;
  };
}

export interface DashboardRefreshConfig {
  auto: boolean;
  interval: number;
  background: boolean;
  onRefresh?: () => Promise<void>;
}

export interface DashboardUserPreferences {
  compactMode: boolean;
  showRecipientEmails: boolean;
  collapseEmptySections: boolean;
  enableNotifications: boolean;
  preferredTimezone: string;
}

export interface DashboardApiResponse {
  success: boolean;
  data?: DashboardSummary;
  error?: string;
  timestamp: Date;
  cacheHit?: boolean;
}
