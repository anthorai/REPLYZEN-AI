import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Zap, Send, ShieldCheck, Lock, Eye, TrendingUp, MessageCircle, Brain, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/LandingFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import heroDashboard from "@/assets/hero-dashboard.png";

const steps = [
  {
    step: "01",
    icon: Mail,
    title: "Connect Gmail",
    description: "Securely link your Gmail account with one click via OAuth 2.0.",
  },
  {
    step: "02",
    icon: Brain,
    title: "AI Detects No Replies",
    description: "Our AI scans your inbox and surfaces conversations going cold.",
  },
  {
    step: "03",
    icon: Send,
    title: "One-Click Send",
    description: "Review AI-drafted follow-up and send it instantly.",
  },
];

const benefits = [
  { icon: TrendingUp, title: "Recover Lost Deals", description: "Re-engage prospects before they go silent for good." },
  { icon: MessageCircle, title: "Increase Response Rates", description: "Timely follow-ups boost reply rates by up to 40%." },
  { icon: Zap, title: "Reduce Inbox Stress", description: "Stop manually tracking who hasn't replied." },
  { icon: CheckCircle, title: "Stay Professionally Consistent", description: "Never let important conversations slip through." },
];

const trustItems = [
  { icon: ShieldCheck, title: "Secure OAuth", description: "Industry-standard Google OAuth 2.0. We never see your password." },
  { icon: Eye, title: "No Auto-Sending", description: "Every follow-up requires your approval before sending." },
  { icon: Lock, title: "Encrypted Storage", description: "All data encrypted at rest and in transit." },
];

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle OAuth redirect
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      console.log('[Index] OAuth redirect check:', { code, error, errorDescription });

      if (error) {
        console.error('[Index] OAuth error:', error, errorDescription);
        toast.error(`Authentication failed: ${errorDescription || error}`);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (code) {
        console.log('[Index] OAuth code received, processing...');
        setIsConnecting(true);
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[Index] Session exchange error:', error);
            toast.error(`Failed to complete authentication: ${error.message}`);
          } else {
            console.log('[Index] Authentication successful:', data.session);
            toast.success('Successfully signed in!');
            
            // Small delay to ensure auth state is updated
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 100);
          }
        } catch (err) {
          console.error('[Index] OAuth processing error:', err);
          toast.error('Failed to complete authentication. Please try again.');
        } finally {
          setIsConnecting(false);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleOAuthRedirect();
  }, [navigate]);

  // Redirect logged-in users to dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGetStarted = async () => {
    console.log('[Index] Get Started button clicked');
    
    // Prevent multiple clicks
    if (isConnecting) {
      console.log('[Index] Connection already in progress');
      return;
    }

    setIsConnecting(true);
    
    try {
      // Check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('[Index] User already logged in, redirecting to dashboard');
        toast.success('Already signed in!');
        navigate('/dashboard', { replace: true });
        return;
      }

      // Redirect to login page for OAuth
      console.log('[Index] Redirecting to login for OAuth');
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('[Index] Error in Get Started:', error);
      toast.error('Failed to start authentication. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Show loading state during OAuth processing
  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Completing authentication...</p>
          <p className="text-sm text-muted-foreground mt-2">This should only take a moment.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-left" style={{ animationDelay: "0.1s" }}>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] text-foreground tracking-tight">
                Never Miss a{" "}
                <span className="text-gradient-orange">Follow-Up</span>{" "}
                Again.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
                AI detects silent conversations and writes perfect follow-ups automatically. Close more deals, faster.
              </p>
              <div className="flex flex-wrap gap-3 mt-10">
                <Button 
                  size="lg" 
                  className="text-base px-8 py-6 rounded-2xl shadow-elevated gap-2"
                  onClick={handleGetStarted}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Mail className="h-5 w-5" />
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <a href="#how-it-works">
                  <Button variant="outline" size="lg" className="text-base px-8 py-6 rounded-2xl border-border">
                    See How It Works
                  </Button>
                </a>
              </div>
            </div>

            <div className="animate-fade-in-right" style={{ animationDelay: "0.3s" }}>
              <div className="rounded-2xl overflow-hidden shadow-elevated border border-border bg-card">
                <img
                  src={heroDashboard}
                  alt="Replify AI dashboard preview"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">How Replify AI Works</h2>
            <p className="mt-3 text-muted-foreground text-lg">Three simple steps to never lose a conversation.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[4.5rem] left-[20%] right-[20%] h-px border-t-2 border-dashed border-primary/20" />

            {steps.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-8 shadow-strong hover:shadow-elevated transition-all duration-300 text-center animate-fade-in"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <div className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-4">{step.step}</div>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-accent-foreground mb-5">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Why Replify AI?</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="flex items-start gap-5 rounded-2xl bg-card border border-border p-6 shadow-card hover:shadow-strong transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-1 self-stretch rounded-full bg-primary/60 shrink-0" />
                <div>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent text-accent-foreground mb-3">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-24 gradient-orange-subtle">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Built on Trust</h2>
            <p className="mt-3 text-muted-foreground text-lg">Your data security is our top priority.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {trustItems.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl bg-card border border-border p-8 text-center shadow-strong"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <t.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{t.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — Dark Orange Block */}
      <section className="py-24 gradient-orange">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">Stop Losing Opportunities.</h2>
          <p className="text-primary-foreground/80 text-lg mb-10">
            No credit card required. Connect your Gmail and let AI handle the rest.
          </p>
          <Button 
            size="lg" 
            variant="outline" 
            className="text-base px-10 py-6 rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-0 shadow-elevated font-semibold"
            onClick={handleGetStarted}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect Gmail Now
              </>
            )}
          </Button>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default Index;
