/**
 * Health Check Router
 * 
 * Provides health check endpoints for monitoring and load balancers
 */

import { router, publicProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { sql } from 'drizzle-orm';

// Health status interface
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning' | 'critical';
      used: number;
      total: number;
      percentage: number;
    };
  };
}

// Track server start time
const startTime = Date.now();

export const healthRouter = router({
  // Basic health check (for load balancers)
  check: publicProcedure.query(async (): Promise<{ status: string }> => {
    return { status: 'ok' };
  }),

  // Detailed health check
  detailed: publicProcedure.query(async (): Promise<HealthStatus> => {
    const checks: HealthStatus['checks'] = {
      database: { status: 'down' },
      memory: { status: 'ok', used: 0, total: 0, percentage: 0 },
    };

    // Check database
    try {
      const dbStart = Date.now();
      const db = await getDb();
      if (db) {
        // Simple query to check connection using drizzle
        await db.select({ count: sql`1` }).from(users).limit(1);
        const dbLatency = Date.now() - dbStart;
        checks.database = {
          status: 'up',
          latency: dbLatency,
        };
      } else {
        checks.database = {
          status: 'down',
          error: 'Database not configured',
        };
      }
    } catch (error) {
      checks.database = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check memory
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const memPercentage = (usedMem / totalMem) * 100;

    checks.memory = {
      status: memPercentage > 90 ? 'critical' : memPercentage > 70 ? 'warning' : 'ok',
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round(memPercentage),
    };

    // Determine overall status
    let status: HealthStatus['status'] = 'healthy';
    if (checks.database.status === 'down') {
      status = 'unhealthy';
    } else if (checks.memory.status === 'critical') {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }),

  // Readiness check (for Kubernetes)
  ready: publicProcedure.query(async (): Promise<{ ready: boolean }> => {
    try {
      const db = await getDb();
      if (db) {
        await db.select({ count: sql`1` }).from(users).limit(1);
        return { ready: true };
      }
      return { ready: false };
    } catch {
      return { ready: false };
    }
  }),

  // Liveness check (for Kubernetes)
  live: publicProcedure.query((): { live: boolean } => {
    return { live: true };
  }),
});
