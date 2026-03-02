# Action-Oriented Dashboard for Replyzen

**This is NOT an analytics dashboard. This is NOT a data visualization page.**

This is an ACTION CONTROL PANEL designed to drive daily engagement through clarity and focus.

## Core Philosophy

**Clarity reduces friction.**
**Friction reduction increases daily usage.**
**Daily usage increases stickiness.**

## Dashboard Structure (Strict 4 Sections)

### SECTION 1 — Needs Action Today
**Definition:** Threads eligible for follow-up but not auto-sent.

**Display:**
- Large bold count
- List preview (max 5 threads)
- Thread subject
- Silence duration
- Suggested action label
- CTA button: "Review & Send"

**Example:**
```
3 Follow-Ups Ready
- Proposal – ACME Corp (4 days silent)
- Interview Follow-Up – John (3 days silent)
- Invoice Reminder – Delta Ltd (5 days silent)
```

**Empty State:**
```
No follow-ups needed today.
```

### SECTION 2 — Sent Automatically
**Definition:** Follow-ups sent via Auto-Send in last 24 hours.

**Display:**
- Count
- Short log summary (last 5)
- Status badge: Sent Successfully

**Example:**
```
2 Sent Automatically
- Proposal – ACME Corp (Sent after 4 days)
- Meeting Follow-Up – Sarah (Sent after 3 days)
```

**Empty State:**
```
No automatic sends today.
```

### SECTION 3 — Waiting Threads
**Definition:** Threads in silence window but not yet eligible.

**Display:**
- Count
- Days remaining until follow-up trigger

**Example:**
```
18 Waiting Threads
- Client Onboarding – 2 days remaining
- Proposal – 1 day remaining
```

### SECTION 4 — Usage
**Definition:** Plan consumption summary.

**Display:**
- Follow-ups used / monthly limit
- Auto-Send enabled badge (Pro/Enterprise)

**Example:**
```
27 / 2000 Used
Auto-Send: Enabled
```

## UX Principles

- **Large numbers first** - Immediate visual hierarchy
- **Minimal text** - No cognitive overload
- **No clutter** - Clean, focused interface
- **No dense tables** - Card-based layout
- **No unnecessary controls** - Streamlined actions
- **One screen, one scroll** - Instant comprehension

## Performance Requirements

- **Load time:** < 1 second
- **Single API call:** `/api/dashboard/summary`
- **Cached data:** 30-second TTL
- **Optimized indexes:** Fast database queries

## API Response Format

```typescript
GET /api/dashboard/summary

{
  needs_action_count: number,
  needs_action_threads: ActionThread[],
  auto_sent_count_24h: number,
  auto_sent_logs: AutoSentLog[],
  waiting_count: number,
  waiting_threads: WaitingThread[],
  usage_current: number,
  usage_limit: number,
  auto_send_enabled: boolean,
  user_plan: 'free' | 'pro' | 'enterprise',
  sync_status: 'synced' | 'syncing' | 'error' | 'no_accounts',
  connected_accounts: number,
  last_sync_at: Date
}
```

## Visual Priority Order

1. **Needs Action Today** (top) - Primary attention zone
2. **Sent Automatically** - Build trust in automation
3. **Waiting Threads** - System status awareness
4. **Usage** (bottom) - Plan consumption

## Monetization Integration

### Free Plan
- Hide Section 2 (auto-send logs)
- Show upgrade CTA: "Enable Auto-Send with Pro"

### Pro Plan
- Show all sections
- Auto-Send enabled badge
- Usage warnings at 80%

### Enterprise Plan
- All features enabled
- Higher limits
- Priority processing

## Edge Cases

### No Connected Email Accounts
```
Connect your email to activate follow-up tracking.
```

### System Syncing
```
Syncing conversations…
```

### Error State
```
Unable to sync your emails.
[Retry button]
```

## Component Architecture

### Main Components

#### DashboardMain
- Orchestrates all sections
- Handles data fetching and caching
- Manages loading/error states
- Coordinates user actions

#### Section Components
- **ActionSection** - Threads needing manual review
- **AutoSentSection** - Recent automatic sends
- **WaitingSection** - Threads in waiting period
- **UsageSection** - Plan consumption and limits

#### UI Components
- **EmptyState** - Onboarding and error states
- **LoadingState** - Skeleton loading
- **ErrorState** - Error handling with retry
- **DashboardHeader** - Status and refresh controls

### Data Flow

1. **API Call** → `/api/dashboard/summary`
2. **Cache Check** → 30-second TTL
3. **Data Transform** → Component-ready format
4. **Render** → Section components
5. **Actions** → Thread review, upgrade, sync

## Database Schema

### Optimized Tables

#### dashboard_summary_cache
- Pre-aggregated dashboard data
- 30-minute expiration
- JSONB for thread details
- Per-user caching

#### dashboard_usage_tracking
- Daily usage metrics
- Plan-based limits
- Performance tracking

#### dashboard_thread_snapshots
- Fast thread data access
- Type-based categorization
- Automatic cleanup

### Performance Indexes

```sql
-- Action threads
CREATE INDEX idx_email_threads_dashboard_needs_action 
ON email_threads(user_id, needs_followup, last_message_at);

-- Auto-sent logs
CREATE INDEX idx_followup_suggestions_dashboard_auto_sent 
ON followup_suggestions(user_id, auto_send_safe, status, created_at);

-- Usage tracking
CREATE INDEX idx_followup_suggestions_dashboard_usage 
ON followup_suggestions(user_id, created_at);
```

## Caching Strategy

### API Level
- **30-second TTL** for dashboard summary
- **Cache hit** indicator in response
- **Background refresh** via workers

### Database Level
- **Materialized views** for complex aggregations
- **Partial indexes** for common queries
- **Connection pooling** for concurrent access

### Browser Level
- **React Query** or SWR for client caching
- **Background refresh** on focus
- **Optimistic updates** for actions

## Upgrade Triggers

### Free → Pro
- Auto-send functionality hidden
- "Enable Auto-Send with Pro" CTA
- Usage limit warnings

### Pro → Enterprise
- High usage warnings (80%+)
- "Upgrade for higher limits" suggestion
- Priority processing benefits

## Mobile Optimization

### Responsive Design
- **Single column** layout on mobile
- **Touch-friendly** CTA buttons
- **Swipe gestures** for actions
- **Progressive enhancement**

### Performance
- **Reduced data** payload
- **Image lazy loading**
- **Minimal JavaScript**
- **Fast initial paint**

## Monitoring & Analytics

### Performance Metrics
- **Load time** < 1 second
- **API response time** < 500ms
- **Cache hit rate** > 80%
- **Error rate** < 1%

### User Engagement
- **Daily active users**
- **Action completion rate**
- **Upgrade conversion rate**
- **Feature adoption**

### Business Metrics
- **Follow-up generation rate**
- **Auto-send adoption**
- **Plan distribution**
- **Retention by plan**

## Security Considerations

### Data Access
- **Row Level Security** for user data
- **Plan-based feature gating**
- **Rate limiting** per user
- **Input validation**

### Privacy
- **Email address masking** in UI
- **Secure API endpoints**
- **Audit logging** for actions
- **GDPR compliance**

## Future Enhancements

### Planned Features
- **Real-time updates** via WebSocket
- **Advanced filtering** options
- **Bulk actions** for threads
- **Custom thread priorities**

### Performance Improvements
- **Edge caching** with CDN
- **Database sharding** for scale
- **GraphQL API** for efficiency
- **Service workers** for offline

### UX Enhancements
- **Keyboard shortcuts**
- **Drag-and-drop** actions
- **Voice commands**
- **Dark mode** support

## Integration Points

### Follow-Up Generation Engine
- Receives thread data
- Displays action items
- Triggers manual review flow

### Auto-Send Control System
- Shows auto-sent logs
- Builds trust in automation
- Provides transparency

### User Settings
- Plan configuration
- Email account management
- Notification preferences

### Billing System
- Usage tracking
- Limit enforcement
- Upgrade prompts

## Testing Strategy

### Unit Tests
- Component rendering
- Data transformation
- Action handlers
- Error scenarios

### Integration Tests
- API endpoints
- Database queries
- Cache behavior
- User flows

### E2E Tests
- Complete dashboard flow
- Cross-browser compatibility
- Mobile responsiveness
- Performance benchmarks

## Deployment Considerations

### Environment Variables
```env
NEXT_PUBLIC_DASHBOARD_CACHE_TTL=30000
NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL=30000
DASHBOARD_MAX_THREADS_PER_SECTION=5
```

### Monitoring
- **Error tracking** (Sentry)
- **Performance monitoring** (New Relic)
- **User analytics** (Mixpanel)
- **Health checks** (Uptime)

### Scaling
- **Horizontal scaling** via load balancer
- **Database read replicas**
- **CDN for static assets
- **Background workers** for cache updates

---

**Remember: This is an ACTION CONTROL PANEL. Every element must drive user action or provide essential context. No analytics noise. No vanity metrics. Only what requires attention.**
