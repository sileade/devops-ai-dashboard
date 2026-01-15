import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as kubernetes from "../infrastructure/kubernetes";

/**
 * Kubernetes management router
 * Handles pods, deployments, services, and cluster operations
 */
export const kubernetesRouter = router({
  listNamespaces: publicProcedure.query(async () => {
    return kubernetes.listNamespaces();
  }),

  listPods: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return kubernetes.listPods(input?.namespace || "default");
    }),

  getPod: publicProcedure
    .input(z.object({
      name: z.string(),
      namespace: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return kubernetes.getPod(input.name, input.namespace);
    }),

  getPodLogs: publicProcedure
    .input(z.object({
      name: z.string(),
      namespace: z.string().optional(),
      container: z.string().optional(),
      tailLines: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return kubernetes.getPodLogs(input.name, input.namespace, input.container, input.tailLines);
    }),

  deletePod: publicProcedure
    .input(z.object({
      name: z.string(),
      namespace: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await kubernetes.deletePod(input.name, input.namespace);
      return { success };
    }),

  listDeployments: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return kubernetes.listDeployments(input?.namespace || "default");
    }),

  scaleDeployment: publicProcedure
    .input(z.object({
      name: z.string(),
      namespace: z.string(),
      replicas: z.number(),
    }))
    .mutation(async ({ input }) => {
      const success = await kubernetes.scaleDeployment(input.name, input.namespace, input.replicas);
      return { success };
    }),

  restartDeployment: publicProcedure
    .input(z.object({
      name: z.string(),
      namespace: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await kubernetes.restartDeployment(input.name, input.namespace);
      return { success };
    }),

  listServices: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return kubernetes.listServices(input?.namespace || "default");
    }),

  listConfigMaps: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return kubernetes.listConfigMaps(input?.namespace || "default");
    }),

  listNodes: publicProcedure.query(async () => {
    return kubernetes.listNodes();
  }),

  getClusterMetrics: publicProcedure.query(async () => {
    return kubernetes.getClusterMetrics();
  }),

  executeKubectl: publicProcedure
    .input(z.object({ command: z.string() }))
    .mutation(async ({ input }) => {
      return kubernetes.executeKubectl(input.command);
    }),
});
