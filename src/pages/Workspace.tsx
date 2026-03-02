import { useState, useEffect } from "react";
import { useOutletContext, Link, useSearchParams } from "react-router-dom";
import { RefreshCw, Brain, ArrowRight, Loader2, CheckCircle2, Inbox, Clock, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import DashboardHeader from "@/components/DashboardHeader";
import PriorityBadge from "@/components/PriorityBadge";
import { EmailAccountsManager } from "@/components/EmailAccountsManager";
import { useGmailConnection, useFetchEmails, useGenerateFollowups } from "@/hooks/useGmailConnection";
import { useFollowups } from "@/hooks/useFollowups";
import { toast } from "@/hooks/use-toast";

const Workspace = () => {
  const { toggleSidebar } = useOutletContext<{ toggleSidebar: () => void }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: connectionState, refetch: refetchGmail } = useGmailConnection();
  const fetchEmails = useFetchEmails();
  const generateFollowups = useGenerateFollowups();
  const { data: followups } = useFollowups();

  const [fetchResult, setFetchResult] = useState<{ threadsProcessed: number } | null>(null);
  const [genResult, setGenResult] = useState<{ threadsAnalyzed: number; detected: number; generated: number } | null>(null);

  // Handle Gmail OAuth callback
  useEffect(() => {
    const gmailConnected = searchParams.get("gmail_connected");
    const gmailError = searchParams.get("gmail_error");
    const email = searchParams.get("email");
    const message = searchParams.get("message");
    const details = searchParams.get("details");
    
    if (gmailConnected === "true") {
      toast({ 
        title: "✅ Gmail Connected Successfully!",
        description: email ? `Connected account: ${email}` : "Your Gmail account is now linked.",
        duration: 5000
      });
      refetchGmail();
      // Clean up URL
      searchParams.delete("gmail_connected");
      searchParams.delete("email");
      setSearchParams(searchParams, { replace: true });
    } else if (gmailError === "true") {
      const fullMessage = details 
        ? `${message}\n\nDetails: ${details}` 
        : message || "An error occurred during Gmail connection.";
      
      console.error("[Workspace] Gmail connection error:", { message, details });
      
      toast({ 
        title: "❌ Gmail Connection Failed", 
        description: fullMessage, 
        variant: "destructive",
        duration: 8000
      });
      
      // Clean up URL
      searchParams.delete("gmail_error");
      searchParams.delete("message");
      searchParams.delete("details");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, refetchGmail, setSearchParams]);

  const isConnected = !!connectionState?.activeAccount;
  const latestDrafts = (followups || []).slice(0, 3);

  const handleSync = () => {
    setFetchResult(null);
    fetchEmails.mutate(undefined, {
      onSuccess: (data) => setFetchResult(data),
      onError: (err) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleDetect = () => {
    setGenResult(null);
    generateFollowups.mutate(undefined, {
      onSuccess: (data) => setGenResult(data),
      onError: (err) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
    });
  };
 
  return (
    <>
      <DashboardHeader
        title="Workspace"
        subtitle="Control center for your email follow-ups"
      />

      <div className="space-y-6">
        {/* Multi-Account Manager */}
        <EmailAccountsManager onAccountChange={() => {
          setFetchResult(null);
          setGenResult(null);
        }} />

        {/* Fetch Status */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-foreground">Inbox Sync Status</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-secondary text-secondary-foreground hover:bg-accent"
              onClick={handleSync}
              disabled={!isConnected || fetchEmails.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              Run Manual Scan
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-surface p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Last Sync</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {fetchResult ? "Just now" : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Inbox className="h-4 w-4" />
                <span className="text-xs font-medium">Threads Fetched</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {fetchResult ? fetchResult.threadsProcessed : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium">Status</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {fetchEmails.isPending ? "Syncing…" : fetchResult ? "Complete" : isConnected ? "Ready" : "Connect Gmail to start"}
              </p>
            </div>
          </div>
        </div>

        {/* Detection Panel */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-foreground">Follow-Up Detection</h3>
            <Button
              className="gap-2 rounded-xl"
              onClick={handleDetect}
              disabled={!isConnected || !fetchResult || generateFollowups.isPending}
            >
              <Brain className="h-4 w-4" />
              {genResult ? "Scan Again" : "Scan & Generate Follow-Ups"}
            </Button>
          </div>

          {genResult ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Threads Analyzed</p>
                <p className="text-xl font-bold text-foreground">{genResult.threadsAnalyzed}</p>
              </div>
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">No-Reply Detected</p>
                <p className="text-xl font-bold text-primary">{genResult.detected}</p>
              </div>
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">AI Drafts Ready</p>
                <p className="text-xl font-bold text-foreground flex items-center gap-2">
                  {genResult.generated} <CheckCircle2 className="h-5 w-5 text-green-500" />
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface p-4">
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? fetchResult
                    ? "Ready to scan and generate follow-ups."
                    : "Run an inbox scan first to enable detection."
                  : "Connect Gmail to enable detection."}
              </p>
            </div>
          )}
        </div>

        {/* Quick Preview */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-foreground">Latest Follow-Up Drafts</h3>
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="gap-2 border-secondary text-secondary-foreground hover:bg-accent">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {latestDrafts.length > 0 ? (
            <div className="space-y-3">
              {latestDrafts.map((fu) => (
                <div
                  key={fu.id}
                  className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{fu.thread?.subject || "No Subject"}</p>
                      <PriorityBadge priority={fu.priority as "Low" | "Medium" | "High"} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fu.thread?.last_message_from || "Unknown"} ·{" "}
                      {fu.thread?.last_user_message_at
                        ? `${Math.floor((Date.now() - new Date(fu.thread.last_user_message_at).getTime()) / (1000 * 60 * 60 * 24))} days ago`
                        : ""}
                    </p>
                  </div>
                  <Zap className="h-4 w-4 text-primary shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-surface p-4">
              <p className="text-sm text-muted-foreground">No follow-up drafts yet.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Workspace;
