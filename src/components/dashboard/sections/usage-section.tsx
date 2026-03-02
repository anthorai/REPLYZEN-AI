'use client';

import React from 'react';
import { UsageSummary } from '../types';

interface UsageSectionProps {
  usage: UsageSummary;
  onUpgrade?: () => void;
  showUpgradePrompt?: boolean;
}

export function UsageSection({ usage, onUpgrade, showUpgradePrompt = false }: UsageSectionProps) {
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free': return '🔒';
      case 'pro': return '⭐';
      case 'enterprise': return '💎';
      default: return '📊';
    }
  };

  const formatResetDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Usage</h2>
          <p className="text-sm text-gray-600 mt-1">
            Plan consumption summary
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getPlanIcon(usage.plan)}</span>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900 capitalize">{usage.plan}</div>
            <div className="text-sm text-gray-500">
              {usage.autoSendEnabled && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-green-600 bg-green-50">
                  Auto-Send: Enabled
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Usage Display */}
      <div className="space-y-4">
        {/* Main Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Follow-ups this month</span>
            <span className={`text-sm font-bold ${getUsageColor(usage.percentage)}`}>
              {usage.current} / {usage.limit.toLocaleString()}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(usage.percentage)}`}
              style={{ width: `${Math.min(usage.percentage, 100)}%` }}
            />
          </div>
          
          {/* Percentage Display */}
          <div className="flex items-center justify-between mt-2">
            <span className={`text-sm font-medium ${getUsageColor(usage.percentage)}`}>
              {Math.round(usage.percentage)}% used
            </span>
            <span className="text-xs text-gray-500">
              Resets {formatResetDate(usage.resetDate)}
            </span>
          </div>
        </div>

        {/* Warning State */}
        {usage.isNearLimit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 font-medium">
                  Approaching your monthly limit
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  {usage.limit - usage.current} follow-ups remaining
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Over Limit State */}
        {usage.isOverLimit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">
                  Monthly limit exceeded
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Upgrade to continue sending follow-ups
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Prompt */}
        {showUpgradePrompt && usage.plan === 'free' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-900">Enable Auto-Send with Pro</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Upgrade to Pro to enable automatic follow-up sending and higher limits
                </p>
              </div>
              <button
                onClick={onUpgrade}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}

        {/* Plan Features */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900">Monthly Limit</div>
              <div className="text-gray-600">{usage.limit.toLocaleString()} follow-ups</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Auto-Send</div>
              <div className="text-gray-600">
                {usage.autoSendEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Plan Type</div>
              <div className="text-gray-600 capitalize">{usage.plan}</div>
            </div>
          </div>
        </div>

        {/* Upgrade CTA for Pro users near limit */}
        {usage.plan === 'pro' && usage.isNearLimit && (
          <div className="text-center pt-4">
            <button
              onClick={onUpgrade}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Upgrade to Enterprise for higher limits →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
