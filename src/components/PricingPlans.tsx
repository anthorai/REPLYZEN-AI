import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { PLAN_RULES, PlanType } from "@/lib/planRules";

interface PricingPlansProps {
  onUpgradeClick?: (plan: PlanType) => void;
}

const PricingPlans = ({ onUpgradeClick }: PricingPlansProps) => {
  const plans = {
    pro: {
      title: "Pro",
      price: "$12",
      period: "/month",
      features: [
        "2000 follow-ups/month",
        "Auto-send",
        "Custom timing (1–10 days)",
        "Advanced analytics",
        "Weekly reports",
        "2 Email accounts",
        "No branding",
      ],
      badge: "Most Popular",
    },
    business: {
      title: "Business",
      price: "$49",
      period: "/month",
      features: [
        "Unlimited follow-ups",
        "5 email accounts",
        "Auto-send",
        "Custom timing (1–10 days)",
        "Advanced analytics",
        "Weekly reports",
        "No branding",
      ],
      badge: null,
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-md p-8">
      <h3 className="text-xl font-semibold mb-6">Subscription Plans</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pro Card */}
        <div className="relative">
          {plans.pro.badge && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-orange-500 text-white rounded-full px-3 py-1 text-sm">
                {plans.pro.badge}
              </Badge>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-orange-500 p-8 h-full">
            <h3 className="text-xl font-bold text-foreground mb-2">{plans.pro.title}</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-3xl font-bold">{plans.pro.price}</span>
              <span className="text-muted-foreground ml-1">{plans.pro.period}</span>
            </div>
            <ul className="space-y-3 mb-6">
              {plans.pro.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => onUpgradeClick?.('pro')}
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>

        {/* Business Card */}
        <div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 h-full">
            <h3 className="text-xl font-bold text-foreground mb-2">{plans.business.title}</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-3xl font-bold">{plans.business.price}</span>
              <span className="text-muted-foreground ml-1">{plans.business.period}</span>
            </div>
            <ul className="space-y-3 mb-6">
              {plans.business.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              variant="outline"
              className="w-full rounded-xl border-gray-300 text-foreground hover:bg-gray-100"
              onClick={() => onUpgradeClick?.('business')}
            >
              Upgrade to Business
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPlans;