import { useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Inbox, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import EmailCard from "@/components/EmailCard";
import ReadyFollowupsCard from "@/components/ReadyFollowupsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useFollowups, useSendFollowup } from "@/hooks/useFollowups";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Dashboard = () => {
  const { toggleSidebar } = useOutletContext<{ toggleSidebar: () => void }>();
  const [filter, setFilter] = useState<string>("all");
  const { data: followups, isLoading, error, refetch } = useFollowups();
  const sendFollowup = useSendFollowup();

  // Memoize filtered results
  const filtered = useMemo(() => {
    if (!followups) return [];
    if (filter === "all") return followups;
    return followups.filter((fu) => fu.priority === filter);
  }, [followups, filter]);

  // Memoized handler to prevent unnecessary re-renders
  const handleSend = useCallback((id: string, editedText?: string) => {
    sendFollowup.mutate(
      { suggestionId: id, editedText },
      {
        onSuccess: () => toast({ title: "Follow-up sent successfully!", description: "The email has been sent via Gmail." }),
        onError: (err) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
      }
    );
  }, [sendFollowup]);

  const handleRetry = () => {
    console.log('[Dashboard] Retrying followups fetch...');
    refetch();
  };

  // Handle error state
  if (error) {
    console.error('[Dashboard] Error fetching followups:', error);
    return (
      <>
        <DashboardHeader
          title="Dashboard"
          subtitle=""
          onMenuToggle={toggleSidebar}
          extra={
            <Button onClick={handleRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          }
        />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Failed to load follow-ups</p>
                <p className="text-sm text-muted-foreground">
                  {error.message || "There was an error loading your follow-up suggestions. Please try again."}
                </p>
                <Button onClick={handleRetry} variant="outline" size="sm" className="mt-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
          
          <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Unable to Load Data</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Please check your connection and try again. If the problem persists, contact support.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Handle loading state
  if (isLoading) {
    console.log('[Dashboard] Loading followups...');
    return (
      <>
        <DashboardHeader
          title="Dashboard"
          subtitle="Loading your follow-ups..."
          onMenuToggle={toggleSidebar}
        />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </>
    );
  }

  console.log('[Dashboard] Followups loaded:', followups?.length || 0);

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        subtitle={followups ? `${followups.length} follow-up${followups.length === 1 ? '' : 's'} ready` : "Loading..."}
        onMenuToggle={toggleSidebar}
        extra={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="High">High Priority</SelectItem>
              <SelectItem value="Medium">Medium Priority</SelectItem>
              <SelectItem value="Low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Ready Follow-ups Card */}
      <div className="mb-8">
        <ReadyFollowupsCard followups={followups || []} />
      </div>

      {filtered.length === 0 && followups && followups.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground mb-6">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No follow-ups match this filter.</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Try changing the filter to see more follow-ups.
            </p>
            <Button onClick={() => setFilter("all")} variant="outline">
              Show All Follow-ups
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground mb-6">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No follow-ups needed right now.</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              All caught up! Run a new scan from the Workspace to detect more conversations.
            </p>
            <Button onClick={() => window.location.href = '/workspace'} variant="outline">
              Go to Workspace
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((followUp) => {
            console.log('[Dashboard] Rendering follow-up:', followUp.id);
            return (
              <EmailCard
                key={followUp.id}
                followUp={{
                  id: followUp.id,
                  subject: followUp.thread?.subject || "No Subject",
                  recipient: followUp.thread?.last_message_from || "Unknown",
                  daysSince: followUp.thread?.last_user_message_at
                    ? Math.floor((Date.now() - new Date(followUp.thread.last_user_message_at).getTime()) / (1000 * 60 * 60 * 24))
                    : 0,
                  priority: followUp.priority as "Low" | "Medium" | "High",
                  aiDraft: followUp.generated_text,
                }}
                onSend={(editedText) => handleSend(followUp.id, editedText)}
                sending={sendFollowup.isPending}
              />
            );
          })}
        </div>
      )}
    </>
  );
};

export default Dashboard;
