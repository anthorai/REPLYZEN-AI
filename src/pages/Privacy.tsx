import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/LandingFooter";
import { Shield, Database, FileText, Lock, Clock, Users, Mail, AlertCircle } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/20 border-b border-border">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Your trust matters. Here&apos;s how we protect your information and respect your privacy.
            </p>
            <p className="mt-4 text-sm text-muted-foreground/70">
              Last Updated: February 27, 2026
            </p>
          </div>
        </section>

        {/* Main Content */}
        <div className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            
            {/* Introduction */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Introduction</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed text-base">
                  At Replify AI, we respect your privacy and are committed to protecting your personal data. 
                  This Privacy Policy explains how we collect, use, store, and safeguard your information when 
                  you use our email follow-up automation service. By using Replify AI, you consent to the 
                  practices described in this policy.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Information We Collect */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Information We Collect</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Account Information</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    When you sign up, we collect your email address and authentication credentials through 
                    secure OAuth providers like Google. We do not store passwords.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Email Metadata</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    To identify conversations needing follow-ups, we access email metadata including subject 
                    lines, sender information, timestamps, and thread IDs. We do not store full email bodies 
                    or attachments.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Generated Content</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    AI-generated follow-up drafts are stored temporarily so you can review, edit, and approve 
                    them before sending.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-3">Usage Data</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We collect anonymous usage statistics to improve our service, including feature usage 
                    patterns and performance metrics. This data cannot identify you personally.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-800 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Important: We do not sell your data. We do not store full email content permanently. 
                  Your data is used solely to provide the follow-up automation service.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* How We Use Your Information */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">How We Use Your Information</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use the information we collect for the following purposes:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Detect no-reply conversations</strong> — Identify email threads where you&apos;re waiting for a response</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Generate follow-up drafts</strong> — Create personalized, context-aware follow-up suggestions using AI</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Send with your permission only</strong> — We never send emails without your explicit review and approval</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Provide analytics</strong> — Show insights about your follow-up activity and response rates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Improve our service</strong> — Analyze usage patterns to enhance features and user experience</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Google API Data Usage */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Google API Data Usage</h2>
              </div>
              
              <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl mb-6">
                <p className="text-foreground font-medium text-sm leading-relaxed">
                  Replify AI&apos;s use of information received from Google APIs will adhere to the{" "}
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

              <div className="prose prose-gray max-w-none">
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We only access Gmail data with your explicit consent through OAuth authorization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We do not transfer Google user data to third parties except as necessary to provide our services</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We do not use Google user data for advertising purposes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We only use Gmail data to provide the email follow-up functionality you request</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You can revoke our access to your Gmail data at any time through your Google Account settings</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Data Security */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Data Security</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We implement industry-standard security measures to protect your data:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">OAuth 2.0 Authentication</strong> — Secure, password-less access using industry-standard protocols</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Encryption at Rest</strong> — All stored data is encrypted using AES-256 encryption</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">TLS Encryption</strong> — All data transmission occurs over HTTPS with TLS 1.3</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Access Controls</strong> — Strict role-based access controls limit who can access production systems</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Regular Security Audits</strong> — We conduct periodic security reviews and penetration testing</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Data Retention and Deletion */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Data Retention and Deletion</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You have control over your data:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>You may delete your account and all associated data at any time through your account settings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>Upon account deletion, all personal data is permanently removed within 30 days</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>OAuth tokens can be revoked instantly through your Google Account security settings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span>We retain only anonymized analytics data that cannot identify you personally</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Data Sharing */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Data Sharing</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We do not sell, trade, or rent your personal information to third parties. We may share 
                  data only in the following limited circumstances:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Service Providers</strong> — Trusted third parties who assist in operating our service (e.g., cloud infrastructure, AI services) under strict confidentiality agreements</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Legal Requirements</strong> — When required by law, court order, or governmental regulation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Business Transfers</strong> — In connection with a merger, acquisition, or sale of assets, with notice to users</span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Your Rights */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Your Rights</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Depending on your location, you may have the following rights regarding your personal data:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Access</strong> — Request a copy of the personal data we hold about you</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Correction</strong> — Request that we correct inaccurate or incomplete data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Deletion</strong> — Request deletion of your personal data (right to be forgotten)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Portability</strong> — Request transfer of your data to another service</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                    <span><strong className="text-foreground">Objection</strong> — Object to certain types of data processing</span>
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  To exercise any of these rights, please contact us using the information below.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Changes to This Policy */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Changes to This Policy</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time to reflect changes in our practices, 
                  technologies, or legal requirements. We will notify users of any material changes by 
                  posting the updated policy on this page with a revised &quot;Last Updated&quot; date. 
                  We encourage you to review this policy periodically. Continued use of Replify AI 
                  after any changes constitutes acceptance of the updated policy.
                </p>
              </div>
            </section>

            <div className="border-t border-border my-12" />

            {/* Contact Information */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Contact Information</h2>
              </div>
              <div className="p-6 bg-muted/50 border border-border rounded-xl">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our 
                  data practices, please contact us:
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">Email:</span>
                  <a 
                    href="mailto:privacy@replifyai.app" 
                    className="text-primary hover:underline font-medium"
                  >
                    privacy@replifyai.app
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  We aim to respond to all privacy-related inquiries within 48 hours.
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
