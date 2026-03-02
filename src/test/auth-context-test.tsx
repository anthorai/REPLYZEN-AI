import React from 'react';
import { createRoot } from 'react-dom/client';
import { EnhancedAuthProvider, useEnhancedAuth } from '../contexts/EnhancedAuthContext';

// Simple test component to verify auth context
const TestComponent = () => {
  const { session, user, profile, loading, initialized, error } = useEnhancedAuth();
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Auth Context Test</h2>
      <div>
        <p><strong>Loading:</strong> {loading ? 'true' : 'false'}</p>
        <p><strong>Initialized:</strong> {initialized ? 'true' : 'false'}</p>
        <p><strong>Error:</strong> {error || 'null'}</p>
        <p><strong>Session:</strong> {session ? 'Present' : 'null'}</p>
        <p><strong>User:</strong> {user ? user.email : 'null'}</p>
        <p><strong>Profile:</strong> {profile ? profile.display_name : 'null'}</p>
      </div>
    </div>
  );
};

// Test the auth context
const testAuthContext = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  const root = createRoot(container);
  root.render(
    <EnhancedAuthProvider>
      <TestComponent />
    </EnhancedAuthProvider>
  );
  
  console.log('Auth context test component mounted');
};

// Run the test
if (typeof window !== 'undefined') {
  setTimeout(testAuthContext, 1000);
}

export default testAuthContext;