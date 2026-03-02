'use client';

import React from 'react';
import { DashboardSummary } from '../types';

interface DashboardHeaderProps {
  data: DashboardSummary;
  onRefresh: () => void;
  loading: boolean;
  lastRefreshed: Date | null;
}

export function DashboardHeader({ data, onRefresh, loading, lastRefreshed }: DashboardHeaderProps) {
  const formatLastRefreshed = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return 'Just now';
    }
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return '✅';
      case 'syncing': return '🔄';
      case 'error': return '⚠️';
      case 'no_accounts': return '📧';
      default: return '❓';
    }
  };

  const getSyncStatusText = (status: string) => {
    switch (status) {
      case 'synced': return 'All synced';
      case 'syncing': return 'Syncing...';
      case 'error': return 'Sync error';
      case 'no_accounts': return 'No accounts';
      default: return 'Unknown status';
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'text-green-600';
      case 'syncing': return 'text-blue-600';
      case 'error': return 'text-red-600';
      case 'no_accounts': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - Title and Status */}
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-sm ${getSyncStatusColor(data.syncStatus)}`}>
                  {getSyncStatusIcon(data.syncStatus)} {getSyncStatusText(data.syncStatus)}
                </span>
                {data.connectedAccounts > 0 && (
                  <span className="text-sm text-gray-500">
                    {data.connectedAccounts} account{data.connectedAccounts !== 1 ? 's' : ''} connected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center space-x-4">
            {/* Last Refreshed */}
            <div className="text-right">
              <div className="text-xs text-gray-500">
                Last updated: {formatLastRefreshed(lastRefreshed)}
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className={`
                p-2 rounded-lg transition-colors
                ${loading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
              title="Refresh dashboard"
            >
              <svg 
                className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="font-semibold text-blue-600">{data.needsActionCount}</div>
                <div className="text-gray-500">Need Action</div>
              </div>
              {data.autoSendEnabled && (
                <div className="text-center">
                  <div className="font-semibold text-green-600">{data.autoSentCount24h}</div>
                  <div className="text-gray-500">Auto-Sent</div>
                </div>
              )}
              <div className="text-center">
                <div className="font-semibold text-orange-600">{data.waitingCount}</div>
                <div className="text-gray-500">Waiting</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Stats */}
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-semibold text-blue-600">{data.needsActionCount}</div>
              <div className="text-xs text-gray-500">Need Action</div>
            </div>
            {data.autoSendEnabled && (
              <div>
                <div className="font-semibold text-green-600">{data.autoSentCount24h}</div>
                <div className="text-xs text-gray-500">Auto-Sent</div>
              </div>
            )}
            <div>
              <div className="font-semibold text-orange-600">{data.waitingCount}</div>
              <div className="text-xs text-gray-500">Waiting</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
