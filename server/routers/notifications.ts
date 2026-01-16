import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getActiveAlerts, acknowledgeAlert, getMetricsHistory } from "../_core/websocket";

/**
 * Notifications router
 * Handles alerts and notification management
 */
export const notificationsRouter = router({
  // Get all active alerts
  getAlerts: publicProcedure
    .input(z.object({
      includeAcknowledged: z.boolean().optional().default(false),
    }).optional())
    .query(async ({ input }) => {
      const alerts = getActiveAlerts();
      if (input?.includeAcknowledged) {
        return alerts;
      }
      return alerts.filter(a => !a.acknowledged);
    }),

  // Get alert counts by type
  getAlertCounts: publicProcedure.query(async () => {
    const alerts = getActiveAlerts();
    const unacknowledged = alerts.filter(a => !a.acknowledged);
    
    return {
      total: unacknowledged.length,
      critical: unacknowledged.filter(a => a.type === "critical").length,
      warning: unacknowledged.filter(a => a.type === "warning").length,
      info: unacknowledged.filter(a => a.type === "info").length,
    };
  }),

  // Acknowledge an alert
  acknowledge: publicProcedure
    .input(z.object({
      alertId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const success = acknowledgeAlert(input.alertId);
      return { success };
    }),

  // Acknowledge all alerts
  acknowledgeAll: publicProcedure.mutation(async () => {
    const alerts = getActiveAlerts();
    let count = 0;
    for (const alert of alerts) {
      if (!alert.acknowledged) {
        acknowledgeAlert(alert.id);
        count++;
      }
    }
    return { acknowledged: count };
  }),

  // Get metrics history
  getMetricsHistory: publicProcedure
    .input(z.object({
      hours: z.number().min(1).max(24).optional().default(24),
    }).optional())
    .query(async ({ input }) => {
      return getMetricsHistory(input?.hours || 24);
    }),

  // Get notification settings (placeholder for future implementation)
  getSettings: publicProcedure.query(async () => {
    return {
      emailNotifications: false,
      slackNotifications: false,
      criticalAlertsOnly: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
    };
  }),

  // Update notification settings (placeholder)
  updateSettings: publicProcedure
    .input(z.object({
      emailNotifications: z.boolean().optional(),
      slackNotifications: z.boolean().optional(),
      criticalAlertsOnly: z.boolean().optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().optional(),
      quietHoursEnd: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // In a real implementation, this would save to database
      console.log("Notification settings updated:", input);
      return { success: true };
    }),
});
