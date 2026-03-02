import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

const LoginDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runDiagnostics = async () => {
      console.log('[LoginDebug] Running login diagnostics...');
      setLoading(true);
      setError(null);

      try {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        console.log('[LoginDebug] URL params:', { code, error, errorDescription });

        // Check authentication
        console.log('[LoginDebug] Checking authentication...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }

        console.log('[LoginDebug] Session check:', session ? 'Valid' : 'None');

        // Check current user
        let currentUser = null;
        if (session) {
          currentUser = {
            id: session.user.id,
            email: session.user.email,
            created_at: session.user.created_at,
            last_sign_in_at: session.user.last_sign_in_at,
          };
        }

        // Check Supabase connection
        console.log('[LoginDebug] Checking Supabase connection...');
        const { data: connectionData, error: connectionError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        if (connectionError) {
          console.warn('[LoginDebug] Connection test warning:', connectionError);
        }

        // Compile debug info
        setDebugInfo({
          url: window.location.href,
          urlParams: {
            code: code || 'none',
            error: error || 'none',
            errorDescription: errorDescription || 'none',
          },
          authenticated: !!session,
          session: session ? {
            access_token: session.access_token ? `${session.access_token.substring(0, 20)}...` : 'none',
            refresh_token: session.refresh_token ? 'present' : 'none',
            expires_at: session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'never',
            user: currentUser,
          } : null,
          supabaseConnected: !connectionError,
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'set' : 'missing',
          timestamp: new Date().toLocaleString(),
          localStorage: {
            auth: localStorage.getItem('supabase.auth.token') ? 'present' : 'none',
            otherKeys: Object.keys(localStorage).filter(key => key.startsWith('supabase.')),
          },
        });

      } catch (err: any) {
        console.error('[LoginDebug] Diagnostic error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    runDiagnostics();
  }, []);

  const handleClearAuth = () => {
    console.log('[LoginDebug] Clearing auth data...');
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const handleTestAuth = async () => {
    console.log('[LoginDebug] Testing auth flow...');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
      
      if (error) {
        console.error('[LoginDebug] Test auth error:', error);
        alert(`Auth test failed: ${error.message}`);
      } else {
        console.log('[LoginDebug] Test auth initiated');
      }
    } catch (err: any) {
      console.error('[LoginDebug] Test auth exception:', err);
      alert(`Auth test exception: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mb-4 mx-auto" />
            <p>Running login diagnostics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Diagnostic Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="w-full">
            Refresh Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Login Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Information */}
          <div className="space-y-2">
            <div className="font-medium">URL Information:</div>
            <div className="pl-4 space-y-1 text-sm">
              <div>Current URL: {debugInfo.url}</div>
              <div>Code: {debugInfo.urlParams?.code}</div>
              <div>Error: {debugInfo.urlParams?.error}</div>
              <div>Error Description: {debugInfo.urlParams?.errorDescription}</div>
            </div>
          </div>

          {/* Authentication Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Authentication:</span>
            <Badge variant={debugInfo.authenticated ? "default" : "destructive"}>
              {debugInfo.authenticated ? "✅ Authenticated" : "❌ Not Authenticated"}
            </Badge>
          </div>

          {/* Session Info */}
          {debugInfo.session && (
            <div className="space-y-2">
              <div className="font-medium">Session Information:</div>
              <div className="pl-4 space-y-1 text-sm">
                <div>User ID: {debugInfo.session.user?.id}</div>
                <div>Email: {debugInfo.session.user?.email}</div>
                <div>Access Token: {debugInfo.session.access_token}</div>
                <div>Refresh Token: {debugInfo.session.refresh_token}</div>
                <div>Expires At: {debugInfo.session.expires_at}</div>
              </div>
            </div>
          )}

          {/* Supabase Connection */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Supabase Connection:</span>
            <Badge variant={debugInfo.supabaseConnected ? "default" : "destructive"}>
              {debugInfo.supabaseConnected ? "✅ Connected" : "❌ Disconnected"}
            </Badge>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <div className="font-medium">Environment:</div>
            <div className="pl-4 space-y-1 text-sm">
              <div>Supabase URL: {debugInfo.supabaseUrl || 'missing'}</div>
              <div>Anon Key: {debugInfo.supabaseAnonKey}</div>
            </div>
          </div>

          {/* Local Storage */}
          <div className="space-y-2">
            <div className="font-medium">Local Storage:</div>
            <div className="pl-4 space-y-1 text-sm">
              <div>Auth Token: {debugInfo.localStorage?.auth}</div>
              <div>Supabase Keys: {debugInfo.localStorage?.otherKeys?.join(', ') || 'none'}</div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-xs text-muted-foreground pt-4 border-t">
            Last checked: {debugInfo.timestamp}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleClearAuth} variant="outline">
              Clear Auth Data
            </Button>
            <Button onClick={handleTestAuth} variant="outline">
              Test Auth Flow
            </Button>
            <Button onClick={() => window.location.href = '/'}>
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginDebug;
