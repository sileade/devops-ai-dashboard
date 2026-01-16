/**
 * k6 Load Test Script
 * 
 * This script tests the API endpoints under various load conditions.
 * 
 * Run locally:
 *   k6 run k6/load-test.js
 * 
 * Run with options:
 *   k6 run --vus 50 --duration 5m k6/load-test.js
 * 
 * Run with environment variables:
 *   k6 run -e BASE_URL=https://api.example.com k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const requestsCount = new Counter('requests_total');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test options
export const options = {
  // Stages for ramping up/down load
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down to 0
  ],
  
  // Thresholds for pass/fail criteria
  thresholds: {
    // 95% of requests should complete within 500ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Error rate should be less than 1%
    errors: ['rate<0.01'],
    // API latency p95 should be under 400ms
    api_latency: ['p(95)<400'],
    // At least 95% of checks should pass
    checks: ['rate>0.95'],
  },
};

// Helper function to make API requests
function apiRequest(method, endpoint, body = null, params = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...params.headers,
  };
  
  const startTime = Date.now();
  let response;
  
  if (method === 'GET') {
    response = http.get(url, { headers });
  } else if (method === 'POST') {
    response = http.post(url, JSON.stringify(body), { headers });
  }
  
  const latency = Date.now() - startTime;
  apiLatency.add(latency);
  requestsCount.add(1);
  
  return response;
}

// Main test function
export default function() {
  // Dashboard endpoints
  group('Dashboard API', () => {
    // Get dashboard overview
    let response = apiRequest('GET', '/api/trpc/dashboard.overview');
    check(response, {
      'dashboard.overview status is 200': (r) => r.status === 200,
      'dashboard.overview has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(response.status !== 200);
    
    sleep(0.5);
    
    // Get recent activity
    response = apiRequest('GET', '/api/trpc/dashboard.activity');
    check(response, {
      'dashboard.activity status is 200': (r) => r.status === 200,
    });
    errorRate.add(response.status !== 200);
    
    sleep(0.5);
    
    // Get resource usage
    response = apiRequest('GET', '/api/trpc/dashboard.resourceUsage');
    check(response, {
      'dashboard.resourceUsage status is 200': (r) => r.status === 200,
    });
    errorRate.add(response.status !== 200);
  });
  
  sleep(1);
  
  // Docker endpoints
  group('Docker API', () => {
    // List containers
    let response = apiRequest('GET', '/api/trpc/docker.containers');
    check(response, {
      'docker.containers status is 200 or 500': (r) => r.status === 200 || r.status === 500,
    });
    
    sleep(0.5);
    
    // List images
    response = apiRequest('GET', '/api/trpc/docker.images');
    check(response, {
      'docker.images status is 200 or 500': (r) => r.status === 200 || r.status === 500,
    });
  });
  
  sleep(1);
  
  // Kubernetes endpoints
  group('Kubernetes API', () => {
    // List pods
    let response = apiRequest('GET', '/api/trpc/kubernetes.pods');
    check(response, {
      'kubernetes.pods status is 200 or 500': (r) => r.status === 200 || r.status === 500,
    });
    
    sleep(0.5);
    
    // List deployments
    response = apiRequest('GET', '/api/trpc/kubernetes.deployments');
    check(response, {
      'kubernetes.deployments status is 200 or 500': (r) => r.status === 200 || r.status === 500,
    });
  });
  
  sleep(1);
  
  // Health check
  group('Health Check', () => {
    let response = apiRequest('GET', '/api/health');
    check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(response.status !== 200);
  });
  
  sleep(1);
}

// Setup function - runs once before the test
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  
  // Verify the server is reachable
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    console.warn(`Warning: Health check returned status ${response.status}`);
  }
  
  return { startTime: Date.now() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)} seconds`);
}
