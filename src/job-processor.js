/**
 * Job processing utilities for Cloudflare Worker cron jobs
 */

export class JobProcessor {
  constructor(env) {
    this.env = env;
    this.apiBaseUrl = env.TICKER_API_BASE_URL;
    this.apiKey = env.TICKER_API_KEY;
  }

  async processQueue() {
    if (!this.apiBaseUrl || !this.apiKey) {
      throw new Error('Missing required environment variables: TICKER_API_BASE_URL, TICKER_API_KEY');
    }

    console.log('Starting queue processing...');
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'CloudflareWorker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Queue processing failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Queue processing completed:', result);
      return result;
      
    } catch (error) {
      console.error('Queue processing error:', error);
      throw error;
    }
  }

  async getJobStats() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/jobs?limit=10`, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get job stats: ${response.status}`);
      }

      const stats = await response.json();
      console.log('Current job stats:', stats);
      return stats;
      
    } catch (error) {
      console.error('Failed to get job stats:', error);
      return null;
    }
  }

  async cleanupOldJobs() {
    console.log('Cleaning up old completed jobs...');
    
    try {
      // Get jobs older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const response = await fetch(`${this.apiBaseUrl}/api/jobs?status=completed&before=${sevenDaysAgo.toISOString()}`, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (response.ok) {
        const oldJobs = await response.json();
        console.log(`Found ${oldJobs.jobs?.length || 0} old jobs for cleanup`);
        
        // Note: Actual cleanup would require a DELETE endpoint in your API
        // This is just monitoring for now
      }
      
    } catch (error) {
      console.error('Cleanup job failed:', error);
    }
  }

  async performHealthCheck() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/health`);
      
      if (response.ok) {
        const health = await response.json();
        console.log('API health check passed:', health);
        return true;
      } else {
        console.error('API health check failed:', response.status);
        return false;
      }
      
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}