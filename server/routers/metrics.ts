import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getMetricsHistory,
  getAggregatedMetrics,
  saveMetricsSnapshot,
  cleanupOldMetrics,
  getAlertThresholds,
  upsertAlertThreshold,
  toggleAlertThreshold,
  deleteAlertThreshold,
  getAlertHistory,
  acknowledgeAlert,
  getUnacknowledgedAlertCount,
  recordAlert,
  isThresholdInCooldown,
} from "../db";

export const metricsRouter = router({
  // Get metrics history
  getHistory: publicProcedure
    .input(z.object({
      source: z.enum(["docker", "kubernetes", "system"]).optional(),
      resourceType: z.enum(["container", "pod", "node", "cluster"]).optional(),
      resourceId: z.string().optional(),
      hours: z.number().min(1).max(168).default(24), // Max 7 days
      limit: z.number().min(1).max(5000).default(1000),
    }).optional())
    .query(async ({ input }) => {
      const startTime = new Date(Date.now() - (input?.hours || 24) * 60 * 60 * 1000);
      
      return getMetricsHistory({
        source: input?.source,
        resourceType: input?.resourceType,
        resourceId: input?.resourceId,
        startTime,
        limit: input?.limit,
      });
    }),

  // Get aggregated metrics summary
  getSummary: publicProcedure
    .input(z.object({
      hours: z.number().min(1).max(168).default(24),
    }).optional())
    .query(async ({ input }) => {
      return getAggregatedMetrics(input?.hours || 24);
    }),

  // Save metrics snapshot (for internal use)
  saveSnapshot: publicProcedure
    .input(z.object({
      source: z.enum(["docker", "kubernetes", "system"]).default("system"),
      resourceType: z.enum(["container", "pod", "node", "cluster"]).default("cluster"),
      resourceId: z.string().optional(),
      cpuPercent: z.number().min(0).max(100),
      memoryPercent: z.number().min(0).max(100),
      memoryUsedMb: z.number().optional(),
      memoryTotalMb: z.number().optional(),
      networkRxBytes: z.number().optional(),
      networkTxBytes: z.number().optional(),
      diskUsedGb: z.number().optional(),
      diskTotalGb: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await saveMetricsSnapshot(input);
      return { success: id !== null, id };
    }),

  // Cleanup old metrics
  cleanup: publicProcedure
    .input(z.object({
      retentionDays: z.number().min(1).max(365).default(30),
    }).optional())
    .mutation(async ({ input }) => {
      const deleted = await cleanupOldMetrics(input?.retentionDays || 30);
      return { success: true, deletedCount: deleted };
    }),
});

export const alertThresholdsRouter = router({
  // Get all thresholds
  list: publicProcedure
    .input(z.object({
      metricType: z.enum(["cpu", "memory", "disk", "network"]).optional(),
      resourceType: z.enum(["container", "pod", "node", "cluster"]).optional(),
      enabledOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return getAlertThresholds(input);
    }),

  // Create or update threshold
  upsert: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(255),
      metricType: z.enum(["cpu", "memory", "disk", "network"]),
      resourceType: z.enum(["container", "pod", "node", "cluster"]).default("cluster"),
      resourcePattern: z.string().optional(),
      warningThreshold: z.number().min(0).max(100),
      criticalThreshold: z.number().min(0).max(100),
      isEnabled: z.boolean().default(true),
      cooldownMinutes: z.number().min(1).max(1440).default(5),
    }))
    .mutation(async ({ input }) => {
      // Validate that critical > warning
      if (input.criticalThreshold <= input.warningThreshold) {
        return { success: false, error: "Critical threshold must be greater than warning threshold" };
      }
      
      const id = await upsertAlertThreshold(input);
      return { success: id !== null, id };
    }),

  // Toggle threshold enabled/disabled
  toggle: publicProcedure
    .input(z.object({
      id: z.number(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const success = await toggleAlertThreshold(input.id, input.isEnabled);
      return { success };
    }),

  // Delete threshold
  delete: publicProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const success = await deleteAlertThreshold(input.id);
      return { success };
    }),
});

export const alertHistoryRouter = router({
  // Get alert history
  list: publicProcedure
    .input(z.object({
      severity: z.enum(["warning", "critical"]).optional(),
      metricType: z.enum(["cpu", "memory", "disk", "network"]).optional(),
      acknowledgedOnly: z.boolean().optional(),
      unacknowledgedOnly: z.boolean().optional(),
      hours: z.number().min(1).max(168).optional(),
      limit: z.number().min(1).max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const startTime = input?.hours 
        ? new Date(Date.now() - input.hours * 60 * 60 * 1000)
        : undefined;
      
      return getAlertHistory({
        severity: input?.severity,
        metricType: input?.metricType,
        acknowledgedOnly: input?.acknowledgedOnly,
        unacknowledgedOnly: input?.unacknowledgedOnly,
        startTime,
        limit: input?.limit,
      });
    }),

  // Acknowledge an alert
  acknowledge: publicProcedure
    .input(z.object({
      alertId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const success = await acknowledgeAlert(input.alertId);
      return { success };
    }),

  // Get unacknowledged count
  getUnacknowledgedCount: publicProcedure
    .query(async () => {
      const count = await getUnacknowledgedAlertCount();
      return { count };
    }),

  // Check threshold and create alert if needed
  checkAndAlert: publicProcedure
    .input(z.object({
      thresholdId: z.number(),
      currentValue: z.number(),
      resourceId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Check cooldown
      const inCooldown = await isThresholdInCooldown(input.thresholdId);
      if (inCooldown) {
        return { success: false, reason: "Threshold in cooldown" };
      }

      // Get threshold
      const thresholds = await getAlertThresholds();
      const threshold = thresholds.find(t => t.id === input.thresholdId);
      
      if (!threshold || !threshold.isEnabled) {
        return { success: false, reason: "Threshold not found or disabled" };
      }

      // Check if alert should be triggered
      let severity: "warning" | "critical" | null = null;
      
      if (input.currentValue >= threshold.criticalThreshold) {
        severity = "critical";
      } else if (input.currentValue >= threshold.warningThreshold) {
        severity = "warning";
      }

      if (!severity) {
        return { success: false, reason: "Value below thresholds" };
      }

      // Record alert
      const alertId = await recordAlert({
        thresholdId: input.thresholdId,
        severity,
        metricType: threshold.metricType,
        resourceType: threshold.resourceType,
        resourceId: input.resourceId,
        currentValue: input.currentValue,
        thresholdValue: severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold,
        message: `${threshold.name}: ${input.currentValue}% (${severity} threshold: ${severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold}%)`,
      });

      return { 
        success: alertId !== null, 
        alertId,
        severity,
        message: `${threshold.name}: ${input.currentValue}%`,
      };
    }),
});
