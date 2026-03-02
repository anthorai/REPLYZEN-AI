'use client';

import React from 'react';

interface EmptyStateProps {
  type: 'no_accounts' | 'syncing' | 'error' | 'no_data';
  onAction?: () => void;
  error?: string;
}

export function EmptyState({ type, onAction, error }: EmptyStateProps) {
  const getEmptyStateConfig = (type: string) => {
    switch (type) {
      case 'no_accounts':
        return {
          icon: '📧',
          title: 'Connect your email to get started',
          description: 'Connect your email account to activate follow-up tracking and automation.',
          actionText: 'Connect Email',
          showAction: true
        };
      
      case 'syncing':
        return {
          icon: '🔄',
          title: 'Syncing your conversations',
          description: 'We\'re analyzing your email threads to find follow-up opportunities.',
          actionText: '',
          showAction: false
        };
      
      case 'error':
        return {
          icon: '⚠️',
          title: 'Something went wrong',
          description: error || 'Unable to load your dashboard. Please try again.',
          actionText: 'Retry',
          showAction: true
        };
      
      case 'no_data':
        return {
          icon: '📊',
          title: 'No data available',
          description: 'We couldn\'t find any conversation data. Try refreshing or check your email connections.',
          actionText: 'Refresh',
          showAction: true
        };
      
      default:
        return {
          icon: '📋',
          title: 'No content available',
          description: 'There\'s nothing to show here right now.',
          actionText: 'Refresh',
          showAction: true
        };
    }
  };

  const config = getEmptyStateConfig(type);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        {/* Icon */}
        <div className="text-6xl mb-4">{config.icon}</div>
        
        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {config.title}
        </h2>
        
        {/* Description */}
        <p className="text-gray-600 mb-6">
          {config.description}
        </p>
        
        {/* Action Button */}
        {config.showAction && onAction && (
          <button
            onClick={onAction}
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {config.actionText}
          </button>
        )}
        
        {/* Additional Help */}
        {type === 'error' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              If this problem continues, contact our support team.
            </p>
          </div>
        )}
        
        {type === 'syncing' && (
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              This usually takes a few minutes...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
