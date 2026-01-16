import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";

// Import router modules
import {
  authRouter,
  dashboardRouter,
  dockerRouter,
  kubernetesRouter,
  aiRouter,
  connectionsRouter,
  notificationsRouter,
  metricsRouter,
  alertThresholdsRouter,
  alertHistoryRouter,
  autoscalingRouter,
  scheduledScalingRouter,
  abTestingRouter,
  emailRouter,
  prometheusRouter,
  clustersRouter,
} from "./routers/index";

/**
 * Main application router
 * Combines all feature routers into a single tRPC router
 * 
 * Router structure:
 * - system: System-level operations (notifications, etc.)
 * - auth: Authentication (me, logout)
 * - dashboard: Overview, activity, resource usage
 * - docker: Container, image, network, volume management
 * - kubernetes: Pods, deployments, services, cluster operations
 * - ai: Chat, analysis, troubleshooting, knowledge base
 * - connections: Infrastructure connection configuration
 * - notifications: Alerts and notification management
 */
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  docker: dockerRouter,
  kubernetes: kubernetesRouter,
  ai: aiRouter,
  connections: connectionsRouter,
  notifications: notificationsRouter,
  metrics: metricsRouter,
  alertThresholds: alertThresholdsRouter,
  alertHistory: alertHistoryRouter,
  autoscaling: autoscalingRouter,
  scheduledScaling: scheduledScalingRouter,
  abTesting: abTestingRouter,
  email: emailRouter,
  prometheus: prometheusRouter,
  clusters: clustersRouter,
});

export type AppRouter = typeof appRouter;
