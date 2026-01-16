/**
 * Router modules index
 * Re-exports all router modules for clean imports
 */

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
export { emailRouter } from "./email";
export { prometheusRouter } from "./prometheus";
export { clustersRouter } from "./clusters";
