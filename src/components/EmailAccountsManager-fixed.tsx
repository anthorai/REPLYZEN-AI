import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Settings, LogOut, Loader2, AlertTriangle } from "lucide-react";
import { useGmailConnection, useConnectGmail, useSwitchAccount, useDisconnectAccount, resetConnectionState } from "@/hooks/useGmailConnection-fixed";
import { toast } from "@/hooks/use-toast";
import { GmailAccount } from "@/hooks/useGmailConnection-fixed";

interface EmailAccountsManagerProps {
  onAccountChange?: () => void;
}

export function EmailAccountsManager({ onAccountChange }: EmailAccountsManagerProps) {
  const { data: connectionData, isLoading, error, refetch } = useGmailConnection();
  const connectGmail = useConnectGmail();
  const switchAccount = useSwitchAccount();
  const disconnectAccount = useDisconnectAccount();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    // Prevent multiple clicks
    if (isConnecting || connectGmail.isPending) {
      console.log("[EmailAccountsManager] Connection already in progress");
      return;
    }

    setIsConnecting(true);
    
    // Reset connection state to clear any stuck state
    resetConnectionState();
    
    connectGmail.mutate(undefined, {
      onSuccess: (url) => {
        console.log("[EmailAccountsManager] Connection initiated, redirecting to:", url?.substring(0, 50) + "...");
        setIsConnecting(false);
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
        
        setIsConnecting(false);
        
        // Handle specific error types
        if (err?.message?.includes('Another connection attempt')) {
          toast({ 
            title: "⏱️ Connection in Progress", 
            description: "Please wait for the current connection attempt to complete.",
            variant: "default",
            duration: 4000,
          });
          return;
        }
        
        if (err?.message?.includes('limit reached')) {
          toast({ 
            title: "📊 Account Limit Reached", 
            description: "You've reached your account limit. Upgrade to connect more accounts.",
            variant: "destructive",
            duration: 6000,
          });
          return;
        }
        
        if (err?.message?.includes('already connected')) {
          toast({ 
            title: "📧 Account Already Connected", 
            description: "This Gmail account is already connected to your account.",
            variant: "default",
            duration: 4000,
          });
          return;
        }
        
        // Generic error
        toast({ 
          title: "❌ Gmail Connection Failed", 
          description: err?.message || "Unable to connect Gmail. Please try again.", 
          variant: "destructive",
          duration: 6000,
        });
      },
      onSettled: () => {
        setIsConnecting(false);
      },
    });
  };

  const handleSwitch = (accountId: string) => {
    if (switchAccount.isPending) return;
    
    switchAccount.mutate(accountId, {
      onSuccess: () => {
        onAccountChange?.();
        refetch();
      },
    });
  };

  const handleDisconnect = (accountId: string) => {
    if (disconnectAccount.isPending) return;
    
    disconnectAccount.mutate(accountId, {
      onSuccess: () => {
        onAccountChange?.();
        refetch();
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mb-4 mx-auto" />
            <p className="text-muted-foreground">Loading email accounts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="h-6 w-6 text-destructive mb-4 mx-auto" />
            <p className="text-destructive font-medium mb-2">Failed to load email accounts</p>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { accounts, activeAccount, count, limit, canAddMore } = connectionData || {
    accounts: [],
    activeAccount: null,
    count: 0,
    limit: 1,
    canAddMore: true,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Accounts
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {count}/{limit}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Accounts Connected</h3>
            <p className="text-muted-foreground mb-6">
              Connect your Gmail account to start using Replyzen AI
            </p>
            <Button 
              onClick={handleConnect}
              disabled={!canAddMore || isConnecting || connectGmail.isPending}
              className="w-full"
            >
              {isConnecting || connectGmail.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Gmail
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  activeAccount?.id === account.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{account.email_address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={account.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {account.provider}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {activeAccount?.id !== account.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSwitch(account.id)}
                      disabled={switchAccount.isPending}
                    >
                      {switchAccount.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Settings className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnectAccount.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    {disconnectAccount.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <LogOut className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
            
            {canAddMore && (
              <Button 
                onClick={handleConnect}
                disabled={isConnecting || connectGmail.isPending}
                variant="outline"
                className="w-full mt-4"
              >
                {isConnecting || connectGmail.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Another Account
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        
        {!canAddMore && accounts.length > 0 && (
          <div className="text-center p-4 bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              You've reached the limit of {limit} email account{limit > 1 ? 's' : ''}.
            </p>
            <Button variant="outline" size="sm" className="mt-2">
              Upgrade Plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
