import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

// Mock data for dashboard
const mockContainerStats = {
  total: 24,
  running: 18,
  stopped: 6,
  todayChange: 3,
};

const mockKubernetesStats = {
  pods: 47,
  running: 45,
  pending: 2,
};

const mockDeploymentStats = {
  active: 12,
  status: "healthy" as const,
};

const mockAlertStats = {
  total: 3,
  critical: 1,
  warnings: 2,
};

const mockRecentActivity = [
  { id: "1", type: "deploy", message: "Deployed api-server v2.3.1 to production", timestamp: new Date(Date.now() - 2 * 60 * 1000) },
  { id: "2", type: "scale", message: "Scaled web-frontend from 3 to 5 replicas", timestamp: new Date(Date.now() - 15 * 60 * 1000) },
  { id: "3", type: "error", message: "Pod crash loop detected in worker-queue", timestamp: new Date(Date.now() - 32 * 60 * 1000) },
  { id: "4", type: "restart", message: "Restarted database-primary container", timestamp: new Date(Date.now() - 60 * 60 * 1000) },
];

const mockResourceUsage = {
  cpu: { used: 67, total: 100, unit: "%" },
  memory: { used: 12.4, total: 32, unit: "GB" },
  storage: { used: 234, total: 500, unit: "GB" },
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dashboard: router({
    getOverview: protectedProcedure.query(() => {
      return {
        containers: mockContainerStats,
        kubernetes: mockKubernetesStats,
        deployments: mockDeploymentStats,
        alerts: mockAlertStats,
      };
    }),

    getRecentActivity: protectedProcedure.query(() => {
      return mockRecentActivity;
    }),

    getResourceUsage: protectedProcedure.query(() => {
      return mockResourceUsage;
    }),
  }),
});

export type AppRouter = typeof appRouter;
