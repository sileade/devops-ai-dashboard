import { publicProcedure, router } from "../_core/trpc";
import * as docker from "../infrastructure/docker";
import * as kubernetes from "../infrastructure/kubernetes";

/**
 * Dashboard router
 * Handles overview, activity, and resource usage data
 */

// Mock data for dashboard overview
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

export const dashboardRouter = router({
  getOverview: publicProcedure.query(async () => {
    // Try to get real data, fall back to mock
    try {
      const containers = await docker.listContainers();
      const pods = await kubernetes.listPods("all");
      const deployments = await kubernetes.listDeployments("all");
      
      return {
        containers: {
          total: containers.length,
          running: containers.filter(c => c.status === "running").length,
          stopped: containers.filter(c => c.status !== "running").length,
          todayChange: 3,
        },
        kubernetes: {
          pods: pods.length,
          running: pods.filter(p => p.status === "Running").length,
          pending: pods.filter(p => p.status === "Pending").length,
        },
        deployments: {
          active: deployments.length,
          status: "healthy" as const,
        },
        alerts: mockAlertStats,
      };
    } catch {
      return {
        containers: mockContainerStats,
        kubernetes: mockKubernetesStats,
        deployments: mockDeploymentStats,
        alerts: mockAlertStats,
      };
    }
  }),

  getRecentActivity: publicProcedure.query(() => mockRecentActivity),
  getResourceUsage: publicProcedure.query(() => mockResourceUsage),
});
