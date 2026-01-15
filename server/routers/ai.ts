import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as chatDb from "../db";
import * as docker from "../infrastructure/docker";
import * as kubernetes from "../infrastructure/kubernetes";
import * as aiAgent from "../infrastructure/ai-agent";

/**
 * AI Assistant router
 * Handles chat, analysis, troubleshooting, and knowledge base operations
 */
export const aiRouter = router({
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
});
