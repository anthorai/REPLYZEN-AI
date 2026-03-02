# Supabase Cron Scheduling Setup Instructions

This document explains how to configure the cron schedules for your Supabase Edge Functions using the Supabase dashboard.

## Prerequisites

Before setting up the cron schedules, ensure that:

1. All the functions have been successfully deployed to your Supabase project
2. The `pg_cron` extension is enabled in your database
3. You have admin access to the Supabase dashboard

## Step-by-Step Setup Guide

### 1. Enable pg_cron Extension

1. Go to your Supabase dashboard
2. Navigate to Database → Extensions
3. Search for `pg_cron` in the extensions list
4. Click "Enable" next to the `pg_cron` extension

### 2. Set Up Scheduled Functions via SQL Editor

1. Go to Database → SQL Editor in your Supabase dashboard
2. Copy and paste the following SQL commands:

```sql
-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cron-worker to run daily at 9 AM UTC
SELECT cron.schedule(
    'cron-worker-daily-9am',
    '0 9 * * *',
    $$INSERT INTO cron.job_log (jobid, status, return_message)
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
```

3. Click "Run" to execute the commands

### 3. Verify Scheduled Jobs

To confirm that your cron jobs have been set up correctly, run the following query in the SQL Editor:

```sql
SELECT jobid, schedule, command, active FROM cron.job;
```

This will show all the scheduled jobs and their status.

### 4. Alternative Method - Direct Function Scheduling

If the above method doesn't work, you can also schedule the functions using the direct URL method:

```sql
-- Alternative method using direct function URLs
SELECT cron.schedule(
    'cron-worker-daily-9am',
    '0 9 * * *',
    'curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/cron-worker -H "Authorization: Bearer YOUR_ANON_KEY" -H "Content-Type: application/json" -d "{}"'
);
```

Replace `YOUR_PROJECT_ID` and `YOUR_ANON_KEY` with your actual Supabase project ID and anon key.

## Cron Schedule Format

The cron schedule format used is: `minute hour day month weekday`

- `0 9 * * *` means daily at 9:00 AM UTC
- `0 20 * * *` means daily at 8:00 PM UTC  
- `0 2 * * *` means daily at 2:00 AM UTC

## Managing Scheduled Jobs

To view all scheduled jobs:
```sql
SELECT jobid, schedule, command, active FROM cron.job;
```

To remove a scheduled job:
```sql
SELECT cron.unschedule('job_name');
```

For example, to remove the cron-worker schedule:
```sql
SELECT cron.unschedule('cron-worker-daily-9am');
```

## Troubleshooting

If you encounter issues:

1. Make sure the `net` extension is enabled in your Supabase database
2. Verify that your functions are deployed and accessible
3. Check that your service role key has the necessary permissions
4. Review the cron logs in the SQL Editor for error messages

## Test the Functions

You can manually trigger any of these functions through the Supabase dashboard to test them before relying on the scheduled execution.