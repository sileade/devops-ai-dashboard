/**
 * k6 Spike Test Script
 * 
 * This script tests the system's behavior under sudden traffic spikes.
 * It simulates scenarios like viral content or DDoS-like traffic patterns.
 * 
 * Run: k6 run k6/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  // Spike test stages - sudden traffic bursts
  stages: [
    { duration: '1m', target: 10 },   // Baseline
    { duration: '10s', target: 500 }, // Spike to 500 users
    { duration: '1m', target: 500 },  // Stay at spike
    { duration: '10s', target: 10 },  // Drop back to baseline
    { duration: '2m', target: 10 },   // Recovery period
    { duration: '10s', target: 500 }, // Second spike
    { duration: '1m', target: 500 },  // Stay at spike
    { duration: '10s', target: 0 },   // Ramp down
  ],
  
  thresholds: {
    // During spikes, we accept degraded performance
    http_req_duration: ['p(95)<5000'],
    // Error rate should stay manageable
    errors: ['rate<0.2'],
    // At least 80% of checks should pass
    checks: ['rate>0.80'],
  },
};

export default function() {
  // Quick health check
  let response = http.get(`${BASE_URL}/api/health`, {
    timeout: '10s',
  });
  
  check(response, {
    'health check ok': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);
  
  // Dashboard overview - main endpoint
  response = http.get(`${BASE_URL}/api/trpc/dashboard.overview`, {
    timeout: '10s',
  });
  
  check(response, {
    'dashboard ok': (r) => r.status === 200 || r.status === 429, // Accept rate limiting
  });
  
  errorRate.add(response.status !== 200 && response.status !== 429);
  responseTime.add(response.timings.duration);
  
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'k6/spike-test-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  
  let summary = '\n=== SPIKE TEST SUMMARY ===\n\n';
  
  summary += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `Error Rate: ${Math.round((metrics.errors?.values?.rate || 0) * 100)}%\n`;
  summary += `\nResponse Times:\n`;
  summary += `  Average: ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms\n`;
  summary += `  P95: ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms\n`;
  summary += `  Max: ${Math.round(metrics.http_req_duration?.values?.max || 0)}ms\n`;
  
  return summary;
}
