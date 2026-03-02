import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const DashboardDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runDiagnostics = async () => {
      console.log('[DashboardDebug] Running diagnostics...');
      setLoading(true);
      setError(null);

      try {
        // Check authentication
        console.log('[DashboardDebug] Checking authentication...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }

        if (!session) {
          throw new Error('No active session found');
        }

        console.log('[DashboardDebug] Session valid:', session.user.email);

        // Check database connection
        console.log('[DashboardDebug] Checking database connection...');
        const { data: tablesData, error: tablesError } = await supabase
          .from('followup_suggestions')
          .select('count')
          .limit(1);

        if (tablesError) {
          throw new Error(`Database error: ${tablesError.message}`);
        }

        console.log('[DashboardDebug] Database connection OK');

        // Check followups table
        console.log('[DashboardDebug] Checking followups table...');
        const { data: followupsData, error: followupsError } = await supabase
          .from('followup_suggestions')
          .select('id, status, user_id')
          .eq('user_id', session.user.id)
          .limit(5);

        if (followupsError) {
          throw new Error(`Followups query error: ${followupsError.message}`);
        }

        console.log('[DashboardDebug] Followups data:', followupsData?.length || 0);

        // Check email_threads table
        console.log('[DashboardDebug] Checking email_threads table...');
        const { data: threadsData, error: threadsError } = await supabase
          .from('email_threads')
          .select('id, subject')
          .limit(5);

        if (threadsError) {
          console.warn('[DashboardDebug] Threads query error:', threadsError);
        }

        // Check user profile
        console.log('[DashboardDebug] Checking user profile...');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('plan, email')
          .eq('user_id', session.user.id)
          .single();

        if (profileError) {
          console.warn('[DashboardDebug] Profile query error:', profileError);
        }

        // Compile debug info
        setDebugInfo({
          authenticated: true,
          userEmail: session.user.email,
          userId: session.user.id,
          sessionExpiresAt: session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Never',
          databaseConnected: true,
          followupsCount: followupsData?.length || 0,
          followupsSample: followupsData || [],
          threadsCount: threadsData?.length || 0,
          threadsSample: threadsData || [],
          userPlan: profileData?.plan || 'unknown',
          userEmailFromProfile: profileData?.email || 'not set',
          timestamp: new Date().toLocaleString(),
        });

      } catch (err: any) {
        console.error('[DashboardDebug] Diagnostic error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    runDiagnostics();
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mb-4 mx-auto" />
            <p>Running diagnostics...</p>
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
          <Button onClick={handleRefresh} className="w-full">
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
            Dashboard Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Authentication:</span>
            <Badge variant={debugInfo.authenticated ? "default" : "destructive"}>
              {debugInfo.authenticated ? "✅ Authenticated" : "❌ Not Authenticated"}
            </Badge>
          </div>

          {/* User Info */}
          <div className="space-y-2">
            <div className="font-medium">User Information:</div>
            <div className="pl-4 space-y-1 text-sm">
              <div>Email: {debugInfo.userEmail}</div>
              <div>User ID: {debugInfo.userId}</div>
              <div>Plan: {debugInfo.userPlan}</div>
              <div>Session Expires: {debugInfo.sessionExpiresAt}</div>
            </div>
          </div>

          {/* Database Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Database:</span>
            <Badge variant={debugInfo.databaseConnected ? "default" : "destructive"}>
              {debugInfo.databaseConnected ? "✅ Connected" : "❌ Disconnected"}
            </Badge>
          </div>

          {/* Followups Status */}
          <div className="space-y-2">
            <div className="font-medium">Follow-ups Data:</div>
            <div className="pl-4 space-y-1 text-sm">
              <div>Total Count: {debugInfo.followupsCount}</div>
              {debugInfo.followupsSample && debugInfo.followupsSample.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Sample Follow-ups:</div>
                  <div className="pl-4 space-y-1">
                    {debugInfo.followupsSample.map((followup: any) => (
                      <div key={followup.id} className="text-xs">
                        ID: {followup.id}, Status: {followup.status}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Threads Status */}
          <div className="space-y-2">
            <div className="font-medium">Email Threads:</div>
            <div className="pl-4 space-y-1 text-sm">
              <div>Total Count: {debugInfo.threadsCount}</div>
              {debugInfo.threadsSample && debugInfo.threadsSample.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Sample Threads:</div>
                  <div className="pl-4 space-y-1">
                    {debugInfo.threadsSample.map((thread: any) => (
                      <div key={thread.id} className="text-xs">
                        ID: {thread.id}, Subject: {thread.subject || 'No Subject'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-xs text-muted-foreground pt-4 border-t">
            Last checked: {debugInfo.timestamp}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleRefresh} variant="outline">
              Refresh Diagnostics
            </Button>
            <Button onClick={() => window.location.href = '/workspace'}>
              Go to Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardDebug;
