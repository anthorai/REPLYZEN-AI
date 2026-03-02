-- Setup cron schedules for Supabase Edge Functions
-- Run these commands in the Supabase SQL Editor

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cron-worker to run daily at 9 AM UTC
SELECT cron.schedule(
    'cron-worker-daily-9am',
    '0 9 * * *',
    $$
    INSERT INTO cron.job_log (jobid, status, return_message)
    SELECT 1, 'RUNNING', 'Triggering cron-worker function'
    ON CONFLICT (jobid) DO UPDATE SET
        status = 'RUNNING',
        return_message = 'Triggering cron-worker function',
        run_start = NOW();

    WITH response AS (
        SELECT net.http_post(
            url := 'https://' || current_setting('net.postgres_fdw.host') || '/functions/v1/cron-worker',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := '{}'
        ) AS request_id
    )
    SELECT net.await_response(request_id) FROM response;
    $$
);

-- Schedule daily-digest to run daily at 8 PM UTC
SELECT cron.schedule(
    'daily-digest-daily-8pm',
    '0 20 * * *',
    $$
    INSERT INTO cron.job_log (jobid, status, return_message)
    SELECT 2, 'RUNNING', 'Triggering daily-digest function'
    ON CONFLICT (jobid) DO UPDATE SET
        status = 'RUNNING',
        return_message = 'Triggering daily-digest function',
        run_start = NOW();

    WITH response AS (
        SELECT net.http_post(
            url := 'https://' || current_setting('net.postgres_fdw.host') || '/functions/v1/daily-digest',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := '{}'
        ) AS request_id
    )
    SELECT net.await_response(request_id) FROM response;
    $$
);

-- Schedule grace-period-check to run daily at 2 AM UTC
SELECT cron.schedule(
    'grace-period-check-daily-2am',
    '0 2 * * *',
    $$
    INSERT INTO cron.job_log (jobid, status, return_message)
    SELECT 3, 'RUNNING', 'Triggering grace-period-check function'
    ON CONFLICT (jobid) DO UPDATE SET
        status = 'RUNNING',
        return_message = 'Triggering grace-period-check function',
        run_start = NOW();

    WITH response AS (
        SELECT net.http_post(
            url := 'https://' || current_setting('net.postgres_fdw.host') || '/functions/v1/grace-period-check',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := '{}'
        ) AS request_id
    )
    SELECT net.await_response(request_id) FROM response;
    $$
);

-- View all scheduled jobs
SELECT jobid, schedule, command, active FROM cron.job;

-- To unschedule a job, use:
-- SELECT cron.unschedule('job_name');