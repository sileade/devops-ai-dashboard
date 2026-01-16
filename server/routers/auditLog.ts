import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as auditLogService from "../services/auditLog";
import { getUserTeamRole } from "../services/teams";

const auditActionEnum = z.enum([
  "login",
  "logout",
  "login_failed",
  "password_changed",
  "mfa_enabled",
  "mfa_disabled",
  "create",
  "read",
  "update",
  "delete",
  "deploy",
  "rollback",
  "scale",
  "restart",
  "stop",
  "start",
  "team_create",
  "team_update",
  "team_delete",
  "member_invite",
  "member_remove",
  "member_role_change",
  "config_change",
  "secret_access",
  "secret_update",
  "ai_query",
  "ai_recommendation_applied",
  "export",
  "import",
  "admin_action",
  "system_config_change",
]);

const riskLevelEnum = z.enum(["low", "medium", "high", "critical"]);

export const auditLogRouter = router({
  // Get audit logs with filters
  getLogs: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        userId: z.number().optional(),
        action: z.union([auditActionEnum, z.array(auditActionEnum)]).optional(),
        resourceType: z.string().optional(),
        resourceId: z.string().optional(),
        status: z.enum(["success", "failure", "partial"]).optional(),
        riskLevel: z.union([riskLevelEnum, z.array(riskLevelEnum)]).optional(),
        isSuspicious: z.boolean().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // If teamId specified, check membership
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (!role) {
          throw new Error("Not a team member");
        }
      }

      const filters: auditLogService.AuditLogFilters = {
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      };

      // Non-admin users can only see their own logs or team logs
      if (ctx.user.role !== "admin" && !input.teamId) {
        filters.userId = ctx.user.id;
      }

      return auditLogService.getAuditLogs(filters, {
        page: input.page,
        limit: input.limit,
      });
    }),

  // Get single audit log
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const log = await auditLogService.getAuditLogById(input.id);

      if (!log) {
        throw new Error("Audit log not found");
      }

      // Check access
      if (ctx.user.role !== "admin") {
        if (log.userId !== ctx.user.id) {
          if (log.teamId) {
            const role = await getUserTeamRole(log.teamId, ctx.user.id);
            if (!role) {
              throw new Error("Access denied");
            }
          } else {
            throw new Error("Access denied");
          }
        }
      }

      return log;
    }),

  // Get audit log statistics
  getStats: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      // If teamId specified, check membership
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (!role) {
          throw new Error("Not a team member");
        }
      }

      return auditLogService.getAuditLogStats(input.teamId, input.days);
    }),

  // Export audit logs
  export: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        format: z.enum(["json", "csv"]).default("json"),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        action: z.union([auditActionEnum, z.array(auditActionEnum)]).optional(),
        riskLevel: z.union([riskLevelEnum, z.array(riskLevelEnum)]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Insufficient permissions to export logs");
        }
      } else if (ctx.user.role !== "admin") {
        throw new Error("Admin access required to export all logs");
      }

      // Log the export action
      await auditLogService.createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
          teamId: input.teamId,
        },
        {
          action: "export",
          resourceType: "audit_logs",
          description: `Exported audit logs in ${input.format} format`,
          metadata: input as Record<string, unknown>,
        }
      );

      const filters: auditLogService.AuditLogFilters = {
        teamId: input.teamId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        action: input.action,
        riskLevel: input.riskLevel,
      };

      return auditLogService.exportAuditLogs(filters, input.format);
    }),

  // Detect anomalies using AI
  detectAnomalies: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        days: z.number().min(1).max(30).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check permissions
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Insufficient permissions");
        }
      } else if (ctx.user.role !== "admin") {
        throw new Error("Admin access required");
      }

      return auditLogService.detectAnomalies(input.teamId, input.days);
    }),

  // ============================================
  // POLICIES
  // ============================================

  // Create retention policy
  createPolicy: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        actionTypes: z.array(auditActionEnum).optional(),
        resourceTypes: z.array(z.string()).optional(),
        riskLevels: z.array(riskLevelEnum).optional(),
        retentionDays: z.number().min(1).max(3650).default(90),
        archiveEnabled: z.boolean().default(false),
        archiveLocation: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (role !== "owner") {
          throw new Error("Only team owner can create policies");
        }
      } else if (ctx.user.role !== "admin") {
        throw new Error("Admin access required");
      }

      return auditLogService.createAuditLogPolicy(input);
    }),

  // Get policies
  getPolicies: protectedProcedure
    .input(z.object({ teamId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Insufficient permissions");
        }
      }

      return auditLogService.getAuditLogPolicies(input.teamId);
    }),

  // ============================================
  // ALERTS
  // ============================================

  // Create alert
  createAlert: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        triggerConditions: z.record(z.string(), z.unknown()),
        notifyEmail: z.boolean().default(true),
        notifySlack: z.boolean().default(false),
        notifyWebhook: z.boolean().default(false),
        webhookUrl: z.string().url().optional(),
        severity: z.enum(["info", "warning", "critical"]).default("warning"),
        cooldownMinutes: z.number().min(1).max(1440).default(15),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Insufficient permissions");
        }
      } else if (ctx.user.role !== "admin") {
        throw new Error("Admin access required");
      }

      return auditLogService.createAuditLogAlert(input);
    }),

  // Get alerts
  getAlerts: protectedProcedure
    .input(z.object({ teamId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.teamId) {
        const role = await getUserTeamRole(input.teamId, ctx.user.id);
        if (role !== "owner" && role !== "admin") {
          throw new Error("Insufficient permissions");
        }
      }

      return auditLogService.getAuditLogAlerts(input.teamId);
    }),

  // ============================================
  // SAVED QUERIES
  // ============================================

  // Save query
  saveQuery: protectedProcedure
    .input(
      z.object({
        teamId: z.number().optional(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        filters: z.record(z.string(), z.unknown()),
        columns: z.array(z.string()).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        isShared: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return auditLogService.saveAuditLogQuery({
        userId: ctx.user.id,
        teamId: input.teamId,
        name: input.name,
        description: input.description,
        filters: input.filters as auditLogService.AuditLogFilters,
        columns: input.columns,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
        isShared: input.isShared,
      });
    }),

  // Get saved queries
  getSavedQueries: protectedProcedure
    .input(z.object({ teamId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return auditLogService.getSavedQueries(ctx.user.id, input.teamId);
    }),

  // Delete saved query
  deleteSavedQuery: protectedProcedure
    .input(z.object({ queryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await auditLogService.deleteSavedQuery(input.queryId, ctx.user.id);
      return { success: true };
    }),

  // ============================================
  // USER SESSIONS
  // ============================================

  // Get user sessions
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    return auditLogService.getUserSessions(ctx.user.id);
  }),

  // Invalidate session
  invalidateSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await auditLogService.invalidateSession(input.sessionId);

      await auditLogService.createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
        },
        {
          action: "logout",
          description: "Invalidated session",
          metadata: { sessionId: input.sessionId },
        }
      );

      return { success: true };
    }),

  // Invalidate all sessions
  invalidateAllSessions: protectedProcedure
    .input(z.object({ exceptCurrent: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      // Note: Would need current session ID from context
      await auditLogService.invalidateAllUserSessions(ctx.user.id, undefined);

      await auditLogService.createAuditLog(
        {
          userId: ctx.user.id,
          userEmail: ctx.user.email || undefined,
          userName: ctx.user.name || undefined,
        },
        {
          action: "logout",
          description: "Invalidated all sessions",
        }
      );

      return { success: true };
    }),
});
