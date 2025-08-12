import { JobProcessor } from './job-processor.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ticker-backend-worker'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/queue/send' && request.method === 'POST') {
      try {
        const queueMessage = await request.json();
        
        // Send message to Cloudflare Queue
        await env.TICKER_QUEUE.send(queueMessage);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Message sent to queue successfully',
          requestId: queueMessage.requestId,
          tickers: queueMessage.tickers
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to send message to queue',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Ticker Backend Worker - Use /health for status, /queue/send for queue operations', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  async queue(batch, env) {
    console.log(`Processing queue batch with ${batch.messages.length} messages`);
    
    for (const message of batch.messages) {
      try {
        const queueData = message.body;
        console.log('Processing queue message:', JSON.stringify(queueData, null, 2));
        
        if (queueData.type === 'new_ticker_processing') {
          await processNewTickerMessage(queueData, env);
          
          // Acknowledge successful processing
          message.ack();
          console.log(`✓ Successfully processed tickers: ${queueData.tickers.join(', ')}`);
        } else {
          console.warn('Unknown message type:', queueData.type);
          message.ack(); // Acknowledge to avoid reprocessing
        }
        
      } catch (error) {
        console.error('Error processing queue message:', error);
        
        // Retry the message (will be retried up to max_retries times)
        message.retry();
      }
    }
  },

  async scheduled(event, env) {
    const scheduledDate = new Date(event.scheduledTime);
    const cronExpression = event.cron;
    
    console.log(`Cron job triggered at: ${scheduledDate.toISOString()}`);
    console.log(`Cron expression: ${cronExpression}`);
    
    try {
      const processor = new JobProcessor(env);
      
      // Perform health check first
      const isHealthy = await processor.performHealthCheck();
      if (!isHealthy) {
        console.error('API health check failed, skipping job processing');
        return;
      }

      // Determine what type of processing to do based on cron schedule
      if (cronExpression === '0 9,21 * * *') {
        // Twice daily: bulk dividend updates at 9 AM and 9 PM UTC
        console.log('Running bulk dividend update...');
        await processor.processBulkDividendUpdate();
      } else if (cronExpression === '0 9 * * *') {
        // Daily: process individual ticker queue at 9 AM UTC
        console.log('Running individual ticker queue processing...');
        await processor.processQueue();
      } else {
        // Default: run both for manual triggers
        console.log('Running both bulk dividend update and queue processing...');
        await processor.processBulkDividendUpdate();
        await processor.processQueue();
      }
      
      // Get current job statistics
      await processor.getJobStats();
      
      // Clean up old jobs (if needed)
      await processor.cleanupOldJobs();
      
      console.log('Scheduled job completed successfully');
    } catch (error) {
      console.error('Scheduled job failed:', error);
      throw error;
    }
  }
};

/**
 * Process new ticker message from Cloudflare Queue
 * @param {object} queueData - Message data from queue
 * @param {object} env - Worker environment variables
 */
async function processNewTickerMessage(queueData, env) {
  const { tickers, force, requestId } = queueData;
  
  console.log(`Processing ${tickers.length} new tickers via queue: ${tickers.join(', ')}`);
  
  // Process each ticker individually for historical data
  for (const ticker of tickers) {
    try {
      console.log(`Fetching historical dividend data for ${ticker}...`);
      
      // Call the main API to process this specific ticker with historical fetch
      const response = await fetch(`${env.TICKER_API_BASE_URL}/api/process-ticker?ticker=${ticker}&fetchType=historical&force=${force}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': env.TICKER_API_KEY,
          'User-Agent': 'CloudflareQueue/1.0',
          'X-Request-ID': requestId
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to process ${ticker}: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✓ Successfully processed ${ticker}:`, result);
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`✗ Failed to process ${ticker}:`, error.message);
      // Don't throw here - we want to continue processing other tickers
    }
  }
  
  console.log(`Completed queue processing for request ${requestId}`);
}