import { useState, memo } from "react";
import { Send, Pencil, Clock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PriorityBadge from "./PriorityBadge";

export interface FollowUp {
  id: string;
  subject: string;
  recipient: string;
  daysSince: number;
  priority: "Low" | "Medium" | "High";
  aiDraft: string;
}

interface EmailCardProps {
  followUp: FollowUp;
  onSend?: (editedText?: string) => void;
  sending?: boolean;
}

// Memoized to prevent unnecessary re-renders
const EmailCard = memo(({ followUp, onSend, sending }: EmailCardProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(followUp.aiDraft);
  const [snoozed, setSnoozed] = useState(false);

  if (snoozed) return null;

  return (
    <div className="group rounded-2xl border border-border bg-card p-6 shadow-strong transition-all duration-300 hover:shadow-elevated hover:border-primary/20 hover:-translate-y-0.5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="text-base font-semibold text-foreground truncate">{followUp.subject}</h3>
        <PriorityBadge priority={followUp.priority} />
      </div>

      {/* Meta */}
      <p className="text-sm text-muted-foreground mb-4">
        {followUp.recipient} · {followUp.daysSince} days ago
      </p>

      {/* AI Draft */}
      <div className="rounded-xl bg-surface p-4 mb-4">
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[80px] text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
          />
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{draft}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => onSend?.(draft !== followUp.aiDraft ? draft : undefined)}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-secondary text-secondary-foreground hover:bg-accent"
          onClick={() => setEditing(!editing)}
        >
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editing ? "Done" : "Edit"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setSnoozed(true)}
        >
          <Clock className="h-3.5 w-3.5" />
          Snooze
        </Button>
      </div>
    </div>
  );
});

EmailCard.displayName = "EmailCard";

export default EmailCard;
