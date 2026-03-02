import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/LandingFooter";
import { ScrollText, UserCheck, Mail, CreditCard, ShieldAlert, Brain, Database, Lock, Server, Scale, Gavel, FileWarning, RefreshCw, Globe, Phone } from "lucide-react";
import { useEffect } from "react";

export default function Terms() {
  // Scroll to section if hash is present
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);

  const lastUpdated = "February 28, 2026";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/20 border-b border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Please read these terms carefully before using Replify AI. By accessing or using our service, you agree to be bound by these terms.
            </p>
            <p className="mt-4 text-sm text-muted-foreground/70">
              Last Updated: {lastUpdated}
            </p>
          </div>
        </section>

        {/* Table of Contents */}
        <div className="py-8 px-4 sm:px-6 lg:px-8 bg-muted/30 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Table of Contents</h2>
            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: "introduction", label: "1. Introduction" },
                { id: "eligibility", label: "2. Eligibility" },
                { id: "service-description", label: "3. Service Description" },
                { id: "account-registration", label: "4. Account Registration" },
                { id: "subscription-billing", label: "5. Subscription & Billing" },
                { id: "acceptable-use", label: "6. Acceptable Use Policy" },
                { id: "gmail-integration", label: "7. Gmail Integration" },
                { id: "ai-content", label: "8. AI-Generated Content" },
                { id: "data-privacy", label: "9. Data Privacy" },
                { id: "intellectual-property", label: "10. Intellectual Property" },
                { id: "service-availability", label: "11. Service Availability" },
                { id: "limitation-liability", label: "12. Limitation of Liability" },
                { id: "indemnification", label: "13. Indemnification" },
                { id: "termination", label: "14. Termination" },
                { id: "changes-terms", label: "15. Changes to Terms" },
                { id: "governing-law", label: "16. Governing Law" },
                { id: "contact", label: "17. Contact Information" },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            
            {/* 1. Introduction */}
            <section id="introduction" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <ScrollText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">1. Introduction</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Welcome to Replify AI (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of Service (&quot;Terms,&quot; &quot;Terms of Service,&quot; or &quot;Agreement&quot;) constitute a legally binding agreement between you and Replify AI governing your access to and use of the Replify AI website, applications, and services (collectively, the &quot;Service&quot;).
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Replify AI is an AI-powered email follow-up automation platform that integrates with Gmail to help users manage their email conversations and generate follow-up suggestions. Our Service uses artificial intelligence to analyze email metadata and generate draft follow-up messages, which users can review, edit, and send at their discretion.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service. Your access to and use of the Service is also conditioned on your acceptance of and compliance with our Privacy Policy, which describes how we collect, use, and share your personal information.
                </p>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mt-6">
                  <p className="text-amber-800 text-sm font-medium">
                    <ShieldAlert className="w-4 h-4 inline mr-2" />
                    Important: These Terms constitute a binding legal agreement. Please read them carefully. By using Replify AI, you acknowledge that you have read, understood, and agree to be bound by these Terms.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 2. Eligibility */}
            <section id="eligibility" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">2. Eligibility</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  By using the Service, you represent and warrant that:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You are at least 18 years of age or the age of legal majority in your jurisdiction, whichever is greater.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You have the legal capacity and authority to enter into a binding contract.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You are not barred from using the Service under applicable laws.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You will comply with these Terms and all applicable local, state, national, and international laws, rules, and regulations.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You have not been previously suspended or removed from the Service.</span>
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  If you are using the Service on behalf of a company, organization, or other entity, you represent and warrant that you have the authority to bind that entity to these Terms and that you agree to these Terms on behalf of that entity.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 3. Description of Service */}
            <section id="service-description" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">3. Description of Service</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Replify AI provides an AI-powered email follow-up automation service that includes the following features:
                </p>
                <div className="grid gap-4 mt-6">
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h3 className="font-semibold text-foreground mb-2">AI-Powered Email Analysis</h3>
                    <p className="text-sm text-muted-foreground">Our Service analyzes email metadata (subject lines, timestamps, sender information) to identify conversations that may require follow-up.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Gmail Integration</h3>
                    <p className="text-sm text-muted-foreground">Users can connect their Gmail accounts via OAuth to enable the Service to access email metadata and send follow-ups on their behalf.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Follow-Up Draft Generation</h3>
                    <p className="text-sm text-muted-foreground">Our AI generates personalized follow-up email drafts based on conversation context, which users must review and approve before sending.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Subscription-Based Access</h3>
                    <p className="text-sm text-muted-foreground">Access to the Service is provided on a subscription basis with different plans (Free, Pro, Business) offering varying feature sets and usage limits.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Dashboard Analytics</h3>
                    <p className="text-sm text-muted-foreground">Users can view analytics about their follow-up activity, including sent count, reply rates, and weekly summaries.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Automation Features</h3>
                    <p className="text-sm text-muted-foreground">Paid plans include automation features such as scheduled follow-up generation and optional auto-send capabilities (with user approval).</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-6">
                  We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Service.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 4. Account Registration */}
            <section id="account-registration" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">4. Account Registration</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  To use certain features of the Service, you must register for an account. When you register, you agree to:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Provide accurate, current, and complete information about yourself as prompted by the registration form.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Maintain and promptly update your account information to keep it accurate, current, and complete.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Maintain the security of your account credentials and accept all risks of unauthorized access to your account.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Notify us immediately of any unauthorized use of your account or any other breach of security.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Accept responsibility for all activities that occur under your account.</span>
                  </li>
                </ul>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl mt-6">
                  <h4 className="font-semibold text-foreground mb-2">Google OAuth Connection</h4>
                  <p className="text-sm text-muted-foreground">
                    When you connect your Gmail account, you authorize Replify AI to access specific Gmail data as permitted by you through Google&apos;s OAuth consent screen. You can revoke this access at any time through your Google Account settings. We do not store your Google password.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 5. Subscription & Billing */}
            <section id="subscription-billing" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">5. Subscription and Billing</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Subscription Plans</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Replify AI offers multiple subscription plans with different features and usage limits. Current plans include:
                  </p>
                  <ul className="space-y-2 text-muted-foreground mt-3">
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span><strong className="text-foreground">Free Plan:</strong> Limited to 30 follow-ups per month and 1 email account. No auto-send feature.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span><strong className="text-foreground">Pro Plan:</strong> Up to 2,000 follow-ups per month and 2 email accounts. Includes auto-send capabilities.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span><strong className="text-foreground">Business Plan:</strong> Unlimited follow-ups and up to 5 email accounts. Full automation features.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Billing and Payments</h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>All paid subscriptions are billed in advance on a recurring basis through Stripe, our third-party payment processor.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>Subscription fees are non-refundable except as required by applicable law or as explicitly stated in these Terms.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>You agree to provide current, complete, and accurate billing information.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>We reserve the right to change subscription fees upon reasonable notice. Changes will take effect at the next billing cycle.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Auto-Renewal and Cancellation</h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>Your subscription will automatically renew at the end of each billing period unless you cancel it.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>You may cancel your subscription at any time through your account settings or by contacting support.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>Cancellation will take effect at the end of the current billing period. You will continue to have access until then.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>Upon cancellation, your account will revert to the Free plan with corresponding limitations.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <h4 className="font-semibold text-red-800 mb-2">Refund Policy</h4>
                  <p className="text-sm text-red-700">
                    All subscription fees are non-refundable. We do not provide refunds for partial months or unused features. If you believe you have been incorrectly charged, please contact us within 30 days of the charge.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 6. Acceptable Use Policy */}
            <section id="acceptable-use" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">6. Acceptable Use Policy</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  You agree not to use the Service for any purpose that is unlawful or prohibited by these Terms. Specifically, you agree not to:
                </p>
                <div className="grid gap-4 mt-6">
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Spam or Unsolicited Communications</h4>
                    <p className="text-sm text-muted-foreground">Use the Service to send spam, bulk unsolicited emails, or any form of harassment. All follow-ups must be to legitimate business or personal contacts with whom you have an existing relationship.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Illegal Activity</h4>
                    <p className="text-sm text-muted-foreground">Use the Service for any illegal purpose, including fraud, phishing, identity theft, or distribution of malware or harmful code.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Abuse or Harassment</h4>
                    <p className="text-sm text-muted-foreground">Use the Service to harass, abuse, threaten, or intimidate any person, or to promote discrimination, hatred, or violence.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Scraping or Data Mining</h4>
                    <p className="text-sm text-muted-foreground">Use automated systems, bots, spiders, or scrapers to access, monitor, copy, or extract data from the Service without our express written permission.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Reverse Engineering</h4>
                    <p className="text-sm text-muted-foreground">Attempt to reverse engineer, decompile, disassemble, or otherwise attempt to discover the source code of the Service or any part thereof.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Circumvention of Limits</h4>
                    <p className="text-sm text-muted-foreground">Attempt to circumvent any rate limiting, plan restrictions, or security measures implemented by the Service.</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-6">
                  We reserve the right to investigate and take appropriate legal action against anyone who, in our sole discretion, violates this Acceptable Use Policy, including without limitation, removing offending content, suspending or terminating accounts, and reporting violations to law enforcement authorities.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 7. Gmail Integration Disclaimer */}
            <section id="gmail-integration" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-foreground">7. Gmail Integration Disclaimer</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Replify AI integrates with Gmail through Google&apos;s OAuth 2.0 protocol. By connecting your Gmail account, you acknowledge and agree to the following:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Limited Access:</strong> We only access the specific Gmail data you authorize through Google&apos;s OAuth consent screen. This includes email metadata (subjects, timestamps, sender information) necessary to identify conversations needing follow-up.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">No Email Content Storage:</strong> We do not permanently store the full body content of your emails. We only temporarily process metadata and snippets necessary for generating follow-up suggestions.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Secure Token Storage:</strong> OAuth access tokens are encrypted using AES-256-GCM encryption and stored securely. We never store your Gmail password.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">User Control:</strong> You can revoke our access to your Gmail data at any time through your Google Account security settings or by disconnecting your account in Replify AI.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Google API Compliance:</strong> Our use of Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</span>
                  </li>
                </ul>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl mt-6">
                  <p className="text-sm text-foreground">
                    <strong>Important:</strong> Replify AI&apos;s use of information received from Google APIs will adhere to the{" "}
                    <a 
                      href="https://developers.google.com/terms/api-services-user-data-policy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google API Services User Data Policy
                    </a>, including the Limited Use requirements.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 8. AI-Generated Content Disclaimer */}
            <section id="ai-content" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">8. AI-Generated Content Disclaimer</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Replify AI uses artificial intelligence to generate follow-up email drafts. By using this feature, you acknowledge and agree to the following:
                </p>
                <div className="grid gap-4 mt-6">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <h4 className="font-semibold text-amber-800 mb-2">AI Content May Contain Errors</h4>
                    <p className="text-sm text-amber-700">AI-generated drafts may contain inaccuracies, inappropriate language, or content that does not accurately reflect your intended message. You are solely responsible for reviewing, editing, and approving all AI-generated content before sending.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Guarantee of Results</h4>
                    <p className="text-sm text-muted-foreground">We do not guarantee any specific response rates, reply rates, or outcomes from using AI-generated follow-ups. Results may vary based on numerous factors including recipient behavior, email content, timing, and industry.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">User Responsibility</h4>
                    <p className="text-sm text-muted-foreground">You are solely responsible for the content of emails sent through our Service, including AI-generated drafts. We are not liable for any consequences arising from the use of AI-generated content.</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <h4 className="font-semibold text-foreground mb-2">No Liability for AI Mistakes</h4>
                    <p className="text-sm text-muted-foreground">To the fullest extent permitted by law, Replify AI shall not be liable for any errors, omissions, or inaccuracies in AI-generated content, or for any damages or losses resulting from the use of such content.</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-6">
                  We continuously work to improve our AI models, but we cannot guarantee that all generated content will be appropriate, accurate, or effective for your specific use case. Always review AI-generated drafts before sending.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 9. Data Privacy */}
            <section id="data-privacy" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">9. Data Privacy</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Your privacy is important to us. Our collection and use of personal information is governed by our{" "}
                  <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of your information as described in the Privacy Policy.
                </p>
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Key Privacy Commitments</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Data Encryption:</strong> All sensitive data, including OAuth tokens, is encrypted at rest using AES-256-GCM encryption and in transit using TLS 1.3.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Secure Storage:</strong> Your data is stored in secure, SOC 2 compliant data centers with strict access controls.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">No Sale of Data:</strong> We do not sell, rent, or trade your personal information to third parties for marketing purposes.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Limited Data Retention:</strong> We retain your data only as long as necessary to provide the Service or as required by law.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">GDPR Compliance:</strong> For users in the European Economic Area, we comply with the General Data Protection Regulation (GDPR).</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 10. Intellectual Property */}
            <section id="intellectual-property" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">10. Intellectual Property</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <h3 className="text-lg font-medium text-foreground mb-3">Replify AI Ownership</h3>
                <p className="text-muted-foreground leading-relaxed">
                  The Service and its original content, features, and functionality are and will remain the exclusive property of Replify AI and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Replify AI.
                </p>
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">License Grant to Users</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal business purposes. This license does not include:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Modifying or copying our materials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Using the materials for any commercial purpose without authorization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Attempting to decompile or reverse engineer any software</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Removing any copyright or proprietary notations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Transferring the materials to another person or mirroring the materials on any other server</span>
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-6">
                  This license shall automatically terminate if you violate any of these restrictions and may be terminated by Replify AI at any time.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 11. Service Availability */}
            <section id="service-availability" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Server className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">11. Service Availability</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  We strive to maintain high availability of the Service, but we do not guarantee that the Service will be available at all times or that it will be uninterrupted, timely, secure, or error-free.
                </p>
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Maintenance and Downtime</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We may perform scheduled maintenance during which the Service may be unavailable. We will attempt to provide advance notice of scheduled maintenance when possible.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Unscheduled downtime may occur due to technical issues, security incidents, or other circumstances beyond our control.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We are not liable for any loss or damage caused by unavailability of the Service.</span>
                  </li>
                </ul>
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Force Majeure</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We shall not be liable for any failure or delay in performing our obligations under these Terms where such failure or delay results from any cause beyond our reasonable control, including but not limited to: acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, strikes, shortages of transportation, facilities, fuel, energy, labor, or materials, or failure of telecommunications or internet service providers.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 12. Limitation of Liability */}
            <section id="limitation-liability" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Scale className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">12. Limitation of Liability</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  To the fullest extent permitted by applicable law, in no event shall Replify AI, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Your access to or use of or inability to access or use the Service</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Any conduct or content of any third party on the Service</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Any content obtained from the Service, including AI-generated drafts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Unauthorized access, use, or alteration of your transmissions or content</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Any other matter relating to the Service</span>
                  </li>
                </ul>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mt-6">
                  <h4 className="font-semibold text-amber-800 mb-2">Liability Cap</h4>
                  <p className="text-sm text-amber-700">
                    In no event shall our total liability to you for all damages, losses, and causes of action exceed the amount you have paid to us for the Service during the twelve (12) months immediately preceding the event giving rise to the liability, or one hundred dollars ($100.00), whichever is greater.
                  </p>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-6">
                  Some jurisdictions do not allow the exclusion of certain warranties or the limitation or exclusion of liability for incidental or consequential damages. Accordingly, some of the above limitations may not apply to you.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 13. Indemnification */}
            <section id="indemnification" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Gavel className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">13. Indemnification</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  You agree to defend, indemnify, and hold harmless Replify AI and its licensees and licensors, and their employees, contractors, agents, officers, and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to attorney&apos;s fees), resulting from or arising out of:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Your use of and access to the Service, including any data or content transmitted or received by you</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Your violation of any term of these Terms</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Your violation of any third-party right, including without limitation any copyright, property, or privacy right</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Any claim that your use of the Service caused damage to a third party</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Any content you submit, post, transmit, or make available through the Service</span>
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-6">
                  This defense and indemnification obligation will survive these Terms and your use of the Service.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 14. Termination */}
            <section id="termination" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FileWarning className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">14. Termination</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <h3 className="text-lg font-medium text-foreground mb-3">Termination by You</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You may terminate your account at any time by following the account deletion process in your account settings or by contacting us. Upon termination, your right to use the Service will immediately cease.
                </p>
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Termination by Us</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms. We reserve the right to refuse service to anyone for any reason at any time.
                </p>
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Effect of Termination</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Upon termination, your access to the Service will be immediately revoked.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We will retain your data for a reasonable period in accordance with our data retention policy and applicable law.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You may request deletion of your data at any time prior to or after account termination.</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 15. Changes to Terms */}
            <section id="changes-terms" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">15. Changes to Terms</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days&apos; notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, you are no longer authorized to use the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We encourage you to review these Terms periodically for any changes. Changes to these Terms are effective when they are posted on this page.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 16. Governing Law */}
            <section id="governing-law" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">16. Governing Law</h2>
              </div>
              <div className="prose prose-gray max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed and construed in accordance with the laws of [JURISDICTION], without regard to its conflict of law provisions.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms constitute the entire agreement between us regarding our Service, and supersede and replace any prior agreements we might have had between us regarding the Service.
                </p>
                <div className="p-4 bg-muted/50 border border-border rounded-xl mt-6">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Please update the jurisdiction placeholder [JURISDICTION] with your actual governing law jurisdiction (e.g., &quot;the State of California, United States&quot; or &quot;England and Wales&quot;) based on your business registration and legal requirements.
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* 17. Contact Information */}
            <section id="contact" className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">17. Contact Information</h2>
              </div>
              <div className="p-6 bg-muted/50 border border-border rounded-xl">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have any questions about these Terms, please contact us:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">Email:</span>
                    <a 
                      href="mailto:legal@replifyai.app" 
                      className="text-primary hover:underline font-medium"
                    >
                      legal@replifyai.app
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">Support:</span>
                    <a 
                      href="mailto:support@replifyai.app" 
                      className="text-primary hover:underline font-medium"
                    >
                      support@replifyai.app
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-foreground font-medium">Address:</span>
                    <span className="text-muted-foreground">[Your Business Address]</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  We aim to respond to all inquiries within 48 business hours.
                </p>
              </div>
            </section>

          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
