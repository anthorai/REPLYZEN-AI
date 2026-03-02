-- Silence Detection Engine Schema Extensions
-- Production-grade tables for high-precision follow-up eligibility detection

-- Extend email_threads table with silence detection metadata
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS silence_detection_status TEXT DEFAULT 'not_processed';
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS last_silence_check TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS silence_duration_hours DECIMAL(10,2);
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,4);
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS auto_send_ready BOOLEAN DEFAULT FALSE;
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS automation_confidence DECIMAL(5,4);
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS eligibility_metadata JSONB;
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create silence detection log for audit trail and debugging
CREATE TABLE IF NOT EXISTS silence_detection_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'duplicate_prevented', 'race_condition', 'automation_filtered')),
    confidence_score DECIMAL(5,4),
    silence_duration_hours DECIMAL(10,2),
    automation_confidence DECIMAL(5,4),
    processing_time_ms INTEGER,
    rejection_reason TEXT,
    eligibility_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_silence_log_thread_user (thread_id, user_id),
    INDEX idx_silence_log_status_created (status, created_at),
    INDEX idx_silence_log_user_created (user_id, created_at DESC),
    INDEX idx_silence_log_request_id (request_id)
);

-- Create processing locks table for race condition prevention
CREATE TABLE IF NOT EXISTS processing_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate locks
    UNIQUE(thread_id, user_id),
    
    -- Indexes for cleanup and lookup
    INDEX idx_processing_locks_expires (expires_at),
    INDEX idx_processing_locks_user (user_id),
    INDEX idx_processing_locks_request (request_id)
);

-- Create follow-up eligibility cache for performance optimization
CREATE TABLE IF NOT EXISTS followup_eligibility_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    is_eligible BOOLEAN NOT NULL,
    confidence_score DECIMAL(5,4),
    auto_send_ready BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
    eligibility_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rejection_reason TEXT,
    insights JSONB,
    
    -- Unique constraint for thread eligibility
    UNIQUE(thread_id, user_id),
    
    -- Indexes for performance
    INDEX idx_eligibility_cache_user_eligible (user_id, is_eligible),
    INDEX idx_eligibility_cache_expires (expires_at),
    INDEX idx_eligibility_cache_auto_send (auto_send_ready, eligibility_timestamp)
);

-- Create automation detection patterns table for learning system
CREATE TABLE IF NOT EXISTS automation_detection_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_name TEXT NOT NULL UNIQUE,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('header', 'content', 'sender', 'subject')),
    pattern_value TEXT NOT NULL,
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    detection_count INTEGER DEFAULT 0,
    false_positive_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_automation_patterns_active (is_active),
    INDEX idx_automation_patterns_type (pattern_type)
);

-- Create confidence scoring history for trend analysis
CREATE TABLE IF NOT EXISTS confidence_scoring_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    confidence_score DECIMAL(5,4) NOT NULL,
    participant_reciprocity DECIMAL(5,4),
    silence_duration_score DECIMAL(5,4),
    automation_risk DECIMAL(5,4),
    thread_recency DECIMAL(5,4),
    message_quality DECIMAL(5,4),
    duplicate_risk DECIMAL(5,4),
    scoring_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_confidence_history_thread (thread_id, scoring_timestamp DESC),
    INDEX idx_confidence_history_user (user_id, scoring_timestamp DESC)
);

-- Create false positive tracking for continuous improvement
CREATE TABLE IF NOT EXISTS false_positive_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    original_confidence_score DECIMAL(5,4) NOT NULL,
    rejection_reason TEXT NOT NULL,
    user_correction TEXT CHECK (user_correction IN ('correct_rejection', 'false_positive', 'should_followup')),
    feedback_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    
    INDEX idx_false_positive_thread (thread_id),
    INDEX idx_false_positive_user (user_id, feedback_timestamp DESC),
    INDEX idx_false_positive_correction (user_correction)
);

-- Create follow-up performance metrics for monetization tracking
CREATE TABLE IF NOT EXISTS followup_performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    confidence_score DECIMAL(5,4) NOT NULL,
    auto_send BOOLEAN NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    response_received BOOLEAN,
    response_time_hours DECIMAL(10,2),
    conversion_achieved BOOLEAN,
    revenue_impact DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_performance_metrics_user (user_id, sent_at DESC),
    INDEX idx_performance_metrics_confidence (confidence_score),
    INDEX idx_performance_metrics_auto_send (auto_send, response_received)
);

-- Enable Row Level Security for new tables
ALTER TABLE silence_detection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_eligibility_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_detection_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_scoring_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE false_positive_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own silence detection logs" ON silence_detection_log
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own silence detection logs" ON silence_detection_log
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own processing locks" ON processing_locks
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own processing locks" ON processing_locks
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own eligibility cache" ON followup_eligibility_cache
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own eligibility cache" ON followup_eligibility_cache
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view automation patterns" ON automation_detection_patterns
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Users can view their own confidence history" ON confidence_scoring_history
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own confidence history" ON confidence_scoring_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own false positive tracking" ON false_positive_tracking
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own false positive tracking" ON false_positive_tracking
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own performance metrics" ON followup_performance_metrics
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own performance metrics" ON followup_performance_metrics
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Insert default automation detection patterns
INSERT INTO automation_detection_patterns (pattern_name, pattern_type, pattern_value, weight) VALUES
('no-reply-address', 'sender', 'no-reply@', 0.9),
('noreply-address', 'sender', 'noreply@', 0.9),
('donotreply-address', 'sender', 'donotreply@', 0.9),
('notifications-address', 'sender', 'notifications@', 0.8),
('list-unsubscribe-header', 'header', 'list-unsubscribe', 0.95),
('precedence-bulk', 'header', 'precedence:bulk', 0.9),
('auto-submitted', 'header', 'auto-submitted', 0.85),
('unsubscribe-keyword', 'content', 'unsubscribe', 0.7),
('view-browser-keyword', 'content', 'view in browser', 0.7),
('newsletter-keyword', 'content', 'newsletter', 0.8),
('promotional-keyword', 'content', 'promotional', 0.8),
('receipt-keyword', 'content', 'receipt', 0.85),
('invoice-keyword', 'content', 'invoice', 0.85),
('otp-pattern', 'content', 'verification code', 0.95),
('automated-message', 'content', 'automated message', 0.8)
ON CONFLICT (pattern_name) DO NOTHING;

-- Create function for automatic cleanup of expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_processing_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM processing_locks WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO silence_detection_log (thread_id, user_id, request_id, status, created_at)
    SELECT 
        thread_id, 
        user_id, 
        'cleanup_' || EXTRACT(EPOCH FROM NOW())::text,
        'completed',
        NOW()
    FROM processing_locks 
    WHERE expires_at < NOW()
    LIMIT 1;  -- Just log that cleanup happened
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for cache expiration
CREATE OR REPLACE FUNCTION cleanup_expired_eligibility_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM followup_eligibility_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for optimized silence detection queries
CREATE INDEX IF NOT EXISTS idx_email_threads_silence_status 
    ON email_threads (user_id, silence_detection_status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_threads_auto_send_ready 
    ON email_threads (auto_send_ready, confidence_score DESC) 
    WHERE auto_send_ready = TRUE;

CREATE INDEX IF NOT EXISTS idx_email_threads_eligible_threads 
    ON email_threads (user_id, needs_followup, last_message_at DESC)
    WHERE needs_followup = TRUE AND silence_detection_status = 'eligible';

-- Create view for eligible threads with high confidence
CREATE OR REPLACE VIEW high_confidence_eligible_threads AS
SELECT 
    et.id,
    et.thread_id,
    et.subject,
    et.user_id,
    et.confidence_score,
    et.silence_duration_hours,
    et.auto_send_ready,
    et.last_message_at,
    et.eligibility_metadata,
    et.created_at
FROM email_threads et
WHERE et.silence_detection_status = 'eligible'
    AND et.confidence_score >= 0.85
    AND et.auto_send_ready = TRUE
    AND et.needs_followup = TRUE;

-- Create view for silence detection analytics
CREATE OR REPLACE VIEW silence_detection_analytics AS
SELECT 
    user_id,
    COUNT(*) as total_threads_processed,
    COUNT(*) FILTER (WHERE silence_detection_status = 'eligible') as eligible_threads,
    COUNT(*) FILTER (WHERE auto_send_ready = TRUE) as auto_send_ready_threads,
    AVG(confidence_score) as avg_confidence_score,
    AVG(silence_duration_hours) as avg_silence_duration,
    COUNT(*) FILTER (WHERE rejection_reason IS NOT NULL) as rejected_threads,
    MAX(created_at) as last_processed_at
FROM email_threads
WHERE silence_detection_status != 'not_processed'
GROUP BY user_id;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON silence_detection_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON processing_locks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON followup_eligibility_cache TO authenticated;
GRANT SELECT ON automation_detection_patterns TO authenticated;
GRANT SELECT, INSERT ON confidence_scoring_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON false_positive_tracking TO authenticated;
GRANT SELECT, INSERT ON followup_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_processing_locks TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_eligibility_cache TO authenticated;
GRANT SELECT ON high_confidence_eligible_threads TO authenticated;
GRANT SELECT ON silence_detection_analytics TO authenticated;

-- Create trigger to update confidence scoring history
CREATE OR REPLACE FUNCTION update_confidence_scoring_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.confidence_score IS DISTINCT FROM NEW.confidence_score THEN
        INSERT INTO confidence_scoring_history (
            thread_id,
            user_id,
            confidence_score,
            participant_reciprocity,
            silence_duration_score,
            automation_risk,
            thread_recency,
            message_quality,
            duplicate_risk
        ) VALUES (
            NEW.thread_id,
            NEW.user_id,
            NEW.confidence_score,
            COALESCE((NEW.eligibility_metadata->>'participant_reciprocity')::DECIMAL, 0),
            COALESCE((NEW.eligibility_metadata->>'silence_duration_score')::DECIMAL, 0),
            COALESCE((NEW.eligibility_metadata->>'automation_risk')::DECIMAL, 0),
            COALESCE((NEW.eligibility_metadata->>'thread_recency')::DECIMAL, 0),
            COALESCE((NEW.eligibility_metadata->>'message_quality')::DECIMAL, 0),
            COALESCE((NEW.eligibility_metadata->>'duplicate_risk')::DECIMAL, 0)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_confidence_scoring_history
    AFTER UPDATE ON email_threads
    FOR EACH ROW
    WHEN (OLD.confidence_score IS DISTINCT FROM NEW.confidence_score)
    EXECUTE FUNCTION update_confidence_scoring_history();
