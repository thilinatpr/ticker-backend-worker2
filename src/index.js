// Simplified Cloudflare Worker for debugging deployment issues
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ticker-backend-worker-simple',
        environment: {
          hasApiBaseUrl: !!env.TICKER_API_BASE_URL,
          hasApiKey: !!env.TICKER_API_KEY,
          hasQueue: !!env.TICKER_QUEUE
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Queue send endpoint (simplified)
    if (url.pathname === '/queue/send' && request.method === 'POST') {
      try {
        const queueMessage = await request.json();
        console.log('Received queue message:', queueMessage);
        
        // Process new ticker messages immediately
        if (queueMessage.type === 'new_ticker_processing') {
          console.log(`Processing new tickers immediately: ${queueMessage.tickers?.join(', ')}`);
          
          const results = [];
          for (const ticker of queueMessage.tickers || []) {
            try {
              const response = await fetch(`${env.TICKER_API_BASE_URL}/api/process-ticker`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': env.TICKER_API_KEY
                },
                body: JSON.stringify({
                  ticker: ticker,
                  force: true,
                  fetchType: 'historical'
                })
              });

              if (response.ok) {
                const result = await response.json();
                console.log(`✅ Processed ticker ${ticker}:`, result);
                results.push({ ticker, success: true, result });
              } else {
                console.error(`❌ Failed to process ticker ${ticker}: ${response.status}`);
                results.push({ ticker, success: false, error: `HTTP ${response.status}` });
              }
            } catch (error) {
              console.error(`❌ Error processing ticker ${ticker}:`, error);
              results.push({ ticker, success: false, error: error.message });
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Tickers processed immediately',
            tickers: queueMessage.tickers || [],
            results
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Send message to queue if available (for other message types)
        if (env.TICKER_QUEUE) {
          await env.TICKER_QUEUE.send(queueMessage);
          return new Response(JSON.stringify({
            success: true,
            message: 'Message sent to queue successfully',
            tickers: queueMessage.tickers || []
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Fallback: process immediately if no queue binding
          return new Response(JSON.stringify({
            success: true,
            message: 'Queue not available, message received but not processed',
            tickers: queueMessage.tickers || []
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to process queue message',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Dividends all endpoint - fetch all dividend data
    if (url.pathname === '/dividends/all' && request.method === 'GET') {
      try {
        // Simple authentication check
        const apiKey = request.headers.get('X-API-Key');
        if (!apiKey) {
          return new Response(JSON.stringify({
            error: 'Missing API key',
            message: 'X-API-Key header is required'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Extract query parameters
        const searchParams = url.searchParams;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const format = searchParams.get('format');
        const limit = searchParams.get('limit');
        const offset = searchParams.get('offset');

        // Build query parameters for the main API
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.set('startDate', startDate);
        if (endDate) queryParams.set('endDate', endDate);
        if (format) queryParams.set('format', format);
        if (limit) queryParams.set('limit', limit);
        if (offset) queryParams.set('offset', offset);

        // Call the main API dividends/all endpoint
        const response = await fetch(`${env.TICKER_API_BASE_URL}/api/dividends/all?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            'X-API-Key': env.TICKER_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          // Handle CSV response
          if (contentType && contentType.includes('text/csv')) {
            const csvData = await response.text();
            return new Response(csvData, {
              status: 200,
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename="all_dividends.csv"'
              }
            });
          }
          
          // Handle JSON response
          const data = await response.json();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          const errorText = await response.text();
          return new Response(JSON.stringify({
            error: 'Failed to fetch dividend data',
            status: response.status,
            message: errorText
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Update tickers endpoint - submit tickers for processing
    if (url.pathname === '/update-tickers' && request.method === 'POST') {
      try {
        const requestBody = await request.json();
        const { tickers, priority = 1, force = false } = requestBody;

        if (!tickers || !Array.isArray(tickers)) {
          return new Response(JSON.stringify({
            error: 'Invalid request',
            message: 'tickers array is required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Call the main API update-tickers endpoint
        const response = await fetch(`${env.TICKER_API_BASE_URL}/api/update-tickers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': env.TICKER_API_KEY
          },
          body: JSON.stringify({
            tickers,
            priority,
            force
          })
        });

        if (response.ok) {
          const data = await response.json();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          const errorText = await response.text();
          return new Response(JSON.stringify({
            error: 'Failed to submit tickers for update',
            status: response.status,
            message: errorText
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Default response
    return new Response('Ticker Backend Worker (Simple) - Use /health for status', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  async queue(batch, env) {
    console.log(`Processing queue batch with ${batch.messages.length} messages`);
    
    for (const message of batch.messages) {
      try {
        const queueData = message.body;
        console.log('Queue message:', queueData);
        
        if (queueData.type === 'process_queue') {
          // Trigger main API queue processing
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
              console.log(`✅ Queue processing completed:`, result);
            } else {
              console.error(`❌ Queue processing failed: ${response.status}`);
            }
          } catch (error) {
            console.error(`❌ Error triggering queue processing:`, error);
          }
        } else if (queueData.type === 'new_ticker_processing') {
          // Process new tickers instantly
          console.log(`Processing new tickers: ${queueData.tickers?.join(', ')}`);
          
          for (const ticker of queueData.tickers || []) {
            try {
              const response = await fetch(`${env.TICKER_API_BASE_URL}/api/process-ticker`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': env.TICKER_API_KEY
                },
                body: JSON.stringify({
                  ticker: ticker,
                  force: true,
                  fetchType: 'historical'
                })
              });

              if (response.ok) {
                const result = await response.json();
                console.log(`✅ Processed ticker ${ticker}:`, result);
              } else {
                console.error(`❌ Failed to process ticker ${ticker}: ${response.status}`);
              }
            } catch (error) {
              console.error(`❌ Error processing ticker ${ticker}:`, error);
            }
          }
        }
        
        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  },

  async scheduled(event, env) {
    console.log('Cron triggered:', new Date(event.scheduledTime).toISOString());
    
    try {
      // Simple health check
      const healthResponse = await fetch(`${env.TICKER_API_BASE_URL}/api/health`);
      
      if (healthResponse.ok) {
        console.log('✅ Main API is healthy');
        
        // Trigger queue processing
        const queueResponse = await fetch(`${env.TICKER_API_BASE_URL}/api/process-queue`, {
          method: 'POST',
          headers: {
            'X-API-Key': env.TICKER_API_KEY
          }
        });
        
        if (queueResponse.ok) {
          const result = await queueResponse.json();
          console.log('✅ Queue processing completed:', result);
        } else {
          console.error('❌ Queue processing failed:', queueResponse.status);
        }

        // Also trigger bulk dividend update for daily maintenance  
        const bulkResponse = await fetch(`${env.TICKER_API_BASE_URL}/api/bulk-dividend-update`, {
          method: 'POST',
          headers: {
            'X-API-Key': env.TICKER_API_KEY
          }
        });
        
        if (bulkResponse.ok) {
          const bulkResult = await bulkResponse.json();
          console.log('✅ Bulk update completed:', bulkResult);
        } else {
          console.error('❌ Bulk update failed:', bulkResponse.status);
        }
      } else {
        console.error('❌ Main API health check failed');
      }
      
    } catch (error) {
      console.error('❌ Scheduled job failed:', error);
    }
  }
};