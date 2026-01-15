import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as chatDb from "./db";

// Import infrastructure modules
import * as docker from "./infrastructure/docker";
import * as kubernetes from "./infrastructure/kubernetes";
import * as aiAgent from "./infrastructure/ai-agent";

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

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Dashboard overview
  dashboard: router({
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
  }),

  // Docker management
  docker: router({
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
  }),

  // Kubernetes management
  kubernetes: router({
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
  }),

  // AI Assistant
  ai: router({
    // Get or create a chat session
    getSession: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        userOpenId: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const userOpenId = ctx.user?.openId || input?.userOpenId || null;
        const result = await chatDb.getOrCreateChatSession(userOpenId, input?.sessionId);
        return result;
      }),

    // Get chat history for a session
    getChatHistory: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        const messages = await chatDb.getChatHistoryBySessionId(input.sessionId, input.limit);
        return messages.map(m => ({
          id: m.id.toString(),
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.createdAt,
          suggestions: m.suggestions || undefined,
          commands: m.commands || undefined,
          feedbackGiven: m.feedback || undefined,
        }));
      }),

    // Get all sessions for user
    getUserSessions: publicProcedure
      .input(z.object({
        userOpenId: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const userOpenId = ctx.user?.openId || input?.userOpenId;
        if (!userOpenId) return [];
        return chatDb.getUserChatSessions(userOpenId);
      }),

    // Create new chat session
    createSession: publicProcedure
      .input(z.object({
        userOpenId: z.string().optional(),
      }).optional())
      .mutation(async ({ input, ctx }) => {
        const userOpenId = ctx.user?.openId || input?.userOpenId || null;
        const result = await chatDb.createNewChatSession(userOpenId);
        return { sessionId: result.sessionId };
      }),

    // Clear chat history
    clearHistory: publicProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const success = await chatDb.clearChatHistory(input.sessionId);
        return { success };
      }),

    chat: publicProcedure
      .input(z.object({
        message: z.string(),
        sessionId: z.string().optional(),
        context: z.object({
          recentMessages: z.array(z.object({
            role: z.string(),
            content: z.string(),
          })).optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userOpenId = ctx.user?.openId || null;
        
        // Get or create session
        const { sessionId, conversationId } = await chatDb.getOrCreateChatSession(userOpenId, input.sessionId);
        
        // Save user message to database
        await chatDb.saveChatMessage({
          conversationId,
          role: "user",
          content: input.message,
        });

        // Update session title if this is the first message
        const history = await chatDb.getChatHistory(conversationId, 2);
        if (history.length <= 1) {
          const title = input.message.length > 50 ? input.message.substring(0, 50) + "..." : input.message;
          await chatDb.updateSessionTitle(sessionId, title);
        }

        const messages = [
          { role: "system" as const, content: "You are a DevOps AI assistant. Help with infrastructure analysis, troubleshooting, and command recommendations." },
          ...(input.context?.recentMessages?.map(m => ({ role: m.role as "user" | "assistant", content: m.content })) || []),
          { role: "user" as const, content: input.message },
        ];
        const response = await aiAgent.chat(messages);
        
        // Generate suggestions based on response
        const suggestions = [
          "Show me more details",
          "Execute the recommended commands",
          "Analyze related logs",
        ];
        
        // Extract commands from response if any
        const commands: { command: string; description: string }[] = [];
        const commandRegex = /`([^`]+)`/g;
        let match;
        while ((match = commandRegex.exec(response)) !== null) {
          if (match[1].startsWith('kubectl') || match[1].startsWith('docker') || match[1].startsWith('terraform')) {
            commands.push({
              command: match[1],
              description: "Suggested command from AI analysis",
            });
          }
        }

        // Save assistant response to database
        const assistantMessageId = await chatDb.saveChatMessage({
          conversationId,
          role: "assistant",
          content: response,
          suggestions,
          commands,
        });
        
        return { 
          response, 
          suggestions, 
          commands, 
          sessionId,
          messageId: assistantMessageId?.toString(),
        };
      }),

    analyzeInfrastructure: publicProcedure
      .input(z.object({
        containers: z.array(z.unknown()).optional(),
        pods: z.array(z.unknown()).optional(),
        deployments: z.array(z.unknown()).optional(),
        metrics: z.unknown().optional(),
        logs: z.array(z.string()).optional(),
      }).optional())
      .query(async ({ input }) => {
        // Get current infrastructure data if not provided
        const containers = input?.containers || await docker.listContainers();
        const pods = input?.pods || await kubernetes.listPods("all");
        const deployments = input?.deployments || await kubernetes.listDeployments("all");
        
        return aiAgent.analyzeInfrastructure({
          containers,
          pods,
          deployments,
          metrics: input?.metrics,
          logs: input?.logs,
        });
      }),

    troubleshoot: publicProcedure
      .input(z.object({
        issue: z.string(),
        errorLogs: z.array(z.string()).optional(),
        resourceType: z.string().optional(),
        resourceName: z.string().optional(),
        namespace: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return aiAgent.troubleshoot(input.issue, {
          errorLogs: input.errorLogs,
          resourceType: input.resourceType,
          resourceName: input.resourceName,
          namespace: input.namespace,
        });
      }),

    suggestCommands: publicProcedure
      .input(z.object({
        intent: z.string(),
        platform: z.enum(["docker", "kubernetes", "ansible", "terraform"]),
      }))
      .query(async ({ input }) => {
        return aiAgent.suggestCommands(input.intent, input.platform);
      }),

    analyzeLogs: publicProcedure
      .input(z.object({
        logs: z.array(z.string()),
        source: z.string().optional(),
        timeRange: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return aiAgent.analyzeLogsForAnomalies(input.logs, {
          source: input.source,
          timeRange: input.timeRange,
        });
      }),

    getStatus: publicProcedure.query(async () => {
      return aiAgent.getAIStatus();
    }),

    submitFeedback: publicProcedure
      .input(z.object({
        messageId: z.string(),
        feedback: z.enum(["positive", "negative"]),
        context: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Store feedback in database
        const messageIdNum = parseInt(input.messageId, 10);
        if (!isNaN(messageIdNum)) {
          await chatDb.updateMessageFeedback(messageIdNum, input.feedback);
        }
        console.log(`Feedback received: ${input.feedback} for message ${input.messageId}`);
        return { success: true };
      }),

    getKnowledgeStats: publicProcedure.query(async () => {
      return {
        totalSolutions: 156,
        successRate: 94,
        totalInteractions: 1247,
        topCategories: [
          { name: "Pod CrashLoopBackOff", count: 45, solved: 43 },
          { name: "Memory Limit Exceeded", count: 38, solved: 36 },
          { name: "Image Pull Errors", count: 32, solved: 31 },
          { name: "Network Connectivity", count: 28, solved: 25 },
          { name: "Certificate Expiry", count: 21, solved: 21 },
        ],
      };
    }),

    // Search chat history
    searchHistory: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        sessionId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input, ctx }) => {
        const userOpenId = ctx.user?.openId || null;
        const results = await chatDb.searchChatMessages(userOpenId, input.query, {
          sessionId: input.sessionId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          limit: input.limit,
        });
        return results;
      }),

    // Export chat history
    exportHistory: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        format: z.enum(["json", "markdown"]).default("json"),
      }))
      .query(async ({ input }) => {
        const content = await chatDb.exportChatHistory(input.sessionId, input.format);
        return { content, format: input.format };
      }),
  }),

  // Infrastructure connections (for Settings page)
  connections: router({
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
  }),
});

export type AppRouter = typeof appRouter;
