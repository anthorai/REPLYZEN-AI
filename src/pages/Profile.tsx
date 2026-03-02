import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import SubscriptionPlanSection from "@/components/SubscriptionPlanSection";
import AllPlansComparison from "@/components/AllPlansComparison";
import PricingPlans from "@/components/PricingPlans";
import FreePlanCard from "@/components/FreePlanCard";
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  getPlanLimits,
  type PlanId,
} from "@/lib/plans";
import { PLAN_RULES } from "@/lib/planRules";

interface UserProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  plan: string | null;
  created_at: string;
}

const Profile = () => {
  const { toggleSidebar } = useOutletContext<{ toggleSidebar: () => void }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserProfileRow> => {
      const {
        data: { user: authUser },
        error: authError,
      } = await getSupabaseClient().auth.getUser();
      if (authError || !authUser) {
        throw new Error("Not authenticated");
      }

      try {
        const { data, error } = await getSupabaseClient()
          .from("profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            email: data.email,
            full_name: data.display_name,
            username: null,
            plan: data.plan,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.error("Failed to load profile row, falling back to auth user:", err);
      }

      // Fallback to auth user metadata if profiles table/row is missing
      return {
        id: authUser.id,
        email: authUser.email ?? null,
        full_name:
          (authUser.user_metadata as any)?.full_name ||
          (authUser.user_metadata as any)?.name ||
          null,
        username: null,
        plan: "free",
        created_at: authUser.created_at,
      };
    },
  });

  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error("Full name must be at least 2 characters.");
      }
      
      // Update both auth user metadata and profiles table
      const { error: authError } = await getSupabaseClient().auth.updateUser({
        data: { full_name: trimmed },
      });
      if (authError) throw authError;
      
      // Also update the profiles table display_name column
      const { error: profileError } = await getSupabaseClient()
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("user_id", user?.id);
      if (profileError) throw profileError;
      
      return trimmed;
    },
    onSuccess: (name) => {
      queryClient.setQueryData<UserProfileRow | undefined>(
        ["profile", user?.id],
        (old) => (old ? { ...old, full_name: name } : old)
      );
      // Clear the input field after successful save
      setFullName("");
      // Also invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update profile",
        description: err.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update password",
        description: err.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveName = () => {
    if (!profile) return;
    updateNameMutation.mutate(fullName || profile.full_name || "");
  };

  const handleChangePassword = () => {
    if (newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }
    updatePasswordMutation.mutate(newPassword);
  };

  const planId = (profile?.plan || "free").toLowerCase() as PlanId;
  const planLabel =
    planId === "business" ? "Business" : planId === "pro" ? "Pro" : "Free";
  const planBadgeClass =
    planId === "pro" || planId === "business"
      ? "bg-primary/15 text-primary border border-primary/50"
      : "bg-muted text-muted-foreground border border-border";

  const { data: gmailAccount } = useGmailConnection();
  const limits = getPlanLimits(planId);
  const emailAccountsConnected = gmailAccount ? 1 : 0;

  const { data: followupCount } = useQuery({
    queryKey: ["followup-usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("followup_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "sent")
        .gte("sent_at", start.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
  });

  const followupsUsed = followupCount ?? 0;
  const followupLimit =
    limits.followups === Infinity ? "Unlimited" : String(limits.followups);

  const memberSince = profile
    ? new Date(profile.created_at).toLocaleDateString()
    : "";

  const displayFullName =
    profile?.full_name && profile.full_name.trim().length > 0
      ? profile.full_name
      : "Not set";

  const displayEmail = profile?.email ?? user?.email ?? "Unknown";

  const currentPlanLabel = planLabel;
  const currentPlanStatus = "Active";

  return (
    <>
      <DashboardHeader
        title="Profile"
        subtitle="Manage your account details"
        onMenuToggle={toggleSidebar}
      />

      <div className="space-y-6">
        <>
          {/* Account Info */}
          <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Account Info
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Full Name
                </p>
                <p className="text-sm text-foreground">{displayFullName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Email
                </p>
                <p className="text-sm text-foreground">
                  {displayEmail}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Plan
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${planBadgeClass}`}
                >
                  {planLabel}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Member since{" "}
              <span className="font-medium text-foreground">
                {memberSince || "—"}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Current Plan
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Plan Name
                </p>
                <p className="text-sm text-foreground">{currentPlanLabel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Status
                </p>
                <p className="text-sm text-foreground">{currentPlanStatus}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Follow-ups Used (This Month)
                </p>
                <p className="text-sm text-foreground">
                  {followupsUsed} / {followupLimit}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <FreePlanCard 
              onDowngradeClick={() => {
                // Placeholder for downgrade action
                console.log("Downgrade to Free clicked");
              }}
            />
            
            <div className="border-t border-border pt-6">
              <PricingPlans 
                onUpgradeClick={(plan) => {
                  // Placeholder for upgrade action
                  console.log(`Upgrade to ${plan} clicked`);
                }}
              />
            </div>
          </div>

          {/* Edit Name */}
          <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Edit Profile
            </h3>
            <div className="max-w-md space-y-3">
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-sm text-muted-foreground">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={displayFullName}
                  disabled={updateNameMutation.isPending}
                  className="rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="rounded-xl"
                disabled={updateNameMutation.isPending}
                onClick={handleSaveName}
              >
                {updateNameMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Change Password
            </h3>
            <div className="max-w-md space-y-3">
              <div className="space-y-1">
                <Label htmlFor="newPassword" className="text-sm text-muted-foreground">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={updatePasswordMutation.isPending}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm text-muted-foreground"
                >
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  disabled={updatePasswordMutation.isPending}
                  className="rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="rounded-xl"
                disabled={updatePasswordMutation.isPending}
                onClick={handleChangePassword}
              >
                {updatePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Save Password"
                )}
              </Button>
            </div>
          </div>
        </>
      </div>
    </>
  );
};

export default Profile;


