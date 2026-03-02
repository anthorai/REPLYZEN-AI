import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PlanType } from "@/lib/planRules";

interface FreePlanCardProps {
  onDowngradeClick?: () => void;
}

const FreePlanCard = ({ onDowngradeClick }: FreePlanCardProps) => {
  const { data: subscription, isLoading } = useSubscription();

  const resolvedSubscription = subscription ?? {
    currentPlan: "free" as PlanType,
    usage: {
      followupsUsed: 0,
      accountsConnected: 0,
    },
  };

  const { currentPlan, usage } = resolvedSubscription;
  const isCurrentPlan = currentPlan === 'free';

  // Calculate usage percentages
  const followupsPercentage = Math.min(100, (usage.followupsUsed / 30) * 100);
  const accountsPercentage = Math.min(100, (usage.accountsConnected / 1) * 100);

  return (
    <Card className="bg-muted rounded-2xl shadow-sm p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Free</h3>
          <p className="text-muted-foreground">$0/month</p>
        </div>
        <Button
          variant={isCurrentPlan ? "secondary" : "outline"}
          disabled={isCurrentPlan}
          className={isCurrentPlan ? "cursor-not-allowed opacity-70" : ""}
          onClick={onDowngradeClick}
        >
          {isCurrentPlan ? "Current Plan" : "Downgrade to Free"}
        </Button>
      </div>

      <ul className="space-y-3 mb-6">
        <li className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">30 follow-ups/month</span>
        </li>
        <li className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">1 email account</span>
        </li>
        <li className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">AI-generated drafts</span>
        </li>
        <li className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">Manual send</span>
        </li>
        <li className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">Daily digest</span>
        </li>
        <li className="flex items-start gap-3">
          <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">Basic stats</span>
        </li>
      </ul>

      <p className="text-sm text-muted-foreground mb-6">
        Perfect for getting started.
      </p>

      {isCurrentPlan && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Follow-ups Used</span>
              <span>{usage.followupsUsed} / 30</span>
            </div>
            <Progress value={followupsPercentage} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Email Accounts</span>
              <span>{usage.accountsConnected} / 1</span>
            </div>
            <Progress value={accountsPercentage} className="h-2" />
          </div>
        </div>
      )}
    </Card>
  );
};

export default FreePlanCard;