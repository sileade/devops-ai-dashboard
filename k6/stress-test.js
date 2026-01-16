/**
 * k6 Stress Test Script
 * 
 * This script tests the system's behavior under extreme load conditions.
 * It helps identify the breaking point and recovery behavior.
 * 
 * Run: k6 run k6/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  // Stress test stages - push the system to its limits
  stages: [
    { duration: '2m', target: 50 },   // Warm up
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 300 },  // Ramp up to 300 users
    { duration: '5m', target: 300 },  // Stay at 300 users
    { duration: '5m', target: 0 },    // Ramp down - recovery phase
  ],
  
  thresholds: {
    // Under stress, we accept higher latency
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    // Error rate can be higher under stress
    errors: ['rate<0.1'],
    // At least 90% of checks should pass
    checks: ['rate>0.90'],
  },
};

export default function() {
  // Critical path - dashboard overview
  let response = http.get(`${BASE_URL}/api/trpc/dashboard.overview`);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);
  
  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
  
  // Secondary path - health check
  response = http.get(`${BASE_URL}/api/health`);
  
  check(response, {
    'health check ok': (r) => r.status === 200,
  });
  
  errorRate.add(response.status !== 200);
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'k6/stress-test-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const metrics = data.metrics;
  const checks = data.root_group.checks;
  
  let summary = '\n=== STRESS TEST SUMMARY ===\n\n';
  
  summary += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `Failed Requests: ${Math.round((metrics.errors?.values?.rate || 0) * 100)}%\n`;
  summary += `\nResponse Times:\n`;
  summary += `  Average: ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms\n`;
  summary += `  P95: ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms\n`;
  summary += `  P99: ${Math.round(metrics.http_req_duration?.values?.['p(99)'] || 0)}ms\n`;
  summary += `  Max: ${Math.round(metrics.http_req_duration?.values?.max || 0)}ms\n`;
  
  return summary;
}
