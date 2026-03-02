import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { getBillingStatus, formatBillingDate, type BillingStatus } from "@/lib/billing";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";

const BillingSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [billingData, setBillingData] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  const provider = searchParams.get("provider") || "unknown";

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      setStatus("loading");
      const data = await getBillingStatus();
      setBillingData(data);

      if (data.is_active) {
        // Subscription is active - show success
        setStatus("success");
        triggerConfetti();
        
        // Refresh user session to update plan access
        await refreshSession();
      } else if (data.subscription_status === "pending" || retryCount < 3) {
        // Payment might still be processing
        setStatus("pending");
        
        // Retry after delay
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          checkSubscriptionStatus();
        }, 3000);
      } else {
        // Payment failed or taking too long
        setStatus("error");
        setError("Your subscription is not yet active. Please contact support if you completed the payment.");
      }
    } catch (err) {
      console.error("Failed to check billing status:", err);
      setStatus("error");
      setError("Failed to verify your subscription. Please try again or contact support.");
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults, 
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults, 
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleRetry = () => {
    setRetryCount(0);
    checkSubscriptionStatus();
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  const handleGoToWorkspace = () => {
    navigate("/workspace");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <CardTitle className="text-2xl">Processing Payment</CardTitle>
              <CardDescription>
                Please wait while we confirm your subscription...
              </CardDescription>
            </>
          )}

          {status === "pending" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Confirming Payment</CardTitle>
              <CardDescription>
                We're waiting for confirmation from {provider}. This may take a moment...
                <br />
                <span className="text-xs text-muted-foreground mt-2 block">
                  Retry attempt {retryCount}/3
                </span>
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Welcome to {billingData?.plan_type === "business" ? "Business" : "Pro"}!</CardTitle>
              <CardDescription>
                Your subscription is now active. Start using your premium features!
              </CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Payment Issue</CardTitle>
              <CardDescription>{error}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {status === "success" && billingData && (
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{billingData.plan_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Billing</span>
                <span className="font-medium">{formatBillingDate(billingData.current_period_end)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="font-medium capitalize">{billingData.payment_provider}</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="text-sm text-muted-foreground mb-2">Your Plan Includes:</div>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    {billingData.limits.followups === -1 ? "Unlimited" : billingData.limits.followups} follow-ups/month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    {billingData.limits.accounts} email account{billingData.limits.accounts > 1 ? "s" : ""}
                  </li>
                  {billingData.limits.auto_send && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      Auto-send enabled
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {status === "success" && (
              <>
                <Button onClick={handleGoToDashboard} className="w-full">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleGoToWorkspace} className="w-full">
                  Manage Workspace
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <Button onClick={handleRetry} className="w-full">
                  Check Again
                </Button>
                <Button variant="outline" onClick={() => navigate("/pricing")} className="w-full">
                  Back to Pricing
                </Button>
              </>
            )}

            {(status === "loading" || status === "pending") && (
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
                Skip for Now
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Need help? Contact us at{" "}
            <a href="mailto:support@replify.ai" className="text-primary hover:underline">
              support@replify.ai
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSuccess;
