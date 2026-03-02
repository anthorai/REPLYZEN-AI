import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/LandingFooter";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "How does Replify AI detect no replies?",
    a: "Replify AI connects to your Gmail and analyzes your sent emails. When the last message in a thread is from you and no reply has been received for your configured delay period (1–10 days), it flags the conversation as needing a follow-up and generates an AI draft for you to review.",
  },
  {
    q: "Does it automatically send emails?",
    a: "On the Free plan, follow-ups are never sent automatically. You always review and approve each email before it goes out. On Pro and Business plans, you can optionally enable auto-send, but this is a setting you control—you can turn it off anytime.",
  },
  {
    q: "Is my Gmail data secure?",
    a: "Yes. We use OAuth 2.0 to connect to Gmail—we never see or store your password. All data is encrypted at rest and in transit. We only access what’s needed to detect no-reply conversations and generate follow-up drafts.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription at any time. You’ll continue to have access until the end of your billing period, and your account will revert to the Free plan afterward.",
  },
  {
    q: "What happens if I exceed follow-up limits?",
    a: "If you hit your plan’s monthly follow-up limit, you’ll see a message asking you to upgrade. No follow-ups will be generated until the next billing cycle or until you upgrade. You can always check your usage in the Profile page.",
  },
  {
    q: "Does it support Outlook or Zoho?",
    a: "Currently Replify AI supports Gmail only. Support for Outlook and Zoho is on our roadmap. If you'd like to be notified when we add these integrations, contact us from the About page.",
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-16">
            Frequently Asked Questions
          </h1>

          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-xl border border-border bg-card px-4"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Still have questions?
            </p>
            <Link to="/login">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default FAQ;
