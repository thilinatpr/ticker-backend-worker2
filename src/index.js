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
        
        // Send message to queue if available
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
          return new Response(JSON.stringify({
            success: false,
            error: 'Queue not available',
            message: 'TICKER_QUEUE binding not found'
          }), {
            status: 500,
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