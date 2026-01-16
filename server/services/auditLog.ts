import { getDb } from "../db";
import {
  auditLogs,
  auditLogPolicies,
  auditLogAlerts,
  auditLogSavedQueries,
  userSessions,
  InsertAuditLog,
} from "../../drizzle/schema";
import { eq, and, desc, sql, or, like, gte, lte, inArray, between } from "drizzle-orm";
import { randomBytes } from "crypto";
import { invokeLLM } from "../_core/llm";

// ============================================
// AUDIT LOG CREATION
// ============================================

export type AuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "password_changed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "deploy"
  | "rollback"
  | "scale"
  | "restart"
  | "stop"
  | "start"
  | "team_create"
  | "team_update"
  | "team_delete"
  | "member_invite"
  | "member_remove"
  | "member_role_change"
  | "config_change"
  | "secret_access"
  | "secret_update"
  | "ai_query"
  | "ai_recommendation_applied"
  | "export"
  | "import"
  | "admin_action"
  | "system_config_change";

export interface AuditLogContext {
  userId?: number;
  userEmail?: string;
  userName?: string;
  teamId?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
}

export interface AuditLogData {
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  description: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  status?: "success" | "failure" | "partial";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  duration?: number;
}

// Risk level determination based on action type
function determineRiskLevel(action: AuditAction, data: AuditLogData): "low" | "medium" | "high" | "critical" {
  const criticalActions: AuditAction[] = ["admin_action", "system_config_change", "secret_update"];
  const highRiskActions: AuditAction[] = ["delete", "deploy", "rollback", "team_delete", "member_remove"];
  const mediumRiskActions: AuditAction[] = ["update", "scale", "restart", "stop", "start", "config_change", "member_role_change"];

  if (criticalActions.includes(action)) return "critical";
  if (highRiskActions.includes(action)) return "high";
  if (mediumRiskActions.includes(action)) return "medium";
  return "low";
}

// Suspicious activity detection
function detectSuspiciousActivity(
  action: AuditAction,
  context: AuditLogContext,
  data: AuditLogData
): { isSuspicious: boolean; reason?: string } {
  // Failed login attempts
  if (action === "login_failed") {
    return { isSuspicious: true, reason: "Failed login attempt" };
  }

  // Bulk deletions
  if (action === "delete" && data.metadata?.bulkOperation) {
    return { isSuspicious: true, reason: "Bulk deletion operation" };
  }

  // After-hours activity (simplified check)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    if (["delete", "deploy", "rollback", "admin_action"].includes(action)) {
      return { isSuspicious: true, reason: "High-risk action during off-hours" };
    }
  }

  // Secret access
  if (action === "secret_access" || action === "secret_update") {
    return { isSuspicious: true, reason: "Secret access detected" };
  }

  return { isSuspicious: false };
}

export async function createAuditLog(context: AuditLogContext, data: AuditLogData) {
  const db = await getDb();
  if (!db) return null;

  const riskLevel = determineRiskLevel(data.action, data);
  const suspicious = detectSuspiciousActivity(data.action, context, data);

  const [log] = await db.insert(auditLogs).values({
    userId: context.userId,
    userEmail: context.userEmail,
    userName: context.userName,
    teamId: context.teamId,
    action: data.action,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    resourceName: data.resourceName,
    description: data.description,
    previousState: data.previousState,
    newState: data.newState,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    sessionId: context.sessionId,
    status: data.status || "success",
    errorMessage: data.errorMessage,
    riskLevel,
    isSuspicious: suspicious.isSuspicious,
    suspiciousReason: suspicious.reason,
    duration: data.duration,
    metadata: data.metadata,
    tags: data.tags,
  }).$returningId();

  // Check alerts if suspicious
  if (suspicious.isSuspicious) {
    await checkAndTriggerAlerts(log.id, context, data, riskLevel);
  }

  return log;
}

// ============================================
// AUDIT LOG QUERIES
// ============================================

export interface AuditLogFilters {
  userId?: number;
  teamId?: number;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  resourceId?: string;
  status?: "success" | "failure" | "partial";
  riskLevel?: "low" | "medium" | "high" | "critical" | ("low" | "medium" | "high" | "critical")[];
  isSuspicious?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  tags?: string[];
}

export async function getAuditLogs(
  filters: AuditLogFilters = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  const conditions: any[] = [];

  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }

  if (filters.teamId) {
    conditions.push(eq(auditLogs.teamId, filters.teamId));
  }

  if (filters.action) {
    if (Array.isArray(filters.action)) {
      conditions.push(inArray(auditLogs.action, filters.action));
    } else {
      conditions.push(eq(auditLogs.action, filters.action));
    }
  }

  if (filters.resourceType) {
    conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  }

  if (filters.resourceId) {
    conditions.push(eq(auditLogs.resourceId, filters.resourceId));
  }

  if (filters.status) {
    conditions.push(eq(auditLogs.status, filters.status));
  }

  if (filters.riskLevel) {
    if (Array.isArray(filters.riskLevel)) {
      conditions.push(inArray(auditLogs.riskLevel, filters.riskLevel));
    } else {
      conditions.push(eq(auditLogs.riskLevel, filters.riskLevel));
    }
  }

  if (filters.isSuspicious !== undefined) {
    conditions.push(eq(auditLogs.isSuspicious, filters.isSuspicious));
  }

  if (filters.startDate) {
    conditions.push(gte(auditLogs.createdAt, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(auditLogs.createdAt, filters.endDate));
  }

  if (filters.search) {
    conditions.push(
      or(
        like(auditLogs.description, `%${filters.search}%`),
        like(auditLogs.resourceName, `%${filters.search}%`),
        like(auditLogs.userEmail, `%${filters.search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause);

  // Get paginated results
  const offset = (pagination.page - 1) * pagination.limit;
  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pagination.limit)
    .offset(offset);

  return {
    logs,
    total: countResult.count,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(countResult.count / pagination.limit),
  };
}

export async function getAuditLogById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return log || null;
}

// ============================================
// AUDIT LOG STATISTICS
// ============================================

export async function getAuditLogStats(teamId?: number, days = 30) {
  const db = await getDb();
  if (!db) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const conditions: any[] = [gte(auditLogs.createdAt, startDate)];
  if (teamId) {
    conditions.push(eq(auditLogs.teamId, teamId));
  }

  // Total events
  const [totalEvents] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(...conditions));

  // Events by action
  const eventsByAction = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`count(*)`));

  // Events by risk level
  const eventsByRisk = await db
    .select({
      riskLevel: auditLogs.riskLevel,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .groupBy(auditLogs.riskLevel);

  // Suspicious events
  const [suspiciousEvents] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(...conditions, eq(auditLogs.isSuspicious, true)));

  // Failed events
  const [failedEvents] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(...conditions, eq(auditLogs.status, "failure")));

  // Most active users
  const activeUsers = await db
    .select({
      userId: auditLogs.userId,
      userEmail: auditLogs.userEmail,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .groupBy(auditLogs.userId, auditLogs.userEmail)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // Events by day
  const eventsByDay = await db
    .select({
      date: sql<string>`DATE(createdAt)`,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .groupBy(sql`DATE(createdAt)`)
    .orderBy(sql`DATE(createdAt)`);

  return {
    totalEvents: totalEvents.count,
    eventsByAction,
    eventsByRisk,
    suspiciousEvents: suspiciousEvents.count,
    failedEvents: failedEvents.count,
    activeUsers,
    eventsByDay,
    period: { startDate, endDate: new Date() },
  };
}

// ============================================
// AUDIT LOG POLICIES
// ============================================

export async function createAuditLogPolicy(data: {
  teamId?: number;
  name: string;
  description?: string;
  actionTypes?: AuditAction[];
  resourceTypes?: string[];
  riskLevels?: ("low" | "medium" | "high" | "critical")[];
  retentionDays?: number;
  archiveEnabled?: boolean;
  archiveLocation?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [policy] = await db.insert(auditLogPolicies).values({
    teamId: data.teamId,
    name: data.name,
    description: data.description,
    actionTypes: data.actionTypes,
    resourceTypes: data.resourceTypes,
    riskLevels: data.riskLevels,
    retentionDays: data.retentionDays || 90,
    archiveEnabled: data.archiveEnabled || false,
    archiveLocation: data.archiveLocation,
  }).$returningId();

  return policy;
}

export async function getAuditLogPolicies(teamId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (teamId) {
    return db
      .select()
      .from(auditLogPolicies)
      .where(or(eq(auditLogPolicies.teamId, teamId), sql`teamId IS NULL`))
      .orderBy(desc(auditLogPolicies.createdAt));
  }

  return db.select().from(auditLogPolicies).orderBy(desc(auditLogPolicies.createdAt));
}

export async function applyRetentionPolicies() {
  const db = await getDb();
  if (!db) return { deleted: 0 };

  const policies = await db
    .select()
    .from(auditLogPolicies)
    .where(eq(auditLogPolicies.isActive, true));

  let totalDeleted = 0;

  for (const policy of policies) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    const conditions: any[] = [lte(auditLogs.createdAt, cutoffDate)];

    if (policy.teamId) {
      conditions.push(eq(auditLogs.teamId, policy.teamId));
    }

    if (policy.actionTypes && Array.isArray(policy.actionTypes)) {
      conditions.push(inArray(auditLogs.action, policy.actionTypes as AuditAction[]));
    }

    if (policy.riskLevels && Array.isArray(policy.riskLevels)) {
      conditions.push(inArray(auditLogs.riskLevel, policy.riskLevels as any[]));
    }

    // TODO: Archive before deleting if archiveEnabled

    const result = await db.delete(auditLogs).where(and(...conditions));

    // Update policy last applied
    await db
      .update(auditLogPolicies)
      .set({ lastAppliedAt: new Date() })
      .where(eq(auditLogPolicies.id, policy.id));

    totalDeleted += 1; // Simplified - would need actual count
  }

  return { deleted: totalDeleted };
}

// ============================================
// AUDIT LOG ALERTS
// ============================================

export async function createAuditLogAlert(data: {
  teamId?: number;
  name: string;
  description?: string;
  triggerConditions: Record<string, unknown>;
  notifyEmail?: boolean;
  notifySlack?: boolean;
  notifyWebhook?: boolean;
  webhookUrl?: string;
  severity?: "info" | "warning" | "critical";
  cooldownMinutes?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [alert] = await db.insert(auditLogAlerts).values({
    teamId: data.teamId,
    name: data.name,
    description: data.description,
    triggerConditions: data.triggerConditions,
    notifyEmail: data.notifyEmail ?? true,
    notifySlack: data.notifySlack ?? false,
    notifyWebhook: data.notifyWebhook ?? false,
    webhookUrl: data.webhookUrl,
    severity: data.severity || "warning",
    cooldownMinutes: data.cooldownMinutes || 15,
  }).$returningId();

  return alert;
}

export async function getAuditLogAlerts(teamId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (teamId) {
    return db
      .select()
      .from(auditLogAlerts)
      .where(or(eq(auditLogAlerts.teamId, teamId), sql`teamId IS NULL`))
      .orderBy(desc(auditLogAlerts.createdAt));
  }

  return db.select().from(auditLogAlerts).orderBy(desc(auditLogAlerts.createdAt));
}

async function checkAndTriggerAlerts(
  logId: number,
  context: AuditLogContext,
  data: AuditLogData,
  riskLevel: string
) {
  const db = await getDb();
  if (!db) return;

  const alerts = await getAuditLogAlerts(context.teamId);

  for (const alert of alerts) {
    if (!alert.isActive) continue;

    // Check cooldown
    if (alert.lastTriggeredAt) {
      const cooldownEnd = new Date(alert.lastTriggeredAt);
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + alert.cooldownMinutes);
      if (new Date() < cooldownEnd) continue;
    }

    // Check trigger conditions (simplified)
    const conditions = alert.triggerConditions as Record<string, unknown>;
    let shouldTrigger = false;

    if (conditions.actions && Array.isArray(conditions.actions)) {
      if (conditions.actions.includes(data.action)) shouldTrigger = true;
    }

    if (conditions.riskLevels && Array.isArray(conditions.riskLevels)) {
      if (conditions.riskLevels.includes(riskLevel)) shouldTrigger = true;
    }

    if (conditions.suspiciousOnly && data.status === "failure") {
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      // Update alert
      await db
        .update(auditLogAlerts)
        .set({
          lastTriggeredAt: new Date(),
          triggerCount: sql`triggerCount + 1`,
        })
        .where(eq(auditLogAlerts.id, alert.id));

      // Send notifications (simplified - would integrate with notification service)
      console.log(`[AuditAlert] Triggered: ${alert.name} for log ${logId}`);
    }
  }
}

// ============================================
// SAVED QUERIES
// ============================================

export async function saveAuditLogQuery(data: {
  userId: number;
  teamId?: number;
  name: string;
  description?: string;
  filters: AuditLogFilters;
  columns?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isShared?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [query] = await db.insert(auditLogSavedQueries).values({
    userId: data.userId,
    teamId: data.teamId,
    name: data.name,
    description: data.description,
    filters: data.filters,
    columns: data.columns,
    sortBy: data.sortBy,
    sortOrder: data.sortOrder || "desc",
    isShared: data.isShared || false,
  }).$returningId();

  return query;
}

export async function getSavedQueries(userId: number, teamId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    or(
      eq(auditLogSavedQueries.userId, userId),
      and(eq(auditLogSavedQueries.isShared, true), teamId ? eq(auditLogSavedQueries.teamId, teamId) : sql`1=1`)
    ),
  ];

  return db
    .select()
    .from(auditLogSavedQueries)
    .where(and(...conditions))
    .orderBy(desc(auditLogSavedQueries.createdAt));
}

export async function deleteSavedQuery(queryId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(auditLogSavedQueries)
    .where(and(eq(auditLogSavedQueries.id, queryId), eq(auditLogSavedQueries.userId, userId)));
}

// ============================================
// USER SESSIONS
// ============================================

export async function createUserSession(data: {
  userId: number;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  expiresInHours?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours || 24));

  const [session] = await db.insert(userSessions).values({
    userId: data.userId,
    sessionId,
    deviceType: data.deviceType,
    browser: data.browser,
    os: data.os,
    ipAddress: data.ipAddress,
    country: data.country,
    city: data.city,
    expiresAt,
  }).$returningId();

  return { ...session, sessionId };
}

export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)))
    .orderBy(desc(userSessions.lastActivityAt));
}

export async function invalidateSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(userSessions)
    .set({ isActive: false })
    .where(eq(userSessions.sessionId, sessionId));
}

export async function invalidateAllUserSessions(userId: number, exceptSessionId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(userSessions.userId, userId)];
  if (exceptSessionId) {
    conditions.push(sql`sessionId != ${exceptSessionId}`);
  }

  await db.update(userSessions).set({ isActive: false }).where(and(...conditions));
}

// ============================================
// EXPORT FUNCTIONALITY
// ============================================

export async function exportAuditLogs(
  filters: AuditLogFilters,
  format: "json" | "csv" = "json"
): Promise<string> {
  const { logs } = await getAuditLogs(filters, { page: 1, limit: 10000 });

  if (format === "csv") {
    const headers = [
      "ID",
      "Timestamp",
      "User Email",
      "Action",
      "Resource Type",
      "Resource ID",
      "Resource Name",
      "Description",
      "Status",
      "Risk Level",
      "IP Address",
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.userEmail || "",
      log.action,
      log.resourceType || "",
      log.resourceId || "",
      log.resourceName || "",
      log.description.replace(/"/g, '""'),
      log.status,
      log.riskLevel,
      log.ipAddress || "",
    ]);

    return [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
  }

  return JSON.stringify(logs, null, 2);
}

// ============================================
// AI-POWERED ANOMALY DETECTION
// ============================================

export async function detectAnomalies(teamId?: number, days = 7) {
  const db = await getDb();
  if (!db) return null;

  const stats = await getAuditLogStats(teamId, days);
  if (!stats) return null;

  const recentLogs = await getAuditLogs(
    { teamId, startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    { page: 1, limit: 500 }
  );

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a security analyst AI. Analyze audit logs and detect potential anomalies, security threats, or unusual patterns. Be specific and actionable in your findings.`,
        },
        {
          role: "user",
          content: `Analyze these audit log statistics and recent events for anomalies:

Statistics (last ${days} days):
- Total events: ${stats.totalEvents}
- Suspicious events: ${stats.suspiciousEvents}
- Failed events: ${stats.failedEvents}

Events by risk level:
${stats.eventsByRisk.map((r) => `- ${r.riskLevel}: ${r.count}`).join("\n")}

Most active users:
${stats.activeUsers.map((u) => `- ${u.userEmail}: ${u.count} events`).join("\n")}

Recent suspicious/high-risk events:
${recentLogs.logs
  .filter((l) => l.isSuspicious || l.riskLevel === "high" || l.riskLevel === "critical")
  .slice(0, 20)
  .map((l) => `- [${l.riskLevel}] ${l.action}: ${l.description}`)
  .join("\n")}

Identify:
1. Potential security threats
2. Unusual activity patterns
3. Recommended actions
4. Risk score (0-100)`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    return {
      analysis: content,
      stats,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to detect anomalies:", error);
    return null;
  }
}
