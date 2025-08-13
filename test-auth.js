#!/usr/bin/env node

/**
 * Test script for Cloudflare Worker API authentication
 * Tests both authenticated and unauthenticated requests
 */

const WORKER_URL = 'https://ticker-backend-worker2.your-subdomain.workers.dev';
const VALID_API_KEY = 'tk_demo_key_12345';
const INVALID_API_KEY = 'invalid_key_123';

async function testEndpoint(url, headers = {}, method = 'GET', body = null) {
  try {
    console.log(`\n🔍 Testing: ${method} ${url}`);
    console.log(`📋 Headers: ${JSON.stringify(headers, null, 2)}`);
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    console.log(`📊 Status: ${response.status}`);
    
    // Log rate limit headers if present
    const rateLimit = response.headers.get('X-RateLimit-Limit');
    const rateRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimit) {
      console.log(`⏱️  Rate Limit: ${rateRemaining}/${rateLimit}`);
    }

    const responseText = await response.text();
    console.log(`📄 Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function runAuthTests() {
  console.log('🚀 Starting Cloudflare Worker Authentication Tests\n');
  console.log('📍 Worker URL (update this to your actual worker URL):', WORKER_URL);
  console.log('\n' + '='.repeat(60));

  // Test 1: Health check (should work without auth)
  console.log('\n🏥 TEST 1: Health Check (No Auth Required)');
  await testEndpoint(`${WORKER_URL}/health`);

  // Test 2: Unauthenticated request to protected endpoint
  console.log('\n🚫 TEST 2: Protected Endpoint Without API Key');
  await testEndpoint(`${WORKER_URL}/dividends/all`);

  // Test 3: Invalid API key
  console.log('\n❌ TEST 3: Protected Endpoint With Invalid API Key');
  await testEndpoint(`${WORKER_URL}/dividends/all`, {
    'X-API-Key': INVALID_API_KEY,
    'Content-Type': 'application/json'
  });

  // Test 4: Valid API key - should work
  console.log('\n✅ TEST 4: Protected Endpoint With Valid API Key');
  await testEndpoint(`${WORKER_URL}/dividends/all`, {
    'X-API-Key': VALID_API_KEY,
    'Content-Type': 'application/json'
  });

  // Test 5: API key in Authorization header
  console.log('\n🔑 TEST 5: API Key in Authorization Header');
  await testEndpoint(`${WORKER_URL}/dividends/AAPL`, {
    'Authorization': `Bearer ${VALID_API_KEY}`,
    'Content-Type': 'application/json'
  });

  // Test 6: API key in query parameter
  console.log('\n🔗 TEST 6: API Key in Query Parameter');
  await testEndpoint(`${WORKER_URL}/dividends/AAPL?apikey=${VALID_API_KEY}`);

  // Test 7: POST endpoint with authentication
  console.log('\n📤 TEST 7: POST Endpoint With Authentication');
  await testEndpoint(`${WORKER_URL}/update-tickers`, {
    'X-API-Key': VALID_API_KEY,
    'Content-Type': 'application/json'
  }, 'POST', {
    tickers: ['AAPL'],
    force: false
  });

  // Test 8: Rate limiting (make multiple requests)
  console.log('\n⏱️  TEST 8: Rate Limiting (Multiple Requests)');
  for (let i = 1; i <= 3; i++) {
    console.log(`\n   Request ${i}/3:`);
    await testEndpoint(`${WORKER_URL}/dividends/MSFT`, {
      'X-API-Key': VALID_API_KEY,
      'Content-Type': 'application/json'
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 Authentication tests completed!');
  console.log('\n📝 Notes:');
  console.log('- Update WORKER_URL to your actual worker URL');
  console.log('- Health endpoint should work without authentication');
  console.log('- All other endpoints should require valid API key');
  console.log('- Rate limiting headers should be present in responses');
  console.log('- Invalid/missing API keys should return 401 Unauthorized');
}

// Run the tests
runAuthTests().catch(console.error);