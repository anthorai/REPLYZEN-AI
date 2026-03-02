import { RefreshCw, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  onMenuToggle?: () => void;
  extra?: ReactNode;
}

const DashboardHeader = ({ title, subtitle, onMenuToggle, extra }: DashboardHeaderProps) => {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-strong p-6 mb-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onMenuToggle}
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {extra}
          <Button variant="outline" size="sm" className="gap-2 border-secondary text-secondary-foreground hover:bg-accent">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
