# Cloudflare Queue Setup Guide

## Overview

This guide sets up Cloudflare Queues for instant new ticker processing alongside the existing cron-based bulk updates.

## Architecture

```
User Request → API (/api/update-tickers) → Intelligence Routing
    ├── New Tickers → Cloudflare Queue → Instant Processing
    └── Existing Tickers → Traditional Job Queue → Cron Processing

Cloudflare Cron Jobs:
    ├── 9 AM & 9 PM UTC → Bulk dividend updates (all tracked tickers)
    └── 9 AM UTC → Traditional job queue processing
```

## Setup Steps

### 1. Create the Cloudflare Queue

```bash
cd ticker-backend-worker2-deployed
npx wrangler queues create ticker-dividend-queue
```

### 2. Deploy the Updated Worker

```bash
# Deploy the worker with queue configuration
npx wrangler deploy

# Verify deployment
npx wrangler tail
```

### 3. Set Environment Variables

Ensure these environment variables are set in Cloudflare:

```bash
TICKER_API_BASE_URL="https://your-vercel-app.vercel.app"
TICKER_API_KEY="your-api-key"
```

### 4. Test the Queue Integration

```bash
# Test queue send endpoint
curl -X POST https://ticker-backend-worker2.your-worker.workers.dev/queue/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "new_ticker_processing",
    "tickers": ["AAPL"],
    "priority": "high",
    "force": false,
    "timestamp": "'$(date -Iseconds)'",
    "requestId": "test_123"
  }'

# Test new ticker via main API
curl -X POST https://your-vercel-app.vercel.app/api/update-tickers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"tickers": ["NEWSTOCK"]}'
```

## Queue Configuration Details

### wrangler.toml Configuration

```toml
# Queue Producer (sends messages)
[[queues.producers]]
binding = "TICKER_QUEUE"
queue = "ticker-dividend-queue"

# Queue Consumer (processes messages)
[[queues.consumers]]
queue = "ticker-dividend-queue"
max_batch_size = 5
max_wait_time = "5 seconds"
max_retries = 3

# Cron triggers
[[triggers.crons]]
cron = "0 9,21 * * *"  # Bulk updates twice daily

[[triggers.crons]]
cron = "0 9 * * *"     # Traditional queue processing daily
```

### Queue Message Format

```json
{
  "type": "new_ticker_processing",
  "tickers": ["AAPL", "MSFT"],
  "priority": "high",
  "force": false,
  "timestamp": "2025-01-15T10:00:00Z",
  "source": "api",
  "requestId": "req_1234567890_abc123"
}
```

## Processing Flow

### 1. User Submits Tickers
```
POST /api/update-tickers
Body: {"tickers": ["AAPL", "NEWSTOCK"]}
```

### 2. Intelligent Routing
- **AAPL**: Existing ticker → Traditional job queue
- **NEWSTOCK**: New ticker → Cloudflare Queue (instant)

### 3. Queue Processing
- Cloudflare Worker receives queue message
- Calls `/api/process-ticker?ticker=NEWSTOCK&fetchType=historical`
- Fetches 2-year historical dividend data immediately

### 4. Bulk Updates (Scheduled)
- Twice daily: Bulk API call for recent dividends (all tickers)
- Once daily: Process any pending traditional job queue items

## Monitoring

### Cloudflare Dashboard
- View queue metrics and message counts
- Monitor worker execution logs
- Check cron trigger status

### API Logs
```bash
# Monitor main API logs
vercel logs --follow

# Monitor worker logs  
npx wrangler tail --format pretty
```

### Queue Status Endpoint
```bash
# Check worker health
curl https://ticker-backend-worker2.your-worker.workers.dev/health
```

## Benefits of Queue Integration

### Performance Improvements
- **New Tickers**: Instant processing (< 30 seconds) vs waiting for cron (up to 12 hours)
- **Existing Tickers**: Efficient bulk updates twice daily
- **Scalability**: Queue handles bursts of new ticker requests

### Efficiency Gains
- **API Calls**: Bulk approach reduces API calls by ~95%
- **Rate Limiting**: Smart distribution across cron schedules
- **Reliability**: Built-in retry logic and error handling

### User Experience
- **Immediate Feedback**: New tickers processed instantly
- **Predictable Updates**: Existing tickers updated on schedule
- **Hybrid Approach**: Best of both worlds

## Troubleshooting

### Common Issues

1. **Queue Messages Not Processing**
   - Check worker logs: `npx wrangler tail`
   - Verify queue binding in wrangler.toml
   - Ensure API_KEY and BASE_URL are set

2. **Rate Limit Issues**
   - Queue processing respects 2-second delays
   - Bulk updates use 12-second intervals
   - Monitor API call logs in database

3. **Message Retries**
   - Failed messages retry up to 3 times
   - Check error logs for permanent failures
   - Dead letter queue behavior after max retries

### Debug Commands

```bash
# List all queues
npx wrangler queues list

# View queue details
npx wrangler queues show ticker-dividend-queue

# Check worker environment
npx wrangler secret list
```

## Cost Considerations

### Cloudflare Queues Pricing
- Requires Workers Paid plan ($5/month minimum)
- Queue operations: $0.40 per million operations
- Typical usage: ~1000 operations/month = ~$0.001

### API Call Optimization
- Traditional: 100 tickers × 365 days × 12 seconds = 438,000 API seconds/year
- New hybrid: ~5 bulk calls × 365 days × 12 seconds = 21,900 API seconds/year
- **Efficiency gain: ~95% reduction in API time**

This queue integration provides instant processing for new tickers while maintaining efficient bulk updates for existing ones!