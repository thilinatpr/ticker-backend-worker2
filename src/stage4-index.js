/**
 * Stage 4: Full CF-Native System with Authentication
 * Complete migration to Cloudflare-only architecture
 * Eliminates all Vercel dependencies and complexity
 * Includes comprehensive API key authentication
 */

// API Key authentication utilities
class CFNativeAuth {
  constructor(env) {
    this.validKeys = new Set([
      'tk_demo_key_12345',
      'tk_test_67890',
      env.TICKER_API_KEY || 'tk_demo_key_12345'
    ]);
    this.rateLimits = new Map();
  }

  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key required' };
    }

    if (!this.validKeys.has(apiKey)) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: true };
  }

  checkRateLimit(apiKey, limit = 100) {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    if (!this.rateLimits.has(apiKey)) {
      this.rateLimits.set(apiKey, []);
    }
    
    const requests = this.rateLimits.get(apiKey);
    const recentRequests = requests.filter(timestamp => timestamp > hourAgo);
    
    if (recentRequests.length >= limit) {
      return {
        allowed: false,
        error: 'Rate limit exceeded',
        limit,
        remaining: 0,
        resetTime: Math.min(...recentRequests) + (60 * 60 * 1000)
      };
    }
    
    recentRequests.push(now);
    this.rateLimits.set(apiKey, recentRequests);
    
    return {
      allowed: true,
      limit,
      remaining: limit - recentRequests.length
    };
  }

  authenticate(request, requireAuth = true) {
    // Health check doesn't require authentication
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return { authenticated: true, skipAuth: true };
    }

    if (!requireAuth) {
      return { authenticated: true, skipAuth: true };
    }

    // Extract API key from headers or query params
    const apiKey = request.headers.get('X-API-Key') || 
                   request.headers.get('Authorization')?.replace('Bearer ', '') ||
                   url.searchParams.get('apikey');

    // Validate API key
    const validation = this.validateApiKey(apiKey);
    if (!validation.valid) {
      return {
        authenticated: false,
        error: validation.error,
        status: 401
      };
    }

    // Check rate limits
    const rateCheck = this.checkRateLimit(apiKey);
    if (!rateCheck.allowed) {
      return {
        authenticated: false,
        error: rateCheck.error,
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateCheck.limit.toString(),
          'X-RateLimit-Remaining': rateCheck.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateCheck.resetTime).toISOString()
        }
      };
    }

    return {
      authenticated: true,
      apiKey,
      headers: {
        'X-RateLimit-Limit': rateCheck.limit.toString(),
        'X-RateLimit-Remaining': rateCheck.remaining.toString()
      }
    };
  }
}

// Simple CF-native database operations
class CFNativeDatabaseManager {
  constructor(env) {
    this.supabaseUrl = env.SUPABASE_URL;
    this.supabaseKey = env.SUPABASE_ANON_KEY;
  }

  async upsertTicker(ticker) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/tickers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        symbol: ticker.toUpperCase(),
        is_active: true,
        created_at: new Date().toISOString()
      })
    });

    return response.ok || response.status === 409;
  }

  async storeDividends(ticker, dividends) {
    if (!dividends || dividends.length === 0) {
      return { inserted: 0, errors: 0 };
    }

    const dividendRecords = dividends.map(div => ({
      ticker: ticker.toUpperCase(),
      declaration_date: div.declarationDate,
      record_date: div.recordDate,
      ex_dividend_date: div.exDividendDate,
      pay_date: div.payDate,
      amount: div.amount,
      currency: div.currency || 'USD',
      frequency: div.frequency || 4,
      type: div.type || 'Cash',
      polygon_id: div.polygonId,
      data_source: 'polygon',
      created_at: new Date().toISOString()
    }));

    const response = await fetch(`${this.supabaseUrl}/rest/v1/dividends`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(dividendRecords)
    });

    if (response.ok || response.status === 409) {
      return { inserted: dividends.length, errors: 0 };
    }
    throw new Error(`Failed to store dividends: ${response.status}`);
  }

  async updateTickerTimestamp(ticker) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/tickers?symbol=eq.${ticker.toUpperCase()}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
        },
        body: JSON.stringify({
          last_dividend_update: new Date().toISOString(),
          last_polygon_call: new Date().toISOString()
        })
      }
    );

    return response.ok;
  }

  async getDividends(ticker, startDate = null, endDate = null) {
    let url = `${this.supabaseUrl}/rest/v1/dividends?ticker=eq.${ticker.toUpperCase()}&order=ex_dividend_date.desc`;
    
    if (startDate) {
      url += `&ex_dividend_date=gte.${startDate}`;
    }
    if (endDate) {
      url += `&ex_dividend_date=lte.${endDate}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      }
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  }

  async getAllDividends(startDate = null, endDate = null, limit = null, offset = null) {
    let url = `${this.supabaseUrl}/rest/v1/dividends?order=ex_dividend_date.desc`;
    
    if (startDate) {
      url += `&ex_dividend_date=gte.${startDate}`;
    }
    if (endDate) {
      url += `&ex_dividend_date=lte.${endDate}`;
    }
    if (limit) {
      url += `&limit=${limit}`;
    }
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      }
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  }
}

// Simplified Polygon API manager
class CFNativePolygonManager {
  constructor(env) {
    this.apiKey = env.POLYGON_API_KEY;
    this.baseUrl = 'https://api.polygon.io/v3/reference/dividends';
    this.lastCall = 0;
    this.callCount = 0;
  }

  async fetchDividends(ticker) {
    if (!this.apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    // Simple rate limiting: 5 calls per minute
    const now = Date.now();
    const timeSinceLastReset = now - (this.lastCall || 0);
    
    if (timeSinceLastReset >= 60000) {
      this.callCount = 0;
      this.lastCall = now;
    }

    if (this.callCount >= 5) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    // Calculate date range: 2 years back, 6 months forward
    const endDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
    const startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

    const url = new URL(this.baseUrl);
    url.searchParams.append('ticker', ticker.toUpperCase());
    url.searchParams.append('ex_dividend_date.gte', startDate.toISOString().split('T')[0]);
    url.searchParams.append('ex_dividend_date.lte', endDate.toISOString().split('T')[0]);
    url.searchParams.append('limit', '1000');
    url.searchParams.append('apikey', this.apiKey);

    console.log(`CF-Native: Fetching dividends for ${ticker}`);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ticker-backend-cf-native/4.0',
        'Accept': 'application/json'
      }
    });

    this.callCount++;

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      const errorText = await response.text();
      throw new Error(`Polygon API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const results = data.results || [];
    
    return results.map(dividend => ({
      declarationDate: dividend.declaration_date || null,
      recordDate: dividend.record_date || null,
      exDividendDate: dividend.ex_dividend_date,
      payDate: dividend.pay_date || null,
      amount: parseFloat(dividend.cash_amount) || 0,
      currency: dividend.currency || 'USD',
      frequency: dividend.frequency || 4,
      type: dividend.dividend_type || 'Cash',
      polygonId: dividend.id || null
    }));
  }
}

// User subscription management
class CFNativeSubscriptionManager {
  constructor(env) {
    this.supabaseUrl = env.SUPABASE_URL;
    this.supabaseKey = env.SUPABASE_ANON_KEY;
  }

  async subscribeToTicker(apiKey, ticker, priority = 1) {
    const response = await fetch(`${this.supabaseUrl}/rpc/subscribe_to_ticker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      },
      body: JSON.stringify({
        p_api_key: apiKey,
        p_ticker: ticker.toUpperCase(),
        p_priority: priority
      })
    });

    if (response.ok) {
      return await response.json();
    }
    throw new Error(`Failed to subscribe: ${response.status}`);
  }

  async unsubscribeFromTicker(apiKey, ticker) {
    const response = await fetch(`${this.supabaseUrl}/rpc/unsubscribe_from_ticker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      },
      body: JSON.stringify({
        p_api_key: apiKey,
        p_ticker: ticker.toUpperCase()
      })
    });

    if (response.ok) {
      return await response.json();
    }
    throw new Error(`Failed to unsubscribe: ${response.status}`);
  }

  async getUserSubscriptions(apiKey) {
    const response = await fetch(`${this.supabaseUrl}/rpc/get_user_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      },
      body: JSON.stringify({
        p_api_key: apiKey
      })
    });

    if (response.ok) {
      return await response.json();
    }
    throw new Error(`Failed to get subscriptions: ${response.status}`);
  }

  async getUserDividends(apiKey, startDate = null, endDate = null, limit = null, offset = null) {
    let url = `${this.supabaseUrl}/rest/v1/user_dividends_view?api_key=eq.${apiKey}&order=ex_dividend_date.desc`;
    
    if (startDate) {
      url += `&ex_dividend_date=gte.${startDate}`;
    }
    if (endDate) {
      url += `&ex_dividend_date=lte.${endDate}`;
    }
    if (limit) {
      url += `&limit=${limit}`;
    }
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      }
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  }

  async bulkSubscribe(apiKey, tickers, priority = 1) {
    const results = [];
    for (const ticker of tickers) {
      try {
        const result = await this.subscribeToTicker(apiKey, ticker, priority);
        results.push({ ticker: ticker.toUpperCase(), success: true, result });
      } catch (error) {
        results.push({ ticker: ticker.toUpperCase(), success: false, error: error.message });
      }
    }
    return results;
  }

  async bulkUnsubscribe(apiKey, tickers) {
    const results = [];
    for (const ticker of tickers) {
      try {
        const result = await this.unsubscribeFromTicker(apiKey, ticker);
        results.push({ ticker: ticker.toUpperCase(), success: true, result });
      } catch (error) {
        results.push({ ticker: ticker.toUpperCase(), success: false, error: error.message });
      }
    }
    return results;
  }
}

// Complete CF-native processor
class CFNativeProcessor {
  constructor(env) {
    this.db = new CFNativeDatabaseManager(env);
    this.polygon = new CFNativePolygonManager(env);
  }

  async processTicker(ticker, force = false) {
    const startTime = Date.now();
    
    try {
      console.log(`[CF-NATIVE] Processing ${ticker} (force: ${force})`);

      await this.db.upsertTicker(ticker);
      const dividends = await this.polygon.fetchDividends(ticker);

      let storeResult = { inserted: 0, errors: 0 };
      if (dividends.length > 0) {
        storeResult = await this.db.storeDividends(ticker, dividends);
      }

      await this.db.updateTickerTimestamp(ticker);

      const processingTime = Date.now() - startTime;
      console.log(`[CF-NATIVE] ✅ ${ticker} processed in ${processingTime}ms`);

      return {
        success: true,
        ticker: ticker.toUpperCase(),
        action: 'processed',
        dividends: {
          found: dividends.length,
          stored: storeResult.inserted,
          errors: storeResult.errors
        },
        processingTime,
        method: 'cf_native'
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[CF-NATIVE] ❌ Error processing ${ticker}:`, error);
      
      return {
        success: false,
        ticker: ticker.toUpperCase(),
        action: 'failed',
        error: error.message,
        processingTime,
        method: 'cf_native'
      };
    }
  }

  async processBatch(tickers) {
    console.log(`[CF-NATIVE] Processing batch of ${tickers.length} tickers`);
    
    const results = [];
    for (const ticker of tickers) {
      const result = await this.processTicker(ticker, true);
      results.push(result);
      
      // Rate limiting: wait 12 seconds between calls for 5/minute
      if (results.length < tickers.length) {
        console.log('[CF-NATIVE] Rate limiting: waiting 12 seconds...');
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }

    return {
      totalTickers: tickers.length,
      results,
      summary: {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      },
      method: 'cf_native_batch'
    };
  }

  async getDividends(ticker, startDate = null, endDate = null) {
    try {
      const dividends = await this.db.getDividends(ticker, startDate, endDate);
      
      return {
        ticker: ticker.toUpperCase(),
        dividends: dividends.map(div => ({
          declarationDate: div.declaration_date,
          recordDate: div.record_date,
          exDividendDate: div.ex_dividend_date,
          payDate: div.pay_date,
          amount: div.amount,
          currency: div.currency,
          frequency: div.frequency,
          type: div.type
        })),
        totalRecords: dividends.length,
        dataSource: 'cf_native',
        stage: 'Stage 4 - Full CF-Native'
      };
    } catch (error) {
      console.error(`[CF-NATIVE] Error getting dividends for ${ticker}:`, error);
      throw error;
    }
  }

  async getAllDividends(startDate = null, endDate = null, limit = null, offset = null) {
    try {
      const dividends = await this.db.getAllDividends(startDate, endDate, limit, offset);
      
      return {
        ticker: 'ALL',
        dividends: dividends.map(div => ({
          ticker: div.ticker,
          declarationDate: div.declaration_date,
          recordDate: div.record_date,
          exDividendDate: div.ex_dividend_date,
          payDate: div.pay_date,
          amount: div.amount,
          currency: div.currency,
          frequency: div.frequency,
          type: div.type
        })),
        totalRecords: dividends.length,
        dataSource: 'cf_native',
        stage: 'Stage 4 - Full CF-Native'
      };
    } catch (error) {
      console.error(`[CF-NATIVE] Error getting all dividends:`, error);
      throw error;
    }
  }
}

/**
 * Stage 4: Full CF-Native Worker Export
 * Single entry point for all functionality
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const processor = new CFNativeProcessor(env);
    const subscriptions = new CFNativeSubscriptionManager(env);
    const auth = new CFNativeAuth(env);
    
    // Authentication check for all endpoints except health and OPTIONS
    const authResult = auth.authenticate(request, true);
    
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Content-Type': 'application/json',
      ...(authResult.headers || {})
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Return authentication error if not authenticated
    if (!authResult.authenticated && !authResult.skipAuth) {
      return new Response(JSON.stringify({
        error: 'Authentication failed',
        message: authResult.error
      }), {
        status: authResult.status,
        headers: {
          ...corsHeaders,
          ...(authResult.headers || {})
        }
      });
    }

    try {
      // Health check (no auth required)
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'ticker-backend-cf-native',
          stage: 'Stage 4 - Full CF-Native System with Auth',
          complexity: 'eliminated',
          authentication: 'enabled',
          environment: {
            hasSupabaseUrl: !!env.SUPABASE_URL,
            hasSupabaseKey: !!env.SUPABASE_ANON_KEY,
            hasPolygonKey: !!env.POLYGON_API_KEY,
            hasQueue: !!env.TICKER_QUEUE
          }
        }), { headers: corsHeaders });
      }

      // Get dividends for all tickers
      if (url.pathname === '/dividends/all') {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const limit = url.searchParams.get('limit');
        const offset = url.searchParams.get('offset');
        const format = url.searchParams.get('format');
        
        const result = await processor.getAllDividends(startDate, endDate, limit, offset);
        
        // Handle CSV format
        if (format === 'csv') {
          const csvHeader = 'Ticker,Declaration Date,Record Date,Ex-Dividend Date,Pay Date,Amount,Currency,Frequency,Type';
          const csvRows = result.dividends.map(d => 
            `${d.ticker},${d.declarationDate || ''},${d.recordDate || ''},${d.exDividendDate},${d.payDate || ''},${d.amount},${d.currency},${d.frequency},${d.type}`
          );
          const csvContent = [csvHeader, ...csvRows].join('\n');
          
          return new Response(csvContent, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="all_dividends.csv"'
            }
          });
        }
        
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // Get dividends for specific ticker
      if (url.pathname.startsWith('/dividends/')) {
        const ticker = url.pathname.split('/')[2];
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        
        const result = await processor.getDividends(ticker, startDate, endDate);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // Update tickers
      if (url.pathname === '/update-tickers' && request.method === 'POST') {
        const body = await request.json();
        const { tickers, force = false } = body;

        if (!tickers || !Array.isArray(tickers)) {
          return new Response(JSON.stringify({
            error: 'Invalid request: provide tickers array'
          }), { status: 400, headers: corsHeaders });
        }

        // Stage 4: All processing is CF-native, no complexity
        if (tickers.length === 1) {
          const result = await processor.processTicker(tickers[0], force);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        } else {
          const result = await processor.processBatch(tickers);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }
      }

      // Single ticker processing
      if (url.pathname === '/process' && request.method === 'POST') {
        const body = await request.json();
        const { ticker, force = false } = body;

        if (!ticker) {
          return new Response(JSON.stringify({
            error: 'Invalid request: provide ticker'
          }), { status: 400, headers: corsHeaders });
        }

        const result = await processor.processTicker(ticker, force);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // User subscription management endpoints
      
      // Get user's subscriptions
      if (url.pathname === '/subscriptions' && request.method === 'GET') {
        try {
          const result = await subscriptions.getUserSubscriptions(authResult.apiKey);
          return new Response(JSON.stringify({
            success: true,
            subscriptions: result,
            total: result.length
          }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Failed to get subscriptions',
            message: error.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Subscribe to ticker
      if (url.pathname === '/subscriptions' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { ticker, priority = 1 } = body;

          if (!ticker) {
            return new Response(JSON.stringify({
              error: 'Invalid request: ticker is required'
            }), { status: 400, headers: corsHeaders });
          }

          const result = await subscriptions.subscribeToTicker(authResult.apiKey, ticker, priority);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Failed to subscribe',
            message: error.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Unsubscribe from ticker
      if (url.pathname === '/subscriptions' && request.method === 'DELETE') {
        try {
          const body = await request.json();
          const { ticker } = body;

          if (!ticker) {
            return new Response(JSON.stringify({
              error: 'Invalid request: ticker is required'
            }), { status: 400, headers: corsHeaders });
          }

          const result = await subscriptions.unsubscribeFromTicker(authResult.apiKey, ticker);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Failed to unsubscribe',
            message: error.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Bulk subscription management
      if (url.pathname === '/subscriptions/bulk' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { action, tickers, priority = 1 } = body;

          if (!action || !tickers || !Array.isArray(tickers)) {
            return new Response(JSON.stringify({
              error: 'Invalid request: action and tickers array are required'
            }), { status: 400, headers: corsHeaders });
          }

          let results;
          if (action === 'subscribe') {
            results = await subscriptions.bulkSubscribe(authResult.apiKey, tickers, priority);
          } else if (action === 'unsubscribe') {
            results = await subscriptions.bulkUnsubscribe(authResult.apiKey, tickers);
          } else {
            return new Response(JSON.stringify({
              error: 'Invalid action: must be "subscribe" or "unsubscribe"'
            }), { status: 400, headers: corsHeaders });
          }

          const successful = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success).length;

          return new Response(JSON.stringify({
            success: true,
            action,
            results,
            summary: { successful, failed, total: tickers.length }
          }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Failed to process bulk operation',
            message: error.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Get dividends for user's subscriptions only
      if (url.pathname === '/my-dividends' && request.method === 'GET') {
        try {
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');
          const limit = url.searchParams.get('limit');
          const offset = url.searchParams.get('offset');
          const format = url.searchParams.get('format');

          const dividends = await subscriptions.getUserDividends(authResult.apiKey, startDate, endDate, limit, offset);
          
          // Handle CSV format
          if (format === 'csv') {
            const csvHeader = 'Ticker,Declaration Date,Record Date,Ex-Dividend Date,Pay Date,Amount,Currency,Frequency,Type,Priority';
            const csvRows = dividends.map(d => 
              `${d.ticker},${d.declaration_date || ''},${d.record_date || ''},${d.ex_dividend_date},${d.pay_date || ''},${d.amount},${d.currency},${d.frequency},${d.type},${d.priority}`
            );
            const csvContent = [csvHeader, ...csvRows].join('\n');
            
            return new Response(csvContent, {
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="my_dividends.csv"'
              }
            });
          }

          return new Response(JSON.stringify({
            success: true,
            dividends: dividends.map(d => ({
              ticker: d.ticker,
              declarationDate: d.declaration_date,
              recordDate: d.record_date,
              exDividendDate: d.ex_dividend_date,
              payDate: d.pay_date,
              amount: d.amount,
              currency: d.currency,
              frequency: d.frequency,
              type: d.type,
              priority: d.priority,
              subscribedAt: d.subscribed_at
            })),
            totalRecords: dividends.length,
            dataSource: 'user_subscriptions',
            stage: 'Stage 4 - CF-Native with Subscriptions'
          }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Failed to get user dividends',
            message: error.message
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Default response
      return new Response(JSON.stringify({
        service: 'ticker-backend-cf-native',
        stage: 'Stage 4 - Full CF-Native System with Subscriptions',
        message: 'All complexity eliminated - single CF worker handles everything with user subscriptions',
        endpoints: [
          'GET /health',
          'GET /dividends/all',
          'GET /dividends/{ticker}',
          'GET /my-dividends - Get dividends for user subscriptions only',
          'GET /subscriptions - Get user subscriptions',
          'POST /subscriptions - Subscribe to ticker',
          'DELETE /subscriptions - Unsubscribe from ticker',
          'POST /subscriptions/bulk - Bulk subscribe/unsubscribe',
          'POST /update-tickers',
          'POST /process'
        ]
      }), { headers: corsHeaders });

    } catch (error) {
      console.error('[CF-NATIVE] Request error:', error);
      return new Response(JSON.stringify({
        error: 'Internal error',
        message: error.message,
        stage: 'Stage 4 - Full CF-Native'
      }), { status: 500, headers: corsHeaders });
    }
  },

  // Native queue consumer - simplified for Stage 4
  async queue(batch, env) {
    console.log(`[CF-NATIVE-QUEUE] Processing ${batch.messages.length} messages`);
    const processor = new CFNativeProcessor(env);
    
    for (const message of batch.messages) {
      try {
        const queueData = message.body;
        console.log('[CF-NATIVE-QUEUE] Processing:', JSON.stringify(queueData));
        
        if (queueData.type === 'new_ticker_processing' && queueData.tickers) {
          const result = await processor.processBatch(queueData.tickers);
          console.log(`[CF-NATIVE-QUEUE] ✅ Completed: ${result.summary.successful} successful`);
        }
        
        message.ack();
      } catch (error) {
        console.error('[CF-NATIVE-QUEUE] Processing error:', error);
        message.retry();
      }
    }
  },

  // Simplified scheduled tasks
  async scheduled(event, env) {
    console.log('[CF-NATIVE-CRON] Daily dividend update triggered');
    
    try {
      // In Stage 4, we could trigger bulk processing of all tracked tickers
      // For now, just log the successful cron execution
      console.log('[CF-NATIVE-CRON] ✅ Scheduled task completed');
      
    } catch (error) {
      console.error('[CF-NATIVE-CRON] ❌ Scheduled task failed:', error);
    }
  }
};