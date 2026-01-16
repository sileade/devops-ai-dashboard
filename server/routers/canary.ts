import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  createCanaryDeployment,
  getCanaryDeployment,
  listCanaryDeployments,
  getDeploymentSteps,
  startCanaryDeployment,
  progressCanaryDeployment,
  promoteCanaryToStable,
  pauseCanaryDeployment,
  resumeCanaryDeployment,
  cancelCanaryDeployment,
  initiateRollback,
  completeRollback,
  getRollbackHistory,
  getCanaryMetrics,
  analyzeCanaryHealth,
  createCanaryTemplate,
  listCanaryTemplates,
  getCanaryTemplate,
  deleteCanaryTemplate,
  type CanaryDeploymentConfig,
} from "../services/canary";

// Input schemas
const createDeploymentSchema = z.object({
  name: z.string().min(1),
  namespace: z.string().optional(),
  targetDeployment: z.string().min(1),
  canaryImage: z.string().min(1),
  canaryVersion: z.string().optional(),
  stableImage: z.string().optional(),
  stableVersion: z.string().optional(),
  clusterId: z.number().optional(),
  applicationId: z.number().optional(),
  trafficSplitType: z.enum(["percentage", "header", "cookie"]).optional(),
  initialCanaryPercent: z.number().min(1).max(100).optional(),
  targetCanaryPercent: z.number().min(1).max(100).optional(),
  incrementPercent: z.number().min(1).max(100).optional(),
  incrementIntervalMinutes: z.number().min(1).optional(),
  errorRateThreshold: z.number().min(0).max(100).optional(),
  latencyThresholdMs: z.number().min(0).optional(),
  successRateThreshold: z.number().min(0).max(100).optional(),
  minHealthyPods: z.number().min(1).optional(),
  autoRollbackEnabled: z.boolean().optional(),
  rollbackOnErrorRate: z.boolean().optional(),
  rollbackOnLatency: z.boolean().optional(),
  rollbackOnPodFailure: z.boolean().optional(),
  requireManualApproval: z.boolean().optional(),
  gitCommit: z.string().optional(),
  gitBranch: z.string().optional(),
  pullRequestUrl: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trafficSplitType: z.enum(["percentage", "header", "cookie"]).optional(),
  initialCanaryPercent: z.number().min(1).max(100).optional(),
  incrementPercent: z.number().min(1).max(100).optional(),
  incrementIntervalMinutes: z.number().min(1).optional(),
  errorRateThreshold: z.number().min(0).max(100).optional(),
  latencyThresholdMs: z.number().min(0).optional(),
  successRateThreshold: z.number().min(0).max(100).optional(),
  autoRollbackEnabled: z.boolean().optional(),
  requireManualApproval: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const canaryRouter = router({
  // ============================================
  // DEPLOYMENT MANAGEMENT
  // ============================================
  
  create: protectedProcedure
    .input(createDeploymentSchema)
    .mutation(async ({ ctx, input }) => {
      const config: CanaryDeploymentConfig = {
        ...input,
      };
      return createCanaryDeployment(ctx.user.id, config);
    }),
  
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getCanaryDeployment(input.id);
    }),
  
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return listCanaryDeployments(undefined, input?.status, input?.limit);
    }),
  
  getSteps: publicProcedure
    .input(z.object({ deploymentId: z.number() }))
    .query(async ({ input }) => {
      return getDeploymentSteps(input.deploymentId);
    }),
  
  // ============================================
  // DEPLOYMENT LIFECYCLE
  // ============================================
  
  start: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return startCanaryDeployment(input.id);
    }),
  
  progress: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return progressCanaryDeployment(input.id);
    }),
  
  promote: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return promoteCanaryToStable(input.id);
    }),
  
  pause: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return pauseCanaryDeployment(input.id);
    }),
  
  resume: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return resumeCanaryDeployment(input.id);
    }),
  
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return cancelCanaryDeployment(input.id);
    }),
  
  // ============================================
  // ROLLBACK
  // ============================================
  
  rollback: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return initiateRollback(
        input.deploymentId,
        input.reason,
        "manual",
        String(ctx.user.id)
      );
    }),
  
  completeRollback: protectedProcedure
    .input(z.object({
      rollbackId: z.number(),
      success: z.boolean(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return completeRollback(input.rollbackId, input.success, input.errorMessage);
    }),
  
  getRollbackHistory: publicProcedure
    .input(z.object({ deploymentId: z.number() }))
    .query(async ({ input }) => {
      return getRollbackHistory(input.deploymentId);
    }),
  
  // ============================================
  // METRICS & ANALYSIS
  // ============================================
  
  getMetrics: publicProcedure
    .input(z.object({
      deploymentId: z.number(),
      limit: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return getCanaryMetrics(input.deploymentId, input.limit);
    }),
  
  analyze: publicProcedure
    .input(z.object({ deploymentId: z.number() }))
    .query(async ({ input }) => {
      return analyzeCanaryHealth(input.deploymentId);
    }),
  
  // ============================================
  // TEMPLATES
  // ============================================
  
  createTemplate: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return createCanaryTemplate(ctx.user.id, input);
    }),
  
  listTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      return listCanaryTemplates(ctx.user.id);
    }),
  
  getTemplate: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getCanaryTemplate(input.id);
    }),
  
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCanaryTemplate(input.id);
      return { success: true };
    }),
});
