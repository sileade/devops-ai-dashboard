import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";

/**
 * OpenClaw Integration Router
 * 
 * Provides integration with OpenClaw (Clawd Bot) for ChatOps functionality.
 * OpenClaw is a personal AI assistant that connects to WhatsApp, Telegram,
 * Discord, Slack, and other messaging platforms.
 * 
 * Features:
 * - Gateway connection management
 * - Channel configuration (WhatsApp, Telegram, Discord, etc.)
 * - Message sending/receiving
 * - DevOps command execution via chat
 * - Alert notifications to chat channels
 * - Incident approval workflows
 */

// Types
interface OpenClawConfig {
  gatewayUrl: string;
  gatewayToken: string;
  enabled: boolean;
  channels: OpenClawChannel[];
  webhookUrl?: string;
}

interface OpenClawChannel {
  id: string;
  type: "whatsapp" | "telegram" | "discord" | "slack" | "teams" | "matrix" | "signal";
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  lastConnected?: Date;
  status: "connected" | "disconnected" | "error";
}

interface ChatMessage {
  id: string;
  channelId: string;
  channelType: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  direction: "inbound" | "outbound";
  metadata?: Record<string, unknown>;
}

interface DevOpsCommand {
  id: string;
  command: string;
  description: string;
  category: "incidents" | "deployments" | "scaling" | "security" | "costs" | "general";
  requiresApproval: boolean;
  allowedChannels: string[];
}

interface AlertSubscription {
  id: string;
  channelId: string;
  alertTypes: string[];
  severity: ("critical" | "high" | "medium" | "low")[];
  enabled: boolean;
  quietHours?: { start: string; end: string };
}

// In-memory storage
let openClawConfig: OpenClawConfig = {
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789",
  gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || "",
  enabled: false,
  channels: [],
};

const chatMessages: Map<string, ChatMessage> = new Map();
const alertSubscriptions: Map<string, AlertSubscription> = new Map();
let messageIdCounter = 1;
let subscriptionIdCounter = 1;

// Default DevOps commands available via chat
const devOpsCommands: DevOpsCommand[] = [
  {
    id: "1",
    command: "/status",
    description: "Get current system status and health overview",
    category: "general",
    requiresApproval: false,
    allowedChannels: ["whatsapp", "telegram", "discord", "slack"],
  },
  {
    id: "2",
    command: "/incidents",
    description: "List active incidents with severity and status",
    category: "incidents",
    requiresApproval: false,
    allowedChannels: ["whatsapp", "telegram", "discord", "slack"],
  },
  {
    id: "3",
    command: "/approve <incident_id>",
    description: "Approve a pending incident resolution action",
    category: "incidents",
    requiresApproval: true,
    allowedChannels: ["whatsapp", "telegram", "slack"],
  },
  {
    id: "4",
    command: "/deploy <service> <version>",
    description: "Trigger deployment of a service to production",
    category: "deployments",
    requiresApproval: true,
    allowedChannels: ["slack", "discord"],
  },
  {
    id: "5",
    command: "/rollback <service>",
    description: "Rollback service to previous version",
    category: "deployments",
    requiresApproval: true,
    allowedChannels: ["slack", "discord"],
  },
  {
    id: "6",
    command: "/scale <service> <replicas>",
    description: "Scale service to specified number of replicas",
    category: "scaling",
    requiresApproval: true,
    allowedChannels: ["slack", "discord"],
  },
  {
    id: "7",
    command: "/security-scan",
    description: "Trigger security vulnerability scan",
    category: "security",
    requiresApproval: false,
    allowedChannels: ["slack", "discord"],
  },
  {
    id: "8",
    command: "/costs",
    description: "Get current cloud cost summary and recommendations",
    category: "costs",
    requiresApproval: false,
    allowedChannels: ["whatsapp", "telegram", "discord", "slack"],
  },
  {
    id: "9",
    command: "/healing approve <action_id>",
    description: "Approve a pending self-healing action",
    category: "incidents",
    requiresApproval: true,
    allowedChannels: ["whatsapp", "telegram", "slack"],
  },
  {
    id: "10",
    command: "/help",
    description: "Show available commands",
    category: "general",
    requiresApproval: false,
    allowedChannels: ["whatsapp", "telegram", "discord", "slack", "teams", "matrix", "signal"],
  },
];

// Initialize sample channels
const initializeSampleChannels = () => {
  openClawConfig.channels = [
    {
      id: "ch_1",
      type: "telegram",
      name: "DevOps Alerts Bot",
      enabled: true,
      config: { botToken: "***configured***", chatId: "-1001234567890" },
      status: "disconnected",
    },
    {
      id: "ch_2",
      type: "slack",
      name: "#devops-alerts",
      enabled: true,
      config: { webhookUrl: "***configured***", channel: "#devops-alerts" },
      status: "disconnected",
    },
    {
      id: "ch_3",
      type: "discord",
      name: "DevOps Server",
      enabled: false,
      config: { botToken: "***configured***", guildId: "123456789", channelId: "987654321" },
      status: "disconnected",
    },
    {
      id: "ch_4",
      type: "whatsapp",
      name: "On-Call Group",
      enabled: false,
      config: { groupId: "***configured***" },
      status: "disconnected",
    },
  ];

  // Sample alert subscriptions
  alertSubscriptions.set("sub_1", {
    id: "sub_1",
    channelId: "ch_1",
    alertTypes: ["incident", "security", "cost"],
    severity: ["critical", "high"],
    enabled: true,
  });
  alertSubscriptions.set("sub_2", {
    id: "sub_2",
    channelId: "ch_2",
    alertTypes: ["incident", "deployment", "scaling"],
    severity: ["critical", "high", "medium"],
    enabled: true,
    quietHours: { start: "22:00", end: "08:00" },
  });
};

initializeSampleChannels();

// Helper function to call OpenClaw Gateway API
async function callGatewayAPI(endpoint: string, method: string = "GET", body?: unknown): Promise<unknown> {
  if (!openClawConfig.enabled || !openClawConfig.gatewayToken) {
    throw new Error("OpenClaw integration is not configured");
  }

  const response = await fetch(`${openClawConfig.gatewayUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openClawConfig.gatewayToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Gateway API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Helper to process incoming chat commands
function processCommand(message: string, channelType: string): { response: string; action?: string } {
  const parts = message.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();

  const command = devOpsCommands.find(c => c.command.split(" ")[0] === cmd);
  
  if (!command) {
    return {
      response: `Unknown command: ${cmd}. Type /help for available commands.`,
    };
  }

  if (!command.allowedChannels.includes(channelType)) {
    return {
      response: `Command ${cmd} is not available on ${channelType}. Please use one of: ${command.allowedChannels.join(", ")}`,
    };
  }

  // Generate response based on command
  switch (cmd) {
    case "/status":
      return {
        response: `📊 **System Status**\n\n✅ All systems operational\n📦 Containers: 24 running\n🔄 Deployments: 3 in progress\n⚠️ Active incidents: 2\n💰 Today's cost: $127.45`,
      };
    case "/incidents":
      return {
        response: `🚨 **Active Incidents**\n\n1. [CRITICAL] INC-001: Database connection timeout\n   Status: Investigating | Assigned: AI Commander\n\n2. [HIGH] INC-002: Memory usage spike on api-server\n   Status: Pending approval | Action: Scale up`,
      };
    case "/costs":
      return {
        response: `💰 **Cost Summary**\n\n📅 MTD: $3,847.23\n📈 Forecast: $5,120.00\n💡 Potential savings: $487.50\n\n**Top recommendations:**\n1. Rightsize db-server-01: Save $120/mo\n2. Use spot instances for workers: Save $200/mo`,
      };
    case "/help":
      return {
        response: `📖 **Available Commands**\n\n${devOpsCommands
          .filter(c => c.allowedChannels.includes(channelType))
          .map(c => `• \`${c.command}\` - ${c.description}`)
          .join("\n")}`,
      };
    default:
      if (command.requiresApproval) {
        return {
          response: `⏳ Command requires approval. Please confirm by replying with: \`/confirm ${cmd} ${parts.slice(1).join(" ")}\``,
          action: "pending_approval",
        };
      }
      return {
        response: `✅ Command received: ${message}`,
        action: "executed",
      };
  }
}

// Router
export const openclawRouter = router({
  // Get OpenClaw configuration
  getConfig: publicProcedure.query(() => {
    return {
      ...openClawConfig,
      gatewayToken: openClawConfig.gatewayToken ? "***configured***" : "",
    };
  }),

  // Update OpenClaw configuration
  updateConfig: publicProcedure
    .input(z.object({
      gatewayUrl: z.string().url().optional(),
      gatewayToken: z.string().optional(),
      enabled: z.boolean().optional(),
      webhookUrl: z.string().url().optional(),
    }))
    .mutation(({ input }) => {
      if (input.gatewayUrl) openClawConfig.gatewayUrl = input.gatewayUrl;
      if (input.gatewayToken) openClawConfig.gatewayToken = input.gatewayToken;
      if (input.enabled !== undefined) openClawConfig.enabled = input.enabled;
      if (input.webhookUrl) openClawConfig.webhookUrl = input.webhookUrl;
      
      return { success: true };
    }),

  // Test gateway connection
  testConnection: publicProcedure.mutation(async () => {
    try {
      // In production, this would call the actual OpenClaw Gateway
      // await callGatewayAPI("/health");
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        message: "Successfully connected to OpenClaw Gateway",
        version: "2025.1.30",
        uptime: "3d 14h 22m",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }),

  // List configured channels
  listChannels: publicProcedure.query(() => {
    return openClawConfig.channels;
  }),

  // Add a new channel
  addChannel: publicProcedure
    .input(z.object({
      type: z.enum(["whatsapp", "telegram", "discord", "slack", "teams", "matrix", "signal"]),
      name: z.string().min(1),
      config: z.record(z.string(), z.unknown()),
    }))
    .mutation(({ input }) => {
      const channel: OpenClawChannel = {
        id: `ch_${Date.now()}`,
        type: input.type,
        name: input.name,
        enabled: false,
        config: input.config,
        status: "disconnected",
      };
      
      openClawConfig.channels.push(channel);
      return channel;
    }),

  // Update channel configuration
  updateChannel: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      enabled: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(({ input }) => {
      const channel = openClawConfig.channels.find(c => c.id === input.id);
      if (!channel) throw new Error("Channel not found");
      
      if (input.name) channel.name = input.name;
      if (input.enabled !== undefined) channel.enabled = input.enabled;
      if (input.config) channel.config = { ...channel.config, ...input.config };
      
      return channel;
    }),

  // Connect/disconnect channel
  toggleChannel: publicProcedure
    .input(z.object({
      id: z.string(),
      connect: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const channel = openClawConfig.channels.find(c => c.id === input.id);
      if (!channel) throw new Error("Channel not found");
      
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      channel.status = input.connect ? "connected" : "disconnected";
      channel.enabled = input.connect;
      if (input.connect) {
        channel.lastConnected = new Date();
      }
      
      return channel;
    }),

  // Delete channel
  deleteChannel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const index = openClawConfig.channels.findIndex(c => c.id === input.id);
      if (index === -1) throw new Error("Channel not found");
      
      openClawConfig.channels.splice(index, 1);
      return { success: true };
    }),

  // Send message to channel
  sendMessage: publicProcedure
    .input(z.object({
      channelId: z.string(),
      content: z.string().min(1),
      to: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const channel = openClawConfig.channels.find(c => c.id === input.channelId);
      if (!channel) throw new Error("Channel not found");
      if (!channel.enabled || channel.status !== "connected") {
        throw new Error("Channel is not connected");
      }
      
      const message: ChatMessage = {
        id: `msg_${messageIdCounter++}`,
        channelId: input.channelId,
        channelType: channel.type,
        from: "DevOps Dashboard",
        to: input.to || channel.name,
        content: input.content,
        timestamp: new Date(),
        direction: "outbound",
      };
      
      chatMessages.set(message.id, message);
      
      // In production, this would call OpenClaw Gateway to send the message
      // await callGatewayAPI("/message/send", "POST", { channel: channel.type, to: input.to, content: input.content });
      
      return message;
    }),

  // Get message history
  getMessages: publicProcedure
    .input(z.object({
      channelId: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
    }).optional())
    .query(({ input }) => {
      let messages = Array.from(chatMessages.values());
      
      if (input?.channelId) {
        messages = messages.filter(m => m.channelId === input.channelId);
      }
      
      return messages
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, input?.limit || 50);
    }),

  // Process incoming webhook (from OpenClaw)
  handleWebhook: publicProcedure
    .input(z.object({
      channelType: z.string(),
      from: z.string(),
      content: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(({ input }) => {
      const message: ChatMessage = {
        id: `msg_${messageIdCounter++}`,
        channelId: "webhook",
        channelType: input.channelType,
        from: input.from,
        to: "DevOps Dashboard",
        content: input.content,
        timestamp: new Date(),
        direction: "inbound",
        metadata: input.metadata,
      };
      
      chatMessages.set(message.id, message);
      
      // Process command if it starts with /
      if (input.content.startsWith("/")) {
        const result = processCommand(input.content, input.channelType);
        return {
          received: message,
          response: result.response,
          action: result.action,
        };
      }
      
      return { received: message };
    }),

  // Get available DevOps commands
  getCommands: publicProcedure.query(() => {
    return devOpsCommands;
  }),

  // List alert subscriptions
  listSubscriptions: publicProcedure.query(() => {
    return Array.from(alertSubscriptions.values());
  }),

  // Create alert subscription
  createSubscription: publicProcedure
    .input(z.object({
      channelId: z.string(),
      alertTypes: z.array(z.string()),
      severity: z.array(z.enum(["critical", "high", "medium", "low"])),
      quietHours: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
    }))
    .mutation(({ input }) => {
      const channel = openClawConfig.channels.find(c => c.id === input.channelId);
      if (!channel) throw new Error("Channel not found");
      
      const subscription: AlertSubscription = {
        id: `sub_${subscriptionIdCounter++}`,
        channelId: input.channelId,
        alertTypes: input.alertTypes,
        severity: input.severity,
        enabled: true,
        quietHours: input.quietHours,
      };
      
      alertSubscriptions.set(subscription.id, subscription);
      return subscription;
    }),

  // Update alert subscription
  updateSubscription: publicProcedure
    .input(z.object({
      id: z.string(),
      alertTypes: z.array(z.string()).optional(),
      severity: z.array(z.enum(["critical", "high", "medium", "low"])).optional(),
      enabled: z.boolean().optional(),
      quietHours: z.object({
        start: z.string(),
        end: z.string(),
      }).optional().nullable(),
    }))
    .mutation(({ input }) => {
      const subscription = alertSubscriptions.get(input.id);
      if (!subscription) throw new Error("Subscription not found");
      
      if (input.alertTypes) subscription.alertTypes = input.alertTypes;
      if (input.severity) subscription.severity = input.severity;
      if (input.enabled !== undefined) subscription.enabled = input.enabled;
      if (input.quietHours !== undefined) {
        subscription.quietHours = input.quietHours || undefined;
      }
      
      return subscription;
    }),

  // Delete alert subscription
  deleteSubscription: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      if (!alertSubscriptions.has(input.id)) throw new Error("Subscription not found");
      alertSubscriptions.delete(input.id);
      return { success: true };
    }),

  // Send alert to subscribed channels
  sendAlert: publicProcedure
    .input(z.object({
      type: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      title: z.string(),
      message: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const matchingSubscriptions = Array.from(alertSubscriptions.values())
        .filter(sub => 
          sub.enabled &&
          sub.alertTypes.includes(input.type) &&
          sub.severity.includes(input.severity)
        );
      
      const results: { channelId: string; success: boolean; error?: string }[] = [];
      
      for (const sub of matchingSubscriptions) {
        const channel = openClawConfig.channels.find(c => c.id === sub.channelId);
        if (!channel || !channel.enabled) {
          results.push({ channelId: sub.channelId, success: false, error: "Channel not available" });
          continue;
        }
        
        // Check quiet hours
        if (sub.quietHours) {
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
          if (currentTime >= sub.quietHours.start || currentTime <= sub.quietHours.end) {
            results.push({ channelId: sub.channelId, success: false, error: "Quiet hours active" });
            continue;
          }
        }
        
        // Format alert message
        const severityEmoji = {
          critical: "🔴",
          high: "🟠",
          medium: "🟡",
          low: "🟢",
        }[input.severity];
        
        const alertMessage = `${severityEmoji} **${input.severity.toUpperCase()}**: ${input.title}\n\n${input.message}`;
        
        // Store outbound message
        const message: ChatMessage = {
          id: `msg_${messageIdCounter++}`,
          channelId: channel.id,
          channelType: channel.type,
          from: "DevOps Dashboard",
          to: channel.name,
          content: alertMessage,
          timestamp: new Date(),
          direction: "outbound",
          metadata: input.metadata,
        };
        
        chatMessages.set(message.id, message);
        results.push({ channelId: sub.channelId, success: true });
      }
      
      return {
        alertsSent: results.filter(r => r.success).length,
        results,
      };
    }),

  // Get integration stats
  getStats: publicProcedure.query(() => {
    const connectedChannels = openClawConfig.channels.filter(c => c.status === "connected").length;
    const totalChannels = openClawConfig.channels.length;
    const activeSubscriptions = Array.from(alertSubscriptions.values()).filter(s => s.enabled).length;
    const totalMessages = chatMessages.size;
    const inboundMessages = Array.from(chatMessages.values()).filter(m => m.direction === "inbound").length;
    const outboundMessages = totalMessages - inboundMessages;
    
    return {
      enabled: openClawConfig.enabled,
      gatewayConnected: openClawConfig.enabled && !!openClawConfig.gatewayToken,
      connectedChannels,
      totalChannels,
      activeSubscriptions,
      totalMessages,
      inboundMessages,
      outboundMessages,
      availableCommands: devOpsCommands.length,
    };
  }),
});
