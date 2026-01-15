import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

/**
 * Connections router
 * Handles infrastructure connection configuration and testing
 */
export const connectionsRouter = router({
  getDockerConfig: publicProcedure.query(() => {
    return {
      socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
      host: process.env.DOCKER_HOST || "",
      connected: true, // Mock status
    };
  }),

  getKubernetesConfig: publicProcedure.query(() => {
    return {
      apiServer: process.env.KUBERNETES_API_SERVER || "",
      namespace: process.env.KUBERNETES_NAMESPACE || "default",
      connected: true, // Mock status
    };
  }),

  getAIConfig: publicProcedure.query(() => {
    return {
      agentUrl: process.env.DEVOPS_AI_AGENT_URL || "",
      ollamaUrl: process.env.OLLAMA_URL || "",
      model: process.env.AI_MODEL || "gpt-4",
      useLocalLLM: process.env.USE_LOCAL_LLM === "true",
    };
  }),

  testConnection: publicProcedure
    .input(z.object({
      type: z.enum(["docker", "kubernetes", "ai"]),
    }))
    .mutation(async ({ input }) => {
      // Mock connection test
      return {
        success: true,
        message: `Successfully connected to ${input.type}`,
        latency: Math.floor(Math.random() * 100) + 10,
      };
    }),
});
