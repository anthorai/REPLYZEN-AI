'use client';

import React from 'react';
import { WaitingThread } from '../types';

interface WaitingSectionProps {
  threads: WaitingThread[];
  onViewThread: (threadId: string) => void;
  loading?: boolean;
  maxThreads?: number;
}

export function WaitingSection({
  threads,
  onViewThread,
  loading = false,
  maxThreads = 5
}: WaitingSectionProps) {
  const displayThreads = threads.slice(0, maxThreads);
  const hasMore = threads.length > maxThreads;

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
                <div className="h-6 bg-gray-200 rounded w-16"></div>
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
          <h2 className="text-lg font-semibold text-gray-900">Waiting Threads</h2>
          <p className="text-sm text-gray-600 mt-1">
            Threads in silence window but not yet eligible
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-orange-600">{threads.length}</div>
          <div className="text-sm text-gray-500">Waiting threads</div>
        </div>
      </div>

      {/* Content */}
      {displayThreads.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-5xl mb-3">⏰</div>
          <p className="text-gray-600 font-medium">No waiting threads</p>
          <p className="text-sm text-gray-500 mt-1">
            All threads are either active or need attention.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayThreads.map((thread) => (
            <WaitingThreadCard
              key={thread.id}
              thread={thread}
              onViewThread={onViewThread}
            />
          ))}
          
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => onViewThread('all-waiting')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View all {threads.length} waiting →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface WaitingThreadCardProps {
  thread: WaitingThread;
  onViewThread: (threadId: string) => void;
}

function WaitingThreadCard({ thread, onViewThread }: WaitingThreadCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getDaysRemainingColor = (days: number) => {
    if (days <= 1) return 'text-red-600 font-medium';
    if (days <= 3) return 'text-orange-600 font-medium';
    return 'text-gray-600';
  };

  const formatFollowUpDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date < today) {
      return 'Today';
    }
    
    if (date < tomorrow) {
      return 'Tomorrow';
    }
    
    const days = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) {
      return `In ${days} days`;
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-gray-900 truncate">
            {thread.subject}
          </h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(thread.priority)}`}>
            {thread.priority}
          </span>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span className="truncate">
            {thread.recipientName}
          </span>
          <span>•</span>
          <span className={getDaysRemainingColor(thread.daysRemaining)}>
            {thread.daysRemaining} day{thread.daysRemaining !== 1 ? 's' : ''} remaining
          </span>
          <span>•</span>
          <span>
            Follow-up: {formatFollowUpDate(thread.followUpDate)}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 ml-4">
        <div className="text-right">
          <div className={`text-sm ${getDaysRemainingColor(thread.daysRemaining)}`}>
            {thread.daysRemaining}d
          </div>
          <div className="text-xs text-gray-500">
            {formatFollowUpDate(thread.followUpDate)}
          </div>
        </div>
        
        <button
          onClick={() => onViewThread(thread.threadId)}
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
