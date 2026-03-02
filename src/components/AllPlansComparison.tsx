import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";
import { PLAN_LIMITS, PlanType } from "@/lib/planConfig";

interface AllPlansComparisonProps {
  onUpgradeClick?: (plan: PlanType) => void;
}

const AllPlansComparison = ({ onUpgradeClick }: AllPlansComparisonProps) => {
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-md bg-card">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Subscription Plans</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="rounded-2xl shadow-md bg-card">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Subscription Plans</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Could not load subscription information
        </CardContent>
      </Card>
    );
  }

  const { currentPlan, usage } = subscription;

  // Define all plans to show
  const allPlans: PlanType[] = ['free', 'pro', 'business'];

  return (
    <Card className="rounded-2xl shadow-md bg-card">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Subscription Plans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {allPlans.map((plan) => {
            const planDetails = PLAN_LIMITS[plan];
            
            // Determine if this is the current plan
            const isCurrentPlan = plan === currentPlan;
            
            // Determine badge variant based on plan
            const getPlanBadgeVariant = (p: PlanType) => {
              switch (p) {
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
              if (isCurrentPlan) {
                return {
                  text: 'Current Plan',
                  variant: 'outline' as const,
                  onClick: () => {},
                  disabled: true
                };
              } else {
                return {
                  text: `Upgrade to ${planDetails.label}`,
                  variant: 'default' as const,
                  onClick: () => onUpgradeClick?.(plan),
                  disabled: false
                };
              }
            };

            // Calculate usage percentages based on current usage vs plan limits
            const followupsPercentage = planDetails.followups === Infinity 
              ? 0 
              : Math.min(100, (usage.followupsUsed / planDetails.followups) * 100);
              
            const accountsPercentage = planDetails.accounts === Infinity 
              ? 0 
              : Math.min(100, (usage.accountsConnected / planDetails.accounts) * 100);

            return (
              <div 
                key={plan} 
                className={`rounded-xl border border-border bg-surface p-6 ${isCurrentPlan ? 'ring-2 ring-primary/30 ring-offset-2' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={getPlanBadgeVariant(plan)}>
                      {planDetails.label}
                    </Badge>
                    {plan === 'pro' && (
                      <Badge variant="secondary" className="bg-emerald-500 text-white">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <h3 className="font-semibold text-lg">{planDetails.label}</h3>
                    <p className="text-sm text-muted-foreground">{planDetails.price}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Follow-ups per month</span>
                      <span>{planDetails.followups === Infinity ? '∞' : planDetails.followups}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Email accounts allowed</span>
                      <span>{planDetails.accounts === Infinity ? '∞' : planDetails.accounts}</span>
                    </div>
                  </div>
                  
                  {isCurrentPlan && (
                    <>
                      <div className="pt-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Follow-ups Used (this month)</span>
                          <span>{usage.followupsUsed} / {planDetails.followups === Infinity ? '∞' : planDetails.followups}</span>
                        </div>
                        <Progress value={followupsPercentage} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Email Accounts Connected</span>
                          <span>{usage.accountsConnected} / {planDetails.accounts === Infinity ? '∞' : planDetails.accounts}</span>
                        </div>
                        <Progress value={accountsPercentage} className="h-2" />
                      </div>
                    </>
                  )}
                </div>

                <Button 
                  variant={getActionButton().variant} 
                  onClick={getActionButton().onClick}
                  disabled={getActionButton().disabled}
                  className="w-full"
                >
                  {getActionButton().text}
                </Button>
                
                {isCurrentPlan && (
                  <p className="text-xs text-center text-muted-foreground mt-2">You are currently on this plan</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AllPlansComparison;