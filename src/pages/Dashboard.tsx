import { useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Inbox, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import EmailCard from "@/components/EmailCard";
import ReadyFollowupsCard from "@/components/ReadyFollowupsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFollowups, useSendFollowup } from "@/hooks/useFollowups";
import { toast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { toggleSidebar } = useOutletContext<{ toggleSidebar: () => void }>();
  const [filter, setFilter] = useState<string>("all");
  const { data: followups, isLoading } = useFollowups();
  const sendFollowup = useSendFollowup();

  const followupsList = followups ?? [];

  // Memoize filtered results
  const filtered = useMemo(() => {
    if (filter === "all") return followupsList;
    return followupsList.filter((fu) => fu.priority === filter);
  }, [followupsList, filter]);

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

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        subtitle=""
        onMenuToggle={toggleSidebar}
        extra={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="High">High Priority</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Ready Follow-ups Card */}
      <div className="mb-8">
        <ReadyFollowupsCard followups={followupsList} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground mb-6">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {isLoading ? "Loading follow-ups..." : "No follow-ups needed right now."}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              All caught up! Run a new scan from the Workspace to detect more conversations.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((followUp) => (
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
          ))}
        </div>
      )}
    </>
  );
};

export default Dashboard;
