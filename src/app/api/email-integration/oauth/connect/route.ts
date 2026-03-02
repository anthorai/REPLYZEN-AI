import { NextRequest, NextResponse } from 'next/server';
import { OAuthFlowManager } from '@/lib/email-integration/oauth/oauth-flow';
import { EmailProvider } from '@/lib/email-integration/types';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { code, state, provider } = body;

    if (!code || !state || !provider) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    if (!['google', 'microsoft'].includes(provider)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid provider'
      }, { status: 400 });
    }

    // Get OAuth configuration
    const oauthConfig = getOAuthConfig(provider);
    if (!oauthConfig) {
      return NextResponse.json({
        success: false,
        error: 'Provider not configured'
      }, { status: 500 });
    }

    // Initialize OAuth flow manager
    const encryptionKey = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json({
        success: false,
        error: 'Encryption key not configured'
      }, { status: 500 });
    }

    const oauthFlow = new OAuthFlowManager(encryptionKey, {
      [provider]: oauthConfig
    });

    // Exchange code for tokens
    const result = await oauthFlow.exchangeCodeForTokens(code, state, provider);

    // Create webhook subscription
    try {
      const connection = await getConnection(result.connectionId, user.id);
      if (connection) {
        const tokens = await decryptTokens(connection.encrypted_access_token, connection.encrypted_refresh_token);
        await createWebhookSubscription(user.id, provider as EmailProvider, tokens.accessToken);
      }
    } catch (webhookError) {
      console.warn('Failed to create webhook subscription:', webhookError);
      // Don't fail the OAuth flow if webhook setup fails
    }

    return NextResponse.json({
      success: true,
      data: {
        connectionId: result.connectionId,
        userInfo: result.userInfo,
        provider
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

function getOAuthConfig(provider: EmailProvider) {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      scopes: ['gmail.readonly', 'gmail.send'],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      webhookUrl: 'https://www.googleapis.com/gmail/api/v1/users/me/watch'
    };
  } else if (provider === 'microsoft') {
    return {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      scopes: ['mail.read', 'mail.send'],
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      webhookUrl: 'https://graph.microsoft.com/v1.0/subscriptions'
    };
  }
  
  return null;
}

// Helper functions (would be moved to a utils file in production)
async function createClient() {
  // Implementation would use actual Supabase client
  return {} as any;
}

async function decryptTokens(encryptedAccessToken: string, encryptedRefreshToken: string) {
  // Implementation would use TokenEncryption
  return { accessToken: 'mock', refreshToken: 'mock' };
}

async function getConnection(connectionId: string, userId: string) {
  // Implementation would query database
  return null;
}

async function createWebhookSubscription(userId: string, provider: EmailProvider, accessToken: string) {
  // Implementation would create webhook subscription
  console.log(`Creating webhook subscription for ${provider}`);
}
