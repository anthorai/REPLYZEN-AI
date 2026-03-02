import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/LandingFooter";
import { PLAN_FEATURES, type PlanId } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckout, canUpgrade, formatPrice } from "@/lib/billing";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const plans: PlanId[] = ["free", "pro", "business"];

const Pricing = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "business" | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const currentPlan = profile?.plan || "free";
  const isAuthenticated = !!user;

  const handleUpgradeClick = (planId: "pro" | "business") => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!canUpgrade(currentPlan)) {
      toast.info("You already have an active subscription");
      return;
    }

    setSelectedPlan(planId);
    setShowUpgradeDialog(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;

    setLoadingPlan(selectedPlan);
    setShowUpgradeDialog(false);

    try {
      const response = await createCheckout({
        planType: selectedPlan,
        billingCycle
      });

      toast.success("Redirecting to secure checkout...");
      
      // Redirect to payment provider
      window.location.href = response.checkout_url;
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
      setLoadingPlan(null);
    }
  };

  const getButtonText = (planId: PlanId) => {
    if (loadingPlan === planId) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    if (currentPlan === planId) {
      return "Current Plan";
    }

    if (planId === "free") {
      return "Get Started";
    }

    if (!canUpgrade(currentPlan)) {
      return "Subscribed";
    }

    return `Upgrade to ${planId === "pro" ? "Pro" : "Business"}`;
  };

  const getButtonDisabled = (planId: PlanId) => {
    if (loadingPlan) return true;
    if (currentPlan === planId) return true;
    if (planId !== "free" && !canUpgrade(currentPlan)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Simple, Transparent Pricing
            </h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Choose the plan that fits your follow-up workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((planId) => {
              const plan = PLAN_FEATURES[planId];
              const isPro = planId === "pro";
              const isCurrentPlan = currentPlan === planId;
              const isUpgradeable = planId !== "free" && canUpgrade(currentPlan);

              return (
                <div
                  key={planId}
                  className={`relative rounded-2xl border shadow-md bg-card p-6 lg:p-8 flex flex-col ${
                    isPro
                      ? "border-primary/50 ring-2 ring-primary/20"
                      : "border-border"
                  } ${isCurrentPlan ? "ring-2 ring-green-500/20 border-green-500/50" : ""}`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary text-primary-foreground border border-primary px-3 py-0.5 text-xs font-semibold shadow-md">
                      {plan.badge}
                    </span>
                  )}
                  {isCurrentPlan && (
                    <span className="absolute -top-3 right-4 inline-flex items-center rounded-full bg-green-100 text-green-700 border border-green-200 px-3 py-0.5 text-xs font-semibold shadow-md">
                      Active
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-foreground">
                    {plan.title}
                  </h3>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    ${plan.price}
                    <span className="text-sm font-normal text-muted-foreground">
                      /month
                    </span>
                  </p>
                  <ul className="mt-6 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {planId === "free" ? (
                    <Link to={isAuthenticated ? "/dashboard" : "/login"} className="mt-8">
                      <Button
                        className="w-full rounded-xl"
                        variant="outline"
                        disabled={isCurrentPlan}
                      >
                        {getButtonText(planId)}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="w-full rounded-xl mt-8"
                      variant={isPro ? "default" : "outline"}
                      disabled={getButtonDisabled(planId)}
                      onClick={() => handleUpgradeClick(planId as "pro" | "business")}
                    >
                      {isUpgradeable && <Sparkles className="mr-2 h-4 w-4" />}
                      {getButtonText(planId)}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedPlan === "pro" ? "Pro" : "Business"}</DialogTitle>
            <DialogDescription>
              Choose your billing cycle. You can cancel anytime.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <ToggleGroup
              type="single"
              value={billingCycle}
              onValueChange={(value) => value && setBillingCycle(value as "monthly" | "yearly")}
              className="grid grid-cols-2 gap-4"
            >
              <ToggleGroupItem value="monthly" className="flex flex-col items-center p-4 data-[state=on]:border-primary data-[state=on]:bg-primary/5">
                <span className="font-semibold">Monthly</span>
                <span className="text-sm text-muted-foreground">
                  ${selectedPlan === "pro" ? "29" : "99"}/mo
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem value="yearly" className="flex flex-col items-center p-4 data-[state=on]:border-primary data-[state=on]:bg-primary/5">
                <span className="font-semibold">Yearly</span>
                <span className="text-sm text-muted-foreground">
                  ${selectedPlan === "pro" ? "290" : "990"}/yr
                </span>
                <span className="text-xs text-green-600 font-medium mt-1">Save 17%</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">{selectedPlan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing</span>
              <span className="font-medium capitalize">{billingCycle}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-medium">Total</span>
              <span className="font-bold">
                ${billingCycle === "yearly" 
                  ? (selectedPlan === "pro" ? "290" : "990")
                  : (selectedPlan === "pro" ? "29" : "99")
                }
                {billingCycle === "monthly" ? "/mo" : "/yr"}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleConfirmUpgrade} className="flex-1">
              {loadingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LandingFooter />
    </div>
  );
};

export default Pricing;
