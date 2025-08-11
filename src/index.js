import { JobProcessor } from './job-processor.js';

export default {
  async fetch(request) {
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

    return new Response('Ticker Backend Worker - Use /health for status', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  async scheduled(_event, env) {
    console.log('Cron job triggered at:', new Date().toISOString());
    
    try {
      const processor = new JobProcessor(env);
      
      // Perform health check first
      const isHealthy = await processor.performHealthCheck();
      if (!isHealthy) {
        console.error('API health check failed, skipping job processing');
        return;
      }
      
      // Process the job queue
      await processor.processQueue();
      
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