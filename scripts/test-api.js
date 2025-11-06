#!/usr/bin/env node

/**
 * API Test Script for BetterFeed
 * 
 * This script dynamically tests all API endpoints by:
 * 1. Creating a user via signup
 * 2. Logging in with those credentials
 * 3. Creating a post and using its ID for all post operations
 * 4. Creating interactions with the post and tracking their IDs
 * 5. Cleaning up by deleting interactions and the post
 * 
 * Usage:
 *   node scripts/test-api.js                    # Test all endpoints (full dynamic flow)
 *   node scripts/test-api.js signup             # Test specific endpoint
 *   node scripts/test-api.js login              # Test login and save token
 * 
 * Environment:
 *   BASE_URL - API base URL (default: http://localhost:3000)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Store auth token for authenticated requests
let authToken = null;

// Store test user credentials for reuse
let testCredentials = null;

// Store created resources for dynamic testing
let createdPostId = null;
let createdInteractionIds = [];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logRequest(method, endpoint) {
  log(`\n${method} ${endpoint}`, 'cyan');
}

function logResponse(status, data) {
  if (status >= 200 && status < 300) {
    log(`✅ Status: ${status}`, 'green');
  } else {
    log(`❌ Status: ${status}`, 'red');
  }
  console.log(JSON.stringify(data, null, 2));
}

async function makeRequest(method, endpoint, body = null, useAuth = false) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (useAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    logResponse(response.status, data);
    return { status: response.status, data };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return { status: 0, error: error.message };
  }
}

// Test endpoints
const tests = {
  async signup() {
    logRequest('POST', '/api/auth/signup');
    
    // Generate test credentials
    const timestamp = Date.now();
    testCredentials = {
      email: `test${timestamp}@example.com`,
      password: 'testpassword123',
      username: `testuser${timestamp}`,
    };
    
    const result = await makeRequest('POST', '/api/auth/signup', testCredentials);
    
    if (result.status === 200) {
      log(`\n💾 Test credentials saved: ${testCredentials.email}`, 'yellow');
    }
    
    return result;
  },

  async login() {
    logRequest('POST', '/api/auth/login');
    
    // Use saved credentials from signup, or fallback to defaults
    const credentials = testCredentials || {
      email: 'test@example.com',
      password: 'testpassword123',
    };
    
    if (!testCredentials) {
      log(`\n⚠️  Using default credentials (run signup first to use newly created account)`, 'yellow');
    }
    
    const result = await makeRequest('POST', '/api/auth/login', credentials);
    
    if (result.data?.access_token) {
      authToken = result.data.access_token;
      log(`\n🔑 Auth token saved for authenticated requests`, 'yellow');
    }
    return result;
  },

  async getPosts() {
    logRequest('GET', '/api/posts');
    return await makeRequest('GET', '/api/posts');
  },

  async getPostById(postId = null) {
    const id = postId || createdPostId || 1;
    logRequest('GET', `/api/posts/${id}`);
    return await makeRequest('GET', `/api/posts/${id}`);
  },

  async getUsernameByPostId(postId = null) {
    const id = postId || createdPostId || 1;
    logRequest('GET', `/api/posts/${id}/username`);
    return await makeRequest('GET', `/api/posts/${id}/username`);
  },

  async createPost() {
    logRequest('POST', '/api/posts');
    const result = await makeRequest('POST', '/api/posts', {
      title: `Test Post ${Date.now()}`,
      content: 'This is a test post content created dynamically',
      article_url: 'https://example.com/article',
      thumbnail_url: 'https://example.com/thumbnail.jpg',
    }, true); // Requires auth
    
    // Save the created post ID
    if (result.status === 200 && result.data && result.data[0]) {
      createdPostId = result.data[0].id;
      log(`\n💾 Created post ID saved: ${createdPostId}`, 'yellow');
    }
    
    return result;
  },

  async updatePost(postId = null) {
    const id = postId || createdPostId;
    if (!id) {
      log('⚠️  No post ID available. Create a post first.', 'yellow');
      return { status: 0, error: 'No post ID' };
    }
    
    logRequest('PUT', `/api/posts/${id}`);
    return await makeRequest('PUT', `/api/posts/${id}`, {
      title: `Updated Test Post Title ${Date.now()}`,
    }, true); // Requires auth
  },

  async deletePost(postId = null) {
    const id = postId || createdPostId;
    if (!id) {
      log('⚠️  No post ID available. Create a post first.', 'yellow');
      return { status: 0, error: 'No post ID' };
    }
    
    logRequest('DELETE', `/api/posts/${id}`);
    const result = await makeRequest('DELETE', `/api/posts/${id}`, null, true); // Requires auth
    
    // Clear the post ID after deletion
    if (result.status === 200) {
      createdPostId = null;
    }
    
    return result;
  },

  async createInteraction(postId = null, interactionType = 'like') {
    const id = postId || createdPostId;
    if (!id) {
      log('⚠️  No post ID available. Create a post first.', 'yellow');
      return { status: 0, error: 'No post ID' };
    }
    
    logRequest('POST', '/api/interactions');
    const result = await makeRequest('POST', '/api/interactions', {
      post_id: id,
      interaction_type: interactionType,
    }, true); // Requires auth
    
    // Save the created interaction ID
    if (result.status === 200 && result.data && result.data[0]) {
      createdInteractionIds.push(result.data[0].id);
      log(`\n💾 Created interaction ID saved: ${result.data[0].id}`, 'yellow');
    }
    
    return result;
  },

  async getInteractionsByPostId(postId = null) {
    const id = postId || createdPostId || 1;
    logRequest('GET', `/api/interactions/${id}`);
    return await makeRequest('GET', `/api/interactions/${id}`);
  },

  async deleteInteraction(interactionId = null) {
    // Try to use the last created interaction, or provided ID
    const id = interactionId || createdInteractionIds.pop();
    if (!id) {
      log('⚠️  No interaction ID available. Create an interaction first.', 'yellow');
      return { status: 0, error: 'No interaction ID' };
    }
    
    logRequest('DELETE', `/api/interactions/${id}`);
    return await makeRequest('DELETE', `/api/interactions/${id}`, null, true); // Requires auth
  },
};

// Main execution
async function main() {
  const testName = process.argv[2];

  log('\n🧪 BetterFeed API Test Script', 'blue');
  log(`Base URL: ${BASE_URL}`, 'yellow');

  if (testName && tests[testName]) {
    // Run single test
    await tests[testName]();
  } else if (testName) {
    log(`\n❌ Unknown test: ${testName}`, 'red');
    log('Available tests:', 'yellow');
    Object.keys(tests).forEach(name => log(`  - ${name}`, 'yellow'));
  } else {
    // Run all tests
    log('\n📋 Running all tests...\n', 'blue');
    
    // Public endpoints first (may fail if no data exists, that's OK)
    log('\n--- Public Endpoints ---\n', 'yellow');
    await tests.getPosts();
    
    // Auth endpoints
    log('\n\n--- Authentication Tests ---\n', 'yellow');
    await tests.signup();
    await tests.login();
    
    // Authenticated endpoints
    if (authToken) {
      log('\n\n--- Authenticated Endpoint Tests ---\n', 'yellow');
      
      // Create a post
      await tests.createPost();
      
      // If post was created, test full flow with it
      if (createdPostId) {
        // Test GET endpoints with the created post
        await tests.getPostById(createdPostId);
        await tests.getUsernameByPostId(createdPostId);
        
        // Update the post
        await tests.updatePost(createdPostId);
        
        // Create multiple interactions (like and save)
        await tests.createInteraction(createdPostId, 'like');
        await tests.createInteraction(createdPostId, 'save');
        
        // Get interactions for the post
        await tests.getInteractionsByPostId(createdPostId);
        
        // Delete all created interactions (in reverse order)
        log('\n--- Cleaning up interactions ---\n', 'yellow');
        while (createdInteractionIds.length > 0) {
          await tests.deleteInteraction();
        }
        
        // Delete the post
        log('\n--- Cleaning up post ---\n', 'yellow');
        await tests.deletePost(createdPostId);
      } else {
        log('⚠️  Could not create post, skipping post-related tests', 'yellow');
      }
    } else {
      log('\n⚠️  Skipping authenticated tests (no auth token)', 'yellow');
    }
    
    log('\n✅ All tests completed!', 'green');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as module
module.exports = { tests, makeRequest };

