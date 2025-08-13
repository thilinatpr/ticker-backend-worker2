# User-Specific Ticker Subscriptions

This document describes the user-specific ticker subscription system implemented in the Cloudflare Worker. Users can subscribe to specific tickers and receive filtered dividend data based on their subscriptions.

## 🎯 Overview

The subscription system allows users to:
- **Subscribe/Unsubscribe** to specific stock tickers
- **Manage Priority Levels** (normal vs high priority)
- **Bulk Operations** for multiple tickers at once
- **Get Filtered Data** - only dividends for subscribed tickers
- **User Isolation** - each API key sees only their own subscriptions

## 📊 Database Schema

### New Tables

**`api_users`** - User accounts linked to API keys
```sql
- api_key (VARCHAR) - Unique API key identifier
- user_name (VARCHAR) - Optional user display name  
- plan_type (VARCHAR) - free, basic, premium
- max_subscriptions (INTEGER) - Subscription limit based on plan
- is_active (BOOLEAN) - Account status
```

**`user_subscriptions`** - User ticker subscriptions
```sql
- user_id (INTEGER) - References api_users.id
- ticker_symbol (VARCHAR) - Stock ticker symbol
- priority (INTEGER) - 1=normal, 2=high priority
- subscribed_at (TIMESTAMP) - When subscription was created
- auto_update_enabled (BOOLEAN) - Enable automatic updates
```

**`subscription_preferences`** - User preferences
```sql
- user_id (INTEGER) - References api_users.id
- update_frequency_hours (INTEGER) - How often to check updates
- include_historical_months (INTEGER) - Historical data range
- dividend_alerts (BOOLEAN) - Enable dividend notifications
```

**`subscription_activity`** - Activity log
```sql
- user_id (INTEGER) - References api_users.id
- action (VARCHAR) - subscribe, unsubscribe, etc.
- ticker_symbol (VARCHAR) - Related ticker
- details (JSONB) - Additional metadata
```

### Views and Functions

**`user_dividends_view`** - Joins dividends with user subscriptions
**`get_user_subscriptions()`** - Get all subscriptions for a user
**`subscribe_to_ticker()`** - Subscribe user to ticker with validation
**`unsubscribe_from_ticker()`** - Remove ticker subscription

## 🚀 API Endpoints

### Subscription Management

#### `GET /subscriptions`
Get current user's subscriptions
- **Auth:** Required (X-API-Key)
- **Response:** List of subscribed tickers with metadata

```json
{
  "success": true,
  "subscriptions": [
    {
      "ticker_symbol": "AAPL",
      "subscribed_at": "2025-08-13T10:00:00Z",
      "priority": 2,
      "auto_update_enabled": true,
      "dividend_count": 8
    }
  ],
  "total": 1
}
```

#### `POST /subscriptions`
Subscribe to a ticker
- **Auth:** Required (X-API-Key)
- **Body:** `{"ticker": "AAPL", "priority": 1}`
- **Priority:** 1=normal, 2=high priority

```bash
curl -X POST "https://your-worker.workers.dev/subscriptions" \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "priority": 2}'
```

#### `DELETE /subscriptions`
Unsubscribe from a ticker
- **Auth:** Required (X-API-Key)
- **Body:** `{"ticker": "AAPL"}`

```bash
curl -X DELETE "https://your-worker.workers.dev/subscriptions" \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL"}'
```

#### `POST /subscriptions/bulk`
Bulk subscribe/unsubscribe operations
- **Auth:** Required (X-API-Key)
- **Body:** `{"action": "subscribe|unsubscribe", "tickers": ["AAPL", "MSFT"], "priority": 1}`

```bash
# Bulk subscribe
curl -X POST "https://your-worker.workers.dev/subscriptions/bulk" \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "subscribe",
    "tickers": ["AAPL", "MSFT", "GOOGL"],
    "priority": 1
  }'

# Bulk unsubscribe  
curl -X POST "https://your-worker.workers.dev/subscriptions/bulk" \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "unsubscribe",
    "tickers": ["AAPL", "MSFT"]
  }'
```

### User-Specific Data

#### `GET /my-dividends`
Get dividends only for user's subscribed tickers
- **Auth:** Required (X-API-Key)
- **Query Params:**
  - `startDate` - Filter from date (YYYY-MM-DD)
  - `endDate` - Filter to date (YYYY-MM-DD)
  - `limit` - Number of results
  - `offset` - Pagination offset
  - `format=csv` - Return CSV format

```bash
# Get all user dividends
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-worker.workers.dev/my-dividends"

# Get 2025 dividends in CSV format
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-worker.workers.dev/my-dividends?startDate=2025-01-01&endDate=2025-12-31&format=csv"
```

**Response:**
```json
{
  "success": true,
  "dividends": [
    {
      "ticker": "AAPL",
      "declarationDate": "2025-07-31",
      "exDividendDate": "2025-08-11", 
      "amount": 0.26,
      "currency": "USD",
      "priority": 2,
      "subscribedAt": "2025-08-13T10:00:00Z"
    }
  ],
  "totalRecords": 1,
  "dataSource": "user_subscriptions"
}
```

## 👥 User Plans & Limits

### Plan Types

**Free Plan**
- Max 10 subscriptions
- Normal priority only
- Basic features

**Basic Plan**  
- Max 25 subscriptions
- High priority available
- CSV export

**Premium Plan**
- Max 100 subscriptions
- All priority levels
- Advanced features

### Subscription Limits

The system enforces subscription limits based on user plan:
- Attempts to exceed limits return error with current usage
- Users can upgrade plans to increase limits
- Bulk operations respect individual limits

## 🔒 Security & Isolation

### User Isolation
- Each API key represents a unique user
- Users can only see/manage their own subscriptions
- Database queries filtered by user_id automatically

### Authentication
- All subscription endpoints require API key
- API keys mapped to user accounts in database
- Row Level Security (RLS) enforced on all tables

### Data Privacy
- User subscription data is completely isolated
- No cross-user data visibility
- Activity logging for audit trails

## 📈 Usage Examples

### Complete Workflow

```bash
# 1. Check current subscriptions (initially empty)
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-worker.workers.dev/subscriptions"

# 2. Subscribe to some tickers
curl -X POST -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "priority": 2}' \
  "https://your-worker.workers.dev/subscriptions"

# 3. Bulk subscribe to portfolio
curl -X POST -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"action": "subscribe", "tickers": ["MSFT", "GOOGL", "NVDA"]}' \
  "https://your-worker.workers.dev/subscriptions/bulk"

# 4. Get dividend data for subscribed tickers only
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-worker.workers.dev/my-dividends?startDate=2025-01-01"

# 5. Export to CSV for analysis
curl -H "X-API-Key: tk_demo_key_12345" \
  "https://your-worker.workers.dev/my-dividends?format=csv" \
  > my_dividends.csv
```

### Integration with Existing Endpoints

The subscription system complements existing endpoints:

- **Global Data:** `/dividends/all` - All tickers (unchanged)
- **Specific Ticker:** `/dividends/{ticker}` - Single ticker (unchanged)  
- **User Data:** `/my-dividends` - User's subscriptions only (NEW)

## 🛠️ Database Deployment

To deploy the subscription system:

```sql
-- Run the subscription schema
\i sql/user-subscriptions-schema.sql

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('api_users', 'user_subscriptions', 'subscription_preferences');

-- Check sample users
SELECT api_key, user_name, plan_type, max_subscriptions FROM api_users;
```

## 🧪 Testing

Use the comprehensive test script:

```bash
node test-subscriptions.js
```

The test script covers:
- ✅ Subscription management (add/remove/bulk)
- ✅ User isolation and multi-user scenarios  
- ✅ Data filtering and CSV export
- ✅ Error handling and validation
- ✅ Authentication requirements
- ✅ Priority and limit enforcement

## 📊 Monitoring & Analytics

### Subscription Analytics

Query useful metrics:
```sql
-- User subscription summary
SELECT * FROM subscription_summary;

-- Most popular tickers
SELECT ticker_symbol, COUNT(*) as subscriber_count
FROM user_subscriptions 
GROUP BY ticker_symbol 
ORDER BY subscriber_count DESC;

-- User activity
SELECT action, COUNT(*) as count
FROM subscription_activity
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY action;
```

### Performance Considerations

- **Indexes:** Optimized for user_id + ticker_symbol queries
- **Views:** Pre-joined data for efficient user queries  
- **RLS:** Database-level security with minimal overhead
- **Caching:** API results can be cached per user

## 🔄 Migration Path

For existing users:
1. Deploy database schema
2. Create user accounts for existing API keys
3. Existing endpoints continue working unchanged
4. Users can start using subscription features immediately
5. Gradual migration to subscription-based workflow

## 🚨 Error Handling

Common error scenarios:

**Subscription Limit Exceeded**
```json
{
  "success": false,
  "error": "Subscription limit reached",
  "limit": 10,
  "current": 10
}
```

**Invalid Ticker**
```json
{
  "success": false, 
  "error": "Invalid request: ticker is required"
}
```

**User Not Found**
```json
{
  "success": false,
  "error": "Invalid API key or inactive user"
}
```

The subscription system provides a robust, scalable foundation for user-specific dividend tracking with comprehensive authentication, isolation, and management features.