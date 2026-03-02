-- Dashboard Schema for Replyzen
-- Optimized tables for fast dashboard loading

-- Dashboard summary cache table
CREATE TABLE IF NOT EXISTS dashboard_summary_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    needs_action_count INTEGER DEFAULT 0,
    auto_sent_count_24h INTEGER DEFAULT 0,
    waiting_count INTEGER DEFAULT 0,
    usage_current INTEGER DEFAULT 0,
    usage_limit INTEGER DEFAULT 0,
    auto_send_enabled BOOLEAN DEFAULT FALSE,
    user_plan TEXT NOT NULL CHECK (user_plan IN ('free', 'pro', 'enterprise')),
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'syncing', 'error', 'no_accounts')),
    connected_accounts INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cache_data JSONB, -- Detailed thread data
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for one cache entry per user
    UNIQUE(user_id),
    
    -- Indexes for performance
    INDEX idx_dashboard_cache_user (user_id),
    INDEX idx_dashboard_cache_expires (expires_at),
    INDEX idx_dashboard_cache_updated (updated_at DESC)
);

-- Dashboard usage tracking
CREATE TABLE IF NOT EXISTS dashboard_usage_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    followups_generated INTEGER DEFAULT 0,
    followups_sent INTEGER DEFAULT 0,
    followups_auto_sent INTEGER DEFAULT 0,
    manual_sends INTEGER DEFAULT 0,
    auto_send_sends INTEGER DEFAULT 0,
    response_rate DECIMAL(5,4) DEFAULT 0,
    average_response_time_hours DECIMAL(8,2) DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for daily tracking per user
    UNIQUE(user_id, date),
    
    -- Indexes for performance
    INDEX idx_usage_tracking_user_date (user_id, date DESC),
    INDEX idx_usage_tracking_date (date DESC),
    INDEX idx_usage_tracking_plan (plan)
);

-- Dashboard thread snapshots for fast loading
CREATE TABLE IF NOT EXISTS dashboard_thread_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    thread_type TEXT NOT NULL CHECK (thread_type IN ('action', 'auto_sent', 'waiting')),
    subject TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    silence_duration_hours INTEGER,
    suggested_action TEXT,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    days_remaining INTEGER,
    follow_up_date TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('sent', 'delivered', 'opened', 'clicked')),
    auto_send_safe BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Indexes for performance
    INDEX idx_thread_snapshots_user_type (user_id, thread_type),
    INDEX idx_thread_snapshots_expires (expires_at),
    INDEX idx_thread_snapshots_priority (priority),
    INDEX idx_thread_snapshots_created (created_at DESC)
);

-- Dashboard performance metrics
CREATE TABLE IF NOT EXISTS dashboard_performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    average_response_time_ms DECIMAL(8,2) DEFAULT 0,
    slow_queries INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for daily metrics
    UNIQUE(date),
    
    -- Indexes for performance
    INDEX idx_performance_metrics_date (date DESC),
    INDEX idx_performance_metrics_created (created_at DESC)
);

-- Enable Row Level Security for new tables
ALTER TABLE dashboard_summary_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_thread_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own dashboard cache" ON dashboard_summary_cache
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own dashboard cache" ON dashboard_summary_cache
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own usage tracking" ON dashboard_usage_tracking
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own usage tracking" ON dashboard_usage_tracking
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own thread snapshots" ON dashboard_thread_snapshots
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own thread snapshots" ON dashboard_thread_snapshots
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "System can view performance metrics" ON dashboard_performance_metrics
    FOR SELECT USING (auth.uid()::text IS NULL);

-- Functions for dashboard data aggregation

-- Function to update dashboard cache
CREATE OR REPLACE FUNCTION update_dashboard_cache(user_id_param TEXT)
RETURNS VOID AS $$
DECLARE
    user_plan TEXT;
    usage_limit INTEGER;
    usage_current INTEGER;
    needs_action_count INTEGER;
    auto_sent_count_24h INTEGER;
    waiting_count INTEGER;
    auto_send_enabled BOOLEAN;
    connected_accounts INTEGER;
    cache_data JSONB;
    expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get user plan and limits
    SELECT p.plan INTO user_plan
    FROM profiles p
    WHERE p.user_id = user_id_param;
    
    -- Set usage limits based on plan
    usage_limit := CASE user_plan
        WHEN 'free' THEN 50
        WHEN 'pro' THEN 2000
        WHEN 'enterprise' THEN 10000
        ELSE 50
    END;
    
    -- Get current month usage
    SELECT COUNT(*) INTO usage_current
    FROM followup_suggestions fs
    WHERE fs.user_id = user_id_param
      AND fs.created_at >= DATE_TRUNC('month', CURRENT_DATE);
    
    -- Get connected accounts count
    SELECT COUNT(*) INTO connected_accounts
    FROM email_accounts ea
    WHERE ea.user_id = user_id_param
      AND ea.is_active = true;
    
    -- Auto-send enabled for non-free plans
    auto_send_enabled := user_plan != 'free';
    
    -- Count threads needing action
    SELECT COUNT(*) INTO needs_action_count
    FROM email_threads et
    WHERE et.user_id = user_id_param
      AND et.needs_followup = true
      AND NOT EXISTS (
        SELECT 1 FROM followup_suggestions fs 
        WHERE fs.thread_id = et.id 
        AND fs.status IS NOT NULL
      );
    
    -- Count auto-sent in last 24 hours
    SELECT COUNT(*) INTO auto_sent_count_24h
    FROM followup_suggestions fs
    WHERE fs.user_id = user_id_param
      AND fs.auto_send_safe = true
      AND fs.status = 'sent'
      AND fs.created_at >= NOW() - INTERVAL '24 hours';
    
    -- Count waiting threads
    SELECT COUNT(*) INTO waiting_count
    FROM email_threads et
    WHERE et.user_id = user_id_param
      AND et.needs_followup = false
      AND et.last_message_at >= NOW() - INTERVAL '7 days';
    
    -- Build cache data with thread details
    cache_data := json_build_object(
        'needs_action_threads', (
            SELECT json_agg(
                json_build_object(
                    'id', et.id,
                    'threadId', et.id,
                    'subject', et.subject,
                    'recipientName', COALESCE(
                        SPLIT_PART(SPLIT_PART(et.last_message_from, '"', 2), '"', 1),
                        SPLIT_PART(et.last_message_from, '@', 1)
                    ),
                    'recipientEmail', et.last_message_from,
                    'silenceDuration', EXTRACT(EPOCH FROM (NOW() - et.last_message_at)) / 3600,
                    'suggestedAction', 'Follow up needed',
                    'priority', CASE 
                        WHEN EXTRACT(EPOCH FROM (NOW() - et.last_message_at)) / 3600 >= 7 THEN 'high'
                        WHEN EXTRACT(EPOCH FROM (NOW() - et.last_message_at)) / 3600 >= 3 THEN 'medium'
                        ELSE 'low'
                    END,
                    'createdAt', et.last_message_at
                )
            )
            FROM email_threads et
            WHERE et.user_id = user_id_param
              AND et.needs_followup = true
              AND NOT EXISTS (
                SELECT 1 FROM followup_suggestions fs 
                WHERE fs.thread_id = et.id 
                AND fs.status IS NOT NULL
              )
            ORDER BY et.last_message_at ASC
            LIMIT 5
        ),
        'auto_sent_logs', (
            SELECT json_agg(
                json_build_object(
                    'id', fs.id,
                    'threadId', fs.thread_id,
                    'subject', et.subject,
                    'recipientName', COALESCE(
                        SPLIT_PART(SPLIT_PART(et.last_message_from, '"', 2), '"', 1),
                        SPLIT_PART(et.last_message_from, '@', 1)
                    ),
                    'sentAt', fs.created_at,
                    'silenceDuration', 0,
                    'status', 'sent',
                    'autoSendSafe', fs.auto_send_safe
                )
            )
            FROM followup_suggestions fs
            JOIN email_threads et ON fs.thread_id = et.id
            WHERE fs.user_id = user_id_param
              AND fs.auto_send_safe = true
              AND fs.status = 'sent'
              AND fs.created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY fs.created_at DESC
            LIMIT 5
        ),
        'waiting_threads', (
            SELECT json_agg(
                json_build_object(
                    'id', et.id,
                    'threadId', et.id,
                    'subject', et.subject,
                    'recipientName', COALESCE(
                        SPLIT_PART(SPLIT_PART(et.last_message_from, '"', 2), '"', 1),
                        SPLIT_PART(et.last_message_from, '@', 1)
                    ),
                    'daysRemaining', GREATEST(0, CEIL((72 - EXTRACT(EPOCH FROM (NOW() - et.last_message_at)) / 3600) / 24)),
                    'followUpDate', et.last_message_at + INTERVAL '72 hours',
                    'priority', 'medium'
                )
            )
            FROM email_threads et
            WHERE et.user_id = user_id_param
              AND et.needs_followup = false
              AND et.last_message_at >= NOW() - INTERVAL '7 days'
            ORDER BY et.last_message_at ASC
            LIMIT 5
        )
    );
    
    -- Set expiration (30 minutes from now)
    expires_at := NOW() + INTERVAL '30 minutes';
    
    -- Update or insert cache
    INSERT INTO dashboard_summary_cache (
        user_id,
        needs_action_count,
        auto_sent_count_24h,
        waiting_count,
        usage_current,
        usage_limit,
        auto_send_enabled,
        user_plan,
        sync_status,
        connected_accounts,
        cache_data,
        expires_at,
        updated_at
    ) VALUES (
        user_id_param,
        needs_action_count,
        auto_sent_count_24h,
        waiting_count,
        usage_current,
        usage_limit,
        auto_send_enabled,
        user_plan,
        CASE WHEN connected_accounts > 0 THEN 'synced' ELSE 'no_accounts' END,
        connected_accounts,
        cache_data,
        expires_at,
        NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        needs_action_count = EXCLUDED.needs_action_count,
        auto_sent_count_24h = EXCLUDED.auto_sent_count_24h,
        waiting_count = EXCLUDED.waiting_count,
        usage_current = EXCLUDED.usage_current,
        usage_limit = EXCLUDED.usage_limit,
        auto_send_enabled = EXCLUDED.auto_send_enabled,
        user_plan = EXCLUDED.user_plan,
        sync_status = EXCLUDED.sync_status,
        connected_accounts = EXCLUDED.connected_accounts,
        cache_data = EXCLUDED.cache_data,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_dashboard_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM dashboard_summary_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM dashboard_thread_snapshots WHERE expires_at < NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to track dashboard performance
CREATE OR REPLACE FUNCTION track_dashboard_performance(
    request_time_ms INTEGER,
    cache_hit BOOLEAN,
    error_occurred BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO dashboard_performance_metrics (
        date,
        total_requests,
        cache_hits,
        cache_misses,
        average_response_time_ms,
        error_count,
        unique_users
    )
    VALUES (
        CURRENT_DATE,
        1,
        CASE WHEN cache_hit THEN 1 ELSE 0 END,
        CASE WHEN cache_hit THEN 0 ELSE 1 END,
        request_time_ms,
        CASE WHEN error_occurred THEN 1 ELSE 0 END,
        1
    )
    ON CONFLICT (date)
    DO UPDATE SET
        total_requests = dashboard_performance_metrics.total_requests + 1,
        cache_hits = dashboard_performance_metrics.cache_hits + CASE WHEN cache_hit THEN 1 ELSE 0 END,
        cache_misses = dashboard_performance_metrics.cache_misses + CASE WHEN cache_hit THEN 0 ELSE 1 END,
        average_response_time_ms = (
            (dashboard_performance_metrics.average_response_time_ms * dashboard_performance_metrics.total_requests + request_time_ms) / 
            (dashboard_performance_metrics.total_requests + 1)
        ),
        error_count = dashboard_performance_metrics.error_count + CASE WHEN error_occurred THEN 1 ELSE 0 END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update usage tracking
CREATE OR REPLACE FUNCTION update_dashboard_usage_tracking()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dashboard_usage_tracking (
        user_id,
        date,
        plan,
        followups_generated,
        followups_sent,
        followups_auto_sent,
        manual_sends,
        auto_send_sends
    )
    VALUES (
        NEW.user_id,
        CURRENT_DATE,
        'pro', -- Would get from user profile
        1,
        CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END,
        CASE WHEN NEW.auto_send_safe = true AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        CASE WHEN NEW.auto_send_safe = false AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        CASE WHEN NEW.auto_send_safe = true AND NEW.status = 'sent' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        followups_generated = dashboard_usage_tracking.followups_generated + 1,
        followups_sent = dashboard_usage_tracking.followups_sent + CASE WHEN NEW.status = 'sent' THEN 1 ELSE 0 END,
        followups_auto_sent = dashboard_usage_tracking.followups_auto_sent + CASE WHEN NEW.auto_send_safe = true AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        manual_sends = dashboard_usage_tracking.manual_sends + CASE WHEN NEW.auto_send_safe = false AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        auto_send_sends = dashboard_usage_tracking.auto_send_sends + CASE WHEN NEW.auto_send_safe = true AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track usage when follow-up is sent
CREATE TRIGGER trigger_dashboard_usage_tracking
    AFTER INSERT OR UPDATE ON followup_suggestions
    FOR EACH ROW
    WHEN (NEW.status = 'sent')
    EXECUTE FUNCTION update_dashboard_usage_tracking();

-- Scheduled cleanup function (run via cron job)
CREATE OR REPLACE FUNCTION scheduled_dashboard_cleanup()
RETURNS TEXT AS $$
DECLARE
    cache_cleaned INTEGER;
BEGIN
    cache_cleaned := cleanup_dashboard_cache();
    
    RETURN CONCAT('Cleaned ', cache_cleaned, ' expired cache entries');
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_summary_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_usage_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_thread_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_performance_metrics TO authenticated;

GRANT EXECUTE ON FUNCTION update_dashboard_cache TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_dashboard_cache TO authenticated;
GRANT EXECUTE ON FUNCTION track_dashboard_performance TO authenticated;
GRANT EXECUTE ON FUNCTION update_dashboard_usage_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION scheduled_dashboard_cleanup TO authenticated;

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_email_threads_dashboard_needs_action 
    ON email_threads(user_id, needs_followup, last_message_at) 
    WHERE needs_followup = true;

CREATE INDEX IF NOT EXISTS idx_email_threads_dashboard_waiting 
    ON email_threads(user_id, needs_followup, last_message_at) 
    WHERE needs_followup = false;

CREATE INDEX IF NOT EXISTS idx_followup_suggestions_dashboard_auto_sent 
    ON followup_suggestions(user_id, auto_send_safe, status, created_at) 
    WHERE auto_send_safe = true AND status = 'sent';

CREATE INDEX IF NOT EXISTS idx_followup_suggestions_dashboard_usage 
    ON followup_suggestions(user_id, created_at) 
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE);

-- Insert initial performance metrics record
INSERT INTO dashboard_performance_metrics (date, total_requests, cache_hits, cache_misses, created_at)
VALUES (CURRENT_DATE, 0, 0, 0, NOW())
ON CONFLICT (date) DO NOTHING;
