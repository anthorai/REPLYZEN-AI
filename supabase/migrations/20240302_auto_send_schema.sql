-- Auto-Send Control System Schema
-- Production-grade tables for safe auto-send functionality

-- Main auto-send attempts table
CREATE TABLE IF NOT EXISTS auto_send_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    follow_up_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('SAFE_TO_SEND', 'CANCELLED', 'RETRY_LATER', 'MANUAL_REVIEW_REQUIRED')),
    cancellation_reason TEXT CHECK (cancellation_reason IN (
        'user_already_replied',
        'silence_window_invalid', 
        'spam_risk_high',
        'daily_limit_reached',
        'plan_limit_reached',
        'sensitive_conversation',
        'recipient_opted_out',
        'technical_error',
        'rate_limit_exceeded',
        'content_quality_low',
        'legal_risk_detected',
        'max_retry_attempts_exceeded'
    )),
    validation_snapshot JSONB NOT NULL,
    generated_message TEXT NOT NULL,
    user_insight TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    email_provider_id TEXT,
    processing_time_ms INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_auto_send_thread_user (thread_id, user_id),
    INDEX idx_auto_send_decision_created (decision, created_at DESC),
    INDEX idx_auto_send_idempotency (idempotency_key),
    INDEX idx_auto_send_user_created (user_id, created_at DESC),
    INDEX idx_auto_send_retry_at (next_retry_at) WHERE next_retry_at IS NOT NULL,
    INDEX idx_auto_send_sent_at (sent_at) WHERE sent_at IS NOT NULL
);

-- Auto-send safety log for compliance
CREATE TABLE IF NOT EXISTS auto_send_safety_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    generation_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    safety_check_passed BOOLEAN NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    safety_flags JSONB NOT NULL,
    auto_send_allowed BOOLEAN NOT NULL,
    manual_override_reason TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    response_received BOOLEAN DEFAULT FALSE,
    response_time_hours DECIMAL(8,2),
    conversion_achieved BOOLEAN DEFAULT FALSE,
    revenue_impact DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_safety_log_user_date (user_id, created_at DESC),
    INDEX idx_safety_log_passed (safety_check_passed),
    INDEX idx_safety_log_conversion (conversion_achieved, created_at DESC),
    INDEX idx_safety_log_generation (generation_id)
);

-- Daily sending limits tracking
CREATE TABLE IF NOT EXISTS daily_send_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    daily_limit INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_limit_reached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for daily tracking
    UNIQUE(user_id, date),
    
    -- Indexes for performance
    INDEX idx_daily_limits_user_date (user_id, date DESC),
    INDEX idx_daily_limits_reset (reset_time),
    INDEX idx_daily_limits_reached (is_limit_reached, date)
);

-- Spam risk analysis cache
CREATE TABLE IF NOT EXISTS spam_risk_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    risk_score DECIMAL(5,4) NOT NULL,
    risk_factors JSONB NOT NULL,
    last_follow_up_at TIMESTAMP WITH TIME ZONE,
    follow_up_count INTEGER DEFAULT 0,
    pattern_type TEXT CHECK (pattern_type IN ('normal', 'high_frequency', 'repetitive', 'suspicious')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_spam_risk_user_recipient (user_id, recipient_email),
    INDEX idx_spam_risk_score (risk_score DESC),
    INDEX idx_spam_risk_expires (expires_at),
    INDEX idx_spam_risk_pattern (pattern_type)
);

-- Sentiment risk tracking
CREATE TABLE IF NOT EXISTS sentiment_risk_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    risk_type TEXT NOT NULL CHECK (risk_type IN (
        'legal_dispute',
        'refund_escalation', 
        'angry_sentiment',
        'do_not_contact',
        'complaint_escalation',
        'dissatisfaction',
        'threatening_language'
    )),
    confidence DECIMAL(5,4) NOT NULL,
    evidence TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_sentiment_risk_thread (thread_id),
    INDEX idx_sentiment_risk_user (user_id, detected_at DESC),
    INDEX idx_sentiment_risk_type (risk_type),
    INDEX idx_sentiment_risk_severity (severity, is_active)
);

-- Auto-send performance metrics
CREATE TABLE IF NOT EXISTS auto_send_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    user_id TEXT REFERENCES profiles(user_id) ON DELETE CASCADE,
    plan TEXT CHECK (plan IN ('free', 'pro', 'enterprise')),
    total_attempts INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    cancelled_attempts INTEGER DEFAULT 0,
    retry_attempts INTEGER DEFAULT 0,
    average_processing_time DECIMAL(8,2) DEFAULT 0,
    average_confidence DECIMAL(5,4) DEFAULT 0,
    spam_risk_average DECIMAL(5,4) DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    revenue_impact DECIMAL(12,2) DEFAULT 0,
    top_cancellation_reasons JSONB,
    error_rate DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for daily metrics per user
    UNIQUE(date, COALESCE(user_id, 'system')),
    
    -- Indexes for performance
    INDEX idx_metrics_date_user (date, user_id),
    INDEX idx_metrics_user_date (COALESCE(user_id, 'system'), date DESC),
    INDEX idx_metrics_conversion (conversion_rate DESC),
    INDEX idx_metrics_date (date)
);

-- Queue job tracking
CREATE TABLE IF NOT EXISTS auto_send_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL DEFAULT 'auto_send',
    job_data JSONB NOT NULL,
    priority INTEGER DEFAULT 5,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for queue processing
    INDEX idx_queue_status_priority (status, priority DESC, next_run_at),
    INDEX idx_queue_next_run (next_run_at) WHERE status = 'pending',
    INDEX idx_queue_attempts (attempts, max_attempts),
    INDEX idx_queue_created (created_at)
);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL,
    limit INTEGER NOT NULL,
    window_ms INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_exceeded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for rate limiting
    UNIQUE(key),
    
    -- Indexes for performance
    INDEX idx_rate_limits_key (key),
    INDEX idx_rate_limits_reset (reset_time),
    INDEX idx_rate_limits_exceeded (is_exceeded, reset_time)
);

-- Enable Row Level Security for new tables
ALTER TABLE auto_send_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_send_safety_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_send_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_risk_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_risk_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_send_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own auto-send attempts" ON auto_send_attempts
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own auto-send attempts" ON auto_send_attempts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own auto-send attempts" ON auto_send_attempts
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own safety logs" ON auto_send_safety_log
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own safety logs" ON auto_send_safety_log
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own daily limits" ON daily_send_limits
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own daily limits" ON daily_send_limits
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own spam risk cache" ON spam_risk_cache
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own spam risk cache" ON spam_risk_cache
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own sentiment risk logs" ON sentiment_risk_log
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own sentiment risk logs" ON sentiment_risk_log
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own metrics" ON auto_send_metrics
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can view all metrics" ON auto_send_metrics
    FOR SELECT USING (auth.uid()::text IS NULL);

-- Functions for automated cleanup and maintenance

-- Function to reset daily limits
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE daily_send_limits 
    SET current_count = 0, 
        is_limit_reached = FALSE,
        reset_time = reset_time + INTERVAL '1 day'
    WHERE reset_time <= NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for daily limit reset
CREATE TRIGGER trigger_reset_daily_limits
    AFTER UPDATE ON daily_send_limits
    FOR EACH ROW
    WHEN (OLD.is_limit_reached = TRUE AND NEW.is_limit_reached = FALSE)
    EXECUTE FUNCTION reset_daily_limits();

-- Function to update daily send count
CREATE OR REPLACE FUNCTION increment_daily_send_count()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO daily_send_limits (user_id, date, plan, daily_limit, reset_time)
    VALUES (
        NEW.user_id,
        CURRENT_DATE,
        'pro', -- Would get from user profile
        50,     -- Would get from plan limits
        DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
    )
    ON CONFLICT (user_id, date) 
    DO UPDATE SET
        current_count = daily_send_limits.current_count + 1,
        is_limit_reached = (daily_send_limits.current_count + 1) >= daily_send_limits.daily_limit,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment daily count on successful send
CREATE TRIGGER trigger_increment_daily_count
    AFTER INSERT ON auto_send_attempts
    FOR EACH ROW
    WHEN (NEW.decision = 'SAFE_TO_SEND')
    EXECUTE FUNCTION increment_daily_send_count();

-- Function to clean up old records
CREATE OR REPLACE FUNCTION cleanup_old_auto_send_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_attempts INTEGER;
    deleted_safety_logs INTEGER;
    deleted_spam_cache INTEGER;
    deleted_queue_jobs INTEGER;
    total_deleted INTEGER;
BEGIN
    -- Clean up attempts older than 90 days
    DELETE FROM auto_send_attempts WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_attempts = ROW_COUNT;
    
    -- Clean up safety logs older than 180 days
    DELETE FROM auto_send_safety_log WHERE created_at < NOW() - INTERVAL '180 days';
    GET DIAGNOSTICS deleted_safety_logs = ROW_COUNT;
    
    -- Clean up spam risk cache older than 30 days
    DELETE FROM spam_risk_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_spam_cache = ROW_COUNT;
    
    -- Clean up old queue jobs older than 7 days
    DELETE FROM auto_send_queue WHERE created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_queue_jobs = ROW_COUNT;
    
    total_deleted := deleted_attempts + deleted_safety_logs + deleted_spam_cache + deleted_queue_jobs;
    
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to update auto-send metrics
CREATE OR REPLACE FUNCTION update_auto_send_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO auto_send_metrics (
        date,
        user_id,
        plan,
        total_attempts,
        successful_sends,
        cancelled_attempts,
        average_processing_time,
        average_confidence,
        created_at,
        updated_at
    )
    VALUES (
        CURRENT_DATE,
        NEW.user_id,
        'pro', -- Would get from user profile
        1,
        CASE WHEN NEW.decision = 'SAFE_TO_SEND' THEN 1 ELSE 0 END,
        CASE WHEN NEW.decision = 'CANCELLED' THEN 1 ELSE 0 END,
        NEW.processing_time_ms,
        (NEW.validation_snapshot->>'spamRiskAnalysis'->>'overallScore')::DECIMAL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (date, COALESCE(NEW.user_id, 'system'))
    DO UPDATE SET
        total_attempts = auto_send_metrics.total_attempts + 1,
        successful_sends = auto_send_metrics.successful_sends + 
            CASE WHEN NEW.decision = 'SAFE_TO_SEND' THEN 1 ELSE 0 END,
        cancelled_attempts = auto_send_metrics.cancelled_attempts + 
            CASE WHEN NEW.decision = 'CANCELLED' THEN 1 ELSE 0 END,
        average_processing_time = (auto_send_metrics.average_processing_time * auto_send_metrics.total_attempts + NEW.processing_time_ms) / (auto_send_metrics.total_attempts + 1),
        average_confidence = (auto_send_metrics.average_confidence * auto_send_metrics.total_attempts + 
            (NEW.validation_snapshot->>'spamRiskAnalysis'->>'overallScore')::DECIMAL) / (auto_send_metrics.total_attempts + 1),
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics on each attempt
CREATE TRIGGER trigger_update_auto_send_metrics
    AFTER INSERT ON auto_send_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_auto_send_metrics();

-- Views for analytics and reporting

CREATE OR REPLACE VIEW auto_send_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE decision = 'SAFE_TO_SEND') as successful_sends,
    COUNT(*) FILTER (WHERE decision = 'CANCELLED') as cancelled_attempts,
    COUNT(*) FILTER (WHERE decision = 'RETRY_LATER') as retry_attempts,
    AVG(processing_time_ms) as avg_processing_time,
    AVG((validation_snapshot->>'spamRiskAnalysis'->>'overallScore')::DECIMAL) as avg_spam_risk,
    COUNT(DISTINCT user_id) as active_users
FROM auto_send_attempts
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW user_auto_send_summary AS
SELECT 
    user_id,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE decision = 'SAFE_TO_SEND') as successful_sends,
    COUNT(*) FILTER (WHERE decision = 'CANCELLED') as cancelled_attempts,
    AVG(processing_time_ms) as avg_processing_time,
    AVG((validation_snapshot->>'spamRiskAnalysis'->>'overallScore')::DECIMAL) as avg_spam_risk,
    MAX(created_at) as last_activity
FROM auto_send_attempts
GROUP BY user_id;

CREATE OR REPLACE VIEW cancellation_reasons_breakdown AS
SELECT 
    cancellation_reason,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM auto_send_attempts
WHERE cancellation_reason IS NOT NULL
GROUP BY cancellation_reason
ORDER BY count DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_send_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_send_safety_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_send_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON spam_risk_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sentiment_risk_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_send_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_send_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO authenticated;

GRANT EXECUTE ON FUNCTION reset_daily_limits TO authenticated;
GRANT EXECUTE FUNCTION increment_daily_send_count TO authenticated;
GRANT EXECUTE FUNCTION cleanup_old_auto_send_records TO authenticated;
GRANT EXECUTE FUNCTION update_auto_send_metrics TO authenticated;

GRANT SELECT ON auto_send_analytics TO authenticated;
GRANT SELECT ON user_auto_send_summary TO authenticated;
GRANT SELECT ON cancellation_reasons_breakdown TO authenticated;

-- Insert default rate limits
INSERT INTO rate_limits (key, limit, window_ms, reset_time)
VALUES 
    ('auto_send_global', 10000, 3600000, NOW() + INTERVAL '1 hour'),
    ('auto_send_per_user', 100, 3600000, NOW() + INTERVAL '1 hour')
ON CONFLICT (key) DO NOTHING;
