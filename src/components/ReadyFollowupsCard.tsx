import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, ArrowRight, Clock, Mail } from "lucide-react";
import type { FollowUpWithThread } from "@/hooks/useFollowups";

interface ReadyFollowupsCardProps {
  followups: FollowUpWithThread[];
}

const ReadyFollowupsCard = ({ followups }: ReadyFollowupsCardProps) => {
  const readyFollowUpsCount = followups.length;
  const latestFollowups = followups.slice(0, 5);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-strong">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Follow-Ups Ready to Send
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Review AI suggestions before sending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">
            {readyFollowUpsCount}
          </span>
          <span className="text-sm text-muted-foreground">ready</span>
        </div>
      </div>

      {/* Content */}
      {readyFollowUpsCount === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-accent-foreground mb-4">
            <Inbox className="h-6 w-6" />
          </div>
          <h4 className="text-base font-medium text-foreground mb-1">
            No follow-ups ready yet
          </h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            AI-generated follow-ups will appear here once ready.
          </p>
        </div>
      ) : (
        /* Follow-ups List */
        <div className="space-y-3">
          {latestFollowups.map((followup) => (
            <div
              key={followup.id}
              className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium text-foreground truncate">
                    {followup.thread?.last_message_from || "Unknown"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {followup.thread?.subject || "No Subject"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(followup.generated_at)}</span>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700 hover:bg-green-100 text-xs"
                >
                  Ready
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Action */}
      <div className="mt-6 pt-4 border-t border-border">
        <Link to="/dashboard">
          <Button
            className="w-full rounded-xl gap-2"
            disabled={readyFollowUpsCount === 0}
          >
            Review Now
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default ReadyFollowupsCard;
