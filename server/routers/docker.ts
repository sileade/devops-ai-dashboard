import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as docker from "../infrastructure/docker";

/**
 * Docker management router
 * Handles container, image, network, and volume operations
 */
export const dockerRouter = router({
  listContainers: publicProcedure
    .input(z.object({ all: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return docker.listContainers(input?.all ?? true);
    }),

  getContainerStats: publicProcedure
    .input(z.object({ containerId: z.string() }))
    .query(async ({ input }) => {
      return docker.getContainerStats(input.containerId);
    }),

  getContainerLogs: publicProcedure
    .input(z.object({
      containerId: z.string(),
      tail: z.number().optional(),
      since: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return docker.getContainerLogs(input.containerId, input.tail, input.since);
    }),

  startContainer: publicProcedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ input }) => {
      const success = await docker.startContainer(input.containerId);
      return { success };
    }),

  stopContainer: publicProcedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ input }) => {
      const success = await docker.stopContainer(input.containerId);
      return { success };
    }),

  restartContainer: publicProcedure
    .input(z.object({ containerId: z.string() }))
    .mutation(async ({ input }) => {
      const success = await docker.restartContainer(input.containerId);
      return { success };
    }),

  listImages: publicProcedure.query(async () => {
    return docker.listImages();
  }),

  listNetworks: publicProcedure.query(async () => {
    return docker.listNetworks();
  }),

  listVolumes: publicProcedure.query(async () => {
    return docker.listVolumes();
  }),
});
