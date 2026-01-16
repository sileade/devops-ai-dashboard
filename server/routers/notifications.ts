import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getActiveAlerts, acknowledgeAlert, getMetricsHistory } from "../_core/websocket";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  clearNotifications,
  createNotification,
  sendNotificationToUser,
  sendNotificationToTeam,
  broadcastNotification,
  type NotificationCategory,
  type NotificationPriority,
} from "../services/realtimeNotifications";

const notificationCategorySchema = z.enum([
  "security",
  "deployment",
  "scaling",
  "error",
  "team",
  "system",
  "audit",
]);

const notificationPrioritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

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

  // ============================================
  // REAL-TIME NOTIFICATIONS
  // ============================================

  // Get user real-time notifications
  listRealtime: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        unreadOnly: z.boolean().optional().default(false),
        categories: z.array(notificationCategorySchema).optional(),
        priorities: z.array(notificationPrioritySchema).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = getUserNotifications(ctx.user.id, {
        limit: input.limit,
        unreadOnly: input.unreadOnly,
        categories: input.categories as NotificationCategory[] | undefined,
        priorities: input.priorities as NotificationPriority[] | undefined,
      });

      return {
        notifications,
        total: notifications.length,
        unreadCount: getUnreadCount(ctx.user.id),
      };
    }),

  // Get unread count
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return {
      count: getUnreadCount(ctx.user.id),
    };
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = markNotificationAsRead(ctx.user.id, input.notificationId);
      return { success };
    }),

  // Mark all notifications as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const count = markAllNotificationsAsRead(ctx.user.id);
    return { markedCount: count };
  }),

  // Clear all notifications
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    clearNotifications(ctx.user.id);
    return { success: true };
  }),

  // Send test notification
  sendTest: protectedProcedure
    .input(
      z.object({
        type: notificationCategorySchema.optional().default("system"),
        priority: notificationPrioritySchema.optional().default("info"),
        title: z.string().optional().default("Test Notification"),
        message: z.string().optional().default("This is a test notification"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const notification = createNotification({
        type: input.type as NotificationCategory,
        priority: input.priority as NotificationPriority,
        title: input.title,
        message: input.message,
        userId: ctx.user.id,
      });

      await sendNotificationToUser(ctx.user.id, notification);
      return { success: true, notification };
    }),

  // Admin: Broadcast notification
  broadcast: protectedProcedure
    .input(
      z.object({
        type: notificationCategorySchema,
        priority: notificationPrioritySchema,
        title: z.string(),
        message: z.string(),
        actionUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Admin access required");
      }

      const notification = createNotification({
        type: input.type as NotificationCategory,
        priority: input.priority as NotificationPriority,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
      });

      const sentCount = await broadcastNotification(notification);
      return { success: true, deliveredCount: sentCount };
    }),
});
