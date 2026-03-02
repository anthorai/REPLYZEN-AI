-- Follow-Up Generation Engine Schema Extensions
-- Production-grade tables for AI-powered follow-up generation

-- Extend followup_suggestions table with generation metadata
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS generation_context JSONB;
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS quality_metrics JSONB;
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS safety_checks JSONB;
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,4);
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS auto_send_ready BOOLEAN DEFAULT FALSE;
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0;
ALTER TABLE followup_suggestions ADD COLUMN IF NOT EXISTS generation_metadata JSONB;

-- Create follow-up generations table for tracking AI generations
CREATE TABLE IF NOT EXISTS followup_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    generation_request_id TEXT NOT NULL UNIQUE,
    generated_text TEXT NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    conversation_type TEXT NOT NULL CHECK (conversation_type IN ('proposal', 'sales_pitch', 'meeting_scheduling', 'interview', 'invoice_payment', 'partnership', 'client_onboarding', 'support_resolution', 'followup_reminder', 'general_conversation')),
    relationship_stage TEXT NOT NULL CHECK (relationship_stage IN ('cold_lead', 'warm_lead', 'active_client', 'past_client', 'recruiter', 'vendor', 'internal_team')),
    time_delay_category TEXT NOT NULL CHECK (time_delay_category IN ('light_nudge', 'gentle_followup', 'stronger_clarity', 're_engagement')),
    tone_preference TEXT NOT NULL CHECK (tone_preference IN ('professional', 'friendly', 'assertive', 'polite', 'direct', 'concise')),
    time_since_last_message DECIMAL(5,2) NOT NULL,
    
    -- Quality metrics
    quality_metrics JSONB NOT NULL,
    safety_checks JSONB NOT NULL,
    auto_send_ready BOOLEAN DEFAULT FALSE,
    
    -- Generation metadata
    generation_metadata JSONB NOT NULL,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'approved', 'rejected', 'sent', 'regenerated', 'edited')),
    feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
    user_edited BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    response_received BOOLEAN DEFAULT FALSE,
    response_received_at TIMESTAMP WITH TIME ZONE,
    conversion_achieved BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_generations_thread_user (thread_id, user_id),
    INDEX idx_generations_status_created (status, created_at DESC),
    INDEX idx_generations_confidence (confidence_score DESC),
    INDEX idx_generations_auto_send (auto_send_ready, created_at DESC),
    INDEX idx_generations_conversation_type (conversation_type),
    INDEX idx_generations_user_created (user_id, created_at DESC),
    INDEX idx_generations_request_id (generation_request_id)
);

-- Create conversation context cache for performance
CREATE TABLE IF NOT EXISTS conversation_context_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    conversation_type TEXT NOT NULL,
    relationship_stage TEXT NOT NULL,
    time_delay_category TEXT NOT NULL,
    tone_preference TEXT NOT NULL,
    time_since_last_message DECIMAL(5,2) NOT NULL,
    thread_summary JSONB NOT NULL,
    last_user_message TEXT NOT NULL,
    last_recipient_message TEXT NOT NULL,
    participant_names JSONB NOT NULL,
    classification_confidence DECIMAL(5,4),
    context_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for thread context
    UNIQUE(thread_id, user_id),
    
    -- Indexes for performance
    INDEX idx_context_cache_thread_user (thread_id, user_id),
    INDEX idx_context_cache_expires (expires_at),
    INDEX idx_context_cache_conversation_type (conversation_type),
    INDEX idx_context_cache_hash (context_hash)
);

-- Create generation prompts table for tracking and optimization
CREATE TABLE IF NOT EXISTS generation_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_id TEXT NOT NULL UNIQUE,
    conversation_type TEXT NOT NULL,
    relationship_stage TEXT NOT NULL,
    time_delay_category TEXT NOT NULL,
    tone_preference TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    context_template TEXT NOT NULL,
    instruction_template TEXT NOT NULL,
    constraint_template TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0,
    average_confidence DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_prompts_conversation_type (conversation_type),
    INDEX idx_prompts_success_rate (success_rate DESC),
    INDEX idx_prompts_usage_count (usage_count DESC),
    INDEX idx_prompts_hash (prompt_hash)
);

-- Create quality feedback table for continuous improvement
CREATE TABLE IF NOT EXISTS generation_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES followup_generations(generation_request_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_category TEXT CHECK (feedback_category IN ('quality', 'tone', 'context', 'timing', 'length', 'other')),
    was_helpful BOOLEAN DEFAULT FALSE,
    was_edited BOOLEAN DEFAULT FALSE,
    edited_text TEXT,
    was_sent BOOLEAN DEFAULT FALSE,
    led_to_response BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_feedback_generation (generation_id),
    INDEX idx_feedback_user_rating (user_id, rating),
    INDEX idx_feedback_category (feedback_category),
    INDEX idx_feedback_created (created_at DESC)
);

-- Create regeneration tracking table
CREATE TABLE IF NOT EXISTS regeneration_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_generation_id TEXT NOT NULL REFERENCES followup_generations(generation_request_id) ON DELETE CASCADE,
    regeneration_number INTEGER NOT NULL,
    reason_for_regeneration TEXT,
    feedback_received TEXT,
    new_generated_text TEXT NOT NULL,
    new_confidence_score DECIMAL(5,4) NOT NULL,
    new_quality_metrics JSONB NOT NULL,
    new_safety_checks JSONB NOT NULL,
    improvement_score DECIMAL(5,4), // How much better it was
    user_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_regeneration_original (original_generation_id),
    INDEX idx_regeneration_improvement (improvement_score DESC),
    INDEX idx_regeneration_created (created_at DESC)
);

-- Create auto-send safety log for compliance and debugging
CREATE TABLE IF NOT EXISTS auto_send_safety_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES followup_generations(generation_request_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
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
    INDEX idx_safety_log_generation (generation_id),
    INDEX idx_safety_log_user_date (user_id, created_at DESC),
    INDEX idx_safety_log_passed (safety_check_passed),
    INDEX idx_safety_log_conversion (conversion_achieved, created_at DESC)
);

-- Create generation performance metrics table
CREATE TABLE IF NOT EXISTS generation_performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    total_generations INTEGER DEFAULT 0,
    successful_generations INTEGER DEFAULT 0,
    auto_sent_generations INTEGER DEFAULT 0,
    manual_sent_generations INTEGER DEFAULT 0,
    average_confidence DECIMAL(5,4) DEFAULT 0,
    average_quality DECIMAL(5,4) DEFAULT 0,
    average_response_rate DECIMAL(5,4) DEFAULT 0,
    average_conversion_rate DECIMAL(5,4) DEFAULT 0,
    total_revenue_impact DECIMAL(12,2) DEFAULT 0,
    top_conversation_types JSONB,
    common_issues JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for daily metrics per user
    UNIQUE(date, user_id),
    
    -- Indexes for performance
    INDEX idx_metrics_date_user (date, user_id),
    INDEX idx_metrics_user_date (user_id, date DESC),
    INDEX idx_metrics_conversions (average_conversion_rate DESC)
);

-- Enable Row Level Security for new tables
ALTER TABLE followup_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE regeneration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_send_safety_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own follow-up generations" ON followup_generations
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own follow-up generations" ON followup_generations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own follow-up generations" ON followup_generations
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own conversation context" ON conversation_context_cache
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own conversation context" ON conversation_context_cache
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view generation prompts" ON generation_prompts
    FOR SELECT USING (true); -- Prompts are shared

CREATE POLICY "Users can insert their own feedback" ON generation_feedback
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own feedback" ON generation_feedback
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own regeneration attempts" ON regeneration_attempts
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own regeneration attempts" ON regeneration_attempts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own safety logs" ON auto_send_safety_log
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own performance metrics" ON generation_performance_metrics
    FOR SELECT USING (auth.uid()::text = user_id);

-- Create function for automatic performance metric updates
CREATE OR REPLACE FUNCTION update_generation_performance_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO generation_performance_metrics (
        date,
        user_id,
        total_generations,
        successful_generations,
        auto_sent_generations,
        manual_sent_generations,
        average_confidence,
        average_quality,
        created_at,
        updated_at
    )
    VALUES (
        CURRENT_DATE,
        NEW.user_id,
        1,
        CASE WHEN NEW.auto_send_ready THEN 1 ELSE 0 END,
        CASE WHEN NEW.auto_send_ready AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        CASE WHEN NOT NEW.auto_send_ready AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        NEW.confidence_score,
        (NEW.quality_metrics->>'overallQuality')::DECIMAL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (date, user_id) DO UPDATE SET
        total_generations = generation_performance_metrics.total_generations + 1,
        successful_generations = generation_performance_metrics.successful_generations + 
            CASE WHEN NEW.auto_send_ready THEN 1 ELSE 0 END,
        auto_sent_generations = generation_performance_metrics.auto_sent_generations + 
            CASE WHEN NEW.auto_send_ready AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        manual_sent_generations = generation_performance_metrics.manual_sent_generations + 
            CASE WHEN NOT NEW.auto_send_ready AND NEW.status = 'sent' THEN 1 ELSE 0 END,
        average_confidence = (generation_performance_metrics.average_confidence * generation_performance_metrics.total_generations + NEW.confidence_score) / (generation_performance_metrics.total_generations + 1),
        average_quality = (generation_performance_metrics.average_quality * generation_performance_metrics.total_generations + (NEW.quality_metrics->>'overallQuality')::DECIMAL) / (generation_performance_metrics.total_generations + 1),
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic performance metric updates
CREATE TRIGGER trigger_update_generation_performance_metrics
    AFTER INSERT ON followup_generations
    FOR EACH ROW
    EXECUTE FUNCTION update_generation_performance_metrics();

-- Create function for cleaning up expired context cache
CREATE OR REPLACE FUNCTION cleanup_expired_context_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM conversation_context_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for generation analytics
CREATE OR REPLACE VIEW generation_analytics AS
SELECT 
    user_id,
    COUNT(*) as total_generations,
    COUNT(*) FILTER (WHERE auto_send_ready = TRUE) as auto_send_ready_count,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
    AVG(confidence_score) as avg_confidence,
    AVG((quality_metrics->>'overallQuality')::DECIMAL) as avg_quality,
    AVG(CASE WHEN response_received THEN 1 ELSE 0 END) as response_rate,
    AVG(CASE WHEN conversion_achieved THEN 1 ELSE 0 END) as conversion_rate,
    COUNT(DISTINCT conversation_type) as conversation_variety,
    MAX(created_at) as last_generation_at
FROM followup_generations
GROUP BY user_id;

-- Create view for quality trends
CREATE OR REPLACE VIEW quality_trends AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    conversation_type,
    relationship_stage,
    AVG(confidence_score) as avg_confidence,
    AVG((quality_metrics->>'overallQuality')::DECIMAL) as avg_quality,
    COUNT(*) as generation_count,
    COUNT(*) FILTER (WHERE auto_send_ready = TRUE) as auto_send_count,
    AVG(CASE WHEN response_received THEN 1 ELSE 0 END) as response_rate
FROM followup_generations
GROUP BY DATE_TRUNC('day', created_at), conversation_type, relationship_stage
ORDER BY date DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON followup_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_context_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON generation_prompts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON generation_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON regeneration_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_send_safety_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON generation_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION update_generation_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_context_cache TO authenticated;
GRANT SELECT ON generation_analytics TO authenticated;
GRANT SELECT ON quality_trends TO authenticated;

-- Insert default generation prompts
INSERT INTO generation_prompts (
    prompt_id,
    conversation_type,
    relationship_stage,
    time_delay_category,
    tone_preference,
    system_prompt,
    context_template,
    instruction_template,
    constraint_template,
    prompt_hash
) VALUES
(
    'proposal_professional_default',
    'proposal',
    'warm_lead',
    'gentle_followup',
    'professional',
    'You are generating a follow-up for a business proposal...',
    'Conversation Type: {conversation_type}\nRelationship Stage: {relationship_stage}...',
    'Generate a concise, specific, human-sounding follow-up...',
    'DO NOT use these phrases: "just checking in", "bumping this up"...',
    'hash1'
),
(
    'meeting_scheduling_direct_default',
    'meeting_scheduling',
    'active_client',
    'light_nudge',
    'direct',
    'You are following up on meeting scheduling...',
    'Conversation Type: {conversation_type}\nRelationship Stage: {relationship_stage}...',
    'Generate a concise, specific, human-sounding follow-up...',
    'DO NOT use these phrases: "just checking in", "bumping this up"...',
    'hash2'
)
ON CONFLICT (prompt_id) DO NOTHING;

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_followup_generations_composite 
    ON followup_generations(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_followup_generations_quality_filter 
    ON followup_generations(auto_send_ready, confidence_score DESC) 
    WHERE auto_send_ready = TRUE;

CREATE INDEX IF NOT EXISTS idx_conversation_context_composite 
    ON conversation_context_cache(thread_id, user_id, expires_at);
