'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardSummary, DashboardState, DashboardActions, DashboardConfig, EmptyStateProps } from './types';
import { ActionSection } from './sections/action-section';
import { AutoSentSection } from './sections/auto-sent-section';
import { WaitingSection } from './sections/waiting-section';
import { UsageSection } from './sections/usage-section';
import { EmptyState } from './components/empty-state';
import { LoadingState } from './components/loading-state';
import { ErrorState } from './components/error-state';
import { DashboardHeader } from './components/dashboard-header';

interface DashboardMainProps {
  initialData?: DashboardSummary;
  config?: Partial<DashboardConfig>;
  onReviewAndSend?: (threadId: string) => void;
  onViewThread?: (threadId: string) => void;
  onUpgradePlan?: () => void;
  onConnectEmail?: () => void;
  onRetrySync?: () => void;
}

const DEFAULT_CONFIG: DashboardConfig = {
  refreshInterval: 30000, // 30 seconds
  maxThreadsPerSection: 5,
  enableAutoRefresh: true,
  showUpgradePrompts: true,
  usageWarningThreshold: 80
};

export function DashboardMain({
  initialData,
  config: userConfig,
  onReviewAndSend,
  onViewThread,
  onUpgradePlan,
  onConnectEmail,
  onRetrySync
}: DashboardMainProps) {
  const [state, setState] = useState<DashboardState>({
    data: initialData || null,
    loading: !initialData,
    error: null,
    lastRefreshed: initialData ? new Date() : null,
    config: { ...DEFAULT_CONFIG, ...userConfig }
  });

  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'upgrade' | 'limit_warning' | 'sync_error' | 'success';
    title: string;
    message: string;
    dismissible: boolean;
  }>>([]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/dashboard/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }

      setState(prev => ({
        ...prev,
        data: result.data,
        loading: false,
        lastRefreshed: new Date(),
        error: null
      }));

      // Check for upgrade prompts
      if (result.data && state.config.showUpgradePrompts) {
        checkUpgradePrompts(result.data);
      }

    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [state.config.showUpgradePrompts]);

  // Check for upgrade prompts
  const checkUpgradePrompts = useCallback((data: DashboardSummary) => {
    const newNotifications = [];

    // Free plan upgrade prompt
    if (data.userPlan === 'free' && data.needsActionCount > 0) {
      newNotifications.push({
        id: 'upgrade-pro',
        type: 'upgrade' as const,
        title: 'Enable Auto-Send',
        message: 'Upgrade to Pro to enable automatic follow-up sending',
        dismissible: true
      });
    }

    // Usage limit warning
    if (data.usageCurrent / data.usageLimit > state.config.usageWarningThreshold / 100) {
      newNotifications.push({
        id: 'limit-warning',
        type: 'limit_warning' as const,
        title: 'Approaching Limit',
        message: `You've used ${Math.round((data.usageCurrent / data.usageLimit) * 100)}% of your monthly follow-ups`,
        dismissible: true
      });
    }

    // Sync error
    if (data.syncStatus === 'error') {
      newNotifications.push({
        id: 'sync-error',
        type: 'sync_error' as const,
        title: 'Sync Error',
        message: 'Having trouble syncing your emails',
        dismissible: false
      });
    }

    setNotifications(prev => {
      const filtered = prev.filter(n => !newNotifications.find(nn => nn.id === n.id));
      return [...filtered, ...newNotifications];
    });
  }, [state.config.usageWarningThreshold]);

  // Auto-refresh effect
  useEffect(() => {
    if (!state.config.enableAutoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, state.config.refreshInterval);

    return () => clearInterval(interval);
  }, [state.config.enableAutoRefresh, state.config.refreshInterval, fetchDashboardData]);

  // Initial data fetch
  useEffect(() => {
    if (!initialData) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, initialData]);

  // Handle actions
  const handleReviewAndSend = useCallback((threadId: string) => {
    onReviewAndSend?.(threadId);
  }, [onReviewAndSend]);

  const handleViewThread = useCallback((threadId: string) => {
    onViewThread?.(threadId);
  }, [onViewThread]);

  const handleUpgradePlan = useCallback(() => {
    onUpgradePlan?.();
    // Dismiss upgrade notifications
    setNotifications(prev => prev.filter(n => n.type !== 'upgrade'));
  }, [onUpgradePlan]);

  const handleConnectEmail = useCallback(() => {
    onConnectEmail?.();
  }, [onConnectEmail]);

  const handleRetrySync = useCallback(() => {
    onRetrySync?.();
    fetchDashboardData();
  }, [onRetrySync, fetchDashboardData]);

  const handleRefresh = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleDismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Render empty states
  if (state.data?.syncStatus === 'no_accounts') {
    return (
      <EmptyState
        type="no_accounts"
        onAction={handleConnectEmail}
      />
    );
  }

  if (state.data?.syncStatus === 'syncing') {
    return (
      <EmptyState
        type="syncing"
      />
    );
  }

  if (state.data?.syncStatus === 'error') {
    return (
      <EmptyState
        type="error"
        onAction={handleRetrySync}
        error="Unable to sync your emails"
      />
    );
  }

  if (state.error && !state.data) {
    return (
      <ErrorState
        error={state.error}
        onRetry={handleRefresh}
      />
    );
  }

  if (state.loading && !state.data) {
    return (
      <LoadingState />
    );
  }

  if (!state.data) {
    return (
      <EmptyState
        type="no_data"
        onAction={handleRefresh}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="sticky top-0 z-50 space-y-2 p-4">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`
                flex items-center justify-between p-4 rounded-lg shadow-sm
                ${notification.type === 'upgrade' ? 'bg-blue-50 border border-blue-200' : ''}
                ${notification.type === 'limit_warning' ? 'bg-yellow-50 border border-yellow-200' : ''}
                ${notification.type === 'sync_error' ? 'bg-red-50 border border-red-200' : ''}
                ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : ''}
              `}
            >
              <div>
                <h3 className="font-medium text-gray-900">{notification.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
              </div>
              <div className="flex items-center space-x-2">
                {notification.type === 'upgrade' && (
                  <button
                    onClick={handleUpgradePlan}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Upgrade
                  </button>
                )}
                {notification.type === 'sync_error' && (
                  <button
                    onClick={handleRetrySync}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                )}
                {notification.dismissible && (
                  <button
                    onClick={() => handleDismissNotification(notification.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <DashboardHeader
        data={state.data}
        onRefresh={handleRefresh}
        loading={state.loading}
        lastRefreshed={state.lastRefreshed}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Needs Action Today */}
        <ActionSection
          threads={state.data.needsActionThreads}
          onReviewAndSend={handleReviewAndSend}
          onViewThread={handleViewThread}
          loading={state.loading}
          maxThreads={state.config.maxThreadsPerSection}
        />

        {/* Section 2: Sent Automatically */}
        {state.data.autoSendEnabled && (
          <AutoSentSection
            logs={state.data.autoSentLogs}
            onViewThread={handleViewThread}
            loading={state.loading}
            maxThreads={state.config.maxThreadsPerSection}
          />
        )}

        {/* Section 3: Waiting Threads */}
        <WaitingSection
          threads={state.data.waitingThreads}
          onViewThread={handleViewThread}
          loading={state.loading}
          maxThreads={state.config.maxThreadsPerSection}
        />

        {/* Section 4: Usage */}
        <UsageSection
          usage={{
            current: state.data.usageCurrent,
            limit: state.data.usageLimit,
            percentage: (state.data.usageCurrent / state.data.usageLimit) * 100,
            isNearLimit: (state.data.usageCurrent / state.data.usageLimit) > (state.config.usageWarningThreshold / 100),
            isOverLimit: state.data.usageCurrent > state.data.usageLimit,
            plan: state.data.userPlan,
            autoSendEnabled: state.data.autoSendEnabled,
            resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
          }}
          onUpgrade={handleUpgradePlan}
          showUpgradePrompt={state.config.showUpgradePrompts && state.data.userPlan === 'free'}
        />
      </div>
    </div>
  );
}

// Helper component for section loading state
function SectionLoading({ height = "h-32" }: { height?: string }) {
  return (
    <div className={`${height} bg-white rounded-lg shadow-sm p-6 animate-pulse`}>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}
