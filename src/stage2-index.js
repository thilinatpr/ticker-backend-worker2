/**
 * Stage 2: Native Cloudflare Queue Integration
 * Prioritizes native queue processing over HTTP endpoints
 */

// Database configuration
class DatabaseManager {
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

    if (!response.ok && response.status !== 409) {
      throw new Error(`Failed to upsert ticker: ${response.status}`);
    }
  }

  async getTickerInfo(ticker) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/tickers?symbol=eq.${ticker.toUpperCase()}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get ticker info: ${response.status}`);
    }

    const data = await response.json();
    return data[0] || null;
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

    if (!response.ok) {
      // If it's a duplicate key error, that's actually success
      if (response.status === 409) {
        console.log(`Dividends for ${ticker} already exist (duplicate key), skipping...`);
        return { inserted: 0, errors: 0, skipped: dividends.length };
      }
      throw new Error(`Failed to store dividends: ${response.status} ${await response.text()}`);
    }

    return { inserted: dividends.length, errors: 0 };
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

    if (!response.ok) {
      throw new Error(`Failed to update ticker timestamp: ${response.status}`);
    }
  }
}

// Polygon API integration
class PolygonManager {
  constructor(env) {
    this.apiKey = env.POLYGON_API_KEY;
    this.baseUrl = 'https://api.polygon.io/v3/reference/dividends';
  }

  calculateDateRange(fetchType = 'historical') {
    const now = new Date();
    let startDate, endDate;

    if (fetchType === 'historical') {
      startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    } else {
      startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      endDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  async fetchDividends(ticker, fetchType = 'historical') {
    if (!this.apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const dateRange = this.calculateDateRange(fetchType);
    const url = new URL(this.baseUrl);
    
    url.searchParams.append('ticker', ticker.toUpperCase());
    url.searchParams.append('ex_dividend_date.gte', dateRange.startDate);
    url.searchParams.append('ex_dividend_date.lte', dateRange.endDate);
    url.searchParams.append('limit', '1000');
    url.searchParams.append('apikey', this.apiKey);

    console.log(`Fetching dividends for ${ticker} from ${dateRange.startDate} to ${dateRange.endDate}`);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ticker-backend-worker/2.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Polygon API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`Found ${data.results?.length || 0} dividend records for ${ticker}`);

    return this.transformPolygonData(data.results || []);
  }

  transformPolygonData(polygonData) {
    return polygonData.map(dividend => ({
      declarationDate: dividend.declaration_date || null,
      recordDate: dividend.record_date || null,
      exDividendDate: dividend.ex_dividend_date,
      payDate: dividend.pay_date || null,
      amount: parseFloat(dividend.cash_amount) || 0,
      currency: dividend.currency || 'USD',
      frequency: dividend.frequency || 4,
      type: dividend.dividend_type || 'Cash',
      polygonId: dividend.id || null,
      dataSource: 'polygon'
    }));
  }
}

// Complete ticker processing logic
class TickerProcessor {
  constructor(env) {
    this.db = new DatabaseManager(env);
    this.polygon = new PolygonManager(env);
  }

  async shouldProcessTicker(ticker, force = false) {
    if (force) {
      return { shouldProcess: true, reason: 'force_update' };
    }

    const tickerInfo = await this.db.getTickerInfo(ticker);
    
    if (!tickerInfo) {
      return { shouldProcess: true, reason: 'new_ticker' };
    }

    if (!tickerInfo.last_dividend_update) {
      return { shouldProcess: true, reason: 'no_dividend_data' };
    }

    const lastUpdate = new Date(tickerInfo.last_dividend_update);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    if (lastUpdate < twentyFourHoursAgo) {
      return { shouldProcess: true, reason: 'stale_data' };
    }

    return { shouldProcess: false, reason: 'recent_data' };
  }

  async processTicker(ticker, options = {}) {
    const { force = false, fetchType = 'historical' } = options;
    const startTime = Date.now();
    
    try {
      console.log(`[QUEUE] Processing ticker ${ticker} (force: ${force}, fetchType: ${fetchType})`);

      const { shouldProcess, reason } = await this.shouldProcessTicker(ticker, force);
      
      if (!shouldProcess) {
        console.log(`[QUEUE] Skipping ${ticker}: ${reason}`);
        return {
          success: true,
          ticker: ticker.toUpperCase(),
          action: 'skipped',
          reason,
          processingTime: Date.now() - startTime
        };
      }

      await this.db.upsertTicker(ticker);
      const dividends = await this.polygon.fetchDividends(ticker, fetchType);

      let storeResult = { inserted: 0, errors: 0 };
      if (dividends.length > 0) {
        storeResult = await this.db.storeDividends(ticker, dividends);
      }

      await this.db.updateTickerTimestamp(ticker);

      const processingTime = Date.now() - startTime;
      console.log(`[QUEUE] ✅ Successfully processed ${ticker} in ${processingTime}ms`);

      return {
        success: true,
        ticker: ticker.toUpperCase(),
        action: 'processed',
        fetchType,
        dividends: {
          found: dividends.length,
          stored: storeResult.inserted,
          errors: storeResult.errors
        },
        processingTime,
        reason
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[QUEUE] ❌ Error processing ${ticker}:`, error);
      
      return {
        success: false,
        ticker: ticker.toUpperCase(),
        action: 'failed',
        error: error.message,
        processingTime
      };
    }
  }

  async processBatch(tickers, options = {}) {
    console.log(`[QUEUE] Processing batch of ${tickers.length} tickers`);
    
    const results = [];
    for (const ticker of tickers) {
      const result = await this.processTicker(ticker, options);
      results.push(result);
      
      // Rate limiting: 12 seconds between calls
      if (results.length < tickers.length) {
        console.log('[QUEUE] Rate limiting: waiting 12 seconds...');
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }

    return {
      totalTickers: tickers.length,
      results,
      summary: {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        skipped: results.filter(r => r.action === 'skipped').length
      }
    };
  }
}

/**
 * Main worker export - Stage 2: Native Queue Priority
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ticker-backend-worker-stage2',
        stage: 'Stage 2 - Native Queue Integration',
        environment: {
          hasSupabaseUrl: !!env.SUPABASE_URL,
          hasSupabaseKey: !!env.SUPABASE_ANON_KEY,
          hasPolygonKey: !!env.POLYGON_API_KEY,
          hasApiBaseUrl: !!env.TICKER_API_BASE_URL,
          hasApiKey: !!env.TICKER_API_KEY,
          hasQueue: !!env.TICKER_QUEUE
        },
        queueInfo: {
          primaryMethod: 'native_queue_consumer',
          fallbackMethod: 'http_endpoints',
          message: 'Native queue processing prioritized for reliability'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Keep HTTP endpoints for testing and fallback
    if (url.pathname === '/process' && request.method === 'POST') {
      try {
        const body = await request.json();
        const processor = new TickerProcessor(env);
        
        console.log('[HTTP] Processing request via HTTP fallback');
        
        if (body.ticker) {
          const result = await processor.processTicker(body.ticker, {
            force: body.force || false,
            fetchType: body.fetchType || 'historical'
          });
          
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (body.tickers && Array.isArray(body.tickers)) {
          const result = await processor.processBatch(body.tickers, {
            force: body.force || false,
            fetchType: body.fetchType || 'historical'
          });
          
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid request: provide either "ticker" or "tickers" array'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('[HTTP] Processing error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Internal processing error',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Legacy queue/send endpoint (deprecated but kept for backward compatibility)
    if (url.pathname === '/queue/send' && request.method === 'POST') {
      try {
        const queueMessage = await request.json();
        console.log('[HTTP] Legacy queue/send called - consider migrating to native queue');
        
        if (queueMessage.type === 'new_ticker_processing' && queueMessage.tickers) {
          const processor = new TickerProcessor(env);
          const result = await processor.processBatch(queueMessage.tickers, {
            force: true,
            fetchType: 'historical'
          });
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Processed via legacy HTTP endpoint',
            ...result
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Unsupported queue message type'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to process legacy queue message',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Default response
    return new Response('Stage 2: Native Queue Integration - Use /health for status', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  // PRIORITY: Native queue consumer - this is the main processing method
  async queue(batch, env) {
    console.log(`[NATIVE-QUEUE] Processing queue batch with ${batch.messages.length} messages`);
    const processor = new TickerProcessor(env);
    
    for (const message of batch.messages) {
      try {
        const queueData = message.body;
        console.log('[NATIVE-QUEUE] Processing message:', JSON.stringify(queueData));
        
        if (queueData.type === 'new_ticker_processing' && queueData.tickers) {
          console.log(`[NATIVE-QUEUE] Processing ${queueData.tickers.length} tickers: ${queueData.tickers.join(', ')}`);
          
          const result = await processor.processBatch(queueData.tickers, {
            force: queueData.force || true,
            fetchType: queueData.fetchType || 'historical'
          });
          
          console.log(`[NATIVE-QUEUE] ✅ Batch completed: ${result.summary.successful} successful, ${result.summary.failed} failed`);
        } else if (queueData.type === 'process_queue') {
          // Legacy support for traditional queue processing
          console.log('[NATIVE-QUEUE] Processing legacy queue trigger');
          try {
            const response = await fetch(`${env.TICKER_API_BASE_URL}/api/process-queue`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': env.TICKER_API_KEY
              }
            });

            if (response.ok) {
              const result = await response.json();
              console.log(`[NATIVE-QUEUE] ✅ Legacy queue processing completed:`, result);
            } else {
              console.error(`[NATIVE-QUEUE] ❌ Legacy queue processing failed: ${response.status}`);
            }
          } catch (error) {
            console.error(`[NATIVE-QUEUE] ❌ Error triggering legacy queue processing:`, error);
          }
        } else {
          console.log(`[NATIVE-QUEUE] Unknown message type: ${queueData.type}`);
        }
        
        message.ack();
      } catch (error) {
        console.error('[NATIVE-QUEUE] Processing error:', error);
        message.retry();
      }
    }
  },

  // Scheduled tasks - trigger both legacy and native processing
  async scheduled(event, env) {
    console.log('[CRON] Triggered:', new Date(event.scheduledTime).toISOString());
    
    try {
      // Health check first
      const healthResponse = await fetch(`${env.TICKER_API_BASE_URL}/api/health`);
      
      if (healthResponse.ok) {
        console.log('[CRON] ✅ Main API is healthy');
        
        // Trigger traditional queue processing for existing tickers
        const queueResponse = await fetch(`${env.TICKER_API_BASE_URL}/api/process-queue`, {
          method: 'POST',
          headers: {
            'X-API-Key': env.TICKER_API_KEY
          }
        });
        
        if (queueResponse.ok) {
          const result = await queueResponse.json();
          console.log('[CRON] ✅ Queue processing completed:', result);
        } else {
          console.error('[CRON] ❌ Queue processing failed:', queueResponse.status);
        }
      } else {
        console.error('[CRON] ❌ Main API health check failed');
      }
      
    } catch (error) {
      console.error('[CRON] ❌ Scheduled job failed:', error);
    }
  }
};