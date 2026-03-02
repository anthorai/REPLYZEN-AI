import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { LandingFooter } from "@/components/LandingFooter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth redirect
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      console.log('[Login] Checking OAuth redirect...');
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      if (error) {
        console.error('[Login] OAuth error:', error, errorDescription);
        setError(errorDescription || error);
        toast.error(`Authentication failed: ${errorDescription || error}`);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (code) {
        console.log('[Login] OAuth code received, processing...');
        setSubmitting(true);
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[Login] Session exchange error:', error);
            setError(error.message);
            toast.error(`Failed to complete authentication: ${error.message}`);
          } else {
            console.log('[Login] Authentication successful:', data.session);
            toast.success('Successfully signed in!');
            
            // Small delay to ensure auth state is updated
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 500);
          }
        } catch (err) {
          console.error('[Login] OAuth processing error:', err);
          setError('Failed to complete authentication. Please try again.');
          toast.error('Failed to complete authentication. Please try again.');
        } finally {
          setSubmitting(false);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleOAuthRedirect();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const handleGoogleLogin = async () => {
    console.log('[Login] Starting Google OAuth flow...');
    setError(null);
    setSubmitting(true);
    
    try {
      const origin = window.location.origin;
      console.log('[Login] Redirect origin:', origin);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/login`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      console.log('[Login] OAuth response:', { data, error });

      if (error) {
        console.error('[Login] OAuth error:', error);
        setError(error.message);
        toast.error(`Google login failed: ${error.message}`);
        setSubmitting(false);
      } else {
        console.log('[Login] OAuth initiated successfully');
        // The redirect will happen automatically, but set a timeout for safety
        setTimeout(() => {
          if (submitting) {
            setSubmitting(false);
            setError('Redirect timed out. Please try again.');
            toast.error('Redirect timed out. Please try again.');
          }
        }, 10000); // 10 second timeout
      }
    } catch (err) {
      console.error('[Login] Unexpected error during Google login:', err);
      setError("Unable to start Google login. Please try again.");
      toast.error("Unable to start Google login. Please try again.");
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`[Login] Starting ${mode} flow...`);
    setError(null);
    setSubmitting(true);
    
    try {
      if (mode === "login") {
        console.log('[Login] Attempting email login...');
        const { error } = await signIn(email, password);
        if (error) {
          console.error('[Login] Login error:', error);
          setError(error);
          toast.error(`Login failed: ${error}`);
        } else {
          console.log('[Login] Login successful');
          toast.success('Successfully signed in!');
          navigate('/dashboard', { replace: true });
        }
      } else {
        console.log('[Login] Attempting signup...');
        const { error } = await signUp(email, password);
        if (error) {
          console.error('[Login] Signup error:', error);
          setError(error);
          toast.error(`Signup failed: ${error}`);
        } else {
          console.log('[Login] Signup successful');
          toast.success('Account created successfully!');
          // you can later store fullName in a profile table / user_metadata
          setMode("login");
        }
      }
    } catch (err) {
      console.error('[Login] Unexpected error during email auth:', err);
      setError("An unexpected error occurred. Please try again.");
      toast.error("An unexpected error occurred. Please try again.");
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
                placeholder="•••••••"
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
