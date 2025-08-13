# Cloudflare Worker Authentication

This document describes the API authentication system implemented in the Cloudflare Worker for the ticker backend service.

## Overview

The Cloudflare Worker now includes comprehensive API key authentication for all endpoints except the health check. This provides secure access control and rate limiting for the dividend data API.

## Authentication Features

### 🔐 API Key Validation
- **Format Validation**: API keys must start with `tk_` and be at least 10 characters long
- **Active Key Check**: Only active API keys are accepted
- **Multiple Header Support**: API keys can be provided via:
  - `X-API-Key` header (recommended)
  - `Authorization: Bearer <key>` header
  - `apikey` query parameter (for simple GET requests)

### 🚦 Rate Limiting
- **Per-Key Limits**: Each API key has its own rate limit (default: 100 requests/hour)
- **Sliding Window**: Rate limiting uses a 1-hour sliding window
- **Headers**: Rate limit information returned in response headers:
  - `X-RateLimit-Limit`: Total requests allowed per hour
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: When the rate limit window resets (for exceeded limits)

### 🔓 Public Endpoints
- **Health Check**: `/health` endpoint requires no authentication
- **CORS Support**: Proper CORS headers for cross-origin requests

## Valid API Keys

The following API keys are currently configured:

1. **Demo Key**: `tk_demo_key_12345`
   - Rate limit: 100 requests/hour
   - For testing and demo purposes

2. **Test Key**: `tk_test_67890`
   - Rate limit: 100 requests/hour  
   - For development testing

3. **Environment Key**: Uses `TICKER_API_KEY` environment variable
   - Configurable via wrangler.toml
   - Default: `tk_demo_key_12345`

## Protected Endpoints

All endpoints except `/health` require authentication:

- `GET /dividends/all` - Get all dividend data
- `GET /dividends/{ticker}` - Get dividends for specific ticker
- `POST /update-tickers` - Submit tickers for processing
- `POST /process` - Process single ticker

## HTTP Status Codes

- `200` - Success (with rate limit headers)
- `401` - Unauthorized (missing or invalid API key)
- `429` - Rate limit exceeded
- `400` - Bad request (invalid parameters)
- `500` - Internal server error

## Example Usage

### Authenticated Request
```bash
curl -X GET "https://your-worker.workers.dev/dividends/AAPL" \
  -H "X-API-Key: tk_demo_key_12345" \
  -H "Content-Type: application/json"
```

### Using Authorization Header
```bash
curl -X GET "https://your-worker.workers.dev/dividends/all" \
  -H "Authorization: Bearer tk_demo_key_12345" \
  -H "Content-Type: application/json"
```

### Using Query Parameter
```bash
curl -X GET "https://your-worker.workers.dev/dividends/AAPL?apikey=tk_demo_key_12345"
```

### Health Check (No Auth)
```bash
curl -X GET "https://your-worker.workers.dev/health"
```

## Error Responses

### Missing API Key
```json
{
  "error": "Authentication failed",
  "message": "API key required"
}
```

### Invalid API Key
```json
{
  "error": "Authentication failed", 
  "message": "Invalid API key"
}
```

### Rate Limit Exceeded
```json
{
  "error": "Authentication failed",
  "message": "Rate limit exceeded"
}
```

## Configuration

### Environment Variables

Add to `wrangler.toml`:
```toml
[vars]
WORKER_AUTH_ENABLED = "true"
WORKER_RATE_LIMIT = "100"
TICKER_API_KEY = "your_api_key_here"
```

### Customizing API Keys

To add or modify API keys, update the `CFNativeAuth` class constructor in `src/stage4-index.js`:

```javascript
this.validKeys = new Set([
  'tk_demo_key_12345',
  'tk_test_67890',
  'tk_your_custom_key',
  env.TICKER_API_KEY || 'tk_demo_key_12345'
]);
```

## Testing

Use the included test script to verify authentication:

```bash
node test-auth.js
```

Update the `WORKER_URL` variable in the test script to point to your deployed worker.

## Security Considerations

1. **API Key Storage**: API keys are stored in memory (suitable for development)
2. **Rate Limiting**: Rate limit data is stored in memory (resets on worker restart)
3. **HTTPS Only**: All communication should use HTTPS
4. **Key Rotation**: Regularly rotate API keys in production
5. **Environment Variables**: Store sensitive keys in Cloudflare environment variables

## Production Deployment

For production use:

1. **Generate Unique Keys**: Create strong, unique API keys for each client
2. **Database Storage**: Consider storing API keys and rate limit data in a database
3. **Monitoring**: Implement logging and monitoring for authentication events
4. **Key Management**: Implement proper key lifecycle management

## Migration from Previous Version

The authentication system is backward compatible. Existing API calls without authentication will receive a 401 error with clear instructions on how to authenticate.

## Support

For authentication issues:
1. Check API key format (must start with `tk_`)
2. Verify rate limits haven't been exceeded
3. Ensure proper headers are set
4. Review error messages for specific guidance