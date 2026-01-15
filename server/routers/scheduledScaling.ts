import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getScheduledScalingRules,
  getScheduledScalingById,
  createScheduledScaling,
  updateScheduledScaling,
  deleteScheduledScaling,
  getScheduledScalingHistory,
  recordScheduledScalingExecution,
  updateScheduleExecutionStats,
} from "../db";
import { scaleDeployment, Deployment } from "../infrastructure/kubernetes";
import { listDeployments } from "../infrastructure/kubernetes";

// Cron expression validator
const cronExpressionSchema = z.string().regex(
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
  "Invalid cron expression"
);

// Common timezone list
const timezones = [
  "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "Europe/London", "Europe/Paris", "Europe/Moscow", "Asia/Tokyo",
  "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney"
];

export const scheduledScalingRouter = router({
  // Get all scheduled scaling rules
  list: publicProcedure
    .input(z.object({
      applicationId: z.number().optional(),
      enabledOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await getScheduledScalingRules(input);
    }),

  // Get single scheduled scaling rule
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getScheduledScalingById(input.id);
    }),

  // Create scheduled scaling rule
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      targetType: z.enum(["deployment", "container", "service"]),
      targetName: z.string().min(1).max(255),
      namespace: z.string().optional(),
      cronExpression: z.string().min(1), // Simplified validation
      timezone: z.string().default("UTC"),
      targetReplicas: z.number().min(0).max(100),
      isEnabled: z.boolean().default(true),
      applicationId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Calculate next execution time
      const nextExecution = calculateNextExecution(input.cronExpression, input.timezone);
      
      const id = await createScheduledScaling({
        ...input,
        nextExecutionAt: nextExecution,
      });
      
      if (!id) {
        throw new Error("Failed to create scheduled scaling rule");
      }
      
      return { id, success: true };
    }),

  // Update scheduled scaling rule
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      cronExpression: z.string().optional(),
      timezone: z.string().optional(),
      targetReplicas: z.number().min(0).max(100).optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      
      // Recalculate next execution if cron or timezone changed
      if (updates.cronExpression || updates.timezone) {
        const existing = await getScheduledScalingById(id);
        if (existing) {
          const cron = updates.cronExpression || existing.cronExpression;
          const tz = updates.timezone || existing.timezone;
          (updates as any).nextExecutionAt = calculateNextExecution(cron, tz);
        }
      }
      
      const success = await updateScheduledScaling(id, updates);
      return { success };
    }),

  // Delete scheduled scaling rule
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = await deleteScheduledScaling(input.id);
      return { success };
    }),

  // Toggle enabled state
  toggle: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const schedule = await getScheduledScalingById(input.id);
      if (!schedule) {
        throw new Error("Schedule not found");
      }
      
      const success = await updateScheduledScaling(input.id, {
        isEnabled: !schedule.isEnabled,
      });
      
      return { success, isEnabled: !schedule.isEnabled };
    }),

  // Get execution history
  history: publicProcedure
    .input(z.object({
      scheduleId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      return await getScheduledScalingHistory(input?.scheduleId, input?.limit);
    }),

  // Execute scheduled scaling manually
  executeNow: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const schedule = await getScheduledScalingById(input.id);
      if (!schedule) {
        throw new Error("Schedule not found");
      }

      const startTime = Date.now();
      let previousReplicas = 0;
      let actualReplicas = 0;
      let errorMessage: string | undefined;
      let status: "completed" | "failed" = "completed";

      try {
        // Get current replica count
        if (schedule.targetType === "deployment") {
          const deployments = await listDeployments(schedule.namespace || "default");
          const deployment = deployments.find((d: Deployment) => d.name === schedule.targetName);
          previousReplicas = deployment?.replicas || 0;
        }

        // Execute scaling
        if (schedule.targetType === "deployment") {
          await scaleDeployment(
            schedule.targetName,
            schedule.namespace || "default",
            schedule.targetReplicas
          );
          actualReplicas = schedule.targetReplicas;
        } else {
          throw new Error(`Scaling for ${schedule.targetType} not yet implemented`);
        }
      } catch (error) {
        status = "failed";
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }

      const executionTimeMs = Date.now() - startTime;

      // Record execution
      await recordScheduledScalingExecution({
        scheduleId: input.id,
        previousReplicas,
        targetReplicas: schedule.targetReplicas,
        actualReplicas: status === "completed" ? actualReplicas : undefined,
        status,
        errorMessage,
        executionTimeMs,
        scheduledFor: new Date(),
        executedAt: new Date(),
      });

      // Update stats
      await updateScheduleExecutionStats(input.id, status === "completed");

      return {
        success: status === "completed",
        previousReplicas,
        newReplicas: actualReplicas,
        executionTimeMs,
        error: errorMessage,
      };
    }),

  // Get available timezones
  getTimezones: publicProcedure.query(() => {
    return timezones;
  }),

  // Preview next executions
  previewExecutions: publicProcedure
    .input(z.object({
      cronExpression: z.string(),
      timezone: z.string().default("UTC"),
      count: z.number().min(1).max(10).default(5),
    }))
    .query(({ input }) => {
      const executions: Date[] = [];
      let current = new Date();
      
      for (let i = 0; i < input.count; i++) {
        const next = calculateNextExecution(input.cronExpression, input.timezone, current);
        if (next) {
          executions.push(next);
          current = new Date(next.getTime() + 60000); // Add 1 minute to find next
        }
      }
      
      return executions;
    }),
});

// Helper function to calculate next execution time from cron expression
function calculateNextExecution(cronExpression: string, timezone: string, from?: Date): Date | null {
  try {
    // Simple cron parser for common patterns
    const parts = cronExpression.split(" ");
    if (parts.length !== 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = from || new Date();
    
    // For simplicity, calculate next occurrence
    // This is a simplified implementation - in production, use a library like cron-parser
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    // Parse minute
    if (minute !== "*") {
      const targetMinute = parseInt(minute);
      if (!isNaN(targetMinute)) {
        if (next.getMinutes() >= targetMinute) {
          next.setHours(next.getHours() + 1);
        }
        next.setMinutes(targetMinute);
      }
    }
    
    // Parse hour
    if (hour !== "*") {
      const targetHour = parseInt(hour);
      if (!isNaN(targetHour)) {
        if (next.getHours() > targetHour || (next.getHours() === targetHour && next.getMinutes() > parseInt(minute))) {
          next.setDate(next.getDate() + 1);
        }
        next.setHours(targetHour);
      }
    }
    
    return next;
  } catch {
    return null;
  }
}
