import { 
  EmailProvider, 
  OAuthTokenResponse, 
  OAuthUserInfo, 
  OAuthState,
  EmailConnectionError,
  OAuthFlowError,
  ConnectionStatus
} from '../types';
import { TokenEncryption } from '../security/token-encryption';
import { supabase } from '@/integrations/supabase/client';

export class OAuthFlowManager {
  private tokenEncryption: TokenEncryption;
  private providerConfigs: Record<EmailProvider, any>;

  constructor(encryptionKey: string, providerConfigs: Record<EmailProvider, any>) {
    this.tokenEncryption = new TokenEncryption(encryptionKey);
    this.providerConfigs = providerConfigs;
  }

  /**
   * Generates OAuth authorization URL
   */
  generateAuthUrl(userId: string, provider: EmailProvider): {
    authUrl: string;
    state: string;
  } {
    const config = this.providerConfigs[provider];
    const state = this.generateOAuthState(userId, provider);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state.state,
      access_type: 'offline', // For refresh token
      prompt: 'consent' // Force consent to get refresh token
    });

    // Add provider-specific parameters
    if (provider === 'google') {
      params.set('include_granted_scopes', 'true');
    } else if (provider === 'microsoft') {
      params.set('response_mode', 'query');
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    return { authUrl, state: state.state };
  }

  /**
   * Exchanges authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: string,
    provider: EmailProvider
  ): Promise<{
    connectionId: string;
    userInfo: OAuthUserInfo;
  }> {
    try {
      // Validate state
      const oauthState = await this.validateOAuthState(state);
      if (!oauthState) {
        throw new OAuthFlowError('Invalid or expired OAuth state', provider);
      }

      // Exchange code for tokens
      const tokenResponse = await this.exchangeCode(code, provider);
      
      // Get user info
      const userInfo = await this.getUserInfo(tokenResponse.accessToken, provider);

      // Encrypt and store tokens
      const encryptedTokens = this.tokenEncryption.encryptTokenResponse({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresIn: tokenResponse.expiresIn,
        scope: tokenResponse.scope
      });

      // Store connection
      const connectionId = await this.storeConnection({
        userId: oauthState.userId,
        provider,
        emailAddress: userInfo.email,
        ...encryptedTokens,
        scopes: tokenResponse.scope.split(' ').filter(Boolean) as any[],
        connectionStatus: 'ACTIVE'
      });

      // Clean up OAuth state
      await this.deleteOAuthState(state);

      return { connectionId, userInfo };

    } catch (error) {
      console.error('OAuth token exchange failed:', error);
      throw new OAuthFlowError(
        `Failed to exchange authorization code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider
      );
    }
  }

  /**
   * Refreshes access token
   */
  async refreshTokens(connectionId: string): Promise<{
    success: boolean;
    requiresReauth: boolean;
    error?: string;
  }> {
    try {
      // Get connection from database
      const { data: connection, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !connection) {
        throw new EmailConnectionError('Connection not found', 'CONNECTION_NOT_FOUND');
      }

      // Decrypt refresh token
      const tokens = this.tokenEncryption.decryptTokens(
        connection.encrypted_refresh_token,
        connection.encrypted_refresh_token
      );

      // Refresh tokens
      const newTokens = await this.refreshAccessToken(tokens.refreshToken, connection.provider as EmailProvider);

      // Encrypt and update tokens
      const encryptedTokens = this.tokenEncryption.encryptTokenResponse({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || tokens.refreshToken,
        expiresIn: newTokens.expiresIn,
        scope: newTokens.scope
      });

      // Update connection
      const { error: updateError } = await supabase
        .from('email_connections')
        .update({
          encrypted_access_token: encryptedTokens.encryptedAccessToken,
          encrypted_refresh_token: encryptedTokens.encryptedRefreshToken,
          token_expiry: encryptedTokens.tokenExpiry,
          last_refreshed_at: new Date(),
          connection_status: 'ACTIVE',
          updated_at: new Date()
        })
        .eq('id', connectionId);

      if (updateError) {
        throw new EmailConnectionError('Failed to update connection', 'UPDATE_FAILED');
      }

      return { success: true, requiresReauth: false };

    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // Mark connection as requiring re-auth if refresh fails
      if (error instanceof EmailConnectionError) {
        await supabase
          .from('email_connections')
          .update({ connection_status: 'REAUTH_REQUIRED', updated_at: new Date() })
          .eq('id', connectionId);
      }

      return {
        success: false,
        requiresReauth: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Disconnects email account
   */
  async disconnectEmail(connectionId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get connection
      const { data: connection, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (error || !connection) {
        throw new EmailConnectionError('Connection not found', 'CONNECTION_NOT_FOUND');
      }

      // Revoke token at provider
      try {
        await this.revokeToken(connection.encrypted_access_token, connection.provider as EmailProvider);
      } catch (revokeError) {
        // Log but don't fail the disconnect
        console.warn('Failed to revoke token at provider:', revokeError);
      }

      // Remove webhook subscription
      if (connection.webhook_subscription_id) {
        await this.removeWebhookSubscription(
          connection.webhook_subscription_id,
          connection.provider as EmailProvider
        );
      }

      // Delete connection
      const { error: deleteError } = await supabase
        .from('email_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new EmailConnectionError('Failed to delete connection', 'DELETE_FAILED');
      }

      // Log disconnect event
      await this.logSecurityEvent(userId, 'disconnect', connection.provider as EmailProvider, true);

      return { success: true };

    } catch (error) {
      console.error('Email disconnect failed:', error);
      
      await this.logSecurityEvent(userId, 'disconnect', 'unknown' as EmailProvider, false, 
        error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generates and stores OAuth state
   */
  private generateOAuthState(userId: string, provider: EmailProvider): OAuthState {
    const state = this.tokenEncryption.generateSecureState();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return {
      userId,
      provider,
      state,
      createdAt: new Date(),
      expiresAt
    };
  }

  /**
   * Validates OAuth state
   */
  private async validateOAuthState(state: string): Promise<OAuthState | null> {
    try {
      const { data: oauthState, error } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('expires_at', 'gt', new Date().toISOString())
        .single();

      if (error || !oauthState) {
        return null;
      }

      return oauthState as OAuthState;
    } catch (error) {
      console.error('OAuth state validation failed:', error);
      return null;
    }
  }

  /**
   * Deletes OAuth state
   */
  private async deleteOAuthState(state: string): Promise<void> {
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);
  }

  /**
   * Exchanges authorization code for tokens
   */
  private async exchangeCode(code: string, provider: EmailProvider): Promise<OAuthTokenResponse> {
    const config = this.providerConfigs[provider];
    
    const tokenData = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthFlowError(`Token exchange failed: ${errorText}`, provider);
    }

    const tokenResponse = await response.json();

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      scope: tokenResponse.scope,
      tokenType: tokenResponse.token_type || 'Bearer'
    };
  }

  /**
   * Gets user info from provider
   */
  private async getUserInfo(accessToken: string, provider: EmailProvider): Promise<OAuthUserInfo> {
    const config = this.providerConfigs[provider];

    const response = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new OAuthFlowError('Failed to get user info', provider);
    }

    const userData = await response.json();

    // Normalize user data across providers
    if (provider === 'google') {
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        verifiedEmail: userData.verified_email
      };
    } else if (provider === 'microsoft') {
      return {
        id: userData.id,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
        picture: undefined,
        verifiedEmail: true
      };
    }

    throw new OAuthFlowError('Unsupported provider for user info', provider);
  }

  /**
   * Refreshes access token
   */
  private async refreshAccessToken(refreshToken: string, provider: EmailProvider): Promise<OAuthTokenResponse> {
    const config = this.providerConfigs[provider];

    const tokenData = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OAuthFlowError(`Token refresh failed: ${errorText}`, provider);
    }

    const tokenResponse = await response.json();

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || refreshToken,
      expiresIn: tokenResponse.expires_in,
      scope: tokenResponse.scope,
      tokenType: tokenResponse.token_type || 'Bearer'
    };
  }

  /**
   * Revokes token at provider
   */
  private async revokeToken(encryptedAccessToken: string, provider: EmailProvider): Promise<void> {
    const accessToken = this.tokenEncryption.decrypt(encryptedAccessToken);
    
    if (provider === 'google') {
      const revokeUrl = 'https://oauth2.googleapis.com/revoke';
      await fetch(`${revokeUrl}?token=${accessToken}`, {
        method: 'POST'
      });
    }
    // Microsoft doesn't have a direct revoke endpoint, tokens expire naturally
  }

  /**
   * Removes webhook subscription
   */
  private async removeWebhookSubscription(subscriptionId: string, provider: EmailProvider): Promise<void> {
    // Implementation would depend on provider webhook management
    console.log(`Removing webhook subscription ${subscriptionId} for ${provider}`);
  }

  /**
   * Stores email connection
   */
  private async storeConnection(connectionData: {
    userId: string;
    provider: EmailProvider;
    emailAddress: string;
    encryptedAccessToken: string;
    encryptedRefreshToken: string;
    tokenExpiry: Date;
    scopes: string[];
    connectionStatus: ConnectionStatus;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('email_connections')
      .insert({
        user_id: connectionData.userId,
        provider: connectionData.provider,
        email_address: connectionData.emailAddress,
        encrypted_access_token: connectionData.encryptedAccessToken,
        encrypted_refresh_token: connectionData.encryptedRefreshToken,
        token_expiry: connectionData.tokenExpiry.toISOString(),
        scope_list: connectionData.scopes,
        connection_status: connectionData.connectionStatus,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new EmailConnectionError('Failed to store connection', 'STORE_FAILED');
    }

    // Log connection event
    await this.logSecurityEvent(connectionData.userId, 'connect', connectionData.provider, true);

    return data.id;
  }

  /**
   * Logs security events
   */
  private async logSecurityEvent(
    userId: string,
    action: string,
    provider: EmailProvider,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await supabase
        .from('security_audit_logs')
        .insert({
          user_id: userId,
          action,
          provider,
          ip_address: 'unknown', // Would get from request
          user_agent: 'unknown', // Would get from request
          success,
          error,
          timestamp: new Date()
        });
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
  }

  /**
   * Gets OAuth scopes for provider
   */
  getProviderScopes(provider: EmailProvider): string[] {
    return this.providerConfigs[provider].scopes;
  }

  /**
   * Validates provider configuration
   */
  validateProviderConfig(provider: EmailProvider): boolean {
    const config = this.providerConfigs[provider];
    return !!(
      config.clientId &&
      config.clientSecret &&
      config.redirectUri &&
      config.authUrl &&
      config.tokenUrl &&
      config.userInfoUrl &&
      config.scopes?.length > 0
    );
  }
}
