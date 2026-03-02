import { cn } from "@/lib/utils";

type Priority = "Low" | "Medium" | "High";

interface PriorityBadgeProps {
  priority: Priority;
}

const priorityStyles: Record<Priority, string> = {
  Low: "bg-accent text-accent-foreground",
  Medium: "bg-secondary text-secondary-foreground",
  High: "bg-primary text-primary-foreground",
};

const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        priorityStyles[priority]
      )}
    >
      {priority}
    </span>
  );
};

export default PriorityBadge;
