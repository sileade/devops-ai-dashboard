/**
 * Router modules index
 * Re-exports all router modules for clean imports
 */

// Core routers
export { authRouter } from "./auth";
export { dashboardRouter } from "./dashboard";
export { dockerRouter } from "./docker";
export { kubernetesRouter } from "./kubernetes";
export { aiRouter } from "./ai";
export { connectionsRouter } from "./connections";
export { notificationsRouter } from "./notifications";
export { metricsRouter, alertThresholdsRouter, alertHistoryRouter } from "./metrics";
export { autoscalingRouter } from "./autoscaling";
export { scheduledScalingRouter } from "./scheduledScaling";
export { abTestingRouter } from "./abTesting";

// New AI-powered DevOps modules
export { incidentCommanderRouter } from "./incidentCommander";
export { securityGuardianRouter } from "./securityGuardian";
export { costOptimizerRouter } from "./costOptimizer";
export { selfHealingRouter } from "./selfHealing";
