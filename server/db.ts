import { eq, and, desc, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, chatMessages, chatSessions, InsertChatMessage, InsertChatSession, metricsHistory, alertThresholds, alertHistory, InsertMetricsHistory, InsertAlertThreshold, InsertAlertHistory } from "../drizzle/schema";
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
