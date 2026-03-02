#!/bin/bash
# =========================================================
# REPLIFY AI - PRODUCTION DEPLOYMENT SCRIPT
# =========================================================

set -e  # Exit on any error

echo "🚀 Replify AI - Production Deployment"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed. Install it first:"
    echo "  npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    print_error "Not logged in to Supabase. Run: supabase login"
    exit 1
fi

echo "Step 1: Running database migrations..."
supabase db push
print_status "Database migrations applied"

echo ""
echo "Step 2: Deploying Edge Functions..."

# Deploy all edge functions
FUNCTIONS=(
    "cron-worker"
    "daily-digest"
    "stripe-webhook"
    "gmail-connect"
    "gmail-callback"
    "generate-followups"
    "send-followup"
    "fetch-emails"
    "disconnect-account"
    "switch-account"
)

for func in "${FUNCTIONS[@]}"; do
    echo "  Deploying $func..."
    supabase functions deploy "$func"
    print_status "$func deployed"
done

echo ""
echo "Step 3: Setting up environment variables..."
print_warning "Make sure to set these in Supabase Dashboard:"
echo "  1. Go to: https://supabase.com/dashboard/project/_/settings/functions"
echo "  2. Add the following secrets:"
echo "     - ENCRYPTION_KEY"
echo "     - FRONTEND_URL"
echo "     - BREVO_API_KEY"
echo "     - OPENAI_API_KEY"
echo "     - GMAIL_CLIENT_ID"
echo "     - GMAIL_CLIENT_SECRET"
echo "     - GMAIL_REDIRECT_URI"
echo "     - RAZORPAY_KEY_ID"
echo "     - RAZORPAY_KEY_SECRET"
echo "     - RAZORPAY_WEBHOOK_SECRET"
echo "     - PADDLE_API_KEY"
echo "     - PADDLE_WEBHOOK_SECRET"

echo ""
echo "Step 4: Running tests..."
npm test
print_status "All tests passed"

echo ""
echo "======================================"
print_status "Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Configure Razorpay webhook endpoint to:"
echo "     https://vnhllbfvpkzdbqbitnnb.supabase.co/functions/v1/razorpay-webhook"
echo "  2. Configure Paddle webhook endpoint to:"
echo "     https://vnhllbfvpkzdbqbitnnb.supabase.co/functions/v1/paddle-webhook"
echo "  2. Set up Gmail OAuth redirect URI in Google Cloud Console"
echo "  3. Verify cron jobs are scheduled in Supabase dashboard"
echo "  4. Configure Brevo SMTP settings for transactional emails"
echo "  4. Test OAuth flow end-to-end"
echo ""
