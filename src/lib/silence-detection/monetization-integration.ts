import { 
  SilenceDetectionResult, 
  FollowUpRule, 
  MonetizationFlags,
  ProcessingContext 
} from './types';
import { getSupabaseClient } from '@/integrations/supabase/client';

export class MonetizationIntegration {
  private readonly AUTO_SEND_CONFIDENCE_THRESHOLD = 0.85;
  private readonly PRO_PLAN_MAX_THREADS = 1000;
  private readonly ENTERPRISE_PLAN_MAX_THREADS = 10000;

  /**
   * Evaluates monetization flags for a silence detection result
   */
  evaluateMonetizationFlags(
    result: SilenceDetectionResult,
    userPlan: 'free' | 'pro' | 'enterprise',
    userStats: UserStats
  ): MonetizationFlags {
    const autoSendReady = this.isAutoSendReady(result, userPlan);
    const requiresUpgrade = this.requiresUpgrade(userPlan, userStats, result);
    const featureGates = this.getFeatureGates(userPlan, result);
    const upgradePrompt = this.generateUpgradePrompt(userPlan, requiresUpgrade, result);

    return {
      autoSendReady,
      requiresUpgrade,
      featureGates,
      upgradePrompt
    };
  }

  /**
   * Determines if auto-send is ready for this user
   */
  private isAutoSendReady(
    result: SilenceDetectionResult,
    userPlan: 'free' | 'pro' | 'enterprise'
  ): boolean {
    // Free plans never get auto-send
    if (userPlan === 'free') {
      return false;
    }

    // Must meet confidence threshold
    if (result.confidenceScore < this.AUTO_SEND_CONFIDENCE_THRESHOLD) {
      return false;
    }

    // Must be eligible
    if (!result.isEligible) {
      return false;
    }

    // Pro and Enterprise plans get auto-send if confidence is high
    return userPlan === 'pro' || userPlan === 'enterprise';
  }

  /**
   * Determines if user needs to upgrade
   */
  private requiresUpgrade(
    userPlan: 'free' | 'pro' | 'enterprise',
    userStats: UserStats,
    result: SilenceDetectionResult
  ): boolean {
    // Free users always need upgrade for auto-send
    if (userPlan === 'free' && result.autoSendReady) {
      return true;
    }

    // Check thread limits
    const maxThreads = this.getMaxThreadsForPlan(userPlan);
    if (userStats.totalThreads >= maxThreads) {
      return true;
    }

    // Pro users might need enterprise for advanced features
    if (userPlan === 'pro' && userStats.totalThreads >= this.PRO_PLAN_MAX_THREADS * 0.8) {
      return true;
    }

    return false;
  }

  /**
   * Gets feature gates for the user's plan
   */
  private getFeatureGates(
    userPlan: 'free' | 'pro' | 'enterprise',
    result: SilenceDetectionResult
  ): string[] {
    const gates: string[] = [];

    switch (userPlan) {
      case 'free':
        gates.push('manual_only', 'basic_insights', 'limited_threads');
        if (result.confidenceScore >= this.AUTO_SEND_CONFIDENCE_THRESHOLD) {
          gates.push('auto_send_upgrade_prompt');
        }
        break;

      case 'pro':
        gates.push('auto_send_enabled', 'advanced_insights', 'custom_timing');
        if (result.confidenceScore >= 0.95) {
          gates.push('high_confidence_features');
        }
        break;

      case 'enterprise':
        gates.push('auto_send_enabled', 'advanced_insights', 'custom_timing', 
                 'api_access', 'priority_support', 'unlimited_threads');
        break;
    }

    return gates;
  }

  /**
   * Generates contextual upgrade prompt
   */
  private generateUpgradePrompt(
    userPlan: 'free' | 'pro' | 'enterprise',
    requiresUpgrade: boolean,
    result: SilenceDetectionResult
  ): string {
    if (!requiresUpgrade) {
      return '';
    }

    const confidence = Math.round(result.confidenceScore * 100);
    const subject = result.subject;

    switch (userPlan) {
      case 'free':
        if (result.autoSendReady) {
          return `🚀 Ready for automatic follow-up! Upgrade to Pro to enable auto-send for "${subject}" with ${confidence}% confidence.`;
        }
        return `Unlock unlimited follow-ups and advanced insights with Pro plan.`;

      case 'pro':
        if (result.confidenceScore >= 0.95) {
          return `🎯 Ultra-high confidence (${confidence}%) detected! Upgrade to Enterprise for priority processing and advanced analytics.`;
        }
        return `Approaching thread limits. Upgrade to Enterprise for unlimited processing.`;

      case 'enterprise':
        return '';

      default:
        return 'Upgrade your plan to unlock more features.';
    }
  }

  /**
   * Gets maximum threads allowed for a plan
   */
  private getMaxThreadsForPlan(plan: 'free' | 'pro' | 'enterprise'): number {
    switch (plan) {
      case 'free':
        return 100;
      case 'pro':
        return this.PRO_PLAN_MAX_THREADS;
      case 'enterprise':
        return this.ENTERPRISE_PLAN_MAX_THREADS;
      default:
        return 100;
    }
  }

  /**
   * Tracks monetization events
   */
  async trackMonetizationEvent(
    userId: string,
    eventType: 'auto_send_ready' | 'upgrade_prompt_shown' | 'feature_gate_hit' | 'limit_reached',
    metadata: {
      threadId?: string;
      confidenceScore?: number;
      plan?: string;
      feature?: string;
      limit?: string;
    }
  ): Promise<void> {
    try {
      await getSupabaseClient()
        .from('monetization_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error tracking monetization event:', error);
      // Don't throw - tracking failure shouldn't stop the main process
    }
  }

  /**
   * Calculates revenue impact for a thread
   */
  calculateRevenueImpact(
    result: SilenceDetectionResult,
    userPlan: 'free' | 'pro' | 'enterprise'
  ): {
    immediateValue: number;
    potentialValue: number;
    upgradeProbability: number;
    recommendedAction: string;
  } {
    const confidence = result.confidenceScore;
    const baseValue = this.getBaseValueForConfidence(confidence);
    
    let immediateValue = 0;
    let potentialValue = baseValue;
    let upgradeProbability = 0;
    let recommendedAction = 'monitor';

    // Free users: high confidence = upgrade opportunity
    if (userPlan === 'free' && confidence >= this.AUTO_SEND_CONFIDENCE_THRESHOLD) {
      immediateValue = 0;
      potentialValue = baseValue * 2; // Pro plan value
      upgradeProbability = Math.min(0.8, confidence);
      recommendedAction = 'prompt_upgrade';
    }

    // Pro users: very high confidence = enterprise opportunity
    if (userPlan === 'pro' && confidence >= 0.95) {
      immediateValue = baseValue;
      potentialValue = baseValue * 3; // Enterprise plan value
      upgradeProbability = Math.min(0.4, (confidence - 0.9) * 4);
      recommendedAction = 'suggest_enterprise';
    }

    // Enterprise users: focus on retention
    if (userPlan === 'enterprise') {
      immediateValue = baseValue * 2;
      potentialValue = immediateValue;
      upgradeProbability = 0;
      recommendedAction = 'retain';
    }

    return {
      immediateValue,
      potentialValue,
      upgradeProbability,
      recommendedAction
    };
  }

  /**
   * Gets base value based on confidence score
   */
  private getBaseValueForConfidence(confidence: number): number {
    if (confidence >= 0.95) return 50; // $50 value for very high confidence
    if (confidence >= 0.85) return 25; // $25 value for high confidence
    if (confidence >= 0.75) return 10; // $10 value for medium confidence
    return 5; // $5 value for low confidence
  }

  /**
   * Gets user statistics for monetization decisions
   */
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const [threadsResult, followupsResult, settingsResult] = await Promise.all([
        supabase
          .from('email_threads')
          .select('id, needs_followup, last_message_at')
          .eq('user_id', userId),
        
        supabase
          .from('followup_suggestions')
          .select('id, status, sent_at')
          .eq('user_id', userId),
        
        supabase
          .from('user_settings')
          .select('followup_delay_days, auto_scan_enabled')
          .eq('user_id', userId)
          .single()
      ]);

      const totalThreads = threadsResult.data?.length || 0;
      const eligibleThreads = threadsResult.data?.filter(t => t.needs_followup).length || 0;
      const sentFollowups = followupsResult.data?.filter(f => f.status === 'sent').length || 0;
      const autoSendEnabled = settingsResult.data?.auto_scan_enabled || false;

      return {
        totalThreads,
        eligibleThreads,
        sentFollowups,
        autoSendEnabled,
        averageConfidence: 0.8, // Would be calculated from actual data
        lastActivity: threadsResult.data?.[0]?.last_message_at ? 
          new Date(threadsResult.data[0].last_message_at) : new Date()
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalThreads: 0,
        eligibleThreads: 0,
        sentFollowups: 0,
        autoSendEnabled: false,
        averageConfidence: 0,
        lastActivity: new Date()
      };
    }
  }

  /**
   * Creates upgrade recommendation based on user behavior
   */
  createUpgradeRecommendation(
    userStats: UserStats,
    userPlan: 'free' | 'pro' | 'enterprise',
    recentResults: SilenceDetectionResult[]
  ): {
    recommendedPlan: 'free' | 'pro' | 'enterprise';
    reasons: string[];
    urgency: 'low' | 'medium' | 'high';
    estimatedValue: number;
  } {
    const reasons: string[] = [];
    let urgency: 'low' | 'medium' | 'high' = 'low';
    let estimatedValue = 0;

    // Analyze recent high-confidence results
    const highConfidenceResults = recentResults.filter(r => r.confidenceScore >= this.AUTO_SEND_CONFIDENCE_THRESHOLD);
    const veryHighConfidenceResults = recentResults.filter(r => r.confidenceScore >= 0.95);

    // Free user analysis
    if (userPlan === 'free') {
      if (highConfidenceResults.length >= 3) {
        reasons.push(`${highConfidenceResults.length} high-confidence follow-ups ready for automation`);
        urgency = 'medium';
        estimatedValue = highConfidenceResults.length * 25; // Pro plan value
      }

      if (userStats.totalThreads >= 80) {
        reasons.push('Approaching free plan thread limit');
        urgency = 'high';
        estimatedValue += 50;
      }

      if (userStats.eligibleThreads >= 10) {
        reasons.push('High volume of follow-up opportunities');
        urgency = 'medium';
        estimatedValue += 30;
      }

      return {
        recommendedPlan: urgency === 'high' ? 'pro' : 'free',
        reasons,
        urgency,
        estimatedValue
      };
    }

    // Pro user analysis
    if (userPlan === 'pro') {
      if (veryHighConfidenceResults.length >= 5) {
        reasons.push(`${veryHighConfidenceResults.length} ultra-high confidence opportunities`);
        urgency = 'medium';
        estimatedValue = veryHighConfidenceResults.length * 50; // Enterprise value
      }

      if (userStats.totalThreads >= this.PRO_PLAN_MAX_THREADS * 0.8) {
        reasons.push('Approaching Pro plan limits');
        urgency = 'high';
        estimatedValue += 100;
      }

      if (userStats.sentFollowups >= 50) {
        reasons.push('Heavy usage - Enterprise features would be beneficial');
        urgency = 'medium';
        estimatedValue += 75;
      }

      return {
        recommendedPlan: urgency === 'high' || estimatedValue > 150 ? 'enterprise' : 'pro',
        reasons,
        urgency,
        estimatedValue
      };
    }

    // Enterprise users - focus on retention
    return {
      recommendedPlan: 'enterprise',
      reasons: ['Maximum value plan'],
      urgency: 'low',
      estimatedValue: userStats.totalThreads * 10
    };
  }

  /**
   * Formats monetization insights for UI display
   */
  formatMonetizationInsights(
    flags: MonetizationFlags,
    revenueImpact: any,
    userPlan: 'free' | 'pro' | 'enterprise'
  ): {
    title: string;
    description: string;
    actionItems: string[];
    valueProposition: string;
  } {
    const title = flags.requiresUpgrade ? 'Upgrade Opportunity' : 'Current Plan Features';
    
    let description = '';
    let actionItems: string[] = [];
    let valueProposition = '';

    if (flags.requiresUpgrade) {
      description = flags.upgradePrompt;
      actionItems = ['Upgrade plan', 'Enable advanced features', 'Increase limits'];
      valueProposition = `Unlock $${revenueImpact.potentialValue} in potential value`;
    } else {
      switch (userPlan) {
        case 'free':
          description = 'Basic follow-up tracking enabled';
          actionItems = ['Review suggestions manually', 'Monitor thread activity'];
          valueProposition = 'Core features available';
          break;
        case 'pro':
          description = 'Advanced follow-up automation active';
          actionItems = ['Monitor auto-send performance', 'Adjust timing settings'];
          valueProposition = 'Professional automation features';
          break;
        case 'enterprise':
          description = 'Full-featured follow-up system';
          actionItems = ['Optimize automation rules', 'Utilize API access'];
          valueProposition = 'Maximum productivity and insights';
          break;
      }
    }

    return {
      title,
      description,
      actionItems,
      valueProposition
    };
  }
}

interface UserStats {
  totalThreads: number;
  eligibleThreads: number;
  sentFollowups: number;
  autoSendEnabled: boolean;
  averageConfidence: number;
  lastActivity: Date;
}
