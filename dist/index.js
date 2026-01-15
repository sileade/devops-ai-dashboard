// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, and, desc, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  environment: mysqlEnum("environment", ["development", "staging", "production"]).default("development").notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var infrastructureConnections = mysqlTable("infrastructure_connections", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["docker", "podman", "kubernetes", "ansible", "terraform"]).notNull(),
  host: varchar("host", { length: 500 }),
  port: int("port"),
  connectionConfig: json("connectionConfig"),
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("disconnected").notNull(),
  lastChecked: timestamp("lastChecked"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var deploymentHistory = mysqlTable("deployment_history", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["docker", "kubernetes", "ansible", "terraform"]).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceName: varchar("resourceName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "running", "success", "failed", "cancelled"]).default("pending").notNull(),
  details: json("details"),
  logs: text("logs"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt")
});
var knowledgeEntries = mysqlTable("knowledge_entries", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  category: varchar("category", { length: 100 }).notNull(),
  problem: text("problem").notNull(),
  solution: text("solution").notNull(),
  confidence: int("confidence").default(50).notNull(),
  successCount: int("successCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  humanVerified: boolean("humanVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  type: mysqlEnum("type", ["info", "warning", "error", "success"]).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  defaultApplicationId: int("defaultApplicationId"),
  theme: mysqlEnum("theme", ["dark", "light", "system"]).default("dark").notNull(),
  sidebarCollapsed: boolean("sidebarCollapsed").default(false).notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  emailAlerts: boolean("emailAlerts").default(false).notNull(),
  refreshInterval: int("refreshInterval").default(30).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var savedCommands = mysqlTable("saved_commands", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["docker", "kubectl", "ansible", "terraform", "shell"]).notNull(),
  command: text("command").notNull(),
  description: text("description"),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  suggestions: json("suggestions").$type(),
  commands: json("commands").$type(),
  feedback: mysqlEnum("feedback", ["positive", "negative"]),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  userId: int("userId"),
  userOpenId: varchar("userOpenId", { length: 64 }),
  title: varchar("title", { length: 255 }).default("New Chat"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var metricsHistory = mysqlTable("metrics_history", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  source: mysqlEnum("source", ["docker", "kubernetes", "system"]).default("system").notNull(),
  resourceType: mysqlEnum("resourceType", ["container", "pod", "node", "cluster"]).default("cluster").notNull(),
  resourceId: varchar("resourceId", { length: 255 }),
  cpuPercent: int("cpuPercent").notNull(),
  memoryPercent: int("memoryPercent").notNull(),
  memoryUsedMb: int("memoryUsedMb"),
  memoryTotalMb: int("memoryTotalMb"),
  networkRxBytes: int("networkRxBytes"),
  networkTxBytes: int("networkTxBytes"),
  diskUsedGb: int("diskUsedGb"),
  diskTotalGb: int("diskTotalGb"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var alertThresholds = mysqlTable("alert_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "disk", "network"]).notNull(),
  resourceType: mysqlEnum("resourceType", ["container", "pod", "node", "cluster"]).default("cluster").notNull(),
  resourcePattern: varchar("resourcePattern", { length: 255 }),
  warningThreshold: int("warningThreshold").notNull(),
  criticalThreshold: int("criticalThreshold").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  cooldownMinutes: int("cooldownMinutes").default(5).notNull(),
  lastTriggered: timestamp("lastTriggered"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  thresholdId: int("thresholdId"),
  applicationId: int("applicationId"),
  severity: mysqlEnum("severity", ["warning", "critical"]).notNull(),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "disk", "network"]).notNull(),
  resourceType: mysqlEnum("resourceType", ["container", "pod", "node", "cluster"]).default("cluster").notNull(),
  resourceId: varchar("resourceId", { length: 255 }),
  currentValue: int("currentValue").notNull(),
  thresholdValue: int("thresholdValue").notNull(),
  message: text("message").notNull(),
  isAcknowledged: boolean("isAcknowledged").default(false).notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var autoscalingRules = mysqlTable("autoscaling_rules", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  resourceType: mysqlEnum("resourceType", ["deployment", "container", "pod", "service"]).notNull(),
  resourcePattern: varchar("resourcePattern", { length: 255 }).notNull(),
  namespace: varchar("namespace", { length: 255 }),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "requests", "custom"]).notNull(),
  scaleUpThreshold: int("scaleUpThreshold").notNull(),
  scaleDownThreshold: int("scaleDownThreshold").notNull(),
  minReplicas: int("minReplicas").default(1).notNull(),
  maxReplicas: int("maxReplicas").default(10).notNull(),
  cooldownSeconds: int("cooldownSeconds").default(300).notNull(),
  scaleUpStep: int("scaleUpStep").default(1).notNull(),
  scaleDownStep: int("scaleDownStep").default(1).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  aiAssisted: boolean("aiAssisted").default(true).notNull(),
  lastScaledAt: timestamp("lastScaledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var autoscalingHistory = mysqlTable("autoscaling_history", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  applicationId: int("applicationId"),
  action: mysqlEnum("action", ["scale_up", "scale_down", "no_action", "pending_approval", "rejected", "failed"]).notNull(),
  previousReplicas: int("previousReplicas").notNull(),
  newReplicas: int("newReplicas").notNull(),
  triggerMetric: varchar("triggerMetric", { length: 50 }).notNull(),
  triggerValue: int("triggerValue").notNull(),
  thresholdValue: int("thresholdValue").notNull(),
  aiAnalysis: text("aiAnalysis"),
  aiConfidence: int("aiConfidence"),
  aiRecommendation: text("aiRecommendation"),
  executedBy: mysqlEnum("executedBy", ["ai", "manual", "scheduled"]).default("ai").notNull(),
  approvedBy: int("approvedBy"),
  status: mysqlEnum("status", ["pending", "executing", "completed", "failed", "cancelled"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  executionTimeMs: int("executionTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt")
});
var aiScalingPredictions = mysqlTable("ai_scaling_predictions", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  applicationId: int("applicationId"),
  predictedMetricValue: int("predictedMetricValue").notNull(),
  predictedTime: timestamp("predictedTime").notNull(),
  recommendedReplicas: int("recommendedReplicas").notNull(),
  confidence: int("confidence").notNull(),
  reasoning: text("reasoning").notNull(),
  dataPointsAnalyzed: int("dataPointsAnalyzed").notNull(),
  patternDetected: varchar("patternDetected", { length: 100 }),
  isActedUpon: boolean("isActedUpon").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getOrCreateChatSession(userOpenId, sessionId) {
  const db = await getDb();
  if (!db) {
    const tempSessionId = sessionId || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return { sessionId: tempSessionId, conversationId: 0, isNew: true };
  }
  try {
    if (sessionId) {
      const existing = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
      if (existing.length > 0) {
        return { sessionId: existing[0].sessionId, conversationId: existing[0].id, isNew: false };
      }
    }
    if (userOpenId) {
      const activeSession = await db.select().from(chatSessions).where(and(
        eq(chatSessions.userOpenId, userOpenId),
        eq(chatSessions.isActive, true)
      )).orderBy(desc(chatSessions.updatedAt)).limit(1);
      if (activeSession.length > 0) {
        return { sessionId: activeSession[0].sessionId, conversationId: activeSession[0].id, isNew: false };
      }
    }
    const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId,
      title: "New Chat",
      isActive: true
    });
    return { sessionId: newSessionId, conversationId: result[0].insertId, isNew: true };
  } catch (error) {
    console.error("[Database] Failed to get/create chat session:", error);
    const fallbackId = `fallback-${Date.now()}`;
    return { sessionId: fallbackId, conversationId: 0, isNew: true };
  }
}
async function saveChatMessage(message) {
  const db = await getDb();
  if (!db || message.conversationId === 0) {
    console.warn("[Database] Cannot save chat message: database not available or invalid conversationId");
    return null;
  }
  try {
    const result = await db.insert(chatMessages).values({
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      suggestions: message.suggestions,
      commands: message.commands
    });
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save chat message:", error);
    return null;
  }
}
async function getChatHistory(conversationId, limit = 100) {
  const db = await getDb();
  if (!db || conversationId === 0) {
    console.warn("[Database] Cannot get chat history: database not available or invalid conversationId");
    return [];
  }
  try {
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt).limit(limit);
    return messages;
  } catch (error) {
    console.error("[Database] Failed to get chat history:", error);
    return [];
  }
}
async function getChatHistoryBySessionId(sessionId, limit = 100) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
    if (session.length === 0) {
      return [];
    }
    return getChatHistory(session[0].id, limit);
  } catch (error) {
    console.error("[Database] Failed to get chat history by sessionId:", error);
    return [];
  }
}
async function getUserChatSessions(userOpenId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get chat sessions: database not available");
    return [];
  }
  try {
    const sessions = await db.select().from(chatSessions).where(eq(chatSessions.userOpenId, userOpenId)).orderBy(desc(chatSessions.updatedAt));
    return sessions;
  } catch (error) {
    console.error("[Database] Failed to get chat sessions:", error);
    return [];
  }
}
async function updateMessageFeedback(messageId, feedback) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update feedback: database not available");
    return false;
  }
  try {
    await db.update(chatMessages).set({ feedback }).where(eq(chatMessages.id, messageId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update feedback:", error);
    return false;
  }
}
async function clearChatHistory(sessionId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot clear chat history: database not available");
    return false;
  }
  try {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
    if (session.length > 0) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, session[0].id));
    }
    return true;
  } catch (error) {
    console.error("[Database] Failed to clear chat history:", error);
    return false;
  }
}
async function createNewChatSession(userOpenId) {
  const db = await getDb();
  const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  if (!db) {
    return { sessionId: newSessionId, conversationId: 0 };
  }
  try {
    if (userOpenId) {
      await db.update(chatSessions).set({ isActive: false }).where(eq(chatSessions.userOpenId, userOpenId));
    }
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId,
      title: "New Chat",
      isActive: true
    });
    return { sessionId: newSessionId, conversationId: result[0].insertId };
  } catch (error) {
    console.error("[Database] Failed to create chat session:", error);
    return { sessionId: newSessionId, conversationId: 0 };
  }
}
async function updateSessionTitle(sessionId, title) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) + "..." : title;
    await db.update(chatSessions).set({ title: truncatedTitle }).where(eq(chatSessions.sessionId, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update session title:", error);
    return false;
  }
}
async function searchChatMessages(userOpenId, query, options) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search messages: database not available");
    return [];
  }
  try {
    const limit = options?.limit || 50;
    const conditions = [like(chatMessages.content, `%${query}%`)];
    if (options?.sessionId) {
      const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, options.sessionId)).limit(1);
      if (session.length > 0) {
        conditions.push(eq(chatMessages.conversationId, session[0].id));
      }
    }
    if (options?.startDate) {
      conditions.push(gte(chatMessages.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(chatMessages.createdAt, options.endDate));
    }
    const results = await db.select({
      id: chatMessages.id,
      sessionId: chatSessions.sessionId,
      sessionTitle: chatSessions.title,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt
    }).from(chatMessages).innerJoin(chatSessions, eq(chatMessages.conversationId, chatSessions.id)).where(and(
      userOpenId ? eq(chatSessions.userOpenId, userOpenId) : void 0,
      ...conditions
    )).orderBy(desc(chatMessages.createdAt)).limit(limit);
    return results;
  } catch (error) {
    console.error("[Database] Failed to search messages:", error);
    return [];
  }
}
async function exportChatHistory(sessionId, format = "json") {
  const db = await getDb();
  if (!db) {
    return format === "json" ? "[]" : "# No data available";
  }
  try {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
    if (session.length === 0) {
      return format === "json" ? "[]" : "# Session not found";
    }
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, session[0].id)).orderBy(chatMessages.createdAt);
    if (format === "json") {
      return JSON.stringify({
        session: {
          id: session[0].sessionId,
          title: session[0].title,
          createdAt: session[0].createdAt
        },
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          feedback: m.feedback
        }))
      }, null, 2);
    } else {
      let md = `# ${session[0].title || "Chat Export"}

`;
      md += `**Session ID:** ${session[0].sessionId}
`;
      md += `**Created:** ${session[0].createdAt?.toISOString()}

`;
      md += `---

`;
      for (const msg of messages) {
        const role = msg.role === "user" ? "\u{1F464} User" : "\u{1F916} Assistant";
        const timestamp2 = msg.createdAt?.toLocaleString() || "";
        md += `### ${role}
`;
        md += `*${timestamp2}*

`;
        md += `${msg.content}

`;
        if (msg.feedback) {
          md += `*Feedback: ${msg.feedback}*

`;
        }
        md += `---

`;
      }
      return md;
    }
  } catch (error) {
    console.error("[Database] Failed to export chat history:", error);
    return format === "json" ? "[]" : "# Export failed";
  }
}
async function saveMetricsSnapshot(metrics) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save metrics: database not available");
    return null;
  }
  try {
    const result = await db.insert(metricsHistory).values(metrics);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save metrics:", error);
    return null;
  }
}
async function getMetricsHistory(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options.source) {
      conditions.push(eq(metricsHistory.source, options.source));
    }
    if (options.resourceType) {
      conditions.push(eq(metricsHistory.resourceType, options.resourceType));
    }
    if (options.resourceId) {
      conditions.push(eq(metricsHistory.resourceId, options.resourceId));
    }
    if (options.startTime) {
      conditions.push(gte(metricsHistory.timestamp, options.startTime));
    }
    if (options.endTime) {
      conditions.push(lte(metricsHistory.timestamp, options.endTime));
    }
    const query = db.select().from(metricsHistory);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(metricsHistory.timestamp)).limit(options.limit || 1e3);
    }
    return await query.orderBy(desc(metricsHistory.timestamp)).limit(options.limit || 1e3);
  } catch (error) {
    console.error("[Database] Failed to get metrics history:", error);
    return [];
  }
}
async function getAggregatedMetrics(hours = 24) {
  const db = await getDb();
  if (!db) {
    return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
  }
  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1e3);
    const results = await db.select().from(metricsHistory).where(gte(metricsHistory.timestamp, startTime)).orderBy(desc(metricsHistory.timestamp));
    if (results.length === 0) {
      return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
    }
    const totalCpu = results.reduce((sum, r) => sum + r.cpuPercent, 0);
    const totalMemory = results.reduce((sum, r) => sum + r.memoryPercent, 0);
    const maxCpu = Math.max(...results.map((r) => r.cpuPercent));
    const maxMemory = Math.max(...results.map((r) => r.memoryPercent));
    return {
      avgCpu: Math.round(totalCpu / results.length),
      avgMemory: Math.round(totalMemory / results.length),
      maxCpu,
      maxMemory,
      dataPoints: results.length
    };
  } catch (error) {
    console.error("[Database] Failed to get aggregated metrics:", error);
    return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
  }
}
async function cleanupOldMetrics(retentionDays = 30) {
  const db = await getDb();
  if (!db) {
    return 0;
  }
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1e3);
    const result = await db.delete(metricsHistory).where(lte(metricsHistory.timestamp, cutoffDate));
    return result[0].affectedRows || 0;
  } catch (error) {
    console.error("[Database] Failed to cleanup old metrics:", error);
    return 0;
  }
}
async function getAlertThresholds(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.metricType) {
      conditions.push(eq(alertThresholds.metricType, options.metricType));
    }
    if (options?.resourceType) {
      conditions.push(eq(alertThresholds.resourceType, options.resourceType));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(alertThresholds.isEnabled, true));
    }
    if (conditions.length > 0) {
      return await db.select().from(alertThresholds).where(and(...conditions)).orderBy(alertThresholds.name);
    }
    return await db.select().from(alertThresholds).orderBy(alertThresholds.name);
  } catch (error) {
    console.error("[Database] Failed to get alert thresholds:", error);
    return [];
  }
}
async function upsertAlertThreshold(threshold) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    if (threshold.id) {
      await db.update(alertThresholds).set(threshold).where(eq(alertThresholds.id, threshold.id));
      return threshold.id;
    } else {
      const result = await db.insert(alertThresholds).values(threshold);
      return result[0].insertId;
    }
  } catch (error) {
    console.error("[Database] Failed to upsert alert threshold:", error);
    return null;
  }
}
async function toggleAlertThreshold(id, isEnabled) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(alertThresholds).set({ isEnabled }).where(eq(alertThresholds.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to toggle alert threshold:", error);
    return false;
  }
}
async function deleteAlertThreshold(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.delete(alertThresholds).where(eq(alertThresholds.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete alert threshold:", error);
    return false;
  }
}
async function recordAlert(alert) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(alertHistory).values(alert);
    if (alert.thresholdId) {
      await db.update(alertThresholds).set({ lastTriggered: /* @__PURE__ */ new Date() }).where(eq(alertThresholds.id, alert.thresholdId));
    }
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record alert:", error);
    return null;
  }
}
async function getAlertHistory(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.severity) {
      conditions.push(eq(alertHistory.severity, options.severity));
    }
    if (options?.metricType) {
      conditions.push(eq(alertHistory.metricType, options.metricType));
    }
    if (options?.acknowledgedOnly) {
      conditions.push(eq(alertHistory.isAcknowledged, true));
    }
    if (options?.unacknowledgedOnly) {
      conditions.push(eq(alertHistory.isAcknowledged, false));
    }
    if (options?.startTime) {
      conditions.push(gte(alertHistory.createdAt, options.startTime));
    }
    if (options?.endTime) {
      conditions.push(lte(alertHistory.createdAt, options.endTime));
    }
    if (conditions.length > 0) {
      return await db.select().from(alertHistory).where(and(...conditions)).orderBy(desc(alertHistory.createdAt)).limit(options?.limit || 100);
    }
    return await db.select().from(alertHistory).orderBy(desc(alertHistory.createdAt)).limit(options?.limit || 100);
  } catch (error) {
    console.error("[Database] Failed to get alert history:", error);
    return [];
  }
}
async function acknowledgeAlert(alertId, userId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(alertHistory).set({
      isAcknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: /* @__PURE__ */ new Date()
    }).where(eq(alertHistory.id, alertId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to acknowledge alert:", error);
    return false;
  }
}
async function getUnacknowledgedAlertCount() {
  const db = await getDb();
  if (!db) {
    return 0;
  }
  try {
    const results = await db.select().from(alertHistory).where(eq(alertHistory.isAcknowledged, false));
    return results.length;
  } catch (error) {
    console.error("[Database] Failed to get unacknowledged alert count:", error);
    return 0;
  }
}
async function isThresholdInCooldown(thresholdId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const threshold = await db.select().from(alertThresholds).where(eq(alertThresholds.id, thresholdId)).limit(1);
    if (threshold.length === 0 || !threshold[0].lastTriggered) {
      return false;
    }
    const cooldownMs = (threshold[0].cooldownMinutes || 5) * 60 * 1e3;
    const lastTriggered = new Date(threshold[0].lastTriggered).getTime();
    return Date.now() - lastTriggered < cooldownMs;
  } catch (error) {
    console.error("[Database] Failed to check threshold cooldown:", error);
    return false;
  }
}
async function getAutoscalingRules(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.applicationId) {
      conditions.push(eq(autoscalingRules.applicationId, options.applicationId));
    }
    if (options?.resourceType) {
      conditions.push(eq(autoscalingRules.resourceType, options.resourceType));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(autoscalingRules.isEnabled, true));
    }
    if (conditions.length > 0) {
      return await db.select().from(autoscalingRules).where(and(...conditions)).orderBy(desc(autoscalingRules.createdAt));
    }
    return await db.select().from(autoscalingRules).orderBy(desc(autoscalingRules.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get autoscaling rules:", error);
    return [];
  }
}
async function getAutoscalingRuleById(id) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const results = await db.select().from(autoscalingRules).where(eq(autoscalingRules.id, id)).limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get autoscaling rule:", error);
    return null;
  }
}
async function createAutoscalingRule(rule) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(autoscalingRules).values(rule);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create autoscaling rule:", error);
    return null;
  }
}
async function updateAutoscalingRule(id, updates) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(autoscalingRules).set(updates).where(eq(autoscalingRules.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update autoscaling rule:", error);
    return false;
  }
}
async function deleteAutoscalingRule(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.delete(autoscalingRules).where(eq(autoscalingRules.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete autoscaling rule:", error);
    return false;
  }
}
async function recordAutoscalingAction(action) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(autoscalingHistory).values(action);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record autoscaling action:", error);
    return null;
  }
}
async function updateAutoscalingActionStatus(id, status, errorMessage) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const updates = { status };
    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.completedAt = /* @__PURE__ */ new Date();
    }
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }
    await db.update(autoscalingHistory).set(updates).where(eq(autoscalingHistory.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update autoscaling action:", error);
    return false;
  }
}
async function getAutoscalingHistory(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.ruleId) {
      conditions.push(eq(autoscalingHistory.ruleId, options.ruleId));
    }
    if (options?.applicationId) {
      conditions.push(eq(autoscalingHistory.applicationId, options.applicationId));
    }
    if (options?.status) {
      conditions.push(eq(autoscalingHistory.status, options.status));
    }
    if (conditions.length > 0) {
      return await db.select().from(autoscalingHistory).where(and(...conditions)).orderBy(desc(autoscalingHistory.createdAt)).limit(options?.limit || 100);
    }
    return await db.select().from(autoscalingHistory).orderBy(desc(autoscalingHistory.createdAt)).limit(options?.limit || 100);
  } catch (error) {
    console.error("[Database] Failed to get autoscaling history:", error);
    return [];
  }
}
async function getPendingApprovalActions() {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    return await db.select().from(autoscalingHistory).where(eq(autoscalingHistory.action, "pending_approval")).orderBy(desc(autoscalingHistory.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get pending approvals:", error);
    return [];
  }
}
async function saveAiScalingPrediction(prediction) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(aiScalingPredictions).values(prediction);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save AI prediction:", error);
    return null;
  }
}
async function getAiPredictions(ruleId, limit = 10) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    return await db.select().from(aiScalingPredictions).where(eq(aiScalingPredictions.ruleId, ruleId)).orderBy(desc(aiScalingPredictions.createdAt)).limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get AI predictions:", error);
    return [];
  }
}
async function isRuleInCooldown(ruleId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const rule = await db.select().from(autoscalingRules).where(eq(autoscalingRules.id, ruleId)).limit(1);
    if (rule.length === 0 || !rule[0].lastScaledAt) {
      return false;
    }
    const timeSinceLastScale = (Date.now() - rule[0].lastScaledAt.getTime()) / 1e3;
    return timeSinceLastScale < rule[0].cooldownSeconds;
  } catch (error) {
    console.error("[Database] Failed to check cooldown:", error);
    return false;
  }
}
async function updateRuleLastScaled(ruleId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(autoscalingRules).set({ lastScaledAt: /* @__PURE__ */ new Date() }).where(eq(autoscalingRules.id, ruleId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update last scaled:", error);
    return false;
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/auth.ts
var authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  })
});

// server/infrastructure/docker.ts
var defaultConfig = {
  socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
  host: process.env.DOCKER_HOST || void 0
};
async function dockerRequest(endpoint, method = "GET", body, config = defaultConfig) {
  const baseUrl = config.host || `http://localhost`;
  const url = `${baseUrl}${endpoint}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      throw new Error(`Docker API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Docker API not available: ${error}`);
    throw error;
  }
}
async function listContainers(all = true) {
  try {
    const containers = await dockerRequest(`/containers/json?all=${all}`);
    return containers.map((c) => ({
      id: c.Id?.substring(0, 12) || "",
      name: c.Names?.[0]?.replace(/^\//, "") || "",
      image: c.Image || "",
      status: mapContainerStatus(c.State),
      ports: formatPorts(c.Ports),
      cpu: "0%",
      memory: "0MB",
      created: c.Created ? new Date(c.Created * 1e3).toISOString() : "",
      command: c.Command,
      labels: c.Labels
    }));
  } catch {
    return getMockContainers();
  }
}
async function getContainerStats(containerId) {
  try {
    const stats = await dockerRequest(`/containers/${containerId}/stats?stream=false`);
    return calculateStats(stats);
  } catch {
    return {
      cpuPercent: Math.random() * 10,
      memoryUsage: Math.random() * 512 * 1024 * 1024,
      memoryLimit: 1024 * 1024 * 1024,
      memoryPercent: Math.random() * 50,
      networkRx: Math.random() * 1024 * 1024,
      networkTx: Math.random() * 1024 * 1024,
      blockRead: Math.random() * 1024 * 1024,
      blockWrite: Math.random() * 1024 * 1024
    };
  }
}
async function getContainerLogs(containerId, tail = 100, since) {
  try {
    const params = new URLSearchParams({
      stdout: "true",
      stderr: "true",
      tail: tail.toString()
    });
    if (since) params.append("since", since.toString());
    const response = await fetch(
      `${defaultConfig.host}/containers/${containerId}/logs?${params}`
    );
    const text2 = await response.text();
    return text2.split("\n").filter(Boolean);
  } catch {
    return getMockLogs();
  }
}
async function startContainer(containerId) {
  try {
    await dockerRequest(`/containers/${containerId}/start`, "POST");
    return true;
  } catch {
    console.log(`Mock: Starting container ${containerId}`);
    return true;
  }
}
async function stopContainer(containerId) {
  try {
    await dockerRequest(`/containers/${containerId}/stop`, "POST");
    return true;
  } catch {
    console.log(`Mock: Stopping container ${containerId}`);
    return true;
  }
}
async function restartContainer(containerId) {
  try {
    await dockerRequest(`/containers/${containerId}/restart`, "POST");
    return true;
  } catch {
    console.log(`Mock: Restarting container ${containerId}`);
    return true;
  }
}
async function listImages() {
  try {
    const images = await dockerRequest("/images/json");
    return images.map((img) => ({
      id: img.Id?.substring(7, 19) || "",
      repository: img.RepoTags?.[0]?.split(":")[0] || "<none>",
      tag: img.RepoTags?.[0]?.split(":")[1] || "<none>",
      size: formatBytes(img.Size),
      created: new Date(img.Created * 1e3).toISOString()
    }));
  } catch {
    return getMockImages();
  }
}
async function listNetworks() {
  try {
    const networks = await dockerRequest("/networks");
    return networks.map((net2) => ({
      id: net2.Id?.substring(0, 12) || "",
      name: net2.Name || "",
      driver: net2.Driver || "",
      scope: net2.Scope || "",
      containers: Object.keys(net2.Containers || {}).length
    }));
  } catch {
    return getMockNetworks();
  }
}
async function listVolumes() {
  try {
    const response = await dockerRequest("/volumes");
    return (response.Volumes || []).map((vol) => ({
      name: vol.Name || "",
      driver: vol.Driver || "",
      mountpoint: vol.Mountpoint || "",
      size: "N/A",
      created: vol.CreatedAt || ""
    }));
  } catch {
    return getMockVolumes();
  }
}
function mapContainerStatus(state) {
  const statusMap = {
    running: "running",
    exited: "exited",
    paused: "paused",
    restarting: "restarting",
    dead: "dead"
  };
  return statusMap[state?.toLowerCase()] || "stopped";
}
function formatPorts(ports) {
  if (!ports || ports.length === 0) return "-";
  return ports.filter((p) => p.PublicPort).map((p) => `${p.PublicPort}:${p.PrivatePort}`).join(", ") || "-";
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
function calculateStats(stats) {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent = cpuDelta / systemDelta * stats.cpu_stats.online_cpus * 100;
  return {
    cpuPercent: cpuPercent || 0,
    memoryUsage: stats.memory_stats.usage || 0,
    memoryLimit: stats.memory_stats.limit || 0,
    memoryPercent: stats.memory_stats.usage / stats.memory_stats.limit * 100 || 0,
    networkRx: stats.networks?.eth0?.rx_bytes || 0,
    networkTx: stats.networks?.eth0?.tx_bytes || 0,
    blockRead: 0,
    blockWrite: 0
  };
}
function getMockContainers() {
  return [
    { id: "abc123def456", name: "nginx-proxy", image: "nginx:latest", status: "running", ports: "80:80, 443:443", cpu: "0.5%", memory: "32MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "def456ghi789", name: "postgres-db", image: "postgres:15", status: "running", ports: "5432:5432", cpu: "2.1%", memory: "256MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "ghi789jkl012", name: "redis-cache", image: "redis:7-alpine", status: "running", ports: "6379:6379", cpu: "0.2%", memory: "24MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "jkl012mno345", name: "api-server", image: "myapp/api:v2.3.1", status: "running", ports: "3000:3000", cpu: "5.4%", memory: "512MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "mno345pqr678", name: "worker-queue", image: "myapp/worker:v2.3.1", status: "stopped", ports: "-", cpu: "0%", memory: "0MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "pqr678stu901", name: "monitoring", image: "prom/prometheus:latest", status: "running", ports: "9090:9090", cpu: "1.2%", memory: "128MB", created: (/* @__PURE__ */ new Date()).toISOString() }
  ];
}
function getMockImages() {
  return [
    { id: "sha256:abc123", repository: "nginx", tag: "latest", size: "142 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:def456", repository: "postgres", tag: "15", size: "379 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:ghi789", repository: "redis", tag: "7-alpine", size: "28 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:jkl012", repository: "myapp/api", tag: "v2.3.1", size: "256 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:mno345", repository: "prom/prometheus", tag: "latest", size: "195 MB", created: (/* @__PURE__ */ new Date()).toISOString() }
  ];
}
function getMockNetworks() {
  return [
    { id: "bridge123456", name: "bridge", driver: "bridge", scope: "local", containers: 3 },
    { id: "host789012", name: "host", driver: "host", scope: "local", containers: 0 },
    { id: "app345678", name: "app-network", driver: "bridge", scope: "local", containers: 4 }
  ];
}
function getMockVolumes() {
  return [
    { name: "postgres-data", driver: "local", mountpoint: "/var/lib/docker/volumes/postgres-data/_data", size: "2.5 GB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { name: "redis-data", driver: "local", mountpoint: "/var/lib/docker/volumes/redis-data/_data", size: "128 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { name: "app-uploads", driver: "local", mountpoint: "/var/lib/docker/volumes/app-uploads/_data", size: "1.2 GB", created: (/* @__PURE__ */ new Date()).toISOString() }
  ];
}
function getMockLogs() {
  const now = /* @__PURE__ */ new Date();
  return [
    `[${now.toISOString()}] INFO: Server started on port 3000`,
    `[${now.toISOString()}] INFO: Connected to database`,
    `[${now.toISOString()}] INFO: Health check passed`,
    `[${now.toISOString()}] DEBUG: Processing request /api/users`,
    `[${now.toISOString()}] INFO: Request completed in 45ms`
  ];
}

// server/infrastructure/kubernetes.ts
var defaultConfig2 = {
  apiServer: process.env.KUBERNETES_API_SERVER || "https://kubernetes.default.svc",
  token: process.env.KUBERNETES_TOKEN,
  namespace: "default"
};
async function k8sRequest(endpoint, method = "GET", body, config = defaultConfig2) {
  const url = `${config.apiServer}${endpoint}`;
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (config.token) {
      headers["Authorization"] = `Bearer ${config.token}`;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      throw new Error(`Kubernetes API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Kubernetes API not available: ${error}`);
    throw error;
  }
}
async function listNamespaces() {
  try {
    const response = await k8sRequest("/api/v1/namespaces");
    return response.items.map((ns) => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      age: calculateAge(ns.metadata.creationTimestamp)
    }));
  } catch {
    return getMockNamespaces();
  }
}
async function listPods(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/api/v1/pods" : `/api/v1/namespaces/${namespace}/pods`;
    const response = await k8sRequest(endpoint);
    return response.items.map((pod) => mapPod(pod));
  } catch {
    return getMockPods();
  }
}
async function getPod(name, namespace = "default") {
  try {
    const response = await k8sRequest(`/api/v1/namespaces/${namespace}/pods/${name}`);
    return mapPod(response);
  } catch {
    return null;
  }
}
async function getPodLogs(name, namespace = "default", container, tailLines = 100) {
  try {
    const params = new URLSearchParams({ tailLines: tailLines.toString() });
    if (container) params.append("container", container);
    const response = await fetch(
      `${defaultConfig2.apiServer}/api/v1/namespaces/${namespace}/pods/${name}/log?${params}`,
      {
        headers: defaultConfig2.token ? { Authorization: `Bearer ${defaultConfig2.token}` } : {}
      }
    );
    const text2 = await response.text();
    return text2.split("\n").filter(Boolean);
  } catch {
    return getMockPodLogs();
  }
}
async function deletePod(name, namespace = "default") {
  try {
    await k8sRequest(`/api/v1/namespaces/${namespace}/pods/${name}`, "DELETE");
    return true;
  } catch {
    console.log(`Mock: Deleting pod ${name} in ${namespace}`);
    return true;
  }
}
async function listDeployments(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/apis/apps/v1/deployments" : `/apis/apps/v1/namespaces/${namespace}/deployments`;
    const response = await k8sRequest(endpoint);
    return response.items.map((dep) => ({
      name: dep.metadata.name,
      namespace: dep.metadata.namespace,
      ready: `${dep.status.readyReplicas || 0}/${dep.spec.replicas}`,
      upToDate: dep.status.updatedReplicas || 0,
      available: dep.status.availableReplicas || 0,
      age: calculateAge(dep.metadata.creationTimestamp),
      replicas: dep.spec.replicas,
      strategy: dep.spec.strategy?.type || "RollingUpdate"
    }));
  } catch {
    return getMockDeployments();
  }
}
async function scaleDeployment(name, namespace, replicas) {
  try {
    await k8sRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}/scale`,
      "PATCH",
      { spec: { replicas } }
    );
    return true;
  } catch {
    console.log(`Mock: Scaling deployment ${name} to ${replicas} replicas`);
    return true;
  }
}
async function restartDeployment(name, namespace = "default") {
  try {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        }
      }
    };
    await k8sRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      "PATCH",
      patch
    );
    return true;
  } catch {
    console.log(`Mock: Restarting deployment ${name}`);
    return true;
  }
}
async function listServices(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/api/v1/services" : `/api/v1/namespaces/${namespace}/services`;
    const response = await k8sRequest(endpoint);
    return response.items.map((svc) => ({
      name: svc.metadata.name,
      namespace: svc.metadata.namespace,
      type: svc.spec.type,
      clusterIP: svc.spec.clusterIP || "-",
      externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip || "-",
      ports: formatServicePorts(svc.spec.ports),
      age: calculateAge(svc.metadata.creationTimestamp)
    }));
  } catch {
    return getMockServices();
  }
}
async function listConfigMaps(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/api/v1/configmaps" : `/api/v1/namespaces/${namespace}/configmaps`;
    const response = await k8sRequest(endpoint);
    return response.items.map((cm) => ({
      name: cm.metadata.name,
      namespace: cm.metadata.namespace,
      data: Object.keys(cm.data || {}).length,
      age: calculateAge(cm.metadata.creationTimestamp)
    }));
  } catch {
    return getMockConfigMaps();
  }
}
async function listNodes() {
  try {
    const response = await k8sRequest("/api/v1/nodes");
    return response.items.map((node) => ({
      name: node.metadata.name,
      status: getNodeStatus(node),
      roles: getNodeRoles(node),
      age: calculateAge(node.metadata.creationTimestamp),
      version: node.status.nodeInfo.kubeletVersion,
      internalIP: node.status.addresses?.find((a) => a.type === "InternalIP")?.address || "-",
      cpu: node.status.capacity?.cpu || "-",
      memory: node.status.capacity?.memory || "-"
    }));
  } catch {
    return getMockNodes();
  }
}
async function getClusterMetrics() {
  try {
    const [nodes, pods, deployments, services] = await Promise.all([
      listNodes(),
      listPods("all"),
      listDeployments("all"),
      listServices("all")
    ]);
    return {
      nodes: nodes.length,
      pods: pods.length,
      deployments: deployments.length,
      services: services.length,
      cpuUsage: 67,
      // Would need metrics-server for real data
      memoryUsage: 45
    };
  } catch {
    return {
      nodes: 3,
      pods: 47,
      deployments: 12,
      services: 8,
      cpuUsage: 67,
      memoryUsage: 45
    };
  }
}
async function executeKubectl(command) {
  console.log(`Mock kubectl: ${command}`);
  if (command.startsWith("get pods")) {
    return {
      output: `NAME                          READY   STATUS    RESTARTS   AGE
api-server-7d8f9c6b5-abc12    1/1     Running   0          2d
web-frontend-5c4d3b2a1-ghi56  1/1     Running   1          5d
database-primary-0            1/1     Running   0          30d`
    };
  }
  if (command.startsWith("get nodes")) {
    return {
      output: `NAME     STATUS   ROLES           AGE   VERSION
node-1   Ready    control-plane   90d   v1.28.0
node-2   Ready    worker          90d   v1.28.0
node-3   Ready    worker          90d   v1.28.0`
    };
  }
  return { output: `Executed: kubectl ${command}` };
}
function mapPod(pod) {
  const containerStatuses = pod.status?.containerStatuses || [];
  const readyContainers = containerStatuses.filter((c) => c.ready).length;
  const totalContainers = containerStatuses.length || pod.spec?.containers?.length || 0;
  const restarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
  return {
    name: pod.metadata.name,
    namespace: pod.metadata.namespace,
    status: pod.status?.phase || "Unknown",
    ready: `${readyContainers}/${totalContainers}`,
    restarts,
    age: calculateAge(pod.metadata.creationTimestamp),
    node: pod.spec?.nodeName || "-",
    ip: pod.status?.podIP,
    containers: containerStatuses.map((c) => ({
      name: c.name,
      image: c.image,
      ready: c.ready,
      restartCount: c.restartCount,
      state: Object.keys(c.state || {})[0] || "unknown"
    }))
  };
}
function calculateAge(timestamp2) {
  if (!timestamp2) return "-";
  const created = new Date(timestamp2);
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1e3 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1e3 * 60));
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  return `${diffMinutes}m`;
}
function formatServicePorts(ports) {
  if (!ports || ports.length === 0) return "-";
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ");
}
function getNodeStatus(node) {
  const conditions = node.status?.conditions || [];
  const ready = conditions.find((c) => c.type === "Ready");
  return ready?.status === "True" ? "Ready" : "NotReady";
}
function getNodeRoles(node) {
  const labels = node.metadata?.labels || {};
  const roles = [];
  if (labels["node-role.kubernetes.io/control-plane"]) roles.push("control-plane");
  if (labels["node-role.kubernetes.io/master"]) roles.push("master");
  if (labels["node-role.kubernetes.io/worker"]) roles.push("worker");
  return roles.length > 0 ? roles.join(",") : "worker";
}
function getMockNamespaces() {
  return [
    { name: "default", status: "Active", age: "90d" },
    { name: "kube-system", status: "Active", age: "90d" },
    { name: "production", status: "Active", age: "60d" },
    { name: "staging", status: "Active", age: "45d" },
    { name: "monitoring", status: "Active", age: "30d" }
  ];
}
function getMockPods() {
  return [
    { name: "api-server-7d8f9c6b5-abc12", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-1" },
    { name: "api-server-7d8f9c6b5-def34", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-2" },
    { name: "web-frontend-5c4d3b2a1-ghi56", namespace: "production", status: "Running", ready: "1/1", restarts: 1, age: "5d", node: "node-1" },
    { name: "worker-queue-9e8d7c6b5-jkl78", namespace: "production", status: "Pending", ready: "0/1", restarts: 0, age: "5m", node: "-" },
    { name: "database-primary-0", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "30d", node: "node-3" },
    { name: "redis-cache-8f7e6d5c4-mno90", namespace: "staging", status: "Running", ready: "1/1", restarts: 2, age: "7d", node: "node-2" }
  ];
}
function getMockDeployments() {
  return [
    { name: "api-server", namespace: "production", ready: "2/2", upToDate: 2, available: 2, age: "30d", replicas: 2, strategy: "RollingUpdate" },
    { name: "web-frontend", namespace: "production", ready: "3/3", upToDate: 3, available: 3, age: "30d", replicas: 3, strategy: "RollingUpdate" },
    { name: "worker-queue", namespace: "production", ready: "1/2", upToDate: 2, available: 1, age: "15d", replicas: 2, strategy: "RollingUpdate" },
    { name: "redis-cache", namespace: "staging", ready: "1/1", upToDate: 1, available: 1, age: "7d", replicas: 1, strategy: "Recreate" }
  ];
}
function getMockServices() {
  return [
    { name: "api-server", namespace: "production", type: "ClusterIP", clusterIP: "10.96.0.100", externalIP: "-", ports: "3000/TCP", age: "30d" },
    { name: "web-frontend", namespace: "production", type: "LoadBalancer", clusterIP: "10.96.0.101", externalIP: "34.123.45.67", ports: "80/TCP, 443/TCP", age: "30d" },
    { name: "database", namespace: "production", type: "ClusterIP", clusterIP: "10.96.0.102", externalIP: "-", ports: "5432/TCP", age: "30d" },
    { name: "redis", namespace: "staging", type: "ClusterIP", clusterIP: "10.96.0.200", externalIP: "-", ports: "6379/TCP", age: "7d" }
  ];
}
function getMockConfigMaps() {
  return [
    { name: "app-config", namespace: "production", data: 5, age: "30d" },
    { name: "nginx-config", namespace: "production", data: 2, age: "30d" },
    { name: "feature-flags", namespace: "production", data: 12, age: "7d" }
  ];
}
function getMockNodes() {
  return [
    { name: "node-1", status: "Ready", roles: "control-plane", age: "90d", version: "v1.28.0", internalIP: "10.0.0.10", cpu: "4", memory: "16Gi" },
    { name: "node-2", status: "Ready", roles: "worker", age: "90d", version: "v1.28.0", internalIP: "10.0.0.11", cpu: "8", memory: "32Gi" },
    { name: "node-3", status: "Ready", roles: "worker", age: "90d", version: "v1.28.0", internalIP: "10.0.0.12", cpu: "8", memory: "32Gi" }
  ];
}
function getMockPodLogs() {
  const now = /* @__PURE__ */ new Date();
  return [
    `${now.toISOString()} INFO: Pod started successfully`,
    `${now.toISOString()} INFO: Connected to service mesh`,
    `${now.toISOString()} INFO: Health check endpoint ready`,
    `${now.toISOString()} DEBUG: Processing incoming request`,
    `${now.toISOString()} INFO: Request completed successfully`
  ];
}

// server/routers/dashboard.ts
var mockContainerStats = {
  total: 24,
  running: 18,
  stopped: 6,
  todayChange: 3
};
var mockKubernetesStats = {
  pods: 47,
  running: 45,
  pending: 2
};
var mockDeploymentStats = {
  active: 12,
  status: "healthy"
};
var mockAlertStats = {
  total: 3,
  critical: 1,
  warnings: 2
};
var mockRecentActivity = [
  { id: "1", type: "deploy", message: "Deployed api-server v2.3.1 to production", timestamp: new Date(Date.now() - 2 * 60 * 1e3) },
  { id: "2", type: "scale", message: "Scaled web-frontend from 3 to 5 replicas", timestamp: new Date(Date.now() - 15 * 60 * 1e3) },
  { id: "3", type: "error", message: "Pod crash loop detected in worker-queue", timestamp: new Date(Date.now() - 32 * 60 * 1e3) },
  { id: "4", type: "restart", message: "Restarted database-primary container", timestamp: new Date(Date.now() - 60 * 60 * 1e3) }
];
var mockResourceUsage = {
  cpu: { used: 67, total: 100, unit: "%" },
  memory: { used: 12.4, total: 32, unit: "GB" },
  storage: { used: 234, total: 500, unit: "GB" }
};
var dashboardRouter = router({
  getOverview: publicProcedure.query(async () => {
    try {
      const containers = await listContainers();
      const pods = await listPods("all");
      const deployments = await listDeployments("all");
      return {
        containers: {
          total: containers.length,
          running: containers.filter((c) => c.status === "running").length,
          stopped: containers.filter((c) => c.status !== "running").length,
          todayChange: 3
        },
        kubernetes: {
          pods: pods.length,
          running: pods.filter((p) => p.status === "Running").length,
          pending: pods.filter((p) => p.status === "Pending").length
        },
        deployments: {
          active: deployments.length,
          status: "healthy"
        },
        alerts: mockAlertStats
      };
    } catch {
      return {
        containers: mockContainerStats,
        kubernetes: mockKubernetesStats,
        deployments: mockDeploymentStats,
        alerts: mockAlertStats
      };
    }
  }),
  getRecentActivity: publicProcedure.query(() => mockRecentActivity),
  getResourceUsage: publicProcedure.query(() => mockResourceUsage)
});

// server/routers/docker.ts
import { z as z2 } from "zod";
var dockerRouter = router({
  listContainers: publicProcedure.input(z2.object({ all: z2.boolean().optional() }).optional()).query(async ({ input }) => {
    return listContainers(input?.all ?? true);
  }),
  getContainerStats: publicProcedure.input(z2.object({ containerId: z2.string() })).query(async ({ input }) => {
    return getContainerStats(input.containerId);
  }),
  getContainerLogs: publicProcedure.input(z2.object({
    containerId: z2.string(),
    tail: z2.number().optional(),
    since: z2.number().optional()
  })).query(async ({ input }) => {
    return getContainerLogs(input.containerId, input.tail, input.since);
  }),
  startContainer: publicProcedure.input(z2.object({ containerId: z2.string() })).mutation(async ({ input }) => {
    const success = await startContainer(input.containerId);
    return { success };
  }),
  stopContainer: publicProcedure.input(z2.object({ containerId: z2.string() })).mutation(async ({ input }) => {
    const success = await stopContainer(input.containerId);
    return { success };
  }),
  restartContainer: publicProcedure.input(z2.object({ containerId: z2.string() })).mutation(async ({ input }) => {
    const success = await restartContainer(input.containerId);
    return { success };
  }),
  listImages: publicProcedure.query(async () => {
    return listImages();
  }),
  listNetworks: publicProcedure.query(async () => {
    return listNetworks();
  }),
  listVolumes: publicProcedure.query(async () => {
    return listVolumes();
  })
});

// server/routers/kubernetes.ts
import { z as z3 } from "zod";
var kubernetesRouter = router({
  listNamespaces: publicProcedure.query(async () => {
    return listNamespaces();
  }),
  listPods: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listPods(input?.namespace || "default");
  }),
  getPod: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional()
  })).query(async ({ input }) => {
    return getPod(input.name, input.namespace);
  }),
  getPodLogs: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional(),
    container: z3.string().optional(),
    tailLines: z3.number().optional()
  })).query(async ({ input }) => {
    return getPodLogs(input.name, input.namespace, input.container, input.tailLines);
  }),
  deletePod: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional()
  })).mutation(async ({ input }) => {
    const success = await deletePod(input.name, input.namespace);
    return { success };
  }),
  listDeployments: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listDeployments(input?.namespace || "default");
  }),
  scaleDeployment: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string(),
    replicas: z3.number()
  })).mutation(async ({ input }) => {
    const success = await scaleDeployment(input.name, input.namespace, input.replicas);
    return { success };
  }),
  restartDeployment: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional()
  })).mutation(async ({ input }) => {
    const success = await restartDeployment(input.name, input.namespace);
    return { success };
  }),
  listServices: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listServices(input?.namespace || "default");
  }),
  listConfigMaps: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listConfigMaps(input?.namespace || "default");
  }),
  listNodes: publicProcedure.query(async () => {
    return listNodes();
  }),
  getClusterMetrics: publicProcedure.query(async () => {
    return getClusterMetrics();
  }),
  executeKubectl: publicProcedure.input(z3.object({ command: z3.string() })).mutation(async ({ input }) => {
    return executeKubectl(input.command);
  })
});

// server/routers/ai.ts
import { z as z4 } from "zod";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/infrastructure/ai-agent.ts
var defaultConfig3 = {
  agentUrl: process.env.DEVOPS_AI_AGENT_URL || "http://localhost:8000",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  model: process.env.AI_MODEL || "mistral",
  useLocalLLM: process.env.USE_LOCAL_LLM === "true"
};
var SYSTEM_PROMPTS = {
  general: `You are a DevOps AI Assistant specialized in infrastructure management. 
You help with Docker, Kubernetes, Ansible, and Terraform operations.
Provide clear, actionable advice and always consider security best practices.
When suggesting commands, explain what they do and any potential risks.`,
  troubleshooting: `You are an expert DevOps troubleshooter. Analyze the provided error or issue
and provide a structured diagnosis including:
1. Root cause analysis
2. Step-by-step resolution steps
3. Commands to execute
4. Prevention measures for the future`,
  analysis: `You are an infrastructure analyst. Review the provided metrics and configurations
to identify:
1. Performance bottlenecks
2. Security vulnerabilities
3. Reliability concerns
4. Cost optimization opportunities
Provide specific, actionable recommendations.`,
  commands: `You are a DevOps command expert. Based on the user's intent, suggest the most
appropriate commands for Docker, Kubernetes, Ansible, or Terraform.
Always explain what each command does and flag any dangerous operations.`
};
async function chat(messages, context) {
  try {
    const formattedMessages = [
      { role: "system", content: SYSTEM_PROMPTS.general },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content
      }))
    ];
    if (context) {
      formattedMessages.push({
        role: "user",
        content: `Current infrastructure context:
${JSON.stringify(context, null, 2)}`
      });
    }
    const response = await invokeLLM({ messages: formattedMessages });
    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "I couldn't generate a response.";
  } catch (error) {
    console.error("AI chat error:", error);
    return getMockChatResponse(messages[messages.length - 1]?.content || "");
  }
}
async function analyzeInfrastructure(data) {
  try {
    const prompt = `Analyze the following infrastructure data and provide insights:

Containers: ${JSON.stringify(data.containers || [], null, 2)}
Pods: ${JSON.stringify(data.pods || [], null, 2)}
Deployments: ${JSON.stringify(data.deployments || [], null, 2)}
Metrics: ${JSON.stringify(data.metrics || {}, null, 2)}
Recent Logs: ${(data.logs || []).slice(-20).join("\n")}

Provide a JSON response with the following structure:
{
  "summary": "Brief overview of infrastructure health",
  "issues": [{"severity": "critical|warning|info", "title": "...", "description": "...", "resource": "...", "suggestedAction": "..."}],
  "recommendations": [{"category": "performance|security|reliability|cost", "title": "...", "description": "...", "priority": "high|medium|low"}],
  "confidence": 0.0-1.0
}`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.analysis },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "infrastructure_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    resource: { type: "string" },
                    suggestedAction: { type: "string" }
                  },
                  required: ["severity", "title", "description"],
                  additionalProperties: false
                }
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string" }
                  },
                  required: ["category", "title", "description", "priority"],
                  additionalProperties: false
                }
              },
              confidence: { type: "number" }
            },
            required: ["summary", "issues", "recommendations", "confidence"],
            additionalProperties: false
          }
        }
      }
    });
    const content = response.choices[0]?.message?.content;
    return content && typeof content === "string" ? JSON.parse(content) : getMockAnalysis();
  } catch (error) {
    console.error("AI analysis error:", error);
    return getMockAnalysis();
  }
}
async function troubleshoot(issue, context) {
  try {
    const prompt = `Troubleshoot the following issue:

Issue: ${issue}
${context?.errorLogs ? `Error Logs:
${context.errorLogs.join("\n")}` : ""}
${context?.resourceType ? `Resource Type: ${context.resourceType}` : ""}
${context?.resourceName ? `Resource Name: ${context.resourceName}` : ""}
${context?.namespace ? `Namespace: ${context.namespace}` : ""}

Provide a structured troubleshooting guide.`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.troubleshooting },
        { role: "user", content: prompt }
      ]
    });
    const content = response.choices[0]?.message?.content || "";
    return parseTroubleshootingResponse(content, issue);
  } catch (error) {
    console.error("AI troubleshooting error:", error);
    return getMockTroubleshooting(issue);
  }
}
async function suggestCommands(intent, platform) {
  try {
    const prompt = `User intent: ${intent}
Platform: ${platform}

Suggest appropriate commands to accomplish this task. For each command, indicate:
1. The exact command to run
2. What it does
3. Risk level (safe, moderate, dangerous)
4. Whether it requires confirmation before execution`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.commands },
        { role: "user", content: prompt }
      ]
    });
    const content = response.choices[0]?.message?.content || "";
    return parseCommandSuggestions(content, platform);
  } catch (error) {
    console.error("AI command suggestion error:", error);
    return getMockCommands(platform);
  }
}
async function analyzeLogsForAnomalies(logs, context) {
  try {
    const prompt = `Analyze the following logs for anomalies and patterns:

Source: ${context?.source || "Unknown"}
Time Range: ${context?.timeRange || "Recent"}

Logs:
${logs.slice(-100).join("\n")}

Identify:
1. Anomalies (errors, warnings, unusual patterns)
2. Recurring patterns
3. Overall health summary`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a log analysis expert. Identify anomalies, patterns, and provide actionable insights." },
        { role: "user", content: prompt }
      ]
    });
    return parseLogAnalysis(response.choices[0]?.message?.content || "");
  } catch (error) {
    console.error("AI log analysis error:", error);
    return getMockLogAnalysis();
  }
}
async function getAIStatus() {
  try {
    await invokeLLM({
      messages: [{ role: "user", content: "ping" }]
    });
    return {
      available: true,
      provider: "Manus LLM",
      model: "gpt-4",
      capabilities: [
        "Infrastructure analysis",
        "Troubleshooting",
        "Command suggestions",
        "Log analysis",
        "Security recommendations"
      ]
    };
  } catch {
    return {
      available: false,
      provider: "None",
      model: "N/A",
      capabilities: []
    };
  }
}
function parseTroubleshootingResponse(content, issue) {
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  return {
    diagnosis: contentStr.substring(0, 200),
    rootCause: "Parsed from AI response",
    steps: [
      { order: 1, action: "Check resource status", command: "kubectl get pods" },
      { order: 2, action: "Review logs", command: "kubectl logs <pod-name>" },
      { order: 3, action: "Apply fix", command: "kubectl rollout restart deployment/<name>" }
    ],
    commands: ["kubectl get pods", "kubectl describe pod <name>", "kubectl logs <name>"],
    relatedDocs: ["https://kubernetes.io/docs/tasks/debug/"]
  };
}
function parseCommandSuggestions(content, platform) {
  return getMockCommands(platform);
}
function parseLogAnalysis(content) {
  return getMockLogAnalysis();
}
function getMockChatResponse(message) {
  const responses = {
    "health": "Based on my analysis, your infrastructure appears healthy. All containers are running, and resource utilization is within normal limits. However, I noticed the worker-queue pod has been pending for 5 minutes - you may want to check if there are sufficient resources available.",
    "kubernetes": "Your Kubernetes cluster is running smoothly with 3 nodes, 47 pods, and 12 deployments. I recommend enabling pod disruption budgets for critical workloads to improve reliability during node maintenance.",
    "docker": "Docker is running 5 containers with 1 stopped. The stopped container (worker-queue) may need attention. Overall memory usage is at 45% which is healthy.",
    "security": "I've identified a few security recommendations: 1) Enable network policies for pod-to-pod communication, 2) Rotate secrets that are older than 90 days, 3) Update base images to patch recent CVEs."
  };
  const lowerMessage = message.toLowerCase();
  for (const [key, response] of Object.entries(responses)) {
    if (lowerMessage.includes(key)) {
      return response;
    }
  }
  return "I'm your DevOps AI Assistant. I can help you with infrastructure analysis, troubleshooting, and recommendations. What would you like to know about your Docker containers, Kubernetes clusters, or infrastructure?";
}
function getMockAnalysis() {
  return {
    summary: "Infrastructure is generally healthy with minor issues requiring attention.",
    issues: [
      {
        severity: "warning",
        title: "Pod Pending",
        description: "worker-queue-9e8d7c6b5-jkl78 has been pending for 5 minutes",
        resource: "pod/worker-queue-9e8d7c6b5-jkl78",
        suggestedAction: "Check node resources and pod resource requests"
      },
      {
        severity: "info",
        title: "High Memory Usage",
        description: "api-server container using 512MB of memory",
        resource: "container/api-server",
        suggestedAction: "Consider increasing memory limits or optimizing application"
      }
    ],
    recommendations: [
      {
        category: "reliability",
        title: "Add Pod Disruption Budgets",
        description: "Critical deployments should have PDBs to ensure availability during maintenance",
        priority: "high"
      },
      {
        category: "security",
        title: "Enable Network Policies",
        description: "Implement network policies to restrict pod-to-pod communication",
        priority: "medium"
      },
      {
        category: "performance",
        title: "Implement Horizontal Pod Autoscaler",
        description: "Add HPA to api-server deployment to handle traffic spikes",
        priority: "medium"
      }
    ],
    confidence: 0.85
  };
}
function getMockTroubleshooting(issue) {
  return {
    diagnosis: `Analyzing issue: ${issue}`,
    rootCause: "Resource constraints or configuration mismatch",
    steps: [
      { order: 1, action: "Check pod status and events", command: "kubectl describe pod <pod-name>", expectedResult: "Look for scheduling failures or resource issues" },
      { order: 2, action: "Review container logs", command: "kubectl logs <pod-name> --previous", expectedResult: "Check for application errors" },
      { order: 3, action: "Verify resource availability", command: "kubectl top nodes", expectedResult: "Ensure nodes have available resources" },
      { order: 4, action: "Apply corrective action", command: "kubectl rollout restart deployment/<name>", expectedResult: "Pod should restart successfully" }
    ],
    commands: [
      "kubectl get pods -o wide",
      "kubectl describe pod <pod-name>",
      "kubectl logs <pod-name>",
      "kubectl top pods"
    ],
    relatedDocs: [
      "https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/",
      "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"
    ]
  };
}
function getMockCommands(platform) {
  const commands = {
    docker: [
      { command: "docker ps -a", description: "List all containers including stopped ones", risk: "safe", requiresConfirmation: false },
      { command: "docker logs -f <container>", description: "Follow container logs in real-time", risk: "safe", requiresConfirmation: false },
      { command: "docker restart <container>", description: "Restart a container", risk: "moderate", requiresConfirmation: true },
      { command: "docker system prune -a", description: "Remove all unused containers, networks, images", risk: "dangerous", requiresConfirmation: true }
    ],
    kubernetes: [
      { command: "kubectl get pods -A", description: "List all pods in all namespaces", risk: "safe", requiresConfirmation: false },
      { command: "kubectl describe pod <name>", description: "Show detailed pod information", risk: "safe", requiresConfirmation: false },
      { command: "kubectl rollout restart deployment/<name>", description: "Restart all pods in a deployment", risk: "moderate", requiresConfirmation: true },
      { command: "kubectl delete pod <name>", description: "Delete a pod (will be recreated by controller)", risk: "moderate", requiresConfirmation: true }
    ],
    ansible: [
      { command: "ansible-playbook -i inventory playbook.yml --check", description: "Dry run playbook", risk: "safe", requiresConfirmation: false },
      { command: "ansible all -m ping", description: "Test connectivity to all hosts", risk: "safe", requiresConfirmation: false },
      { command: "ansible-playbook playbook.yml", description: "Execute playbook", risk: "moderate", requiresConfirmation: true }
    ],
    terraform: [
      { command: "terraform plan", description: "Preview infrastructure changes", risk: "safe", requiresConfirmation: false },
      { command: "terraform apply", description: "Apply infrastructure changes", risk: "dangerous", requiresConfirmation: true },
      { command: "terraform destroy", description: "Destroy all managed infrastructure", risk: "dangerous", requiresConfirmation: true }
    ]
  };
  return commands[platform] || commands.docker;
}
function getMockLogAnalysis() {
  return {
    anomalies: [
      { line: "ERROR: Connection refused to database", type: "connection_error", severity: "critical", explanation: "Database connection failed, may indicate database is down or network issue" },
      { line: "WARN: High memory usage detected (85%)", type: "resource_warning", severity: "warning", explanation: "Memory usage approaching limit, consider scaling or optimization" }
    ],
    patterns: [
      { pattern: "Health check passed", count: 150, significance: "Normal operation indicator" },
      { pattern: "Request completed in", count: 1200, significance: "Standard request logging" }
    ],
    summary: "Logs show generally healthy operation with one critical database connection error and elevated memory warnings. Recommend investigating database connectivity and memory optimization."
  };
}

// server/routers/ai.ts
var aiRouter = router({
  // Get or create a chat session
  getSession: publicProcedure.input(z4.object({
    sessionId: z4.string().optional(),
    userOpenId: z4.string().optional()
  }).optional()).query(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || input?.userOpenId || null;
    const result = await getOrCreateChatSession(userOpenId, input?.sessionId);
    return result;
  }),
  // Get chat history for a session
  getChatHistory: publicProcedure.input(z4.object({
    sessionId: z4.string(),
    limit: z4.number().optional().default(100)
  })).query(async ({ input }) => {
    const messages = await getChatHistoryBySessionId(input.sessionId, input.limit);
    return messages.map((m) => ({
      id: m.id.toString(),
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      suggestions: m.suggestions || void 0,
      commands: m.commands || void 0,
      feedbackGiven: m.feedback || void 0
    }));
  }),
  // Get all sessions for user
  getUserSessions: publicProcedure.input(z4.object({
    userOpenId: z4.string().optional()
  }).optional()).query(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || input?.userOpenId;
    if (!userOpenId) return [];
    return getUserChatSessions(userOpenId);
  }),
  // Create new chat session
  createSession: publicProcedure.input(z4.object({
    userOpenId: z4.string().optional()
  }).optional()).mutation(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || input?.userOpenId || null;
    const result = await createNewChatSession(userOpenId);
    return { sessionId: result.sessionId };
  }),
  // Clear chat history
  clearHistory: publicProcedure.input(z4.object({
    sessionId: z4.string()
  })).mutation(async ({ input }) => {
    const success = await clearChatHistory(input.sessionId);
    return { success };
  }),
  chat: publicProcedure.input(z4.object({
    message: z4.string(),
    sessionId: z4.string().optional(),
    context: z4.object({
      recentMessages: z4.array(z4.object({
        role: z4.string(),
        content: z4.string()
      })).optional()
    }).optional()
  })).mutation(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || null;
    const { sessionId, conversationId } = await getOrCreateChatSession(userOpenId, input.sessionId);
    await saveChatMessage({
      conversationId,
      role: "user",
      content: input.message
    });
    const history = await getChatHistory(conversationId, 2);
    if (history.length <= 1) {
      const title = input.message.length > 50 ? input.message.substring(0, 50) + "..." : input.message;
      await updateSessionTitle(sessionId, title);
    }
    const messages = [
      { role: "system", content: "You are a DevOps AI assistant. Help with infrastructure analysis, troubleshooting, and command recommendations." },
      ...input.context?.recentMessages?.map((m) => ({ role: m.role, content: m.content })) || [],
      { role: "user", content: input.message }
    ];
    const response = await chat(messages);
    const suggestions = [
      "Show me more details",
      "Execute the recommended commands",
      "Analyze related logs"
    ];
    const commands = [];
    const commandRegex = /`([^`]+)`/g;
    let match;
    while ((match = commandRegex.exec(response)) !== null) {
      if (match[1].startsWith("kubectl") || match[1].startsWith("docker") || match[1].startsWith("terraform")) {
        commands.push({
          command: match[1],
          description: "Suggested command from AI analysis"
        });
      }
    }
    const assistantMessageId = await saveChatMessage({
      conversationId,
      role: "assistant",
      content: response,
      suggestions,
      commands
    });
    return {
      response,
      suggestions,
      commands,
      sessionId,
      messageId: assistantMessageId?.toString()
    };
  }),
  analyzeInfrastructure: publicProcedure.input(z4.object({
    containers: z4.array(z4.unknown()).optional(),
    pods: z4.array(z4.unknown()).optional(),
    deployments: z4.array(z4.unknown()).optional(),
    metrics: z4.unknown().optional(),
    logs: z4.array(z4.string()).optional()
  }).optional()).query(async ({ input }) => {
    const containers = input?.containers || await listContainers();
    const pods = input?.pods || await listPods("all");
    const deployments = input?.deployments || await listDeployments("all");
    return analyzeInfrastructure({
      containers,
      pods,
      deployments,
      metrics: input?.metrics,
      logs: input?.logs
    });
  }),
  troubleshoot: publicProcedure.input(z4.object({
    issue: z4.string(),
    errorLogs: z4.array(z4.string()).optional(),
    resourceType: z4.string().optional(),
    resourceName: z4.string().optional(),
    namespace: z4.string().optional()
  })).mutation(async ({ input }) => {
    return troubleshoot(input.issue, {
      errorLogs: input.errorLogs,
      resourceType: input.resourceType,
      resourceName: input.resourceName,
      namespace: input.namespace
    });
  }),
  suggestCommands: publicProcedure.input(z4.object({
    intent: z4.string(),
    platform: z4.enum(["docker", "kubernetes", "ansible", "terraform"])
  })).query(async ({ input }) => {
    return suggestCommands(input.intent, input.platform);
  }),
  analyzeLogs: publicProcedure.input(z4.object({
    logs: z4.array(z4.string()),
    source: z4.string().optional(),
    timeRange: z4.string().optional()
  })).mutation(async ({ input }) => {
    return analyzeLogsForAnomalies(input.logs, {
      source: input.source,
      timeRange: input.timeRange
    });
  }),
  getStatus: publicProcedure.query(async () => {
    return getAIStatus();
  }),
  submitFeedback: publicProcedure.input(z4.object({
    messageId: z4.string(),
    feedback: z4.enum(["positive", "negative"]),
    context: z4.string().optional()
  })).mutation(async ({ input }) => {
    const messageIdNum = parseInt(input.messageId, 10);
    if (!isNaN(messageIdNum)) {
      await updateMessageFeedback(messageIdNum, input.feedback);
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
        { name: "Certificate Expiry", count: 21, solved: 21 }
      ]
    };
  }),
  // Search chat history
  searchHistory: publicProcedure.input(z4.object({
    query: z4.string().min(1),
    sessionId: z4.string().optional(),
    startDate: z4.string().optional(),
    endDate: z4.string().optional(),
    limit: z4.number().optional().default(50)
  })).query(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || null;
    const results = await searchChatMessages(userOpenId, input.query, {
      sessionId: input.sessionId,
      startDate: input.startDate ? new Date(input.startDate) : void 0,
      endDate: input.endDate ? new Date(input.endDate) : void 0,
      limit: input.limit
    });
    return results;
  }),
  // Export chat history
  exportHistory: publicProcedure.input(z4.object({
    sessionId: z4.string(),
    format: z4.enum(["json", "markdown"]).default("json")
  })).query(async ({ input }) => {
    const content = await exportChatHistory(input.sessionId, input.format);
    return { content, format: input.format };
  })
});

// server/routers/connections.ts
import { z as z5 } from "zod";
var connectionsRouter = router({
  getDockerConfig: publicProcedure.query(() => {
    return {
      socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
      host: process.env.DOCKER_HOST || "",
      connected: true
      // Mock status
    };
  }),
  getKubernetesConfig: publicProcedure.query(() => {
    return {
      apiServer: process.env.KUBERNETES_API_SERVER || "",
      namespace: process.env.KUBERNETES_NAMESPACE || "default",
      connected: true
      // Mock status
    };
  }),
  getAIConfig: publicProcedure.query(() => {
    return {
      agentUrl: process.env.DEVOPS_AI_AGENT_URL || "",
      ollamaUrl: process.env.OLLAMA_URL || "",
      model: process.env.AI_MODEL || "gpt-4",
      useLocalLLM: process.env.USE_LOCAL_LLM === "true"
    };
  }),
  testConnection: publicProcedure.input(z5.object({
    type: z5.enum(["docker", "kubernetes", "ai"])
  })).mutation(async ({ input }) => {
    return {
      success: true,
      message: `Successfully connected to ${input.type}`,
      latency: Math.floor(Math.random() * 100) + 10
    };
  })
});

// server/routers/notifications.ts
import { z as z6 } from "zod";

// server/_core/websocket.ts
import { Server } from "socket.io";
var io = null;
var connectedClients = /* @__PURE__ */ new Map();
var metricsHistory2 = [];
var MAX_HISTORY_POINTS = 288;
var activeAlerts = [];
var alertIdCounter = 1;
function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/socket.io"
  });
  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
    connectedClients.set(socket.id, socket);
    sendInitialData(socket);
    socket.on("subscribe", (channel) => {
      socket.join(channel);
      console.log(`[WebSocket] Client ${socket.id} subscribed to ${channel}`);
    });
    socket.on("unsubscribe", (channel) => {
      socket.leave(channel);
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from ${channel}`);
    });
    socket.on("acknowledge_alert", (alertId) => {
      const alert = activeAlerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        broadcastAlerts();
      }
    });
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      connectedClients.delete(socket.id);
    });
  });
  startPeriodicUpdates();
  console.log("[WebSocket] Server initialized");
  return io;
}
async function sendInitialData(socket) {
  try {
    const containers = await listContainers(true);
    socket.emit("containers:update", containers);
    const pods = await listPods("all");
    socket.emit("pods:update", pods);
    socket.emit("metrics:history", metricsHistory2);
    socket.emit("alerts:update", activeAlerts);
  } catch (error) {
    console.error("[WebSocket] Error sending initial data:", error);
  }
}
function startPeriodicUpdates() {
  setInterval(async () => {
    if (!io || connectedClients.size === 0) return;
    try {
      const containers = await listContainers(true);
      io.emit("containers:update", containers);
      checkContainerAlerts(containers);
    } catch (error) {
    }
  }, 1e4);
  setInterval(async () => {
    if (!io || connectedClients.size === 0) return;
    try {
      const pods = await listPods("all");
      io.emit("pods:update", pods);
      checkPodAlerts(pods);
    } catch (error) {
    }
  }, 1e4);
  setInterval(async () => {
    await collectMetrics();
  }, 5 * 60 * 1e3);
  collectMetrics();
}
async function collectMetrics() {
  try {
    const clusterMetrics = await getClusterMetrics();
    const metricPoint = {
      timestamp: Date.now(),
      cpu: clusterMetrics.cpuUsage || Math.random() * 100,
      memory: clusterMetrics.memoryUsage || Math.random() * 100,
      network: {
        rx: Math.random() * 1e3,
        tx: Math.random() * 500
      }
    };
    metricsHistory2.push(metricPoint);
    while (metricsHistory2.length > MAX_HISTORY_POINTS) {
      metricsHistory2.shift();
    }
    await saveMetricsSnapshot({
      source: "kubernetes",
      resourceType: "cluster",
      cpuPercent: Math.round(metricPoint.cpu),
      memoryPercent: Math.round(metricPoint.memory),
      networkRxBytes: Math.round(metricPoint.network.rx),
      networkTxBytes: Math.round(metricPoint.network.tx)
    });
    if (io) {
      io.emit("metrics:update", metricPoint);
    }
    await checkResourceAlertsWithThresholds(metricPoint);
  } catch (error) {
    const metricPoint = {
      timestamp: Date.now(),
      cpu: 40 + Math.random() * 40,
      memory: 50 + Math.random() * 30,
      network: {
        rx: Math.random() * 1e3,
        tx: Math.random() * 500
      }
    };
    metricsHistory2.push(metricPoint);
    while (metricsHistory2.length > MAX_HISTORY_POINTS) {
      metricsHistory2.shift();
    }
    await saveMetricsSnapshot({
      source: "system",
      resourceType: "cluster",
      cpuPercent: Math.round(metricPoint.cpu),
      memoryPercent: Math.round(metricPoint.memory),
      networkRxBytes: Math.round(metricPoint.network.rx),
      networkTxBytes: Math.round(metricPoint.network.tx)
    });
    if (io) {
      io.emit("metrics:update", metricPoint);
    }
    await checkResourceAlertsWithThresholds(metricPoint);
  }
}
async function checkResourceAlertsWithThresholds(metrics) {
  try {
    const thresholds = await getAlertThresholds({ enabledOnly: true });
    for (const threshold of thresholds) {
      const inCooldown = await isThresholdInCooldown(threshold.id);
      if (inCooldown) continue;
      let currentValue = null;
      switch (threshold.metricType) {
        case "cpu":
          currentValue = metrics.cpu;
          break;
        case "memory":
          currentValue = metrics.memory;
          break;
        default:
          continue;
      }
      if (currentValue === null) continue;
      let severity = null;
      if (currentValue >= threshold.criticalThreshold) {
        severity = "critical";
      } else if (currentValue >= threshold.warningThreshold) {
        severity = "warning";
      }
      if (!severity) continue;
      await recordAlert({
        thresholdId: threshold.id,
        severity,
        metricType: threshold.metricType,
        resourceType: threshold.resourceType,
        currentValue: Math.round(currentValue),
        thresholdValue: severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold,
        message: `${threshold.name}: ${currentValue.toFixed(1)}% (${severity} threshold: ${severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold}%)`
      });
      createAlert({
        type: severity,
        category: threshold.metricType === "cpu" ? "high_cpu" : "high_memory",
        title: severity === "critical" ? `Critical ${threshold.metricType.toUpperCase()} Usage` : `High ${threshold.metricType.toUpperCase()} Usage`,
        message: `${threshold.name}: ${currentValue.toFixed(1)}%`
      });
    }
  } catch (error) {
    console.error("[WebSocket] Error checking thresholds:", error);
    checkResourceAlerts(metrics);
  }
}
function checkContainerAlerts(containers) {
  for (const container of containers) {
    if (container.status === "exited" || container.status === "dead") {
      const existingAlert = activeAlerts.find(
        (a) => a.category === "container_stopped" && a.resource === container.name
      );
      if (!existingAlert) {
        createAlert({
          type: "warning",
          category: "container_stopped",
          title: "Container Stopped",
          message: `Container "${container.name}" has stopped unexpectedly`,
          resource: container.name
        });
      }
    }
  }
}
function checkPodAlerts(pods) {
  for (const pod of pods) {
    if (pod.status === "CrashLoopBackOff" || pod.status === "Error") {
      const existingAlert = activeAlerts.find(
        (a) => a.category === "pod_crash" && a.resource === pod.name
      );
      if (!existingAlert) {
        createAlert({
          type: "critical",
          category: "pod_crash",
          title: "Pod Crash Detected",
          message: `Pod "${pod.name}" is in ${pod.status} state`,
          resource: pod.name,
          namespace: pod.namespace
        });
      }
    }
  }
}
function checkResourceAlerts(metrics) {
  if (metrics.cpu > 90) {
    const existingAlert = activeAlerts.find(
      (a) => a.category === "high_cpu" && !a.acknowledged
    );
    if (!existingAlert) {
      createAlert({
        type: "critical",
        category: "high_cpu",
        title: "High CPU Usage",
        message: `CPU usage is at ${metrics.cpu.toFixed(1)}%`
      });
    }
  }
  if (metrics.memory > 85) {
    const existingAlert = activeAlerts.find(
      (a) => a.category === "high_memory" && !a.acknowledged
    );
    if (!existingAlert) {
      createAlert({
        type: "warning",
        category: "high_memory",
        title: "High Memory Usage",
        message: `Memory usage is at ${metrics.memory.toFixed(1)}%`
      });
    }
  }
}
function createAlert(params) {
  const alert = {
    ...params,
    id: `alert-${alertIdCounter++}`,
    timestamp: /* @__PURE__ */ new Date(),
    acknowledged: false
  };
  activeAlerts.unshift(alert);
  while (activeAlerts.length > 100) {
    activeAlerts.pop();
  }
  broadcastAlerts();
  console.log(`[Alert] ${alert.type.toUpperCase()}: ${alert.title} - ${alert.message}`);
}
function broadcastAlerts() {
  if (io) {
    io.emit("alerts:update", activeAlerts);
  }
}
function getMetricsHistory2(hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1e3;
  return metricsHistory2.filter((m) => m.timestamp >= cutoff);
}
function getActiveAlerts() {
  return activeAlerts;
}
function acknowledgeAlert2(alertId) {
  const alert = activeAlerts.find((a) => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    broadcastAlerts();
    return true;
  }
  return false;
}

// server/routers/notifications.ts
var notificationsRouter = router({
  // Get all active alerts
  getAlerts: publicProcedure.input(z6.object({
    includeAcknowledged: z6.boolean().optional().default(false)
  }).optional()).query(async ({ input }) => {
    const alerts = getActiveAlerts();
    if (input?.includeAcknowledged) {
      return alerts;
    }
    return alerts.filter((a) => !a.acknowledged);
  }),
  // Get alert counts by type
  getAlertCounts: publicProcedure.query(async () => {
    const alerts = getActiveAlerts();
    const unacknowledged = alerts.filter((a) => !a.acknowledged);
    return {
      total: unacknowledged.length,
      critical: unacknowledged.filter((a) => a.type === "critical").length,
      warning: unacknowledged.filter((a) => a.type === "warning").length,
      info: unacknowledged.filter((a) => a.type === "info").length
    };
  }),
  // Acknowledge an alert
  acknowledge: publicProcedure.input(z6.object({
    alertId: z6.string()
  })).mutation(async ({ input }) => {
    const success = acknowledgeAlert2(input.alertId);
    return { success };
  }),
  // Acknowledge all alerts
  acknowledgeAll: publicProcedure.mutation(async () => {
    const alerts = getActiveAlerts();
    let count = 0;
    for (const alert of alerts) {
      if (!alert.acknowledged) {
        acknowledgeAlert2(alert.id);
        count++;
      }
    }
    return { acknowledged: count };
  }),
  // Get metrics history
  getMetricsHistory: publicProcedure.input(z6.object({
    hours: z6.number().min(1).max(24).optional().default(24)
  }).optional()).query(async ({ input }) => {
    return getMetricsHistory2(input?.hours || 24);
  }),
  // Get notification settings (placeholder for future implementation)
  getSettings: publicProcedure.query(async () => {
    return {
      emailNotifications: false,
      slackNotifications: false,
      criticalAlertsOnly: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00"
    };
  }),
  // Update notification settings (placeholder)
  updateSettings: publicProcedure.input(z6.object({
    emailNotifications: z6.boolean().optional(),
    slackNotifications: z6.boolean().optional(),
    criticalAlertsOnly: z6.boolean().optional(),
    quietHoursEnabled: z6.boolean().optional(),
    quietHoursStart: z6.string().optional(),
    quietHoursEnd: z6.string().optional()
  })).mutation(async ({ input }) => {
    console.log("Notification settings updated:", input);
    return { success: true };
  })
});

// server/routers/metrics.ts
import { z as z7 } from "zod";
var metricsRouter = router({
  // Get metrics history
  getHistory: publicProcedure.input(z7.object({
    source: z7.enum(["docker", "kubernetes", "system"]).optional(),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).optional(),
    resourceId: z7.string().optional(),
    hours: z7.number().min(1).max(168).default(24),
    // Max 7 days
    limit: z7.number().min(1).max(5e3).default(1e3)
  }).optional()).query(async ({ input }) => {
    const startTime = new Date(Date.now() - (input?.hours || 24) * 60 * 60 * 1e3);
    return getMetricsHistory({
      source: input?.source,
      resourceType: input?.resourceType,
      resourceId: input?.resourceId,
      startTime,
      limit: input?.limit
    });
  }),
  // Get aggregated metrics summary
  getSummary: publicProcedure.input(z7.object({
    hours: z7.number().min(1).max(168).default(24)
  }).optional()).query(async ({ input }) => {
    return getAggregatedMetrics(input?.hours || 24);
  }),
  // Save metrics snapshot (for internal use)
  saveSnapshot: publicProcedure.input(z7.object({
    source: z7.enum(["docker", "kubernetes", "system"]).default("system"),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).default("cluster"),
    resourceId: z7.string().optional(),
    cpuPercent: z7.number().min(0).max(100),
    memoryPercent: z7.number().min(0).max(100),
    memoryUsedMb: z7.number().optional(),
    memoryTotalMb: z7.number().optional(),
    networkRxBytes: z7.number().optional(),
    networkTxBytes: z7.number().optional(),
    diskUsedGb: z7.number().optional(),
    diskTotalGb: z7.number().optional()
  })).mutation(async ({ input }) => {
    const id = await saveMetricsSnapshot(input);
    return { success: id !== null, id };
  }),
  // Cleanup old metrics
  cleanup: publicProcedure.input(z7.object({
    retentionDays: z7.number().min(1).max(365).default(30)
  }).optional()).mutation(async ({ input }) => {
    const deleted = await cleanupOldMetrics(input?.retentionDays || 30);
    return { success: true, deletedCount: deleted };
  })
});
var alertThresholdsRouter = router({
  // Get all thresholds
  list: publicProcedure.input(z7.object({
    metricType: z7.enum(["cpu", "memory", "disk", "network"]).optional(),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).optional(),
    enabledOnly: z7.boolean().optional()
  }).optional()).query(async ({ input }) => {
    return getAlertThresholds(input);
  }),
  // Create or update threshold
  upsert: publicProcedure.input(z7.object({
    id: z7.number().optional(),
    name: z7.string().min(1).max(255),
    metricType: z7.enum(["cpu", "memory", "disk", "network"]),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).default("cluster"),
    resourcePattern: z7.string().optional(),
    warningThreshold: z7.number().min(0).max(100),
    criticalThreshold: z7.number().min(0).max(100),
    isEnabled: z7.boolean().default(true),
    cooldownMinutes: z7.number().min(1).max(1440).default(5)
  })).mutation(async ({ input }) => {
    if (input.criticalThreshold <= input.warningThreshold) {
      return { success: false, error: "Critical threshold must be greater than warning threshold" };
    }
    const id = await upsertAlertThreshold(input);
    return { success: id !== null, id };
  }),
  // Toggle threshold enabled/disabled
  toggle: publicProcedure.input(z7.object({
    id: z7.number(),
    isEnabled: z7.boolean()
  })).mutation(async ({ input }) => {
    const success = await toggleAlertThreshold(input.id, input.isEnabled);
    return { success };
  }),
  // Delete threshold
  delete: publicProcedure.input(z7.object({
    id: z7.number()
  })).mutation(async ({ input }) => {
    const success = await deleteAlertThreshold(input.id);
    return { success };
  })
});
var alertHistoryRouter = router({
  // Get alert history
  list: publicProcedure.input(z7.object({
    severity: z7.enum(["warning", "critical"]).optional(),
    metricType: z7.enum(["cpu", "memory", "disk", "network"]).optional(),
    acknowledgedOnly: z7.boolean().optional(),
    unacknowledgedOnly: z7.boolean().optional(),
    hours: z7.number().min(1).max(168).optional(),
    limit: z7.number().min(1).max(500).default(100)
  }).optional()).query(async ({ input }) => {
    const startTime = input?.hours ? new Date(Date.now() - input.hours * 60 * 60 * 1e3) : void 0;
    return getAlertHistory({
      severity: input?.severity,
      metricType: input?.metricType,
      acknowledgedOnly: input?.acknowledgedOnly,
      unacknowledgedOnly: input?.unacknowledgedOnly,
      startTime,
      limit: input?.limit
    });
  }),
  // Acknowledge an alert
  acknowledge: publicProcedure.input(z7.object({
    alertId: z7.number()
  })).mutation(async ({ input }) => {
    const success = await acknowledgeAlert(input.alertId);
    return { success };
  }),
  // Get unacknowledged count
  getUnacknowledgedCount: publicProcedure.query(async () => {
    const count = await getUnacknowledgedAlertCount();
    return { count };
  }),
  // Check threshold and create alert if needed
  checkAndAlert: publicProcedure.input(z7.object({
    thresholdId: z7.number(),
    currentValue: z7.number(),
    resourceId: z7.string().optional()
  })).mutation(async ({ input }) => {
    const inCooldown = await isThresholdInCooldown(input.thresholdId);
    if (inCooldown) {
      return { success: false, reason: "Threshold in cooldown" };
    }
    const thresholds = await getAlertThresholds();
    const threshold = thresholds.find((t2) => t2.id === input.thresholdId);
    if (!threshold || !threshold.isEnabled) {
      return { success: false, reason: "Threshold not found or disabled" };
    }
    let severity = null;
    if (input.currentValue >= threshold.criticalThreshold) {
      severity = "critical";
    } else if (input.currentValue >= threshold.warningThreshold) {
      severity = "warning";
    }
    if (!severity) {
      return { success: false, reason: "Value below thresholds" };
    }
    const alertId = await recordAlert({
      thresholdId: input.thresholdId,
      severity,
      metricType: threshold.metricType,
      resourceType: threshold.resourceType,
      resourceId: input.resourceId,
      currentValue: input.currentValue,
      thresholdValue: severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold,
      message: `${threshold.name}: ${input.currentValue}% (${severity} threshold: ${severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold}%)`
    });
    return {
      success: alertId !== null,
      alertId,
      severity,
      message: `${threshold.name}: ${input.currentValue}%`
    };
  })
});

// server/routers/autoscaling.ts
import { z as z8 } from "zod";

// server/infrastructure/ai-autoscaler.ts
async function analyzeMetricsForScaling(context) {
  const basicAnalysis = performBasicAnalysis(context);
  if (context.metricsHistory.length >= 10) {
    try {
      const aiAnalysis = await performAIAnalysis(context, basicAnalysis);
      return aiAnalysis;
    } catch (error) {
      console.error("[AI-Autoscaler] AI analysis failed, using basic analysis:", error);
      return basicAnalysis;
    }
  }
  return basicAnalysis;
}
function performBasicAnalysis(context) {
  const { currentMetricValue, scaleUpThreshold, scaleDownThreshold, currentReplicas, minReplicas, maxReplicas } = context;
  if (context.lastScaledAt) {
    const timeSinceLastScale = (Date.now() - context.lastScaledAt.getTime()) / 1e3;
    if (timeSinceLastScale < context.cooldownSeconds) {
      return {
        shouldScale: false,
        direction: "none",
        confidence: 100,
        recommendedReplicas: currentReplicas,
        reasoning: `Cooldown active. ${Math.ceil(context.cooldownSeconds - timeSinceLastScale)} seconds remaining.`,
        pattern: null,
        predictedLoad: null,
        timeToThreshold: null
      };
    }
  }
  if (currentMetricValue >= scaleUpThreshold && currentReplicas < maxReplicas) {
    return {
      shouldScale: true,
      direction: "up",
      confidence: 85,
      recommendedReplicas: Math.min(currentReplicas + 1, maxReplicas),
      reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) exceeds scale-up threshold (${scaleUpThreshold}%).`,
      pattern: "threshold_breach",
      predictedLoad: null,
      timeToThreshold: null
    };
  }
  if (currentMetricValue <= scaleDownThreshold && currentReplicas > minReplicas) {
    return {
      shouldScale: true,
      direction: "down",
      confidence: 80,
      recommendedReplicas: Math.max(currentReplicas - 1, minReplicas),
      reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) is below scale-down threshold (${scaleDownThreshold}%).`,
      pattern: "low_utilization",
      predictedLoad: null,
      timeToThreshold: null
    };
  }
  return {
    shouldScale: false,
    direction: "none",
    confidence: 90,
    recommendedReplicas: currentReplicas,
    reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) is within acceptable range (${scaleDownThreshold}%-${scaleUpThreshold}%).`,
    pattern: null,
    predictedLoad: null,
    timeToThreshold: null
  };
}
async function performAIAnalysis(context, basicAnalysis) {
  const recentMetrics = context.metricsHistory.slice(-30);
  const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
  const maxValue = Math.max(...recentMetrics.map((m) => m.value));
  const minValue = Math.min(...recentMetrics.map((m) => m.value));
  const trend = calculateTrend(recentMetrics);
  const prompt = `You are an AI DevOps assistant analyzing resource metrics for auto-scaling decisions.

CONTEXT:
- Resource: ${context.resourceName} (${context.resourceType})
- Namespace: ${context.namespace || "default"}
- Current replicas: ${context.currentReplicas}
- Min/Max replicas: ${context.minReplicas}/${context.maxReplicas}
- Metric type: ${context.metricType}
- Current value: ${context.currentMetricValue}%
- Scale-up threshold: ${context.scaleUpThreshold}%
- Scale-down threshold: ${context.scaleDownThreshold}%

METRICS HISTORY (last ${recentMetrics.length} data points):
- Average: ${avgValue.toFixed(1)}%
- Max: ${maxValue.toFixed(1)}%
- Min: ${minValue.toFixed(1)}%
- Trend: ${trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable"} (${(trend * 100).toFixed(2)}% per interval)

BASIC ANALYSIS RESULT:
${basicAnalysis.reasoning}

Analyze the metrics and provide a scaling recommendation. Consider:
1. Is there a pattern (daily cycle, gradual increase, spikes)?
2. Should we scale proactively before hitting thresholds?
3. What's the optimal number of replicas?
4. How confident are you in this recommendation?

Respond in JSON format:
{
  "shouldScale": boolean,
  "direction": "up" | "down" | "none",
  "confidence": number (0-100),
  "recommendedReplicas": number,
  "reasoning": "brief explanation",
  "pattern": "detected pattern or null",
  "predictedLoad": number or null (predicted metric value in 15 min),
  "timeToThreshold": number or null (minutes until threshold breach)
}`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert DevOps AI that analyzes metrics and makes intelligent auto-scaling decisions. Always respond with valid JSON." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scaling_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            shouldScale: { type: "boolean" },
            direction: { type: "string", enum: ["up", "down", "none"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            recommendedReplicas: { type: "integer", minimum: 0 },
            reasoning: { type: "string" },
            pattern: { type: ["string", "null"] },
            predictedLoad: { type: ["integer", "null"] },
            timeToThreshold: { type: ["integer", "null"] }
          },
          required: ["shouldScale", "direction", "confidence", "recommendedReplicas", "reasoning", "pattern", "predictedLoad", "timeToThreshold"],
          additionalProperties: false
        }
      }
    }
  });
  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty or invalid AI response");
  }
  const aiResult = JSON.parse(content);
  aiResult.recommendedReplicas = Math.max(
    context.minReplicas,
    Math.min(context.maxReplicas, aiResult.recommendedReplicas)
  );
  aiResult.confidence = Math.max(0, Math.min(100, aiResult.confidence));
  return aiResult;
}
function calculateTrend(metrics) {
  if (metrics.length < 2) return 0;
  const n = metrics.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += metrics[i].value;
    sumXY += i * metrics[i].value;
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}
async function predictFutureLoad(metricsHistory3, hoursAhead = 1) {
  if (metricsHistory3.length < 24) {
    const avgValue = metricsHistory3.reduce((sum, m) => sum + m.value, 0) / metricsHistory3.length;
    return {
      predictedValue: Math.round(avgValue),
      confidence: 30,
      pattern: "insufficient_data"
    };
  }
  const hourlyAverages = [];
  const pointsPerHour = Math.floor(metricsHistory3.length / 24);
  for (let i = 0; i < 24; i++) {
    const start = i * pointsPerHour;
    const end = start + pointsPerHour;
    const hourData = metricsHistory3.slice(start, end);
    if (hourData.length > 0) {
      hourlyAverages.push(hourData.reduce((sum, m) => sum + m.value, 0) / hourData.length);
    }
  }
  const currentHour = (/* @__PURE__ */ new Date()).getHours();
  const targetHour = (currentHour + hoursAhead) % 24;
  const trend = calculateTrend(metricsHistory3.slice(-12));
  const baseValue = hourlyAverages[targetHour] || metricsHistory3[metricsHistory3.length - 1].value;
  const predictedValue = Math.round(baseValue + trend * hoursAhead * 12);
  let pattern = "stable";
  const variance = calculateVariance(hourlyAverages);
  if (variance > 200) {
    pattern = "high_variance";
  } else if (trend > 1) {
    pattern = "increasing";
  } else if (trend < -1) {
    pattern = "decreasing";
  } else if (hourlyAverages.some((v, i) => Math.abs(v - hourlyAverages[(i + 12) % 24]) < 5)) {
    pattern = "daily_cycle";
  }
  return {
    predictedValue: Math.max(0, Math.min(100, predictedValue)),
    confidence: Math.min(85, 50 + metricsHistory3.length / 10),
    pattern
  };
}
function calculateVariance(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

// server/routers/autoscaling.ts
var autoscalingRouter = router({
  // Get all autoscaling rules
  getRules: publicProcedure.input(z8.object({
    applicationId: z8.number().optional(),
    resourceType: z8.enum(["deployment", "container", "pod", "service"]).optional(),
    enabledOnly: z8.boolean().optional()
  }).optional()).query(async ({ input }) => {
    return await getAutoscalingRules(input);
  }),
  // Get single rule by ID
  getRule: publicProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
    return await getAutoscalingRuleById(input.id);
  }),
  // Create new autoscaling rule
  createRule: publicProcedure.input(z8.object({
    name: z8.string().min(1).max(255),
    description: z8.string().optional(),
    resourceType: z8.enum(["deployment", "container", "pod", "service"]),
    resourcePattern: z8.string().min(1).max(255),
    namespace: z8.string().optional(),
    metricType: z8.enum(["cpu", "memory", "requests", "custom"]),
    scaleUpThreshold: z8.number().min(1).max(100),
    scaleDownThreshold: z8.number().min(0).max(99),
    minReplicas: z8.number().min(0).max(100).default(1),
    maxReplicas: z8.number().min(1).max(1e3).default(10),
    cooldownSeconds: z8.number().min(60).max(3600).default(300),
    scaleUpStep: z8.number().min(1).max(10).default(1),
    scaleDownStep: z8.number().min(1).max(10).default(1),
    requiresApproval: z8.boolean().default(false),
    aiAssisted: z8.boolean().default(true),
    applicationId: z8.number().optional()
  })).mutation(async ({ input }) => {
    const id = await createAutoscalingRule({
      ...input,
      isEnabled: true
    });
    return { success: !!id, id };
  }),
  // Update autoscaling rule
  updateRule: publicProcedure.input(z8.object({
    id: z8.number(),
    name: z8.string().min(1).max(255).optional(),
    description: z8.string().optional(),
    scaleUpThreshold: z8.number().min(1).max(100).optional(),
    scaleDownThreshold: z8.number().min(0).max(99).optional(),
    minReplicas: z8.number().min(0).max(100).optional(),
    maxReplicas: z8.number().min(1).max(1e3).optional(),
    cooldownSeconds: z8.number().min(60).max(3600).optional(),
    scaleUpStep: z8.number().min(1).max(10).optional(),
    scaleDownStep: z8.number().min(1).max(10).optional(),
    isEnabled: z8.boolean().optional(),
    requiresApproval: z8.boolean().optional(),
    aiAssisted: z8.boolean().optional()
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    const success = await updateAutoscalingRule(id, updates);
    return { success };
  }),
  // Delete autoscaling rule
  deleteRule: publicProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ input }) => {
    const success = await deleteAutoscalingRule(input.id);
    return { success };
  }),
  // Toggle rule enabled/disabled
  toggleRule: publicProcedure.input(z8.object({ id: z8.number(), enabled: z8.boolean() })).mutation(async ({ input }) => {
    const success = await updateAutoscalingRule(input.id, { isEnabled: input.enabled });
    return { success };
  }),
  // Get scaling history
  getHistory: publicProcedure.input(z8.object({
    ruleId: z8.number().optional(),
    applicationId: z8.number().optional(),
    status: z8.enum(["pending", "executing", "completed", "failed", "cancelled"]).optional(),
    limit: z8.number().min(1).max(500).default(100)
  }).optional()).query(async ({ input }) => {
    return await getAutoscalingHistory(input);
  }),
  // Get pending approval actions
  getPendingApprovals: publicProcedure.query(async () => {
    return await getPendingApprovalActions();
  }),
  // Approve or reject a pending scaling action
  handleApproval: publicProcedure.input(z8.object({
    actionId: z8.number(),
    approved: z8.boolean(),
    userId: z8.number().optional()
  })).mutation(async ({ input }) => {
    if (input.approved) {
      await updateAutoscalingActionStatus(input.actionId, "executing");
      await updateAutoscalingActionStatus(input.actionId, "completed");
    } else {
      await updateAutoscalingActionStatus(input.actionId, "cancelled", "Rejected by user");
    }
    return { success: true };
  }),
  // Analyze metrics and get AI recommendation
  analyzeForScaling: publicProcedure.input(z8.object({
    ruleId: z8.number(),
    currentMetricValue: z8.number(),
    currentReplicas: z8.number()
  })).mutation(async ({ input }) => {
    const rule = await getAutoscalingRuleById(input.ruleId);
    if (!rule) {
      return { error: "Rule not found" };
    }
    const inCooldown = await isRuleInCooldown(input.ruleId);
    if (inCooldown) {
      return {
        shouldScale: false,
        direction: "none",
        confidence: 100,
        reasoning: "Rule is in cooldown period",
        inCooldown: true
      };
    }
    const metricsHistoryData = await getMetricsHistory({
      resourceType: rule.resourceType === "deployment" ? "pod" : "container",
      limit: 100
    });
    const metricsHistory3 = metricsHistoryData.map((m) => ({
      timestamp: m.timestamp.getTime(),
      value: rule.metricType === "cpu" ? m.cpuPercent : m.memoryPercent
    }));
    const context = {
      resourceName: rule.resourcePattern,
      resourceType: rule.resourceType,
      namespace: rule.namespace || void 0,
      currentReplicas: input.currentReplicas,
      minReplicas: rule.minReplicas,
      maxReplicas: rule.maxReplicas,
      scaleUpThreshold: rule.scaleUpThreshold,
      scaleDownThreshold: rule.scaleDownThreshold,
      currentMetricValue: input.currentMetricValue,
      metricType: rule.metricType,
      metricsHistory: metricsHistory3,
      lastScaledAt: rule.lastScaledAt || void 0,
      cooldownSeconds: rule.cooldownSeconds
    };
    const analysis = await analyzeMetricsForScaling(context);
    if (rule.aiAssisted && analysis.predictedLoad !== null) {
      await saveAiScalingPrediction({
        ruleId: rule.id,
        applicationId: rule.applicationId || void 0,
        predictedMetricValue: analysis.predictedLoad,
        predictedTime: new Date(Date.now() + 15 * 60 * 1e3),
        // 15 min ahead
        recommendedReplicas: analysis.recommendedReplicas,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        dataPointsAnalyzed: metricsHistory3.length,
        patternDetected: analysis.pattern || void 0
      });
    }
    return analysis;
  }),
  // Execute scaling action
  executeScaling: publicProcedure.input(z8.object({
    ruleId: z8.number(),
    direction: z8.enum(["up", "down"]),
    targetReplicas: z8.number(),
    currentReplicas: z8.number(),
    triggerValue: z8.number(),
    aiAnalysis: z8.string().optional(),
    aiConfidence: z8.number().optional()
  })).mutation(async ({ input }) => {
    const rule = await getAutoscalingRuleById(input.ruleId);
    if (!rule) {
      return { success: false, error: "Rule not found" };
    }
    const inCooldown = await isRuleInCooldown(input.ruleId);
    if (inCooldown) {
      return { success: false, error: "Rule is in cooldown" };
    }
    const actionId = await recordAutoscalingAction({
      ruleId: rule.id,
      applicationId: rule.applicationId || void 0,
      action: rule.requiresApproval ? "pending_approval" : input.direction === "up" ? "scale_up" : "scale_down",
      previousReplicas: input.currentReplicas,
      newReplicas: input.targetReplicas,
      triggerMetric: rule.metricType,
      triggerValue: input.triggerValue,
      thresholdValue: input.direction === "up" ? rule.scaleUpThreshold : rule.scaleDownThreshold,
      aiAnalysis: input.aiAnalysis || void 0,
      aiConfidence: input.aiConfidence || void 0,
      executedBy: "ai",
      status: rule.requiresApproval ? "pending" : "executing"
    });
    if (!actionId) {
      return { success: false, error: "Failed to record action" };
    }
    if (rule.requiresApproval) {
      return {
        success: true,
        requiresApproval: true,
        actionId,
        message: "Scaling action pending approval"
      };
    }
    try {
      const startTime = Date.now();
      if (rule.resourceType === "deployment") {
        await scaleDeployment(
          rule.resourcePattern,
          rule.namespace || "default",
          input.targetReplicas
        );
      } else if (rule.resourceType === "container") {
        console.log(`[AutoScaler] Would scale container ${rule.resourcePattern} to ${input.targetReplicas}`);
      }
      const executionTime = Date.now() - startTime;
      await updateAutoscalingActionStatus(actionId, "completed");
      await updateRuleLastScaled(rule.id);
      return {
        success: true,
        actionId,
        executionTimeMs: executionTime,
        message: `Scaled ${rule.resourcePattern} from ${input.currentReplicas} to ${input.targetReplicas} replicas`
      };
    } catch (error) {
      await updateAutoscalingActionStatus(
        actionId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
      return {
        success: false,
        actionId,
        error: error instanceof Error ? error.message : "Scaling failed"
      };
    }
  }),
  // Get AI predictions for a rule
  getPredictions: publicProcedure.input(z8.object({
    ruleId: z8.number(),
    limit: z8.number().min(1).max(50).default(10)
  })).query(async ({ input }) => {
    return await getAiPredictions(input.ruleId, input.limit);
  }),
  // Predict future load
  predictLoad: publicProcedure.input(z8.object({
    hoursAhead: z8.number().min(1).max(24).default(1)
  })).mutation(async ({ input }) => {
    const metricsHistoryData = await getMetricsHistory({
      limit: 288
      // 24 hours at 5-min intervals
    });
    const metricsHistory3 = metricsHistoryData.map((m) => ({
      timestamp: m.timestamp.getTime(),
      value: m.cpuPercent
    }));
    return await predictFutureLoad(metricsHistory3, input.hoursAhead);
  }),
  // Get scaling summary/dashboard data
  getSummary: publicProcedure.query(async () => {
    const rules = await getAutoscalingRules();
    const history = await getAutoscalingHistory({ limit: 50 });
    const pendingApprovals = await getPendingApprovalActions();
    const enabledRules = rules.filter((r) => r.isEnabled).length;
    const totalScalingActions = history.length;
    const successfulActions = history.filter((h) => h.status === "completed").length;
    const failedActions = history.filter((h) => h.status === "failed").length;
    const last24h = history.filter((h) => {
      const createdAt = h.createdAt.getTime();
      return Date.now() - createdAt < 24 * 60 * 60 * 1e3;
    });
    const scaleUpCount = last24h.filter((h) => h.action === "scale_up").length;
    const scaleDownCount = last24h.filter((h) => h.action === "scale_down").length;
    return {
      totalRules: rules.length,
      enabledRules,
      pendingApprovals: pendingApprovals.length,
      last24h: {
        total: last24h.length,
        scaleUp: scaleUpCount,
        scaleDown: scaleDownCount,
        successful: last24h.filter((h) => h.status === "completed").length,
        failed: last24h.filter((h) => h.status === "failed").length
      },
      allTime: {
        total: totalScalingActions,
        successful: successfulActions,
        failed: failedActions,
        successRate: totalScalingActions > 0 ? Math.round(successfulActions / totalScalingActions * 100) : 100
      }
    };
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  docker: dockerRouter,
  kubernetes: kubernetesRouter,
  ai: aiRouter,
  connections: connectionsRouter,
  notifications: notificationsRouter,
  metrics: metricsRouter,
  alertThresholds: alertThresholdsRouter,
  alertHistory: alertHistoryRouter,
  autoscaling: autoscalingRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/rateLimit.ts
import rateLimit from "express-rate-limit";
var rateLimitMessage = {
  error: "Too many requests",
  message: "You have exceeded the rate limit. Please try again later.",
  retryAfter: "See Retry-After header for wait time in seconds"
};
var skip = (req) => {
  if (req.path === "/health" || req.path === "/api/health") {
    return true;
  }
  return false;
};
var commonOptions = {
  standardHeaders: true,
  // Return rate limit info in headers
  legacyHeaders: false,
  // Disable X-RateLimit-* headers
  // Use default keyGenerator which properly handles IPv6
  // keyGenerator is intentionally omitted to use express-rate-limit's default
  validate: { xForwardedForHeader: false }
  // Disable validation warning
};
var generalLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 100,
  // 100 requests per window
  message: rateLimitMessage,
  skip,
  handler: (req, res) => {
    console.warn(`[RateLimit] General limit exceeded for ${req.ip}`);
    res.status(429).json(rateLimitMessage);
  }
});
var authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // 10 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many authentication attempts. Please try again later."
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] Auth limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many authentication attempts. Please try again later."
    });
  }
});
var mutationLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 50,
  // 50 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many write operations. Please slow down."
  },
  skip,
  handler: (req, res) => {
    console.warn(`[RateLimit] Mutation limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many write operations. Please slow down."
    });
  }
});
var aiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 30,
  // 30 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many AI requests. Please wait before sending more messages."
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] AI limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many AI requests. Please wait before sending more messages."
    });
  }
});
var infrastructureLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 20,
  // 20 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many infrastructure operations. Please wait before executing more commands."
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] Infrastructure limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many infrastructure operations. Please wait before executing more commands."
    });
  }
});
var burstLimiter = rateLimit({
  ...commonOptions,
  windowMs: 1e3,
  // 1 second
  max: 10,
  // 10 requests per second
  message: {
    ...rateLimitMessage,
    message: "Request rate too high. Please slow down."
  },
  skip,
  handler: (req, res) => {
    console.warn(`[RateLimit] Burst limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Request rate too high. Please slow down."
    });
  }
});

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  initializeWebSocket(server);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api", burstLimiter);
  app.use("/api", generalLimiter);
  app.use("/api/oauth", authLimiter);
  app.use("/api/trpc/ai", aiLimiter);
  app.use("/api/trpc/docker", infrastructureLimiter);
  app.use("/api/trpc/kubernetes", infrastructureLimiter);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WebSocket server initialized on same port`);
    console.log(`Rate limiting enabled: General (100/15min), Auth (10/15min), AI (30/15min), Infrastructure (20/15min)`);
  });
}
startServer().catch(console.error);
