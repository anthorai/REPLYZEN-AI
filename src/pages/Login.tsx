import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnhancedAuth } from "@/contexts/EnhancedAuthContext";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { LandingFooter } from "@/components/LandingFooter";
import { Loader2 } from "lucide-react";

const Login = () => {
  const { user, loading, initialized, signIn, signUp } = useEnhancedAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/dashboard`,
        },
      });
      if (error) {
        setError(error.message);
        setSubmitting(false);
      }
    } catch {
      setError("Unable to start Google login. Please try again.");
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          setError(error);
        } else {
          // you can later store fullName in a profile table / user_metadata
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] rounded-2xl bg-card border border-border shadow-elevated p-10 animate-scale-in space-y-6">
        <div className="text-center">
          <Link to="/">
            <span className="text-2xl font-bold text-gradient-orange">Replify AI</span>
          </Link>
          <div className="w-10 h-[3px] rounded-full bg-primary mx-auto mt-3" />
          <p className="mt-4 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in with Google or email and password."
              : "Create your account with name, email and password."}
          </p>
        </div>

        {error && (
          <div className="mb-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <Button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-12 text-base rounded-xl flex items-center justify-center gap-2"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to Google...
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
              >
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.92h5.45C16.86 16.9 14.7 18.4 12 18.4c-3.54 0-6.4-2.86-6.4-6.4S8.46 5.6 12 5.6c1.7 0 3.24.64 4.43 1.69l2.79-2.79C17.5 2.94 14.9 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c5.19 0 9.54-3.77 9.96-8.8.03-.34.04-.68.04-1.02 0-.7-.06-1.38-.18-2.04H12z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or continue with email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="fullName" className="text-sm text-muted-foreground">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
                className="mt-1 rounded-xl"
              />
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-sm text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base rounded-xl"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in with email" : "Create account"}
          </Button>
        </form>

        <div className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="text-primary font-medium hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <>
              <p className="mb-3">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </p>
              <p className="text-xs">
                By creating an account, you agree to our{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </>
          )}
        </div>
        </div>
      </div>
      <LandingFooter />
    </div>
  );
};

export default Login;
