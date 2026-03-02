import React, { Suspense, lazy } from "react";
import { isEnvironmentValid } from "@/lib/env-validation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { EnhancedAuthProvider } from "@/contexts/EnhancedAuthContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Pricing = lazy(() => import("./pages/Pricing"));
const FAQ = lazy(() => import("./pages/FAQ"));
const About = lazy(() => import("./pages/About"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Workspace = lazy(() => import("./pages/Workspace"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Profile = lazy(() => import("./pages/Profile"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    minHeight: "100vh",
    background: "#f8f9fa"
  }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ 
        width: "40px", 
        height: "40px", 
        border: "4px solid #e9ecef", 
        borderTop: "4px solid #007bff", 
        borderRadius: "50%", 
        animation: "spin 1s linear infinite",
        margin: "0 auto 20px"
      }}></div>
      <p style={{ color: "#6c757d", margin: 0 }}>Loading...</p>
    </div>
  </div>
);

export default function App() {
  console.log("App component rendering - FINAL VERSION");
  console.log("Environment valid:", isEnvironmentValid());
  
  if (!isEnvironmentValid()) {
    return (
      <div style={{ padding: 40, background: "#ffebee", minHeight: "100vh" }}>
        <h1 style={{ color: "#d32f2f", fontSize: "24px", marginBottom: "20px" }}>
          ⚠️ Environment Configuration Error
        </h1>
        <p style={{ color: "#666", fontSize: "16px" }}>
          Required environment variables are missing. Check console for details.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <EnhancedAuthProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/billing/success" element={<BillingSuccess />} />
                  <Route path="/workspace" element={<DashboardLayout />}>
                    <Route index element={<Workspace />} />
                  </Route>
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                  </Route>
                  <Route path="/settings" element={<DashboardLayout />}>
                    <Route index element={<SettingsPage />} />
                  </Route>
                  <Route path="/profile" element={<DashboardLayout />}>
                    <Route index element={<Profile />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </EnhancedAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
