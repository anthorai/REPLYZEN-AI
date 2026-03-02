export interface FollowUp {
  id: string;
  subject: string;
  recipient: string;
  daysSince: number;
  priority: "Low" | "Medium" | "High";
  aiDraft: string;
}

export const mockFollowups: FollowUp[] = [
  {
    id: "1",
    subject: "Website Redesign Proposal",
    recipient: "client@example.com",
    daysSince: 4,
    priority: "High",
    aiDraft:
      "Hi John, just following up on the website redesign proposal I shared last week. I'd love to hear your thoughts and discuss any questions you might have. Let me know a good time to connect.",
  },
  {
    id: "2",
    subject: "Partnership Opportunity — Q2 Campaign",
    recipient: "partnerships@acmecorp.com",
    daysSince: 3,
    priority: "Medium",
    aiDraft:
      "Hi Sarah, wanted to circle back on the Q2 campaign partnership we discussed. We're finalizing our plans soon and would love to include your team. Any updates on your end?",
  },
  {
    id: "3",
    subject: "Invoice #2847 — Payment Reminder",
    recipient: "accounting@clientfirm.com",
    daysSince: 7,
    priority: "High",
    aiDraft:
      "Hello, I wanted to follow up regarding Invoice #2847 sent on the 5th. Could you confirm receipt and let me know the expected payment timeline? Happy to resend if needed.",
  },
  {
    id: "4",
    subject: "Meeting Notes — Product Sync",
    recipient: "team@startup.io",
    daysSince: 2,
    priority: "Low",
    aiDraft:
      "Hey Alex, sharing the notes from our product sync earlier this week. Let me know if I missed anything or if there are action items you'd like to add.",
  },
  {
    id: "5",
    subject: "Feedback Request — Beta Release",
    recipient: "beta@earlyuser.com",
    daysSince: 5,
    priority: "Medium",
    aiDraft:
      "Hi there, hope you've had a chance to explore the beta! We'd really appreciate any feedback you can share — even quick impressions are helpful. Thanks for being an early tester.",
  },
];
