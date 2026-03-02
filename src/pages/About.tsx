import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Target, Eye, Lock } from "lucide-react";
import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/LandingFooter";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* Hero */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 gradient-hero">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            About Replify AI
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Helping professionals never lose opportunities to forgotten
            follow-ups.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-8 shadow-strong">
            <div className="w-12 h-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Mission
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Replify AI helps professionals never lose opportunities due
                to forgotten follow-ups. We surface conversations going cold and
                give you AI-drafted emails so you can re-engage at the right
                time—without the manual tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-8 shadow-strong">
            <div className="w-12 h-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Vision
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Building intelligent automation that enhances human
                communication. We believe the best tools support you—they don't
                replace you. Replify AI keeps you in control while taking the
                busywork out of follow-ups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-8 shadow-strong">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                Security
                <Lock className="h-4 w-4 text-muted-foreground" />
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Privacy-first architecture. We use OAuth so we never see your
                password. Data is encrypted at rest and in transit. We only
                access what’s needed to detect no-reply conversations and
                generate drafts—nothing more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 gradient-orange">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-4">
            Start Protecting Your Conversations
          </h2>
          <p className="text-primary-foreground/80 mb-8">
            Connect Gmail and never lose another follow-up.
          </p>
          <Link to="/login">
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-0 shadow-elevated font-semibold"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default About;
