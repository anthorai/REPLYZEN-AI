# Email Integration & Security System for Replyzen

**Security-first OAuth 2.0 integration with encrypted token storage**

Trust is the activation driver.
If users do not trust email access, they will never connect their inbox.

## Core Security Philosophy

**Security > Transparency > Performance**

## Architecture Overview

### OAuth 2.0 Authorization Code Flow

**Supported Providers:**
- Google (Gmail API)
- Microsoft (Outlook / Graph API)

**Minimal Scopes Requested:**
- `gmail.readonly` / `mail.read` - Read message metadata
- `gmail.send` / `mail.send` - Send email
- **NO** full mailbox management scope

**Flow Steps:**
1. User clicks "Connect Email"
2. Redirect to provider OAuth consent screen
3. Request minimal scopes with transparency message
4. Receive authorization code
5. Exchange for access_token, refresh_token, expiry
6. Store tokens encrypted (never log or expose)

### Token Storage Security

**Encryption:**
- AES-256-GCM encryption at rest
- Separate encryption key from database
- Key stored in secure environment variable
- Additional Authenticated Data (AAD) for integrity

**Storage Fields:**
```sql
email_connections (
    provider,
    encrypted_access_token,
    encrypted_refresh_token,
    token_expiry,
    scope_list,
    connection_status,
    webhook_subscription_id
)
```

**Never Store:**
- Raw tokens
- Passwords
- Full inbox content
- Unnecessary historical data

### Webhook-Based Sync Architecture

**Push Notifications (No Polling):**
- Gmail push notifications (watch API)
- Microsoft Graph webhook subscriptions
- Real-time thread updates
- Minimal API calls

**Webhook Security:**
- Signature verification (HMAC-SHA256)
- Rate limiting per provider/IP
- Subscription ID validation
- Request sanitization

**Event Processing:**
1. Verify webhook signature
2. Parse provider-specific event
3. Fetch only relevant thread data
4. Update thread status in database
5. Trigger Silence Detection Engine
6. Log processing metrics

### Data Minimization Policy

**Allowed Storage:**
- Thread ID, Subject, Sender, Timestamp
- Last 3 message snippets (cleaned)
- Metadata for silence detection
- Connection status and tokens

**Prohibited Storage:**
- Entire inbox content
- Attachments
- Full historical chains
- Unrelated conversations

**Content Limits:**
- Message snippets: 500 characters max
- Thread history: Last 10 messages
- Automatic cleanup: 90 days

## Security Features

### Token Encryption

```typescript
// AES-256-GCM with authenticated data
const encrypted = tokenEncryption.encrypt(accessToken);
const decrypted = tokenEncryption.decrypt(encrypted);

// Secure state generation
const state = tokenEncryption.generateSecureState();

// Webhook signature validation
const isValid = tokenEncryption.validateWebhookSignature(
  payload, signature, secret
);
```

### OAuth State Management

**CSRF Protection:**
- Cryptographically secure state parameter
- 10-minute expiration
- Automatic cleanup
- One-time use validation

**State Storage:**
```sql
oauth_states (
    user_id,
    provider,
    state,
    expires_at
)
```

### Security Audit Logging

**Comprehensive Tracking:**
- Connection/disconnect events
- Token refresh attempts
- Webhook processing
- Failed authentication attempts
- IP addresses and user agents

**Audit Fields:**
```sql
security_audit_logs (
    user_id,
    action,
    provider,
    ip_address,
    user_agent,
    success,
    error,
    metadata,
    timestamp
)
```

### Rate Limiting

**Webhook Protection:**
- 100 requests per minute per IP
- Exponential backoff on failures
- Automatic IP blocking for abuse
- Provider-specific limits

**API Protection:**
- User-based rate limiting
- Plan-based connection limits
- Request validation
- DDoS protection

## Connection Management

### Connect Flow

**Transparency Message:**
```
"Replyzen will only read metadata required to detect inactive threads. 
We do not store full inbox content."
```

**Steps:**
1. Generate OAuth state
2. Redirect to provider
3. Exchange code for tokens
4. Encrypt and store tokens
5. Create webhook subscription
6. Log security event

### Disconnect Flow

**Complete Cleanup:**
1. Revoke OAuth token at provider
2. Delete encrypted tokens from database
3. Remove webhook subscription
4. Mark account as disconnected
5. Log disconnect event

**User Control:**
- Instant disconnect available
- No dark patterns
- Clear confirmation dialog
- Data retention policy visible

### Token Refresh

**Automatic Refresh:**
- Check tokens expiring within 10 minutes
- Background worker refresh process
- Update encrypted storage
- Log refresh status

**Failure Handling:**
- Mark connection as REAUTH_REQUIRED
- Notify user in dashboard
- Graceful degradation
- Manual re-auth flow

## Monetization Integration

### Plan-Based Limits

**Free Plan:**
- 1 email account allowed
- Basic webhook sync
- 60-minute sync intervals

**Pro Plan:**
- 5 email accounts allowed
- Priority webhook sync
- 15-minute sync intervals

**Enterprise Plan:**
- 20 email accounts allowed
- Priority webhook sync
- 5-minute sync intervals

### Connection Enforcement

```sql
CREATE TRIGGER enforce_connection_limits
BEFORE INSERT ON email_connections
FOR EACH ROW
EXECUTE FUNCTION enforce_connection_limits();
```

### Upgrade Triggers

**Connection Limit Reached:**
```
"You've reached your connection limit. 
Upgrade to Pro to connect more email accounts."
```

**Premium Features:**
- Multiple account management
- Priority webhook processing
- Faster sync intervals
- Advanced security features

## API Design

### OAuth Endpoints

**Initiate Connection:**
```
POST /api/email-integration/oauth/initiate
{
  provider: 'google' | 'microsoft'
}

Response:
{
  authUrl: string,
  state: string
}
```

**Handle Callback:**
```
POST /api/email-integration/oauth/callback
{
  code: string,
  state: string,
  provider: string
}

Response:
{
  success: boolean,
  connectionId: string,
  userInfo: object
}
```

**Disconnect:**
```
DELETE /api/email-integration/connections/:id

Response:
{
  success: boolean,
  message: string
}
```

### Webhook Endpoints

**Provider Webhook:**
```
POST /api/email-integration/webhooks/:provider
Headers: Provider-specific signature
Body: Encrypted webhook payload

Response:
{
  success: boolean,
  processed: boolean
}
```

### Management Endpoints

**List Connections:**
```
GET /api/email-integration/connections

Response:
{
  connections: [{
    id: string,
    provider: string,
    emailAddress: string,
    status: string,
    lastSyncAt: string
  }]
}
```

**Connection Status:**
```
GET /api/email-integration/connections/:id/status

Response:
{
  status: 'ACTIVE' | 'REAUTH_REQUIRED' | 'DISCONNECTED',
  tokenExpiry: string,
  lastRefresh: string,
  webhookStatus: string
}
```

## Database Schema

### Core Tables

**email_connections**
- Encrypted token storage
- Connection status tracking
- Webhook subscription management

**oauth_states**
- CSRF protection
- Temporary state storage
- Automatic cleanup

**webhook_subscriptions**
- Push notification management
- Subscription lifecycle
- Expiration tracking

**security_audit_logs**
- Comprehensive audit trail
- Security event tracking
- Compliance reporting

**webhook_event_logs**
- Webhook processing metrics
- Performance monitoring
- Error tracking

### Performance Indexes

```sql
-- Connection lookups
CREATE INDEX idx_email_connections_user_status 
ON email_connections(user_id, connection_status);

-- Token expiry monitoring
CREATE INDEX idx_email_connections_expiry 
ON email_connections(token_expiry);

-- Webhook processing
CREATE INDEX idx_webhook_logs_provider_success 
ON webhook_event_logs(provider, success, created_at);

-- Security audit queries
CREATE INDEX idx_security_audit_user_timestamp 
ON security_audit_logs(user_id, timestamp DESC);
```

## Error Handling

### OAuth Errors

**Invalid State:**
- Reject request
- Log security event
- Require fresh authentication

**Token Exchange Failed:**
- Retry with exponential backoff
- Log provider-specific errors
- Surface user-friendly message

**Scope Insufficient:**
- Request additional permissions
- Re-initiate OAuth flow
- Explain required permissions

### Webhook Errors

**Signature Invalid:**
- Reject immediately
- Log security incident
- Rate limit source IP

**Rate Limit Exceeded:**
- Return 429 status
- Include retry-after header
- Log rate limit event

**Processing Failed:**
- Queue for retry
- Log error details
- Update connection status

### Token Errors

**Refresh Failed:**
- Mark as REAUTH_REQUIRED
- Notify user
- Disable webhook processing

**Token Expired:**
- Attempt refresh
- If refresh fails, require re-auth
- Graceful service degradation

## Monitoring & Observability

### Security Metrics

**Connection Events:**
- Successful connections per hour
- Failed authentication attempts
- Token refresh success rate
- Disconnect events

**Webhook Metrics:**
- Processing latency
- Success/failure rates
- Provider-specific performance
- Rate limit violations

### Performance Metrics

**Response Times:**
- OAuth flow completion time
- Token refresh duration
- Webhook processing time
- Database query performance

**System Health:**
- Active connection count
- Token expiry distribution
- Webhook subscription status
- Error rates by provider

### Alerts

**Security Alerts:**
- Multiple failed auth attempts
- Unusual webhook activity
- Token refresh failures
- Rate limit violations

**Performance Alerts:**
- High webhook processing latency
- Database query timeouts
- OAuth flow failures
- Connection status changes

## Compliance & Privacy

### Data Protection

**Encryption:**
- Tokens encrypted at rest
- Webhook signatures verified
- Secure key management
- Regular key rotation

**Access Control:**
- Row Level Security (RLS)
- User-based data isolation
- Plan-based feature gating
- Audit trail maintenance

### Privacy Controls

**Data Minimization:**
- Store only necessary data
- Automatic cleanup policies
- User data export options
- Right to deletion

**Transparency:**
- Clear scope explanations
- Data usage disclosure
- Privacy policy alignment
- User consent tracking

## Testing Strategy

### Security Testing

**OAuth Flow:**
- State parameter validation
- CSRF protection testing
- Token encryption verification
- Scope limitation testing

**Webhook Security:**
- Signature validation testing
- Rate limit verification
- Payload sanitization
- Injection attack prevention

### Integration Testing

**Provider Testing:**
- Google OAuth flow
- Microsoft OAuth flow
- Webhook subscription management
- Token refresh scenarios

**Error Scenarios:**
- Network failures
- Provider outages
- Invalid tokens
- Rate limiting

### Performance Testing

**Load Testing:**
- Concurrent OAuth flows
- Webhook volume testing
- Database performance
- Token refresh throughput

**Stress Testing:**
- High connection volumes
- Webhook burst handling
- Memory usage monitoring
- Resource exhaustion

## Deployment Considerations

### Environment Variables

**Required:**
```
EMAIL_TOKEN_ENCRYPTION_KEY=your-256-bit-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=your-redirect-uri
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=your-redirect-uri
WEBHOOK_BASE_URL=your-webhook-url
```

**Security:**
- Use secure key management
- Rotate encryption keys regularly
- Monitor environment variable access
- Use separate keys per environment

### Scaling Considerations

**Horizontal Scaling:**
- Stateless OAuth flows
- Database connection pooling
- Webhook load balancing
- Rate limiting per instance

**Database Optimization:**
- Read replicas for webhook processing
- Connection pooling
- Query optimization
- Index maintenance

### Backup & Recovery

**Data Backup:**
- Encrypted token storage
- Audit log preservation
- Configuration backup
- Disaster recovery testing

**Key Management:**
- Encryption key backup
- Key rotation procedures
- Emergency key replacement
- Access control maintenance

---

**Remember: Trust is the activation driver. Every security measure must be visible and understandable to users. Transparency builds trust, and trust drives adoption.**
