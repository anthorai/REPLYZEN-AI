@echo off
title Replify AI - Supabase Functions Deployment

echo🚀 Replify AI - Supabase Functions Deployment
echo ===============================================
echo.

REM Check if Supabase CLI is installed
echo🔍 Checking Supabase CLI installation...
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo❌ Supabase CLI not found. Please install it first:
    echo    npm install -g supabase
    echo.
    pause
    exit /b 1
)
echo✅ Supabase CLI found

echo.
echo🔐 Please make sure you're logged into Supabase
echo If not logged in, you'll be prompted to login...
echo.

REM Deploy all functions
set PROJECT_REF=vnhllbfvpkzdbqbitnnb

echo📦ingDeploying functions...
echo ========================

echo Deploying razorpay-webhook...
supabase functions deploy razorpay-webhook --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy razorpay-webhook
    goto :error
)
echo✅ razorpay-webhook deployed

echo Deploying paddle-webhook...
supabase functions deploy paddle-webhook --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy paddle-webhook
    goto :error
)
echo ✅ paddle-webhook deployed

echo Deploying create-razorpay-subscription...
supabase functions deploy create-razorpay-subscription --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy create-razorpay-subscription
    goto :error
)
echo✅ create-razorpay-subscription deployed

echo Deploying create-paddle-subscription...
supabase functions deploy create-paddle-subscription --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy create-paddle-subscription
    goto :error
)
echo✅ create-paddle-subscription deployed

echo Deploying billing-status...
supabase functions deploy billing-status --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy billing-status
    goto :error
)
echo ✅ billing-status deployed

echo Deploying cancel-subscription...
supabase functions deploy cancel-subscription --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy cancel-subscription
    goto :error
)
echo✅ cancel-subscription deployed

echo Deploying billing-provider...
supabase functions deploy billing-provider --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy billing-provider
    goto :error
)
echo✅ billing-provider deployed

echo Deploying admin-billing-metrics...
supabase functions deploy admin-billing-metrics --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy admin-billing-metrics
    goto :error
)
echo✅ admin-billing-metrics deployed

echo Deploying grace-period-check...
supabase functions deploy grace-period-check --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy grace-period-check
    goto :error
)
echo ✅ grace-period-check deployed

echo.
echo🎉 All functions deployed successfully!
echo.
echo URLs:
echo =================
echo Razorpay Webhook: https://%PROJECT_REF%.supabase.co/functions/v1/razorpay-webhook
echo Paddle Webhook: https://%PROJECT_REF%.supabase.co/functions/v1/paddle-webhook
echo Billing Status: https://%PROJECT_REF%.supabase.co/functions/v1/billing-status
echo Create Razorpay Subscription: https://%PROJECT_REF%.supabase.co/functions/v1/create-razorpay-subscription
echo Create Paddle Subscription: https://%PROJECT_REF%.supabase.co/functions/v1/create-paddle-subscription
echo Grace Period Check: https://%PROJECT_REF%.supabase.co/functions/v1/grace-period-check
echo.
echo🔧 Steps Steps:
echo =============
echo 1. Configure webhooks in Razorpay and Paddle dashboards
echo 2. Set up cron job for grace-period-check function
echo 3. Test the payment flows with your credentials
echo.
echo💡 Useful Commands:
echo ==================
echo View function logs: supabase functions logs FUNCTION_NAME --project-ref %PROJECT_REF%
echo List deployed functions: supabase functions list --project-ref %PROJECT_REF%
echo Check function status: supabase functions status --project-ref %PROJECT_REF%
echo.
goto :end

:error
echo.
echo⚠  Deployment failed. Please check the errors above.
echo You can try deploying individual functions manually:
echo supabase functions deploy FUNCTION_NAME --project-ref %PROJECT_REF%
echo.

:end
pause