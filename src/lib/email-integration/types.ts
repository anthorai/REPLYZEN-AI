export type EmailProvider = 'google' | 'microsoft';

export type ConnectionStatus = 'ACTIVE' | 'REAUTH_REQUIRED' | 'DISCONNECTED' | 'ERROR';

export type OAuthScope = 
  | 'gmail.readonly'
  | 'gmail.send'
  | 'gmail.modify'
  | 'mail.read'
  | 'mail.send'
  | 'mail.readwrite';

export interface EmailConnection {
  id: string;
  userId: string;
  provider: EmailProvider;
  emailAddress: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiry: Date;
  scopes: OAuthScope[];
  connectionStatus: ConnectionStatus;
  webhookSubscriptionId?: string;
  lastSyncAt?: Date;
  lastRefreshedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verifiedEmail: boolean;
}

export interface WebhookEvent {
  provider: EmailProvider;
  eventType: string;
  messageId: string;
  threadId: string;
  historyId?: string;
  timestamp: Date;
  payload: any;
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  provider: EmailProvider;
  subscriptionId: string;
  webhookUrl: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface EmailSyncResult {
  success: boolean;
  threadsUpdated: number;
  newThreads: number;
  error?: string;
  processingTimeMs: number;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  snippet: string;
  body?: string;
  timestamp: Date;
  isRead: boolean;
  hasAttachments: boolean;
  labels?: string[];
}

export interface EmailThread {
  id: string;
  messages: EmailMessage[];
  participants: string[];
  lastMessageAt: Date;
  lastMessageFrom: string;
  subject: string;
  snippet: string;
  isRead: boolean;
  hasAttachments: boolean;
  messageCount: number;
}

export interface TokenRefreshResult {
  success: boolean;
  newAccessToken?: string;
  newExpiry?: Date;
  error?: string;
  requiresReauth: boolean;
}

export interface ConnectionLimits {
  freePlan: number;
  proPlan: number;
  enterprisePlan: number;
}

export interface EmailIntegrationConfig {
  encryptionKey: string;
  webhookBaseUrl: string;
  tokenRefreshThreshold: number; // minutes before expiry
  maxRetryAttempts: number;
  webhookTimeout: number; // seconds
  rateLimitPerUser: number; // requests per minute
}

export interface OAuthState {
  userId: string;
  provider: EmailProvider;
  state: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface SecurityAuditLog {
  id: string;
  userId: string;
  action: 'connect' | 'disconnect' | 'refresh' | 'webhook_received' | 'sync_completed';
  provider: EmailProvider;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface EmailProviderConfig {
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: OAuthScope[];
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    webhookUrl: string;
  };
  microsoft: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: OAuthScope[];
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    webhookUrl: string;
  };
}

export interface WebhookVerificationResult {
  isValid: boolean;
  provider: EmailProvider;
  userId?: string;
  error?: string;
}

export interface SyncQueueItem {
  id: string;
  userId: string;
  provider: EmailProvider;
  threadId: string;
  eventType: string;
  payload: any;
  priority: 'high' | 'medium' | 'low';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  createdAt: Date;
}

export interface EmailUsageStats {
  userId: string;
  provider: EmailProvider;
  messagesProcessed: number;
  lastSyncAt: Date;
  webhookEventsReceived: number;
  errorsCount: number;
  averageProcessingTime: number;
}

export interface ConnectionHealthCheck {
  connectionId: string;
  provider: EmailProvider;
  status: 'healthy' | 'warning' | 'error';
  lastTokenRefresh: Date;
  lastWebhookReceived?: Date;
  tokenExpiry: Date;
  webhookSubscriptionExpiry?: Date;
  issues: string[];
}

export interface BulkSyncResult {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalThreadsProcessed: number;
  processingTimeMs: number;
  errors: Array<{
    connectionId: string;
    error: string;
  }>;
}

export interface EmailIntegrationError extends Error {
  code: string;
  provider?: EmailProvider;
  userId?: string;
  requiresReauth?: boolean;
  retryable?: boolean;
}

export class EmailConnectionError extends EmailIntegrationError {
  constructor(
    message: string,
    code: string,
    provider?: EmailProvider,
    userId?: string,
    requiresReauth: boolean = false,
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'EmailConnectionError';
    this.code = code;
    this.provider = provider;
    this.userId = userId;
    this.requiresReauth = requiresReauth;
    this.retryable = retryable;
  }
}

export class TokenEncryptionError extends EmailIntegrationError {
  constructor(message: string, userId?: string) {
    super(message, 'TOKEN_ENCRYPTION_ERROR', undefined, userId, false, false);
    this.name = 'TokenEncryptionError';
  }
}

export class WebhookValidationError extends EmailIntegrationError {
  constructor(message: string, provider?: EmailProvider) {
    super(message, 'WEBHOOK_VALIDATION_ERROR', provider, undefined, false, false);
    this.name = 'WebhookValidationError';
  }
}

export class OAuthFlowError extends EmailIntegrationError {
  constructor(
    message: string,
    provider: EmailProvider,
    code: string = 'OAUTH_FLOW_ERROR'
  ) {
    super(message, code, provider, undefined, true, false);
    this.name = 'OAuthFlowError';
  }
}
