'use client';

import React from 'react';
import { AutoSentLog } from '../types';

interface AutoSentSectionProps {
  logs: AutoSentLog[];
  onViewThread: (threadId: string) => void;
  loading?: boolean;
  maxThreads?: number;
}

export function AutoSentSection({
  logs,
  onViewThread,
  loading = false,
  maxThreads = 5
}: AutoSentSectionProps) {
  const displayLogs = logs.slice(0, maxThreads);
  const hasMore = logs.length > maxThreads;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sent Automatically</h2>
          <p className="text-sm text-gray-600 mt-1">
            Follow-ups sent via Auto-Send in last 24 hours
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-600">{logs.length}</div>
          <div className="text-sm text-gray-500">Sent automatically</div>
        </div>
      </div>

      {/* Content */}
      {displayLogs.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-5xl mb-3">📤</div>
          <p className="text-gray-600 font-medium">No automatic sends today</p>
          <p className="text-sm text-gray-500 mt-1">
            Auto-sent follow-ups will appear here when sent.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayLogs.map((log) => (
            <AutoSentLogCard
              key={log.id}
              log={log}
              onViewThread={onViewThread}
            />
          ))}
          
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => onViewThread('all-sent')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all {logs.length} sent →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AutoSentLogCardProps {
  log: AutoSentLog;
  onViewThread: (threadId: string) => void;
}

function AutoSentLogCard({ log, onViewThread }: AutoSentLogCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'opened': return 'text-blue-600 bg-blue-50';
      case 'clicked': return 'text-purple-600 bg-purple-50';
      case 'sent': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivered': return 'Delivered';
      case 'opened': return 'Opened';
      case 'clicked': return 'Clicked';
      case 'sent': return 'Sent';
      default: return status;
    }
  };

  const formatSentTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} min ago`;
    }
    
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatSilenceDuration = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-gray-900 truncate">
            {log.subject}
          </h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
            {getStatusText(log.status)}
          </span>
          {log.autoSendSafe && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-green-600 bg-green-50">
              ✓ Safe
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span className="truncate">
            {log.recipientName}
          </span>
          <span>•</span>
          <span>
            Sent after {formatSilenceDuration(log.silenceDuration)}
          </span>
          <span>•</span>
          <span>
            {formatSentTime(log.sentAt)}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 ml-4">
        <button
          onClick={() => onViewThread(log.threadId)}
          className="text-gray-400 hover:text-gray-600 p-2"
          title="View thread"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
