import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useEnhancedAuth } from "@/contexts/EnhancedAuthContext";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const DashboardLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, loading, initialized, error, refreshSession } = useEnhancedAuth();

  const toggleSidebar = () => {
    setMobileSidebarOpen(prev => !prev);
  };

  // Show error state if there's an authentication error
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">
              Session Error
            </h2>
            <p className="text-sm text-muted-foreground">
              {error}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              onClick={refreshSession}
              className="gap-2"
            >
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.href = "/login"}
              variant="default"
            >
              Sign In Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />
      
      {/* Main content — light gray background */}
      <main className="flex-1 overflow-y-auto bg-surface transition-all duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet context={{ toggleSidebar }} />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
