import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { PlanType, PLAN_LIMITS } from "@/lib/planConfig";

interface SubscriptionPlanSectionProps {
  onUpgradeClick?: () => void;
  /** For development/testing purposes - overrides the actual plan from the backend */
  overridePlan?: 'free' | 'pro' | 'business';
}

const SubscriptionPlanSection = ({ onUpgradeClick, overridePlan }: SubscriptionPlanSectionProps) => {
  const { data: subscription, isLoading } = useSubscription();
  
  // Use override plan if provided, otherwise use the actual subscription data
  const effectiveSubscription = overridePlan && subscription ? {
    ...subscription,
    currentPlan: overridePlan,
    planDetails: PLAN_LIMITS[overridePlan]
  } : subscription;

  const resolvedSubscription = effectiveSubscription ?? {
    currentPlan: "free" as PlanType,
    planDetails: PLAN_LIMITS.free,
    usage: {
      followupsUsed: 0,
      accountsConnected: 0,
    },
    limits: {
      followups: PLAN_LIMITS.free.followups,
      accounts: PLAN_LIMITS.free.accounts,
    },
  };

  const { currentPlan, planDetails, usage } = resolvedSubscription;
  const limitsAny = (resolvedSubscription as any).limits ?? {};
  const followupsLimit = limitsAny.followups ?? 0;
  const accountsLimit = limitsAny.accounts ?? limitsAny.emailAccounts ?? 0;

  const planMeta = PLAN_LIMITS[currentPlan] ?? PLAN_LIMITS.free;
  const planLabel = planMeta.label;
  const planPrice = planMeta.price;

  // Determine badge variant based on plan
  const getPlanBadgeVariant = (plan: PlanType) => {
    switch (plan) {
      case 'pro':
        return 'default'; // Orange variant
      case 'business':
        return 'secondary'; // Darker orange variant
      default:
        return 'outline'; // Gray variant
    }
  };

  // Determine button text and action based on current plan
  const getActionButton = () => {
    switch (currentPlan) {
      case 'free':
        return {
          text: 'Upgrade to Pro',
          variant: 'default' as const,
          onClick: onUpgradeClick || (() => {})
        };
      case 'pro':
        return {
          text: 'Upgrade to Business',
          variant: 'default' as const,
          onClick: onUpgradeClick || (() => {})
        };
      case 'business':
        return {
          text: 'Contact Support',
          variant: 'default' as const,
          onClick: onUpgradeClick || (() => {})
        };
      default:
        return {
          text: 'Upgrade Plan',
          variant: 'default' as const,
          onClick: onUpgradeClick || (() => {})
        };
    }
  };

  // Calculate usage percentages
  const followupsPercentage = followupsLimit === Infinity 
    ? 0 
    : Math.min(100, (usage.followupsUsed / (followupsLimit || 1)) * 100);
    
  const accountsPercentage = accountsLimit === Infinity 
    ? 0 
    : Math.min(100, (usage.accountsConnected / (accountsLimit || 1)) * 100);

  return (
    <Card className="rounded-2xl shadow-md bg-card">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Subscription Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current Plan Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={getPlanBadgeVariant(currentPlan)}>
                {planLabel}
              </Badge>
              <div>
                <h3 className="font-semibold text-lg">{planLabel}</h3>
                <p className="text-sm text-muted-foreground">{planPrice}</p>
              </div>
            </div>
          </div>

          {/* Plan Limits */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Follow-ups Used</span>
                <span>{usage.followupsUsed} / {followupsLimit === Infinity ? '∞' : followupsLimit}</span>
              </div>
              <Progress value={followupsPercentage} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Email Accounts</span>
                <span>{usage.accountsConnected} / {accountsLimit === Infinity ? '∞' : accountsLimit}</span>
              </div>
              <Progress value={accountsPercentage} className="h-2" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4">
            {currentPlan === 'pro' ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant={getActionButton().variant} 
                  onClick={getActionButton().onClick}
                  className="flex-1"
                >
                  {getActionButton().text}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onUpgradeClick || (() => {})}
                  className="flex-1"
                >
                  Manage Subscription
                </Button>
              </div>
            ) : (
              <Button 
                variant={getActionButton().variant} 
                onClick={getActionButton().onClick}
                className="w-full"
              >
                {getActionButton().text}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionPlanSection;