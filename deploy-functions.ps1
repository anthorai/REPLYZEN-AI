# =========================================================
# REPLIFY AI - Supabase Functions Deployment Script
# =========================================================

param(
    [string]$ProjectRef = "vnhllbfvpkzdbqbitnnb"
)

Write-Host "Replify AI - Supabase Functions Deployment" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "Checking Supabase CLI installation..." -ForegroundColor Yellow
try {
    $supabaseVersion = supabase --version
    Write-Host "Supabase CLI found: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Login to Supabase (if not already logged in)
Write-Host ""
Write-Host "Checking Supabase authentication..." -ForegroundColor Yellow
try {
    $authStatus = supabase status 2>$null
    Write-Host "Already authenticated with Supabase" -ForegroundColor Green
} catch {
    Write-Host "Not authenticated. Please login:" -ForegroundColor Yellow
    supabase login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Authentication failed" -ForegroundColor Red
        exit 1
    }
}

# Link project if needed
Write-Host ""
Write-Host "Linking to project: $ProjectRef" -ForegroundColor Yellow
try {
    supabase link --project-ref $ProjectRef
    Write-Host "Project linked successfully" -ForegroundColor Green
} catch {
    Write-Host "Project already linked or linking failed" -ForegroundColor Yellow
}

# Functions to deploy
$functions = @(
    "razorpay-webhook",
    "paddle-webhook",
    "create-razorpay-subscription",
    "create-paddle-subscription",
    "billing-status",
    "cancel-subscription",
    "billing-provider",
    "admin-billing-metrics",
    "grace-period-check",
    "fetch-emails",
    "generate-followups",
    "send-followup",
    "disconnect-account",
    "switch-account"
)

Write-Host ""
Write-Host "Deploying functions..." -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

$successCount = 0
$failedCount = 0

foreach ($func in $functions) {
    Write-Host "Deploying $func..." -ForegroundColor Cyan -NoNewline
    
    # Deploy function
    $result = supabase functions deploy $func --project-ref $ProjectRef 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " SUCCESS" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "   Error: $result" -ForegroundColor Red
        $failedCount++
    }
    
    # Small delay to avoid rate limiting
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Deployment Summary:" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host "Successfully deployed: $successCount functions" -ForegroundColor Green
Write-Host "Failed to deploy: $failedCount functions" -ForegroundColor Green

if ($failedCount -eq 0) {
    Write-Host ""
    Write-Host "All functions deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Function URLs:" -ForegroundColor Yellow
    Write-Host "=================" -ForegroundColor Yellow
    Write-Host "Razorpay Webhook: https://$ProjectRef.supabase.co/functions/v1/razorpay-webhook" -ForegroundColor Cyan
    Write-Host "Paddle Webhook: https://$ProjectRef.supabase.co/functions/v1/paddle-webhook" -ForegroundColor Cyan
    Write-Host "Billing Status: https://$ProjectRef.supabase.co/functions/v1/billing-status" -ForegroundColor Cyan
    Write-Host "Create Razorpay Subscription: https://$ProjectRef.supabase.co/functions/v1/create-razorpay-subscription" -ForegroundColor Cyan
    Write-Host "Create Paddle Subscription: https://$ProjectRef.supabase.co/functions/v1/create-paddle-subscription" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "=============" -ForegroundColor Yellow
    Write-Host "1. Configure webhooks in Razorpay and Paddle dashboards" -ForegroundColor White
    Write-Host "2. Set up cron job for grace-period-check function" -ForegroundColor White
    Write-Host "3. Test the payment flows with your credentials" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Some functions failed to deploy. Please check the errors above." -ForegroundColor Yellow
    Write-Host "You can redeploy individual functions using:" -ForegroundColor Yellow
    Write-Host "supabase functions deploy FUNCTION_NAME --project-ref $ProjectRef" -ForegroundColor White
}

Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "==================" -ForegroundColor Yellow
Write-Host "View function logs: supabase functions logs FUNCTION_NAME --project-ref $ProjectRef" -ForegroundColor White
Write-Host "List deployed functions: supabase functions list --project-ref $ProjectRef" -ForegroundColor White
Write-Host "Check function status: supabase functions status --project-ref $ProjectRef" -ForegroundColor White