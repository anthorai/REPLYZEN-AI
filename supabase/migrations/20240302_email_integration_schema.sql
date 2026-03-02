-- Email Integration & Security System Schema for Replyzen
-- Secure OAuth 2.0 integration with encrypted token storage

-- Email connections table with encrypted tokens
CREATE TABLE IF NOT EXISTS email_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    email_address TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    scope_list TEXT[] NOT NULL,
    connection_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (connection_status IN ('ACTIVE', 'REAUTH_REQUIRED', 'DISCONNECTED', 'ERROR')),
    webhook_subscription_id TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_refreshed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for one connection per user per provider
    UNIQUE(user_id, provider),
    
    -- Indexes for performance
    INDEX idx_email_connections_user (user_id),
    INDEX idx_email_connections_provider (provider),
    INDEX idx_email_connections_status (connection_status),
    INDEX idx_email_connections_expiry (token_expiry),
    INDEX idx_email_connections_webhook (webhook_subscription_id)
);

-- OAuth states for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    state TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Index for cleanup and lookup
    INDEX idx_oauth_states_state (state),
    INDEX idx_oauth_states_expires (expires_at)
);

-- Webhook subscriptions for push notifications
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    subscription_id TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for one subscription per user per provider
    UNIQUE(user_id, provider),
    
    -- Indexes for performance
    INDEX idx_webhook_subscriptions_user (user_id),
    INDEX idx_webhook_subscriptions_provider (provider),
    INDEX idx_webhook_subscriptions_active (is_active),
    INDEX idx_webhook_subscriptions_expires (expires_at)
);

-- Security audit logs for compliance
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('connect', 'disconnect', 'refresh', 'webhook_received', 'sync_completed')),
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for audit queries
    INDEX idx_security_audit_user (user_id),
    INDEX idx_security_audit_action (action),
    INDEX idx_security_audit_provider (provider),
    INDEX idx_security_audit_timestamp (timestamp DESC),
    INDEX idx_security_audit_success (success)
);

-- Webhook event logs for monitoring
CREATE TABLE IF NOT EXISTS webhook_event_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    event_type TEXT NOT NULL,
    message_id TEXT,
    thread_id TEXT,
    user_id TEXT REFERENCES profiles(user_id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL,
    threads_updated INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    error TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_webhook_logs_provider (provider),
    INDEX idx_webhook_logs_user (user_id),
    INDEX idx_webhook_logs_success (success),
    INDEX idx_webhook_logs_timestamp (created_at DESC),
    INDEX idx_webhook_logs_thread (thread_id)
);

-- Email sync queue for processing webhook events
CREATE TABLE IF NOT EXISTS email_sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    thread_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for queue processing
    INDEX idx_sync_queue_status_priority (status, priority, next_retry_at),
    INDEX idx_sync_queue_user (user_id),
    INDEX idx_sync_queue_thread (thread_id),
    INDEX idx_sync_queue_retry (next_retry_at) WHERE status = 'pending'
);

-- Email usage statistics
CREATE TABLE IF NOT EXISTS email_usage_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    date DATE NOT NULL,
    messages_processed INTEGER DEFAULT 0,
    threads_updated INTEGER DEFAULT 0,
    webhook_events_received INTEGER DEFAULT 0,
    sync_errors INTEGER DEFAULT 0,
    average_processing_time_ms DECIMAL(8,2) DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for daily stats per user per provider
    UNIQUE(user_id, provider, date),
    
    -- Indexes for analytics
    INDEX idx_usage_stats_user_date (user_id, date DESC),
    INDEX idx_usage_stats_provider (provider),
    INDEX idx_usage_stats_date (date DESC)
);

-- Connection health monitoring
CREATE TABLE IF NOT EXISTS connection_health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id TEXT NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
    last_token_refresh TIMESTAMP WITH TIME ZONE,
    last_webhook_received TIMESTAMP WITH TIME ZONE,
    token_expiry TIMESTAMP WITH TIME ZONE,
    webhook_subscription_expiry TIMESTAMP WITH TIME ZONE,
    issues TEXT[],
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for health monitoring
    INDEX idx_health_checks_connection (connection_id),
    INDEX idx_health_checks_status (status),
    INDEX idx_health_checks_provider (provider),
    INDEX idx_health_checks_checked (checked_at DESC)
);

-- Enable Row Level Security for new tables
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_health_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own email connections" ON email_connections
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own oauth states" ON oauth_states
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage their own webhook subscriptions" ON webhook_subscriptions
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own security audit logs" ON security_audit_logs
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can insert security audit logs" ON security_audit_logs
    FOR INSERT WITH CHECK (auth.uid()::text IS NULL);

CREATE POLICY "Users can view their own webhook event logs" ON webhook_event_logs
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can insert webhook event logs" ON webhook_event_logs
    FOR INSERT WITH CHECK (auth.uid()::text IS NULL);

CREATE POLICY "Users can manage their own sync queue" ON email_sync_queue
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own usage stats" ON email_usage_stats
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can manage usage stats" ON email_usage_stats
    FOR ALL USING (auth.uid()::text IS NULL);

CREATE POLICY "Users can view their own health checks" ON connection_health_checks
    FOR SELECT USING (auth.uid()::text IN (SELECT user_id FROM email_connections WHERE id = connection_id));

-- Functions for automated maintenance

-- Function to clean up expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_oauth_states()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM oauth_states WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old webhook event logs
CREATE OR REPLACE FUNCTION cleanup_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_event_logs WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update usage statistics
CREATE OR REPLACE FUNCTION update_email_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO email_usage_stats (
        user_id,
        provider,
        date,
        messages_processed,
        threads_updated,
        webhook_events_received,
        sync_errors,
        average_processing_time_ms,
        last_sync_at
    )
    VALUES (
        NEW.user_id,
        NEW.provider,
        CURRENT_DATE,
        CASE WHEN NEW.success THEN 1 ELSE 0 END,
        NEW.threads_updated,
        1,
        CASE WHEN NEW.success THEN 0 ELSE 1 END,
        NEW.processing_time_ms,
        NOW()
    )
    ON CONFLICT (user_id, provider, date)
    DO UPDATE SET
        messages_processed = email_usage_stats.messages_processed + CASE WHEN NEW.success THEN 1 ELSE 0 END,
        threads_updated = email_usage_stats.threads_updated + NEW.threads_updated,
        webhook_events_received = email_usage_stats.webhook_events_received + 1,
        sync_errors = email_usage_stats.sync_errors + CASE WHEN NEW.success THEN 0 ELSE 1 END,
        average_processing_time_ms = (
            (email_usage_stats.average_processing_time_ms * email_usage_stats.webhook_events_received + NEW.processing_time_ms) / 
            (email_usage_stats.webhook_events_received + 1)
        ),
        last_sync_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update usage stats on webhook events
CREATE TRIGGER trigger_update_email_usage_stats
    AFTER INSERT ON webhook_event_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_email_usage_stats();

-- Function to check connection health
CREATE OR REPLACE FUNCTION check_connection_health()
RETURNS TABLE (
    connection_id TEXT,
    provider TEXT,
    status TEXT,
    issues TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.id as connection_id,
        ec.provider,
        CASE 
            WHEN ec.token_expiry < NOW() + INTERVAL '1 hour' THEN 'error'
            WHEN ec.last_refreshed_at < NOW() - INTERVAL '24 hours' THEN 'warning'
            WHEN ec.connection_status != 'ACTIVE' THEN 'error'
            ELSE 'healthy'
        END as status,
        CASE 
            WHEN ec.token_expiry < NOW() + INTERVAL '1 hour' THEN ARRAY['Token expiring soon']
            WHEN ec.last_refreshed_at < NOW() - INTERVAL '24 hours' THEN ARRAY['Token not refreshed recently']
            WHEN ec.connection_status != 'ACTIVE' THEN ARRAY[ec.connection_status]
            ELSE ARRAY[]::TEXT[]
        END as issues
    FROM email_connections ec
    WHERE ec.connection_status != 'DISCONNECTED';
END;
$$ LANGUAGE plpgsql;

-- Function to get connection limits for user plan
CREATE OR REPLACE FUNCTION get_connection_limits(user_plan TEXT)
RETURNS TABLE (
    max_connections INTEGER,
    webhook_priority BOOLEAN,
    sync_interval_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE user_plan
            WHEN 'free' THEN 1
            WHEN 'pro' THEN 5
            WHEN 'enterprise' THEN 20
            ELSE 1
        END as max_connections,
        CASE user_plan
            WHEN 'free' THEN FALSE
            ELSE TRUE
        END as webhook_priority,
        CASE user_plan
            WHEN 'free' THEN 60
            WHEN 'pro' THEN 15
            WHEN 'enterprise' THEN 5
            ELSE 60
        END as sync_interval_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce connection limits
CREATE OR REPLACE FUNCTION enforce_connection_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_plan TEXT;
    max_connections INTEGER;
    current_connections INTEGER;
BEGIN
    -- Get user plan
    SELECT p.plan INTO user_plan
    FROM profiles p
    WHERE p.user_id = NEW.user_id;
    
    -- Get connection limits
    SELECT max_connections INTO max_connections
    FROM get_connection_limits(user_plan);
    
    -- Count current connections
    SELECT COUNT(*) INTO current_connections
    FROM email_connections ec
    WHERE ec.user_id = NEW.user_id
      AND ec.connection_status != 'DISCONNECTED';
    
    -- Enforce limit
    IF current_connections >= max_connections THEN
        RAISE EXCEPTION 'Connection limit exceeded for plan %', user_plan;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce connection limits
CREATE TRIGGER trigger_enforce_connection_limits
    BEFORE INSERT ON email_connections
    FOR EACH ROW
    EXECUTE FUNCTION enforce_connection_limits();

-- Function to automatically refresh expiring tokens
CREATE OR REPLACE FUNCTION auto_refresh_tokens()
RETURNS TABLE (
    connection_id TEXT,
    success BOOLEAN,
    error TEXT
) AS $$
DECLARE
    refresh_result RECORD;
BEGIN
    -- This would integrate with the OAuth flow manager
    -- For now, return placeholder results
    RETURN QUERY
    SELECT 
        ec.id as connection_id,
        FALSE as success,
        'Auto-refresh not implemented' as error
    FROM email_connections ec
    WHERE ec.token_expiry < NOW() + INTERVAL '10 minutes'
      AND ec.connection_status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql;

-- Views for monitoring and analytics

-- Connection overview view
CREATE OR REPLACE VIEW connection_overview AS
SELECT 
    u.user_id,
    u.email as user_email,
    u.plan,
    COUNT(ec.id) as total_connections,
    COUNT(CASE WHEN ec.connection_status = 'ACTIVE' THEN 1 END) as active_connections,
    COUNT(CASE WHEN ec.connection_status = 'REAUTH_REQUIRED' THEN 1 END) as reauth_required,
    COUNT(CASE WHEN ec.connection_status = 'ERROR' THEN 1 END) as error_connections,
    MAX(ec.last_sync_at) as last_sync_at,
    AVG(EXTRACT(EPOCH FROM (NOW() - ec.last_refreshed_at)) / 3600) as avg_hours_since_refresh
FROM profiles u
LEFT JOIN email_connections ec ON u.user_id = ec.user_id
GROUP BY u.user_id, u.email, u.plan;

-- Webhook performance view
CREATE OR REPLACE VIEW webhook_performance AS
SELECT 
    provider,
    DATE(created_at) as date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN success THEN 1 END) as successful_events,
    COUNT(CASE WHEN NOT success THEN 1 END) as failed_events,
    AVG(processing_time_ms) as avg_processing_time,
    AVG(threads_updated) as avg_threads_updated
FROM webhook_event_logs
GROUP BY provider, DATE(created_at)
ORDER BY date DESC;

-- Security audit summary view
CREATE OR REPLACE VIEW security_audit_summary AS
SELECT 
    user_id,
    action,
    provider,
    COUNT(*) as event_count,
    COUNT(CASE WHEN success THEN 1 END) as success_count,
    COUNT(CASE WHEN NOT success THEN 1 END) as failure_count,
    MAX(timestamp) as last_event,
    MIN(timestamp) as first_event
FROM security_audit_logs
GROUP BY user_id, action, provider
ORDER BY last_event DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON email_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_subscriptions TO authenticated;
GRANT SELECT, INSERT ON security_audit_logs TO authenticated;
GRANT SELECT, INSERT ON webhook_event_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_sync_queue TO authenticated;
GRANT SELECT ON email_usage_stats TO authenticated;
GRANT SELECT ON connection_health_checks TO authenticated;

GRANT EXECUTE ON FUNCTION cleanup_oauth_states TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_webhook_logs TO authenticated;
GRANT EXECUTE ON FUNCTION update_email_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION check_connection_health TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_limits TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_connection_limits TO authenticated;
GRANT EXECUTE ON FUNCTION auto_refresh_tokens TO authenticated;

GRANT SELECT ON connection_overview TO authenticated;
GRANT SELECT ON webhook_performance TO authenticated;
GRANT SELECT ON security_audit_summary TO authenticated;

-- Insert default configuration values
INSERT INTO oauth_states (user_id, provider, state, expires_at)
SELECT 
    'system',
    'google',
    'system-state',
    NOW() + INTERVAL '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM oauth_states WHERE user_id = 'system');

-- Create indexes for optimal performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_connections_composite 
ON email_connections(user_id, connection_status, token_expiry);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_event_logs_composite 
ON webhook_event_logs(provider, success, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_logs_composite 
ON security_audit_logs(user_id, action, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_sync_queue_composite 
ON email_sync_queue(status, priority, next_retry_at, created_at);
