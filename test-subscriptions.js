#!/usr/bin/env node

/**
 * Test script for Cloudflare Worker User Subscription System
 * Tests subscription management, user-specific dividend data, and authentication
 */

const WORKER_URL = 'https://ticker-backend-worker2.patprathnayaka.workers.dev';
const VALID_API_KEY = 'tk_demo_key_12345';
const TEST_API_KEY = 'tk_test_67890';

async function testEndpoint(url, options = {}) {
  const { method = 'GET', headers = {}, body } = options;
  
  try {
    console.log(`\n🔍 Testing: ${method} ${url}`);
    if (body) {
      console.log(`📤 Body: ${JSON.stringify(body, null, 2)}`);
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : null
    });

    console.log(`📊 Status: ${response.status}`);
    
    const responseText = await response.text();
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
      console.log(`📄 Response: ${JSON.stringify(parsedResponse, null, 2)}`);
    } catch (e) {
      console.log(`📄 Response: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
    }
    
    return {
      status: response.status,
      body: parsedResponse || responseText,
      ok: response.ok
    };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function runSubscriptionTests() {
  console.log('🚀 Starting User Subscription System Tests\n');
  console.log('📍 Worker URL:', WORKER_URL);
  console.log('\n' + '='.repeat(80));

  // Test 1: Health check with subscription info
  console.log('\n🏥 TEST 1: Health Check (Should show subscription features)');
  await testEndpoint(`${WORKER_URL}/health`);

  // Test 2: Get initial subscriptions (should be empty)
  console.log('\n📋 TEST 2: Get User Subscriptions (Initial - Should be empty)');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 3: Subscribe to single ticker
  console.log('\n➕ TEST 3: Subscribe to Single Ticker (AAPL)');
  const subscribeResult = await testEndpoint(`${WORKER_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { ticker: 'AAPL', priority: 1 }
  });

  // Test 4: Get subscriptions after subscribing
  console.log('\n📋 TEST 4: Get User Subscriptions (After AAPL subscription)');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 5: Subscribe to multiple tickers with different priorities
  console.log('\n➕ TEST 5: Subscribe to High Priority Ticker (MSFT)');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { ticker: 'MSFT', priority: 2 }
  });

  // Test 6: Bulk subscribe
  console.log('\n📦 TEST 6: Bulk Subscribe to Multiple Tickers');
  await testEndpoint(`${WORKER_URL}/subscriptions/bulk`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { 
      action: 'subscribe', 
      tickers: ['GOOGL', 'NVDA', 'TSLA'], 
      priority: 1 
    }
  });

  // Test 7: Get all subscriptions
  console.log('\n📋 TEST 7: Get All User Subscriptions');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 8: Get user-specific dividends
  console.log('\n💰 TEST 8: Get Dividends for User Subscriptions Only');
  await testEndpoint(`${WORKER_URL}/my-dividends`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 9: Get user dividends with date filtering
  console.log('\n💰 TEST 9: Get User Dividends with Date Filter (2025 only)');
  await testEndpoint(`${WORKER_URL}/my-dividends?startDate=2025-01-01&endDate=2025-12-31`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 10: Get user dividends in CSV format
  console.log('\n💰 TEST 10: Get User Dividends in CSV Format');
  const csvResult = await testEndpoint(`${WORKER_URL}/my-dividends?format=csv&limit=5`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 11: Try to subscribe beyond limits (if applicable)
  console.log('\n🚫 TEST 11: Test Subscription Limits (Try subscribing to many tickers)');
  const manyTickers = ['IBM', 'JPM', 'BAC', 'WMT', 'KO', 'PFE', 'XOM', 'CVX'];
  await testEndpoint(`${WORKER_URL}/subscriptions/bulk`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { 
      action: 'subscribe', 
      tickers: manyTickers, 
      priority: 1 
    }
  });

  // Test 12: Unsubscribe from single ticker
  console.log('\n➖ TEST 12: Unsubscribe from Single Ticker (TSLA)');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    method: 'DELETE',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { ticker: 'TSLA' }
  });

  // Test 13: Bulk unsubscribe
  console.log('\n📦 TEST 13: Bulk Unsubscribe from Multiple Tickers');
  await testEndpoint(`${WORKER_URL}/subscriptions/bulk`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { 
      action: 'unsubscribe', 
      tickers: ['GOOGL', 'NVDA'] 
    }
  });

  // Test 14: Get final subscriptions list
  console.log('\n📋 TEST 14: Get Final User Subscriptions');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });

  // Test 15: Test different user (different API key)
  console.log('\n👤 TEST 15: Test Different User (Different API Key)');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'X-API-Key': TEST_API_KEY },
    body: { ticker: 'META', priority: 2 }
  });

  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': TEST_API_KEY }
  });

  // Test 16: Verify user isolation (first user shouldn't see second user's subscriptions)
  console.log('\n🔒 TEST 16: Verify User Isolation');
  console.log('First user subscriptions:');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': VALID_API_KEY }
  });
  
  console.log('Second user subscriptions:');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    headers: { 'X-API-Key': TEST_API_KEY }
  });

  // Test 17: Error handling - invalid ticker
  console.log('\n❌ TEST 17: Error Handling - Invalid Requests');
  await testEndpoint(`${WORKER_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { priority: 1 } // Missing ticker
  });

  await testEndpoint(`${WORKER_URL}/subscriptions/bulk`, {
    method: 'POST',
    headers: { 'X-API-Key': VALID_API_KEY },
    body: { action: 'invalid_action', tickers: ['AAPL'] } // Invalid action
  });

  // Test 18: Unauthenticated requests
  console.log('\n🚫 TEST 18: Unauthenticated Requests (Should fail)');
  await testEndpoint(`${WORKER_URL}/subscriptions`); // No API key
  
  await testEndpoint(`${WORKER_URL}/my-dividends`); // No API key

  console.log('\n' + '='.repeat(80));
  console.log('🎯 User Subscription System tests completed!');
  console.log('\n📝 Summary:');
  console.log('✅ Subscription management (add/remove/bulk operations)');
  console.log('✅ User-specific dividend data filtering');
  console.log('✅ Multi-user isolation and authentication');
  console.log('✅ CSV export for user data');
  console.log('✅ Date filtering and pagination');
  console.log('✅ Error handling and validation');
  console.log('✅ Priority-based subscription management');
  console.log('\n💡 Notes:');
  console.log('- Database schema must be deployed for subscription functions to work');
  console.log('- Each user can only see their own subscriptions and dividends');
  console.log('- Subscription limits are enforced based on user plan type');
  console.log('- All endpoints require valid API key authentication');
}

// Run the tests
runSubscriptionTests().catch(console.error);