import { Navigate } from "react-router-dom";
import { useEnhancedAuth } from "@/contexts/EnhancedAuthContext";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireProfile?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  redirectTo = "/login", 
  requireProfile = false 
}: ProtectedRouteProps) => {
  const { user, loading, initialized, error, refreshSession } = useEnhancedAuth();

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
              Authentication Error
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
              onClick={() => window.location.href = redirectTo}
              variant="default"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: window.location.pathname }} />;
  }

  // Check if profile is required but missing
  if (requireProfile && !user?.user_metadata?.display_name) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface p-4">
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">
              Setting up your profile
            </h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we complete your setup...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
