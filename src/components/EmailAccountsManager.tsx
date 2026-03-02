import { Mail, Plus, Loader2, CheckCircle2, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGmailConnection, useConnectGmail, useSwitchAccount, useDisconnectAccount } from "@/hooks/useGmailConnection";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "react-router-dom";

interface EmailAccountsManagerProps {
  onAccountChange?: () => void;
}

export function EmailAccountsManager({ onAccountChange }: EmailAccountsManagerProps) {
  const { data: connectionState, isLoading, refetch } = useGmailConnection();
  const connectGmail = useConnectGmail();
  const switchAccount = useSwitchAccount();
  const disconnectAccount = useDisconnectAccount();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<{ plan: string; limit: number; current: number } | null>(null);

  const handleConnect = () => {
    console.log("[EmailAccountsManager] === INITIATING GMAIL CONNECTION ===");
    console.log("[EmailAccountsManager] isPending:", connectGmail.isPending);
    console.log("[EmailAccountsManager] isError:", connectGmail.isError);
    console.log("[EmailAccountsManager] error:", connectGmail.error);
    
    if (connectGmail.isPending) {
      console.log("[EmailAccountsManager] Already pending, skipping...");
      return;
    }
    
    // Reset any previous errors
    connectGmail.reset();
    
    connectGmail.mutate(undefined, {
      onSuccess: (url) => {
        console.log("[EmailAccountsManager] Connection initiated, redirecting to:", url?.substring(0, 50) + "...");
      },
      onError: (err: any) => {
        console.error("[EmailAccountsManager] === CONNECTION ERROR ===", err);
        console.error("[EmailAccountsManager] Error details:", {
          message: err?.message,
          upgradeRequired: err?.upgradeRequired,
          plan: err?.plan,
          limit: err?.limit,
          current: err?.current,
        });
        
        if (err?.upgradeRequired) {
          setUpgradeInfo({
            plan: err.plan,
            limit: err.limit,
            current: err.current,
          });
          setShowUpgradeModal(true);
        } else {
          // Show user-friendly error message
          const errorMessage = err?.message || "Unable to connect Gmail. Please try again.";
          toast({ 
            title: "❌ Gmail Connection Failed", 
            description: errorMessage, 
            variant: "destructive",
            duration: 6000
          });
        }
      },
    });
  };

  const handleSwitch = (accountId: string) => {
    switchAccount.mutate(accountId, {
      onSuccess: () => {
        toast({ title: "Account switched successfully" });
        onAccountChange?.();
        refetch();
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to switch account", 
          description: err.message, 
          variant: "destructive" 
        });
      },
    });
  };

  const handleDisconnect = (accountId: string) => {
    disconnectAccount.mutate(accountId, {
      onSuccess: () => {
        toast({ title: "Account disconnected" });
        onAccountChange?.();
        refetch();
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to disconnect", 
          description: err.message, 
          variant: "destructive" 
        });
      },
    });
  };

  const accounts = connectionState?.accounts || [];
  const activeAccount = connectionState?.activeAccount;
  const count = connectionState?.count || 0;
  const limit = connectionState?.limit || 1;
  const canAddMore = connectionState?.canAddMore ?? false;

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">Connected Accounts</h3>
            <p className="text-sm text-muted-foreground">
              Manage your email accounts for follow-up monitoring.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {count} of {limit} accounts used
            </span>
            {canAddMore ? (
              <Button 
                size="sm" 
                className="gap-2 rounded-xl" 
                onClick={handleConnect}
                disabled={connectGmail.isPending}
              >
                {connectGmail.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Connect Another
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => setShowUpgradeModal(true)}
              >
                <AlertCircle className="h-4 w-4" />
                Limit Reached
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <Progress value={(count / limit) * 100} className="h-2" />
        </div>

        {/* Accounts list */}
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-medium text-foreground mb-2">No accounts connected</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Gmail account to start monitoring follow-ups.
            </p>
            <Button onClick={handleConnect} disabled={connectGmail.isPending}>
              {connectGmail.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Connect Gmail
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
                  account.is_active
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    account.is_active ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                  }`}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{account.email_address}</p>
                    <div className="flex items-center gap-2">
                      {account.is_active ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs text-green-600 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          <span className="text-xs text-muted-foreground">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!account.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleSwitch(account.id)}
                      disabled={switchAccount.isPending}
                    >
                      {switchAccount.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Switch
                    </Button>
                  )}
                  {account.is_active && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">In Use</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnectAccount.isPending || accounts.length <= 1}
                    title={accounts.length <= 1 ? "Cannot disconnect your only account" : "Disconnect"}
                  >
                    {disconnectAccount.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>
              You&apos;ve reached the email account limit for your current plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground mb-2">Current Usage</p>
              <p className="text-2xl font-bold">
                {upgradeInfo?.current || count} <span className="text-lg font-normal text-muted-foreground">/ {upgradeInfo?.limit || limit}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {upgradeInfo?.plan || "Free"} Plan
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Plan Limits:</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="font-semibold">Free</p>
                  <p className="text-muted-foreground">1 account</p>
                </div>
                <div className="rounded-lg border border-primary/50 bg-primary/5 p-3 text-center">
                  <p className="font-semibold">Pro</p>
                  <p className="text-muted-foreground">2 accounts</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="font-semibold">Business</p>
                  <p className="text-muted-foreground">5 accounts</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowUpgradeModal(false)}>
              Maybe Later
            </Button>
            <Link to="/pricing" className="flex-1">
              <Button className="w-full">
                Upgrade Plan
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
