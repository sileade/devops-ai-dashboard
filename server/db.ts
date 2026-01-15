import { eq, and, desc, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, chatMessages, chatSessions, InsertChatMessage, InsertChatSession, metricsHistory, alertThresholds, alertHistory, InsertMetricsHistory, InsertAlertThreshold, InsertAlertHistory, autoscalingRules, autoscalingHistory, aiScalingPredictions, InsertAutoscalingRule, InsertAutoscalingHistory, InsertAiScalingPrediction, scheduledScaling, scheduledScalingHistory, abTestExperiments, abTestMetrics, InsertScheduledScaling, InsertScheduledScalingHistory, InsertAbTestExperiment, InsertAbTestMetric } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// Chat History Functions
// ============================================

// Get or create a chat session for a user
export async function getOrCreateChatSession(userOpenId: string | null, sessionId?: string): Promise<{ sessionId: string; conversationId: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) {
    // Return a temporary session ID if DB is not available
    const tempSessionId = sessionId || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return { sessionId: tempSessionId, conversationId: 0, isNew: true };
  }

  try {
    // If sessionId provided, try to find it
    if (sessionId) {
      const existing = await db.select().from(chatSessions)
        .where(eq(chatSessions.sessionId, sessionId))
        .limit(1);
      
      if (existing.length > 0) {
        return { sessionId: existing[0].sessionId, conversationId: existing[0].id, isNew: false };
      }
    }

    // Find active session for user
    if (userOpenId) {
      const activeSession = await db.select().from(chatSessions)
        .where(and(
          eq(chatSessions.userOpenId, userOpenId),
          eq(chatSessions.isActive, true)
        ))
        .orderBy(desc(chatSessions.updatedAt))
        .limit(1);

      if (activeSession.length > 0) {
        return { sessionId: activeSession[0].sessionId, conversationId: activeSession[0].id, isNew: false };
      }
    }

    // Create new session
    const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId: userOpenId,
      title: "New Chat",
      isActive: true,
    });

    return { sessionId: newSessionId, conversationId: result[0].insertId, isNew: true };
  } catch (error) {
    console.error("[Database] Failed to get/create chat session:", error);
    const fallbackId = `fallback-${Date.now()}`;
    return { sessionId: fallbackId, conversationId: 0, isNew: true };
  }
}

// Save a chat message
export async function saveChatMessage(message: {
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: string[];
  commands?: { command: string; description: string }[];
}): Promise<number | null> {
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
      commands: message.commands,
    });
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save chat message:", error);
    return null;
  }
}

// Get chat history for a session by conversationId
export async function getChatHistory(conversationId: number, limit: number = 100): Promise<typeof chatMessages.$inferSelect[]> {
  const db = await getDb();
  if (!db || conversationId === 0) {
    console.warn("[Database] Cannot get chat history: database not available or invalid conversationId");
    return [];
  }

  try {
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);

    return messages;
  } catch (error) {
    console.error("[Database] Failed to get chat history:", error);
    return [];
  }
}

// Get chat history by sessionId (string)
export async function getChatHistoryBySessionId(sessionId: string, limit: number = 100): Promise<typeof chatMessages.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    // First find the session
    const session = await db.select().from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (session.length === 0) {
      return [];
    }

    return getChatHistory(session[0].id, limit);
  } catch (error) {
    console.error("[Database] Failed to get chat history by sessionId:", error);
    return [];
  }
}

// Get all chat sessions for a user
export async function getUserChatSessions(userOpenId: string): Promise<typeof chatSessions.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get chat sessions: database not available");
    return [];
  }

  try {
    const sessions = await db.select().from(chatSessions)
      .where(eq(chatSessions.userOpenId, userOpenId))
      .orderBy(desc(chatSessions.updatedAt));

    return sessions;
  } catch (error) {
    console.error("[Database] Failed to get chat sessions:", error);
    return [];
  }
}

// Update message feedback
export async function updateMessageFeedback(messageId: number, feedback: "positive" | "negative"): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update feedback: database not available");
    return false;
  }

  try {
    await db.update(chatMessages)
      .set({ feedback })
      .where(eq(chatMessages.id, messageId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update feedback:", error);
    return false;
  }
}

// Clear chat history for a session
export async function clearChatHistory(sessionId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot clear chat history: database not available");
    return false;
  }

  try {
    // Find the session first
    const session = await db.select().from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (session.length > 0) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, session[0].id));
    }
    return true;
  } catch (error) {
    console.error("[Database] Failed to clear chat history:", error);
    return false;
  }
}

// Create a new chat session
export async function createNewChatSession(userOpenId: string | null): Promise<{ sessionId: string; conversationId: number }> {
  const db = await getDb();
  const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  if (!db) {
    return { sessionId: newSessionId, conversationId: 0 };
  }

  try {
    // Deactivate previous sessions
    if (userOpenId) {
      await db.update(chatSessions)
        .set({ isActive: false })
        .where(eq(chatSessions.userOpenId, userOpenId));
    }

    // Create new session
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId: userOpenId,
      title: "New Chat",
      isActive: true,
    });

    return { sessionId: newSessionId, conversationId: result[0].insertId };
  } catch (error) {
    console.error("[Database] Failed to create chat session:", error);
    return { sessionId: newSessionId, conversationId: 0 };
  }
}

// Update session title based on first message
export async function updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) + "..." : title;
    await db.update(chatSessions)
      .set({ title: truncatedTitle })
      .where(eq(chatSessions.sessionId, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update session title:", error);
    return false;
  }
}

// Search chat messages by content
export async function searchChatMessages(
  userOpenId: string | null,
  query: string,
  options?: {
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<{
  id: number;
  sessionId: string;
  sessionTitle: string | null;
  role: string;
  content: string;
  createdAt: Date;
}[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search messages: database not available");
    return [];
  }

  try {
    const limit = options?.limit || 50;
    
    // Build conditions
    const conditions = [like(chatMessages.content, `%${query}%`)];
    
    if (options?.sessionId) {
      const session = await db.select().from(chatSessions)
        .where(eq(chatSessions.sessionId, options.sessionId))
        .limit(1);
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

    // Join with sessions to filter by user and get session info
    const results = await db
      .select({
        id: chatMessages.id,
        sessionId: chatSessions.sessionId,
        sessionTitle: chatSessions.title,
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.conversationId, chatSessions.id))
      .where(and(
        userOpenId ? eq(chatSessions.userOpenId, userOpenId) : undefined,
        ...conditions
      ))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return results;
  } catch (error) {
    console.error("[Database] Failed to search messages:", error);
    return [];
  }
}

// Export chat history for a session
export async function exportChatHistory(
  sessionId: string,
  format: "json" | "markdown" = "json"
): Promise<string> {
  const db = await getDb();
  if (!db) {
    return format === "json" ? "[]" : "# No data available";
  }

  try {
    // Get session info
    const session = await db.select().from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (session.length === 0) {
      return format === "json" ? "[]" : "# Session not found";
    }

    // Get all messages
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, session[0].id))
      .orderBy(chatMessages.createdAt);

    if (format === "json") {
      return JSON.stringify({
        session: {
          id: session[0].sessionId,
          title: session[0].title,
          createdAt: session[0].createdAt,
        },
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          feedback: m.feedback,
        })),
      }, null, 2);
    } else {
      // Markdown format
      let md = `# ${session[0].title || "Chat Export"}\n\n`;
      md += `**Session ID:** ${session[0].sessionId}\n`;
      md += `**Created:** ${session[0].createdAt?.toISOString()}\n\n`;
      md += `---\n\n`;

      for (const msg of messages) {
        const role = msg.role === "user" ? "👤 User" : "🤖 Assistant";
        const timestamp = msg.createdAt?.toLocaleString() || "";
        md += `### ${role}\n`;
        md += `*${timestamp}*\n\n`;
        md += `${msg.content}\n\n`;
        if (msg.feedback) {
          md += `*Feedback: ${msg.feedback}*\n\n`;
        }
        md += `---\n\n`;
      }

      return md;
    }
  } catch (error) {
    console.error("[Database] Failed to export chat history:", error);
    return format === "json" ? "[]" : "# Export failed";
  }
}


// ============================================
// METRICS HISTORY FUNCTIONS
// ============================================

// Save a metrics snapshot
export async function saveMetricsSnapshot(metrics: InsertMetricsHistory): Promise<number | null> {
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

// Get metrics history with time range
export async function getMetricsHistory(options: {
  source?: "docker" | "kubernetes" | "system";
  resourceType?: "container" | "pod" | "node" | "cluster";
  resourceId?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}): Promise<typeof metricsHistory.$inferSelect[]> {
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
      return await query
        .where(and(...conditions))
        .orderBy(desc(metricsHistory.timestamp))
        .limit(options.limit || 1000);
    }
    
    return await query
      .orderBy(desc(metricsHistory.timestamp))
      .limit(options.limit || 1000);
  } catch (error) {
    console.error("[Database] Failed to get metrics history:", error);
    return [];
  }
}

// Get aggregated metrics for a time period
export async function getAggregatedMetrics(hours: number = 24): Promise<{
  avgCpu: number;
  avgMemory: number;
  maxCpu: number;
  maxMemory: number;
  dataPoints: number;
}> {
  const db = await getDb();
  if (!db) {
    return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
  }

  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const results = await db.select().from(metricsHistory)
      .where(gte(metricsHistory.timestamp, startTime))
      .orderBy(desc(metricsHistory.timestamp));

    if (results.length === 0) {
      return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
    }

    const totalCpu = results.reduce((sum, r) => sum + r.cpuPercent, 0);
    const totalMemory = results.reduce((sum, r) => sum + r.memoryPercent, 0);
    const maxCpu = Math.max(...results.map(r => r.cpuPercent));
    const maxMemory = Math.max(...results.map(r => r.memoryPercent));

    return {
      avgCpu: Math.round(totalCpu / results.length),
      avgMemory: Math.round(totalMemory / results.length),
      maxCpu,
      maxMemory,
      dataPoints: results.length,
    };
  } catch (error) {
    console.error("[Database] Failed to get aggregated metrics:", error);
    return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
  }
}

// Clean up old metrics (data retention)
export async function cleanupOldMetrics(retentionDays: number = 30): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(metricsHistory)
      .where(lte(metricsHistory.timestamp, cutoffDate));
    
    return result[0].affectedRows || 0;
  } catch (error) {
    console.error("[Database] Failed to cleanup old metrics:", error);
    return 0;
  }
}

// ============================================
// ALERT THRESHOLDS FUNCTIONS
// ============================================

// Get all alert thresholds
export async function getAlertThresholds(options?: {
  metricType?: "cpu" | "memory" | "disk" | "network";
  resourceType?: "container" | "pod" | "node" | "cluster";
  enabledOnly?: boolean;
}): Promise<typeof alertThresholds.$inferSelect[]> {
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
      return await db.select().from(alertThresholds)
        .where(and(...conditions))
        .orderBy(alertThresholds.name);
    }
    
    return await db.select().from(alertThresholds)
      .orderBy(alertThresholds.name);
  } catch (error) {
    console.error("[Database] Failed to get alert thresholds:", error);
    return [];
  }
}

// Create or update alert threshold
export async function upsertAlertThreshold(threshold: InsertAlertThreshold): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    if (threshold.id) {
      await db.update(alertThresholds)
        .set(threshold)
        .where(eq(alertThresholds.id, threshold.id));
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

// Update threshold enabled status
export async function toggleAlertThreshold(id: number, isEnabled: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(alertThresholds)
      .set({ isEnabled })
      .where(eq(alertThresholds.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to toggle alert threshold:", error);
    return false;
  }
}

// Delete alert threshold
export async function deleteAlertThreshold(id: number): Promise<boolean> {
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

// ============================================
// ALERT HISTORY FUNCTIONS
// ============================================

// Record a triggered alert
export async function recordAlert(alert: InsertAlertHistory): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const result = await db.insert(alertHistory).values(alert);
    
    // Update last triggered time on threshold
    if (alert.thresholdId) {
      await db.update(alertThresholds)
        .set({ lastTriggered: new Date() })
        .where(eq(alertThresholds.id, alert.thresholdId));
    }
    
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record alert:", error);
    return null;
  }
}

// Get alert history
export async function getAlertHistory(options?: {
  severity?: "warning" | "critical";
  metricType?: "cpu" | "memory" | "disk" | "network";
  acknowledgedOnly?: boolean;
  unacknowledgedOnly?: boolean;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}): Promise<typeof alertHistory.$inferSelect[]> {
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
      return await db.select().from(alertHistory)
        .where(and(...conditions))
        .orderBy(desc(alertHistory.createdAt))
        .limit(options?.limit || 100);
    }
    
    return await db.select().from(alertHistory)
      .orderBy(desc(alertHistory.createdAt))
      .limit(options?.limit || 100);
  } catch (error) {
    console.error("[Database] Failed to get alert history:", error);
    return [];
  }
}

// Acknowledge an alert
export async function acknowledgeAlert(alertId: number, userId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(alertHistory)
      .set({
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(alertHistory.id, alertId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to acknowledge alert:", error);
    return false;
  }
}

// Get unacknowledged alert count
export async function getUnacknowledgedAlertCount(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const results = await db.select().from(alertHistory)
      .where(eq(alertHistory.isAcknowledged, false));
    return results.length;
  } catch (error) {
    console.error("[Database] Failed to get unacknowledged alert count:", error);
    return 0;
  }
}

// Check if threshold is in cooldown
export async function isThresholdInCooldown(thresholdId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    const threshold = await db.select().from(alertThresholds)
      .where(eq(alertThresholds.id, thresholdId))
      .limit(1);

    if (threshold.length === 0 || !threshold[0].lastTriggered) {
      return false;
    }

    const cooldownMs = (threshold[0].cooldownMinutes || 5) * 60 * 1000;
    const lastTriggered = new Date(threshold[0].lastTriggered).getTime();
    
    return Date.now() - lastTriggered < cooldownMs;
  } catch (error) {
    console.error("[Database] Failed to check threshold cooldown:", error);
    return false;
  }
}


// ============================================
// AUTOSCALING FUNCTIONS
// ============================================

// Get all autoscaling rules
export async function getAutoscalingRules(options?: {
  applicationId?: number;
  resourceType?: "deployment" | "container" | "pod" | "service";
  enabledOnly?: boolean;
}): Promise<typeof autoscalingRules.$inferSelect[]> {
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
      return await db.select().from(autoscalingRules)
        .where(and(...conditions))
        .orderBy(desc(autoscalingRules.createdAt));
    }
    
    return await db.select().from(autoscalingRules)
      .orderBy(desc(autoscalingRules.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get autoscaling rules:", error);
    return [];
  }
}

// Get autoscaling rule by ID
export async function getAutoscalingRuleById(id: number): Promise<typeof autoscalingRules.$inferSelect | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const results = await db.select().from(autoscalingRules)
      .where(eq(autoscalingRules.id, id))
      .limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get autoscaling rule:", error);
    return null;
  }
}

// Create autoscaling rule
export async function createAutoscalingRule(rule: InsertAutoscalingRule): Promise<number | null> {
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

// Update autoscaling rule
export async function updateAutoscalingRule(
  id: number,
  updates: Partial<InsertAutoscalingRule>
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(autoscalingRules)
      .set(updates)
      .where(eq(autoscalingRules.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update autoscaling rule:", error);
    return false;
  }
}

// Delete autoscaling rule
export async function deleteAutoscalingRule(id: number): Promise<boolean> {
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

// Record autoscaling action
export async function recordAutoscalingAction(action: InsertAutoscalingHistory): Promise<number | null> {
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

// Update autoscaling action status
export async function updateAutoscalingActionStatus(
  id: number,
  status: "pending" | "executing" | "completed" | "failed" | "cancelled",
  errorMessage?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    const updates: Record<string, unknown> = { status };
    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.completedAt = new Date();
    }
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await db.update(autoscalingHistory)
      .set(updates)
      .where(eq(autoscalingHistory.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update autoscaling action:", error);
    return false;
  }
}

// Get autoscaling history
export async function getAutoscalingHistory(options?: {
  ruleId?: number;
  applicationId?: number;
  status?: "pending" | "executing" | "completed" | "failed" | "cancelled";
  limit?: number;
}): Promise<typeof autoscalingHistory.$inferSelect[]> {
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
      return await db.select().from(autoscalingHistory)
        .where(and(...conditions))
        .orderBy(desc(autoscalingHistory.createdAt))
        .limit(options?.limit || 100);
    }
    
    return await db.select().from(autoscalingHistory)
      .orderBy(desc(autoscalingHistory.createdAt))
      .limit(options?.limit || 100);
  } catch (error) {
    console.error("[Database] Failed to get autoscaling history:", error);
    return [];
  }
}

// Get pending approval actions
export async function getPendingApprovalActions(): Promise<typeof autoscalingHistory.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    return await db.select().from(autoscalingHistory)
      .where(eq(autoscalingHistory.action, "pending_approval"))
      .orderBy(desc(autoscalingHistory.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get pending approvals:", error);
    return [];
  }
}

// Save AI scaling prediction
export async function saveAiScalingPrediction(prediction: InsertAiScalingPrediction): Promise<number | null> {
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

// Get recent AI predictions for a rule
export async function getAiPredictions(ruleId: number, limit: number = 10): Promise<typeof aiScalingPredictions.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    return await db.select().from(aiScalingPredictions)
      .where(eq(aiScalingPredictions.ruleId, ruleId))
      .orderBy(desc(aiScalingPredictions.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get AI predictions:", error);
    return [];
  }
}

// Check if rule is in cooldown
export async function isRuleInCooldown(ruleId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    const rule = await db.select().from(autoscalingRules)
      .where(eq(autoscalingRules.id, ruleId))
      .limit(1);

    if (rule.length === 0 || !rule[0].lastScaledAt) {
      return false;
    }

    const timeSinceLastScale = (Date.now() - rule[0].lastScaledAt.getTime()) / 1000;
    return timeSinceLastScale < rule[0].cooldownSeconds;
  } catch (error) {
    console.error("[Database] Failed to check cooldown:", error);
    return false;
  }
}

// Update rule's last scaled timestamp
export async function updateRuleLastScaled(ruleId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(autoscalingRules)
      .set({ lastScaledAt: new Date() })
      .where(eq(autoscalingRules.id, ruleId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update last scaled:", error);
    return false;
  }
}


// ============================================
// SCHEDULED SCALING FUNCTIONS
// ============================================

// Get all scheduled scaling rules
export async function getScheduledScalingRules(options?: {
  applicationId?: number;
  enabledOnly?: boolean;
}): Promise<typeof scheduledScaling.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const conditions = [];
    
    if (options?.applicationId) {
      conditions.push(eq(scheduledScaling.applicationId, options.applicationId));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(scheduledScaling.isEnabled, true));
    }

    if (conditions.length > 0) {
      return await db.select().from(scheduledScaling)
        .where(and(...conditions))
        .orderBy(desc(scheduledScaling.createdAt));
    }
    
    return await db.select().from(scheduledScaling)
      .orderBy(desc(scheduledScaling.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get scheduled scaling rules:", error);
    return [];
  }
}

// Get scheduled scaling rule by ID
export async function getScheduledScalingById(id: number): Promise<typeof scheduledScaling.$inferSelect | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const results = await db.select().from(scheduledScaling)
      .where(eq(scheduledScaling.id, id))
      .limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get scheduled scaling by ID:", error);
    return null;
  }
}

// Create scheduled scaling rule
export async function createScheduledScaling(rule: InsertScheduledScaling): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const result = await db.insert(scheduledScaling).values(rule);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create scheduled scaling:", error);
    return null;
  }
}

// Update scheduled scaling rule
export async function updateScheduledScaling(id: number, updates: Partial<InsertScheduledScaling>): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(scheduledScaling)
      .set(updates)
      .where(eq(scheduledScaling.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update scheduled scaling:", error);
    return false;
  }
}

// Delete scheduled scaling rule
export async function deleteScheduledScaling(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.delete(scheduledScaling).where(eq(scheduledScaling.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete scheduled scaling:", error);
    return false;
  }
}

// Record scheduled scaling execution
export async function recordScheduledScalingExecution(record: InsertScheduledScalingHistory): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const result = await db.insert(scheduledScalingHistory).values(record);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record scheduled scaling execution:", error);
    return null;
  }
}

// Get scheduled scaling history
export async function getScheduledScalingHistory(scheduleId?: number, limit: number = 50): Promise<typeof scheduledScalingHistory.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    if (scheduleId) {
      return await db.select().from(scheduledScalingHistory)
        .where(eq(scheduledScalingHistory.scheduleId, scheduleId))
        .orderBy(desc(scheduledScalingHistory.createdAt))
        .limit(limit);
    }
    
    return await db.select().from(scheduledScalingHistory)
      .orderBy(desc(scheduledScalingHistory.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get scheduled scaling history:", error);
    return [];
  }
}

// Update schedule execution stats
export async function updateScheduleExecutionStats(id: number, success: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    const schedule = await getScheduledScalingById(id);
    if (!schedule) return false;

    await db.update(scheduledScaling)
      .set({
        lastExecutedAt: new Date(),
        executionCount: schedule.executionCount + 1,
        failureCount: success ? schedule.failureCount : schedule.failureCount + 1,
      })
      .where(eq(scheduledScaling.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update schedule stats:", error);
    return false;
  }
}

// ============================================
// A/B TEST EXPERIMENTS FUNCTIONS
// ============================================

// Get all A/B test experiments
export async function getAbTestExperiments(options?: {
  applicationId?: number;
  status?: "draft" | "running" | "paused" | "completed" | "cancelled";
}): Promise<typeof abTestExperiments.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const conditions = [];
    
    if (options?.applicationId) {
      conditions.push(eq(abTestExperiments.applicationId, options.applicationId));
    }
    if (options?.status) {
      conditions.push(eq(abTestExperiments.status, options.status));
    }

    if (conditions.length > 0) {
      return await db.select().from(abTestExperiments)
        .where(and(...conditions))
        .orderBy(desc(abTestExperiments.createdAt));
    }
    
    return await db.select().from(abTestExperiments)
      .orderBy(desc(abTestExperiments.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get A/B test experiments:", error);
    return [];
  }
}

// Get A/B test experiment by ID
export async function getAbTestExperimentById(id: number): Promise<typeof abTestExperiments.$inferSelect | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const results = await db.select().from(abTestExperiments)
      .where(eq(abTestExperiments.id, id))
      .limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get A/B test by ID:", error);
    return null;
  }
}

// Create A/B test experiment
export async function createAbTestExperiment(experiment: InsertAbTestExperiment): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const result = await db.insert(abTestExperiments).values(experiment);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create A/B test:", error);
    return null;
  }
}

// Update A/B test experiment
export async function updateAbTestExperiment(id: number, updates: Partial<InsertAbTestExperiment>): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(abTestExperiments)
      .set(updates)
      .where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update A/B test:", error);
    return false;
  }
}

// Delete A/B test experiment
export async function deleteAbTestExperiment(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    // Delete metrics first
    await db.delete(abTestMetrics).where(eq(abTestMetrics.experimentId, id));
    // Then delete experiment
    await db.delete(abTestExperiments).where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete A/B test:", error);
    return false;
  }
}

// Record A/B test metrics
export async function recordAbTestMetrics(metrics: InsertAbTestMetric): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const result = await db.insert(abTestMetrics).values(metrics);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record A/B test metrics:", error);
    return null;
  }
}

// Get A/B test metrics
export async function getAbTestMetrics(experimentId: number, variant?: "A" | "B"): Promise<typeof abTestMetrics.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const conditions = [eq(abTestMetrics.experimentId, experimentId)];
    
    if (variant) {
      conditions.push(eq(abTestMetrics.variant, variant));
    }

    return await db.select().from(abTestMetrics)
      .where(and(...conditions))
      .orderBy(desc(abTestMetrics.timestamp));
  } catch (error) {
    console.error("[Database] Failed to get A/B test metrics:", error);
    return [];
  }
}

// Calculate A/B test statistics
export async function calculateAbTestStats(experimentId: number): Promise<{
  variantA: { avgCpu: number; avgMemory: number; avgReplicas: number; totalScaleOps: number; oscillations: number };
  variantB: { avgCpu: number; avgMemory: number; avgReplicas: number; totalScaleOps: number; oscillations: number };
  sampleSize: { A: number; B: number };
  recommendation: "A" | "B" | "inconclusive";
  confidence: number;
}> {
  const db = await getDb();
  const defaultResult = {
    variantA: { avgCpu: 0, avgMemory: 0, avgReplicas: 0, totalScaleOps: 0, oscillations: 0 },
    variantB: { avgCpu: 0, avgMemory: 0, avgReplicas: 0, totalScaleOps: 0, oscillations: 0 },
    sampleSize: { A: 0, B: 0 },
    recommendation: "inconclusive" as const,
    confidence: 0,
  };

  if (!db) {
    return defaultResult;
  }

  try {
    const metricsA = await getAbTestMetrics(experimentId, "A");
    const metricsB = await getAbTestMetrics(experimentId, "B");

    if (metricsA.length === 0 || metricsB.length === 0) {
      return defaultResult;
    }

    const calcStats = (metrics: typeof metricsA) => ({
      avgCpu: Math.round(metrics.reduce((sum, m) => sum + m.avgCpuPercent, 0) / metrics.length),
      avgMemory: Math.round(metrics.reduce((sum, m) => sum + m.avgMemoryPercent, 0) / metrics.length),
      avgReplicas: Math.round(metrics.reduce((sum, m) => sum + m.avgReplicaCount, 0) / metrics.length),
      totalScaleOps: metrics.reduce((sum, m) => sum + m.scaleUpCount + m.scaleDownCount, 0),
      oscillations: metrics.reduce((sum, m) => sum + m.oscillationCount, 0),
    });

    const statsA = calcStats(metricsA);
    const statsB = calcStats(metricsB);

    // Simple scoring: lower oscillations + lower avg replicas = better
    const scoreA = statsA.oscillations * 10 + statsA.avgReplicas;
    const scoreB = statsB.oscillations * 10 + statsB.avgReplicas;

    let recommendation: "A" | "B" | "inconclusive" = "inconclusive";
    let confidence = 0;

    const diff = Math.abs(scoreA - scoreB);
    const minSamples = 10;

    if (metricsA.length >= minSamples && metricsB.length >= minSamples) {
      if (diff > 5) {
        recommendation = scoreA < scoreB ? "A" : "B";
        confidence = Math.min(95, 50 + diff * 5);
      } else if (diff > 2) {
        recommendation = scoreA < scoreB ? "A" : "B";
        confidence = Math.min(70, 40 + diff * 10);
      }
    }

    return {
      variantA: statsA,
      variantB: statsB,
      sampleSize: { A: metricsA.length, B: metricsB.length },
      recommendation,
      confidence,
    };
  } catch (error) {
    console.error("[Database] Failed to calculate A/B test stats:", error);
    return defaultResult;
  }
}

// Start A/B test
export async function startAbTest(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(abTestExperiments)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to start A/B test:", error);
    return false;
  }
}

// Complete A/B test with winner
export async function completeAbTest(id: number, winner: "A" | "B" | "inconclusive", confidence: number, reason: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    await db.update(abTestExperiments)
      .set({
        status: "completed",
        endedAt: new Date(),
        winnerVariant: winner,
        winnerConfidence: confidence,
        winnerReason: reason,
      })
      .where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to complete A/B test:", error);
    return false;
  }
}
