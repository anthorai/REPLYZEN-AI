import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/integrations/supabase/server';
import { DashboardSummary } from '@/components/dashboard/types';

// Cache for dashboard summary (updated by background workers)
let cachedSummary: DashboardSummary | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedSummary && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cachedSummary,
        timestamp: new Date(),
        cacheHit: true
      });
    }

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userId = user.id;

    // Get user profile and plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, email')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 });
    }

    // Check connected email accounts
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (accountsError) {
      console.error('Error fetching email accounts:', accountsError);
    }

    const connectedAccounts = emailAccounts?.length || 0;
    const syncStatus = connectedAccounts === 0 ? 'no_accounts' : 'synced';

    if (connectedAccounts === 0) {
      // Return empty state for users with no connected accounts
      const emptySummary: DashboardSummary = {
        needsActionCount: 0,
        needsActionThreads: [],
        autoSentCount24h: 0,
        autoSentLogs: [],
        waitingCount: 0,
        waitingThreads: [],
        usageCurrent: 0,
        usageLimit: profile.plan === 'free' ? 50 : profile.plan === 'pro' ? 2000 : 10000,
        autoSendEnabled: profile.plan !== 'free',
        userPlan: profile.plan as 'free' | 'pro' | 'enterprise',
        syncStatus,
        connectedAccounts: 0,
        lastSyncAt: new Date()
      };

      cachedSummary = emptySummary;
      cacheTimestamp = now;

      return NextResponse.json({
        success: true,
        data: emptySummary,
        timestamp: new Date(),
        cacheHit: false
      });
    }

    // Get dashboard summary from cached table or compute on-the-fly
    const summary = await getDashboardSummary(userId, profile.plan as 'free' | 'pro' | 'enterprise');

    // Cache the result
    cachedSummary = summary;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      data: summary,
      timestamp: new Date(),
      cacheHit: false
    });

  } catch (error) {
    console.error('Dashboard summary API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function getDashboardSummary(
  userId: string, 
  plan: 'free' | 'pro' | 'enterprise'
): Promise<DashboardSummary> {
  const supabase = createClient();

  // Get usage limits
  const usageLimits = {
    free: 50,
    pro: 2000,
    enterprise: 10000
  };

  const usageLimit = usageLimits[plan];

  // Get current month usage
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { data: usageData, error: usageError } = await supabase
    .from('followup_suggestions')
    .select('id, created_at')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  const usageCurrent = usageData?.length || 0;

  // Get threads needing action (not auto-sent, eligible for follow-up)
  const { data: actionThreads, error: actionError } = await supabase
    .from('email_threads')
    .select(`
      id,
      subject,
      last_message_from,
      last_message_at,
      needs_followup,
      followup_suggestions(id, created_at, auto_send_safe, status)
    `)
    .eq('user_id', userId)
    .eq('needs_followup', true)
    .is('followup_suggestions.status', 'null')
    .order('last_message_at', { ascending: true })
    .limit(5);

  // Get auto-sent threads from last 24 hours
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const { data: autoSentThreads, error: autoSentError } = await supabase
    .from('followup_suggestions')
    .select(`
      id,
      email_threads!inner(subject, last_message_at),
      created_at,
      auto_send_safe,
      status
    `)
    .eq('user_id', userId)
    .eq('auto_send_safe', true)
    .eq('status', 'sent')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  // Get waiting threads (in silence window but not yet eligible)
  const { data: waitingThreads, error: waitingError } = await supabase
    .from('email_threads')
    .select(`
      id,
      subject,
      last_message_from,
      last_message_at,
      needs_followup
    `)
    .eq('user_id', userId)
    .eq('needs_followup', false)
    .gt('last_message_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() // Last 7 days
    .order('last_message_at', { ascending: true })
    .limit(5);

  // Transform data for dashboard
  const needsActionThreads = (actionThreads || []).map(thread => ({
    id: thread.id,
    threadId: thread.id,
    subject: thread.subject,
    recipientName: extractNameFromEmail(thread.last_message_from),
    recipientEmail: thread.last_message_from,
    silenceDuration: Math.floor((now.getTime() - new Date(thread.last_message_at).getTime()) / (1000 * 60 * 60)),
    suggestedAction: 'Follow up needed',
    priority: getPriorityFromSilence(Math.floor((now.getTime() - new Date(thread.last_message_at).getTime()) / (1000 * 60 * 60))),
    createdAt: new Date(thread.last_message_at)
  }));

  const autoSentLogs = (autoSentThreads || []).map(log => ({
    id: log.id,
    threadId: log.email_threads.id,
    subject: log.email_threads.subject,
    recipientName: 'Unknown', // Would need to extract from thread data
    sentAt: new Date(log.created_at),
    silenceDuration: 0, // Would need to calculate from thread data
    status: 'sent' as const,
    autoSendSafe: log.auto_send_safe
  }));

  const waitingThreadsList = (waitingThreads || []).map(thread => {
    const silenceHours = Math.floor((now.getTime() - new Date(thread.last_message_at).getTime()) / (1000 * 60 * 60));
    const followUpRule = 72; // Default rule - would get from user settings
    const daysRemaining = Math.max(0, Math.ceil((followUpRule - silenceHours) / 24));
    
    return {
      id: thread.id,
      threadId: thread.id,
      subject: thread.subject,
      recipientName: extractNameFromEmail(thread.last_message_from),
      daysRemaining,
      followUpDate: new Date(new Date(thread.last_message_at).getTime() + followUpRule * 60 * 60 * 1000),
      priority: 'medium' as const
    };
  });

  return {
    needsActionCount: needsActionThreads.length,
    needsActionThreads,
    autoSentCount24h: autoSentLogs.length,
    autoSentLogs,
    waitingCount: waitingThreadsList.length,
    waitingThreads: waitingThreadsList,
    usageCurrent,
    usageLimit,
    autoSendEnabled: plan !== 'free',
    userPlan: plan,
    syncStatus: 'synced',
    connectedAccounts: 1, // Would get from actual count
    lastSyncAt: new Date()
  };
}

// Helper functions
function extractNameFromEmail(email: string): string {
  const match = email.match(/^"?([^"]+)"?\s*<([^>]+)>$/);
  if (match) {
    return match[1].trim();
  }
  
  const emailMatch = email.match(/<([^>]+)>/);
  if (emailMatch) {
    const emailAddr = emailMatch[1];
    const localPart = emailAddr.split('@')[0];
    return localPart.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return email;
}

function getPriorityFromSilence(silenceHours: number): 'high' | 'medium' | 'low' {
  if (silenceHours >= 7) return 'high';
  if (silenceHours >= 3) return 'medium';
  return 'low';
}
