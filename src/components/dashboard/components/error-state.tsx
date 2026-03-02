'use client';

import React from 'react';

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
        {/* Error Icon */}
        <div className="text-6xl mb-4">⚠️</div>
        
        {/* Error Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        
        {/* Error Message */}
        <p className="text-gray-600 mb-6">
          {error}
        </p>
        
        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
        
        {/* Additional Help */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">
            If this problem continues, you can:
          </p>
          <div className="space-y-2 text-sm">
            <button className="text-blue-600 hover:text-blue-700 block">
              Check your email connections
            </button>
            <button className="text-blue-600 hover:text-blue-700 block">
              Contact our support team
            </button>
            <button className="text-blue-600 hover:text-blue-700 block">
              View system status
            </button>
          </div>
        </div>
        
        {/* Error Details (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <details className="text-left">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                Error Details
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 font-mono">
                {error}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
