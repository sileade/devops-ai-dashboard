/**
 * Auto-Scaling Router
 * Handles CRUD operations for autoscaling rules and executes scaling actions
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getAutoscalingRules,
  getAutoscalingRuleById,
  createAutoscalingRule,
  updateAutoscalingRule,
  deleteAutoscalingRule,
  recordAutoscalingAction,
  updateAutoscalingActionStatus,
  getAutoscalingHistory,
  getPendingApprovalActions,
  saveAiScalingPrediction,
  getAiPredictions,
  isRuleInCooldown,
  updateRuleLastScaled,
  getMetricsHistory as getDbMetricsHistory,
} from "../db";
import {
  analyzeMetricsForScaling,
  generateScalingExplanation,
  predictFutureLoad,
  ScalingContext,
  MetricDataPoint,
} from "../infrastructure/ai-autoscaler";
import * as kubernetes from "../infrastructure/kubernetes";

export const autoscalingRouter = router({
  // Get all autoscaling rules
  getRules: publicProcedure
    .input(z.object({
      applicationId: z.number().optional(),
      resourceType: z.enum(["deployment", "container", "pod", "service"]).optional(),
      enabledOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await getAutoscalingRules(input);
    }),

  // Get single rule by ID
  getRule: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getAutoscalingRuleById(input.id);
    }),

  // Create new autoscaling rule
  createRule: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      resourceType: z.enum(["deployment", "container", "pod", "service"]),
      resourcePattern: z.string().min(1).max(255),
      namespace: z.string().optional(),
      metricType: z.enum(["cpu", "memory", "requests", "custom"]),
      scaleUpThreshold: z.number().min(1).max(100),
      scaleDownThreshold: z.number().min(0).max(99),
      minReplicas: z.number().min(0).max(100).default(1),
      maxReplicas: z.number().min(1).max(1000).default(10),
      cooldownSeconds: z.number().min(60).max(3600).default(300),
      scaleUpStep: z.number().min(1).max(10).default(1),
      scaleDownStep: z.number().min(1).max(10).default(1),
      requiresApproval: z.boolean().default(false),
      aiAssisted: z.boolean().default(true),
      applicationId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createAutoscalingRule({
        ...input,
        isEnabled: true,
      });
      return { success: !!id, id };
    }),

  // Update autoscaling rule
  updateRule: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      scaleUpThreshold: z.number().min(1).max(100).optional(),
      scaleDownThreshold: z.number().min(0).max(99).optional(),
      minReplicas: z.number().min(0).max(100).optional(),
      maxReplicas: z.number().min(1).max(1000).optional(),
      cooldownSeconds: z.number().min(60).max(3600).optional(),
      scaleUpStep: z.number().min(1).max(10).optional(),
      scaleDownStep: z.number().min(1).max(10).optional(),
      isEnabled: z.boolean().optional(),
      requiresApproval: z.boolean().optional(),
      aiAssisted: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const success = await updateAutoscalingRule(id, updates);
      return { success };
    }),

  // Delete autoscaling rule
  deleteRule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = await deleteAutoscalingRule(input.id);
      return { success };
    }),

  // Toggle rule enabled/disabled
  toggleRule: publicProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const success = await updateAutoscalingRule(input.id, { isEnabled: input.enabled });
      return { success };
    }),

  // Get scaling history
  getHistory: publicProcedure
    .input(z.object({
      ruleId: z.number().optional(),
      applicationId: z.number().optional(),
      status: z.enum(["pending", "executing", "completed", "failed", "cancelled"]).optional(),
      limit: z.number().min(1).max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      return await getAutoscalingHistory(input);
    }),

  // Get pending approval actions
  getPendingApprovals: publicProcedure
    .query(async () => {
      return await getPendingApprovalActions();
    }),

  // Approve or reject a pending scaling action
  handleApproval: publicProcedure
    .input(z.object({
      actionId: z.number(),
      approved: z.boolean(),
      userId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.approved) {
        // Execute the scaling action
        await updateAutoscalingActionStatus(input.actionId, "executing");
        // TODO: Actually execute the scaling
        await updateAutoscalingActionStatus(input.actionId, "completed");
      } else {
        await updateAutoscalingActionStatus(input.actionId, "cancelled", "Rejected by user");
      }
      return { success: true };
    }),

  // Analyze metrics and get AI recommendation
  analyzeForScaling: publicProcedure
    .input(z.object({
      ruleId: z.number(),
      currentMetricValue: z.number(),
      currentReplicas: z.number(),
    }))
    .mutation(async ({ input }) => {
      const rule = await getAutoscalingRuleById(input.ruleId);
      if (!rule) {
        return { error: "Rule not found" };
      }

      // Check cooldown
      const inCooldown = await isRuleInCooldown(input.ruleId);
      if (inCooldown) {
        return {
          shouldScale: false,
          direction: "none",
          confidence: 100,
          reasoning: "Rule is in cooldown period",
          inCooldown: true,
        };
      }

      // Get metrics history for AI analysis
      const metricsHistoryData = await getDbMetricsHistory({
        resourceType: rule.resourceType === "deployment" ? "pod" : "container",
        limit: 100,
      });

      const metricsHistory: MetricDataPoint[] = metricsHistoryData.map(m => ({
        timestamp: m.timestamp.getTime(),
        value: rule.metricType === "cpu" ? m.cpuPercent : m.memoryPercent,
      }));

      const context: ScalingContext = {
        resourceName: rule.resourcePattern,
        resourceType: rule.resourceType,
        namespace: rule.namespace || undefined,
        currentReplicas: input.currentReplicas,
        minReplicas: rule.minReplicas,
        maxReplicas: rule.maxReplicas,
        scaleUpThreshold: rule.scaleUpThreshold,
        scaleDownThreshold: rule.scaleDownThreshold,
        currentMetricValue: input.currentMetricValue,
        metricType: rule.metricType,
        metricsHistory,
        lastScaledAt: rule.lastScaledAt || undefined,
        cooldownSeconds: rule.cooldownSeconds,
      };

      const analysis = await analyzeMetricsForScaling(context);

      // Save prediction if AI-assisted
      if (rule.aiAssisted && analysis.predictedLoad !== null) {
        await saveAiScalingPrediction({
          ruleId: rule.id,
          applicationId: rule.applicationId || undefined,
          predictedMetricValue: analysis.predictedLoad,
          predictedTime: new Date(Date.now() + 15 * 60 * 1000), // 15 min ahead
          recommendedReplicas: analysis.recommendedReplicas,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          dataPointsAnalyzed: metricsHistory.length,
          patternDetected: analysis.pattern || undefined,
        });
      }

      return analysis;
    }),

  // Execute scaling action
  executeScaling: publicProcedure
    .input(z.object({
      ruleId: z.number(),
      direction: z.enum(["up", "down"]),
      targetReplicas: z.number(),
      currentReplicas: z.number(),
      triggerValue: z.number(),
      aiAnalysis: z.string().optional(),
      aiConfidence: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const rule = await getAutoscalingRuleById(input.ruleId);
      if (!rule) {
        return { success: false, error: "Rule not found" };
      }

      // Check cooldown
      const inCooldown = await isRuleInCooldown(input.ruleId);
      if (inCooldown) {
        return { success: false, error: "Rule is in cooldown" };
      }

      // Record the action
      const actionId = await recordAutoscalingAction({
        ruleId: rule.id,
        applicationId: rule.applicationId || undefined,
        action: rule.requiresApproval ? "pending_approval" : (input.direction === "up" ? "scale_up" : "scale_down"),
        previousReplicas: input.currentReplicas,
        newReplicas: input.targetReplicas,
        triggerMetric: rule.metricType,
        triggerValue: input.triggerValue,
        thresholdValue: input.direction === "up" ? rule.scaleUpThreshold : rule.scaleDownThreshold,
        aiAnalysis: input.aiAnalysis || undefined,
        aiConfidence: input.aiConfidence || undefined,
        executedBy: "ai",
        status: rule.requiresApproval ? "pending" : "executing",
      });

      if (!actionId) {
        return { success: false, error: "Failed to record action" };
      }

      // If requires approval, stop here
      if (rule.requiresApproval) {
        return {
          success: true,
          requiresApproval: true,
          actionId,
          message: "Scaling action pending approval",
        };
      }

      // Execute the scaling
      try {
        const startTime = Date.now();

        if (rule.resourceType === "deployment") {
          // Scale Kubernetes deployment
          await kubernetes.scaleDeployment(
            rule.resourcePattern,
            rule.namespace || "default",
            input.targetReplicas
          );
        } else if (rule.resourceType === "container") {
          // For Docker containers, we would need to implement container scaling
          // This is a placeholder for now
          console.log(`[AutoScaler] Would scale container ${rule.resourcePattern} to ${input.targetReplicas}`);
        }

        const executionTime = Date.now() - startTime;

        // Update action status
        await updateAutoscalingActionStatus(actionId, "completed");
        await updateRuleLastScaled(rule.id);

        return {
          success: true,
          actionId,
          executionTimeMs: executionTime,
          message: `Scaled ${rule.resourcePattern} from ${input.currentReplicas} to ${input.targetReplicas} replicas`,
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
          error: error instanceof Error ? error.message : "Scaling failed",
        };
      }
    }),

  // Get AI predictions for a rule
  getPredictions: publicProcedure
    .input(z.object({
      ruleId: z.number(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      return await getAiPredictions(input.ruleId, input.limit);
    }),

  // Predict future load
  predictLoad: publicProcedure
    .input(z.object({
      hoursAhead: z.number().min(1).max(24).default(1),
    }))
    .mutation(async ({ input }) => {
      // Get recent metrics
      const metricsHistoryData = await getDbMetricsHistory({
        limit: 288, // 24 hours at 5-min intervals
      });

      const metricsHistory: MetricDataPoint[] = metricsHistoryData.map(m => ({
        timestamp: m.timestamp.getTime(),
        value: m.cpuPercent,
      }));

      return await predictFutureLoad(metricsHistory, input.hoursAhead);
    }),

  // Get scaling summary/dashboard data
  getSummary: publicProcedure
    .query(async () => {
      const rules = await getAutoscalingRules();
      const history = await getAutoscalingHistory({ limit: 50 });
      const pendingApprovals = await getPendingApprovalActions();

      const enabledRules = rules.filter(r => r.isEnabled).length;
      const totalScalingActions = history.length;
      const successfulActions = history.filter(h => h.status === "completed").length;
      const failedActions = history.filter(h => h.status === "failed").length;

      // Calculate recent activity
      const last24h = history.filter(h => {
        const createdAt = h.createdAt.getTime();
        return Date.now() - createdAt < 24 * 60 * 60 * 1000;
      });

      const scaleUpCount = last24h.filter(h => h.action === "scale_up").length;
      const scaleDownCount = last24h.filter(h => h.action === "scale_down").length;

      return {
        totalRules: rules.length,
        enabledRules,
        pendingApprovals: pendingApprovals.length,
        last24h: {
          total: last24h.length,
          scaleUp: scaleUpCount,
          scaleDown: scaleDownCount,
          successful: last24h.filter(h => h.status === "completed").length,
          failed: last24h.filter(h => h.status === "failed").length,
        },
        allTime: {
          total: totalScalingActions,
          successful: successfulActions,
          failed: failedActions,
          successRate: totalScalingActions > 0 
            ? Math.round((successfulActions / totalScalingActions) * 100) 
            : 100,
        },
      };
    }),
});
