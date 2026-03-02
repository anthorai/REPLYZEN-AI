import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  User, 
  LogOut, 
  ChevronLeft,
  ChevronRight,
  CircleUserRound
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEnhancedAuth } from "@/contexts/EnhancedAuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Workspace", url: "/workspace", icon: Briefcase },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Profile", url: "/profile", icon: User },
];

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

const Sidebar = ({ mobileOpen = false, setMobileOpen }: SidebarProps) => {
  const [localMobileOpen, setLocalMobileOpen] = useState(false);
  const effectiveMobileOpen = setMobileOpen ? mobileOpen : localMobileOpen;
  const setEffectiveMobileOpen = setMobileOpen || setLocalMobileOpen;

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem("sidebar-collapsed");
        return saved ? JSON.parse(saved) : false;
      } catch (error) {
        console.warn('Failed to read sidebar state from localStorage:', error);
        return false;
      }
    }
    return false;
  });
  
  const { data: subscription } = useSubscription();
  const location = useLocation();
  const { user, signOut } = useEnhancedAuth();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem("sidebar-collapsed", JSON.stringify(collapsed));
      } catch (error) {
        console.warn('Failed to save sidebar state to localStorage:', error);
      }
    }
  }, [collapsed]);

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setEffectiveMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Mobile menu backdrop */}
      {effectiveMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setEffectiveMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar - inline flex element, not fixed */}
      <aside 
        className={cn(
          "hidden h-full flex-shrink-0 transition-all duration-300 ease-in-out lg:block",
          collapsed ? "w-20" : "w-64",
          "bg-card border-r border-border shadow-sm"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo section */}
          <div className="flex items-center gap-3 px-5 py-6 border-b border-border">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="ml-auto h-8 w-8"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <li key={item.url}>
                    <Link
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Profile and logout */}
          <div className="p-3">
            {!collapsed ? (
              <div className="bg-white border rounded-2xl shadow-sm p-4 space-y-4">
                {/* User info row */}
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {user?.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt={user.email || "User"}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-medium text-sm">
                        {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="truncate text-sm font-semibold min-w-0">
                      {user?.email?.split('@')[0] || "User"}
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0",
                    subscription?.currentPlan === 'free' ? "bg-gray-200 text-gray-700" :
                    subscription?.currentPlan === 'pro' ? "bg-orange-500 text-white" :
                    "bg-orange-700 text-white"
                  )}>
                    {subscription?.planDetails ? 
                      (subscription.currentPlan.charAt(0).toUpperCase() + subscription.currentPlan.slice(1)) 
                      : "Free"}
                  </span>
                </div>
                
                {/* Logout button */}
                <Button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-red-50 text-sm rounded-xl py-2 transition-colors"
                  variant="ghost"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative group">
                  <div className="relative">
                    {user?.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt={user.email || "User"}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-medium text-sm">
                        {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    
                    {/* Plan indicator dot */}
                    <div className={cn(
                      "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
                      subscription?.currentPlan === 'free' ? "bg-gray-400" :
                      subscription?.currentPlan === 'pro' ? "bg-orange-500" :
                      "bg-orange-700"
                    )}></div>
                  </div>
                  
                  {/* Tooltip for collapsed mode */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block bg-popover text-popover-foreground px-2 py-1 text-xs rounded-md shadow-md border">
                    <div className="whitespace-nowrap">
                      {user?.email?.split('@')[0] || "User"}
                      <br />
                      {subscription?.planDetails ? 
                        (subscription.currentPlan.charAt(0).toUpperCase() + subscription.currentPlan.slice(1)) 
                        : "Free"}
                      <br />
                      Logout
                    </div>
                  </div>
                </div>
                
                {/* Logout icon button */}
                <button 
                  onClick={handleSignOut}
                  className="mt-3 p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <LogOut className="h-4 w-4 text-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar - overlay */}
      {effectiveMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setEffectiveMobileOpen(false)}
        />
      )}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden",
          effectiveMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo section */}
          <div className="flex items-center gap-3 px-5 py-6 border-b border-border">
            <img 
              src={logo} 
              alt="Replify AI" 
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="text-xl font-bold text-gradient-orange">
              Replify AI
            </span>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <li key={item.url}>
                    <Link
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => setEffectiveMobileOpen(false)}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Profile and logout */}
          <div className="px-3 pb-4">
            <div className="mb-3">
              <Link
                to="/profile"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || "User"} />
                  <AvatarFallback>
                    <CircleUserRound className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="truncate font-medium text-foreground">
                    {user?.email?.split('@')[0] || "User"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user?.email || "Account"}
                  </div>
                </div>
              </Link>
            </div>
            <Button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full justify-start"
              variant="ghost"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;