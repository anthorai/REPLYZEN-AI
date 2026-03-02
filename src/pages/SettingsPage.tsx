import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import DashboardHeader from "@/components/DashboardHeader";
import { Mail, AlertTriangle, Loader2, FileText, Shield } from "lucide-react";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useGmailConnection, useDisconnectAccount } from "@/hooks/useGmailConnection";
import { toast } from "@/hooks/use-toast";

const toneExamples: Record<string, string> = {
  professional: "Hi John, I wanted to follow up on our earlier discussion regarding the proposal…",
  friendly: "Hey John! Just checking in — wanted to see if you had a chance to look at the proposal 😊",
  direct: "John, following up on the proposal. Please let me know your decision by EOD Friday.",
  polite: "Hi John, I hope this finds you well. Just a gentle reminder about the proposal I shared earlier…",
};

const SettingsPage = () => {
  const { toggleSidebar } = useOutletContext<{ toggleSidebar: () => void }>();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: connectionState } = useGmailConnection();
  const disconnectAccount = useDisconnectAccount();

  const activeAccount = connectionState?.activeAccount;
  const accounts = connectionState?.accounts || [];

  const handleUpdate = (updates: Parameters<typeof updateSettings.mutate>[0]) => {
    updateSettings.mutate(updates, {
      onSuccess: () => toast({ title: "Settings saved" }),
      onError: (err) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
    });
  };

  const handleDisconnectAll = () => {
    // Disconnect all accounts one by one
    accounts.forEach((account) => {
      disconnectAccount.mutate(account.id);
    });
    toast({ title: "All Gmail accounts disconnected" });
  };

  const tone = settings?.tone_preference || "professional";

  return (
    <>
      <DashboardHeader title="Settings" subtitle="Manage your account and preferences" onMenuToggle={toggleSidebar} />

      <div className="space-y-6">
        {/* Connected Account */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <h3 className="text-base font-semibold text-foreground mb-5">Connected Account</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{activeAccount?.email_address || "Not connected"}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${activeAccount ? "bg-green-500" : "bg-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{activeAccount ? "Connected" : "Disconnected"}</span>
                </div>
              </div>
            </div>
            {activeAccount && (
              <Button
                variant="outline"
                size="sm"
                className="border-secondary text-secondary-foreground hover:bg-accent"
                onClick={() => disconnectAccount.mutate(activeAccount.id, { onSuccess: () => toast({ title: "Gmail disconnected" }) })}
                disabled={disconnectAccount.isPending}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* Follow-Up Rules */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <h3 className="text-base font-semibold text-foreground mb-5">Follow-Up Timing Rules</h3>
          <div className="space-y-6">
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Follow up after no reply for</Label>
              <Select
                value={String(settings?.followup_delay_days ?? 3)}
                onValueChange={(v) => handleUpdate({ followup_delay_days: Number(v) })}
              >
                <SelectTrigger className="w-full max-w-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day} {day === 1 ? "day" : "days"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Automatic Daily Scan</p>
                <p className="text-xs text-muted-foreground">Automatically scan your inbox every morning</p>
              </div>
              <Switch
                checked={settings?.auto_scan_enabled ?? true}
                onCheckedChange={(v) => handleUpdate({ auto_scan_enabled: v })}
              />
            </div>
          </div>
        </div>

        {/* Tone */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <h3 className="text-base font-semibold text-foreground mb-5">Follow-Up Tone</h3>
          <RadioGroup
            value={tone}
            onValueChange={(v) => handleUpdate({ tone_preference: v })}
            className="space-y-3"
          >
            {Object.keys(toneExamples).map((t) => (
              <div key={t} className="flex items-center gap-3">
                <RadioGroupItem value={t} id={`tone-${t}`} />
                <Label htmlFor={`tone-${t}`} className="text-sm font-medium capitalize cursor-pointer">
                  {t === "polite" ? "Gentle Reminder" : t}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="mt-4 rounded-xl bg-surface p-4">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Preview</p>
            <p className="text-sm text-foreground italic leading-relaxed">{toneExamples[tone]}</p>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-strong">
          <h3 className="text-base font-semibold text-foreground mb-5">Notifications</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Daily Digest</p>
                <p className="text-xs text-muted-foreground">Get a summary of pending follow-ups each morning</p>
              </div>
              <Switch
                checked={settings?.daily_digest ?? true}
                onCheckedChange={(v) => handleUpdate({ daily_digest: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Weekly Performance Report</p>
                <p className="text-xs text-muted-foreground">Receive a weekly summary of sent follow-ups and response rates</p>
              </div>
              <Switch
                checked={settings?.weekly_report ?? false}
                onCheckedChange={(v) => handleUpdate({ weekly_report: v })}
              />
            </div>
          </div>
        </div>

        {/* Legal & Compliance */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
          <h3 className="text-base font-semibold text-foreground mb-4">Legal & Compliance</h3>
          <div className="space-y-3">
            <Link 
              to="/terms" 
              target="_blank"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Terms of Service</p>
                <p className="text-xs text-muted-foreground">Read our terms and conditions</p>
              </div>
            </Link>
            <Link 
              to="/privacy" 
              target="_blank"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <Shield className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">How we handle your data</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-strong">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Disconnecting all Gmail accounts will remove all synced data and pending follow-ups.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnectAll}
            disabled={disconnectAccount.isPending || accounts.length === 0}
          >
            Disconnect All Accounts
          </Button>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
