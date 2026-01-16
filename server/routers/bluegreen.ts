/**
 * Blue-Green Deployment Router
 * 
 * tRPC procedures for blue-green deployment management
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { blueGreenService } from '../services/bluegreen';

export const blueGreenRouter = router({
  // Create new blue-green deployment
  createDeployment: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      applicationName: z.string(),
      initialImage: z.string(),
      initialVersion: z.string(),
      replicas: z.number().min(1).default(3),
    }))
    .mutation(async ({ input }) => {
      const deployment = await blueGreenService.createDeployment(
        input.applicationId,
        input.applicationName,
        input.initialImage,
        input.initialVersion,
        input.replicas
      );
      return { deployment };
    }),

  // Get deployment by ID
  getDeployment: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(({ input }) => {
      const deployment = blueGreenService.getDeployment(input.id);
      return { deployment };
    }),

  // Get deployment by application ID
  getDeploymentByApplication: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
    }))
    .query(({ input }) => {
      const deployment = blueGreenService.getDeploymentByApplication(input.applicationId);
      return { deployment };
    }),

  // List all deployments
  listDeployments: protectedProcedure
    .query(() => {
      const deployments = blueGreenService.listDeployments();
      return { deployments };
    }),

  // Deploy new version
  deploy: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
      image: z.string(),
      version: z.string(),
      replicas: z.number().min(1).optional(),
      healthCheckPath: z.string().optional(),
      healthCheckTimeout: z.number().min(10).max(300).optional(),
      preDeployHook: z.string().optional(),
      postDeployHook: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await blueGreenService.deploy(input.deploymentId, {
        image: input.image,
        version: input.version,
        replicas: input.replicas,
        healthCheckPath: input.healthCheckPath,
        healthCheckTimeout: input.healthCheckTimeout,
        preDeployHook: input.preDeployHook,
        postDeployHook: input.postDeployHook,
        metadata: input.metadata,
      });
      return result;
    }),

  // Switch traffic
  switchTraffic: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
      gradual: z.boolean().optional(),
      steps: z.array(z.number().min(1).max(100)).optional(),
      stepIntervalSeconds: z.number().min(5).optional(),
      healthCheckBetweenSteps: z.boolean().optional(),
      autoRollbackOnFailure: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await blueGreenService.switchTraffic(input.deploymentId, {
        gradual: input.gradual,
        steps: input.steps,
        stepIntervalSeconds: input.stepIntervalSeconds,
        healthCheckBetweenSteps: input.healthCheckBetweenSteps,
        autoRollbackOnFailure: input.autoRollbackOnFailure,
      });
      return result;
    }),

  // Instant rollback
  rollback: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const result = await blueGreenService.rollback(input.deploymentId);
      return result;
    }),

  // Scale deployment
  scale: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
      environment: z.enum(['blue', 'green', 'both']),
      replicas: z.number().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      const result = await blueGreenService.scale(
        input.deploymentId,
        input.environment,
        input.replicas
      );
      return result;
    }),

  // Get deployment status
  getStatus: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
    }))
    .query(({ input }) => {
      const status = blueGreenService.getStatus(input.deploymentId);
      return status;
    }),

  // Get AI recommendations
  getAIRecommendations: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
    }))
    .query(async ({ input }) => {
      const recommendations = await blueGreenService.getAIRecommendations(input.deploymentId);
      return { recommendations };
    }),

  // Get deployment history
  getHistory: protectedProcedure
    .input(z.object({
      deploymentId: z.number(),
    }))
    .query(({ input }) => {
      const history = blueGreenService.getDeploymentHistory(input.deploymentId);
      return { history };
    }),

  // Delete deployment
  deleteDeployment: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(({ input }) => {
      const success = blueGreenService.deleteDeployment(input.id);
      return { success };
    }),
});
