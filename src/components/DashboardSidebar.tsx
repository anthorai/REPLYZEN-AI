import { LayoutDashboard, Settings, LogOut, Briefcase, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const navItems = [
  { title: "Workspace", url: "/workspace", icon: Briefcase },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Profile", url: "/profile", icon: User },
];

interface DashboardSidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

const DashboardSidebar = ({ collapsed, onClose }: DashboardSidebarProps) => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center gap-2 px-5 py-6 border-b border-border">
        <img 
          src={logo} 
          alt="Replify AI" 
          className={cn(
            "rounded-lg object-contain",
            collapsed ? "w-8 h-8" : "w-8 h-8"
          )}
        />
        {!collapsed && (
          <span className="text-xl font-bold text-gradient-orange">
            Replify AI
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              activeClassName=""
              onClick={onClose}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
              )}
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={() => signOut()}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
