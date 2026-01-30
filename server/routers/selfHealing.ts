/**
 * Self-Healing Engine Router
 * 
 * Provides autonomous infrastructure recovery with learned patterns
 * and configurable healing rules.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// Types
interface HealingRule {
  id: number;
  name: string;
  description: string;
  conditionType: string;
  conditionConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  targetType: "container" | "pod" | "deployment" | "service" | "node";
  targetSelector?: Record<string, string>;
  enabled: boolean;
  cooldownSeconds: number;
  maxRetries: number;
  requiresApproval: boolean;
  lastTriggeredAt?: Date;
  triggerCount: number;
  successCount: number;
}

interface HealingAction {
  id: number;
  ruleId: number;
  ruleName: string;
  targetResource: string;
  triggerReason: string;
  actionTaken: string;
  status: "pending" | "executing" | "success" | "failed" | "rolled_back";
  result?: string;
  rollbackAction?: string;
  executedAt: Date;
  completedAt?: Date;
}

interface HealingPattern {
  id: number;
  patternName: string;
  symptomSignature: Record<string, unknown>;
  successfulActions: string[];
  failedActions: string[];
  confidenceScore: number;
  occurrenceCount: number;
  lastOccurrence: Date;
}

// In-memory storage
const healingRules: Map<number, HealingRule> = new Map();
const healingActions: Map<number, HealingAction> = new Map();
const healingPatterns: Map<number, HealingPattern> = new Map();
let ruleIdCounter = 1;
let actionIdCounter = 1;
let patternIdCounter = 1;

// Initialize default rules
const initializeDefaultRules = () => {
  const defaultRules: Omit<HealingRule, "id" | "triggerCount" | "successCount">[] = [
    {
      name: "Restart Crashed Containers",
      description: "Automatically restart containers that have crashed or exited unexpectedly",
      conditionType: "container_status",
      conditionConfig: { status: "exited", exitCode: { ne: 0 } },
      actionType: "restart",
      actionConfig: { maxRestarts: 3, backoffSeconds: 30 },
      targetType: "container",
      enabled: true,
      cooldownSeconds: 60,
      maxRetries: 3,
      requiresApproval: false,
    },
    {
      name: "Scale on High CPU",
      description: "Scale up deployment when CPU usage exceeds 80% for 5 minutes",
      conditionType: "metric_threshold",
      conditionConfig: { metric: "cpu_usage", threshold: 80, duration: "5m", operator: "gt" },
      actionType: "scale_up",
      actionConfig: { increment: 1, maxReplicas: 10 },
      targetType: "deployment",
      enabled: true,
      cooldownSeconds: 300,
      maxRetries: 1,
      requiresApproval: false,
    },
    {
      name: "Scale Down on Low CPU",
      description: "Scale down deployment when CPU usage is below 20% for 15 minutes",
      conditionType: "metric_threshold",
      conditionConfig: { metric: "cpu_usage", threshold: 20, duration: "15m", operator: "lt" },
      actionType: "scale_down",
      actionConfig: { decrement: 1, minReplicas: 1 },
      targetType: "deployment",
      enabled: true,
      cooldownSeconds: 600,
      maxRetries: 1,
      requiresApproval: false,
    },
    {
      name: "Restart OOMKilled Pods",
      description: "Restart pods killed due to out of memory and increase memory limit",
      conditionType: "pod_event",
      conditionConfig: { reason: "OOMKilled" },
      actionType: "restart_with_resources",
      actionConfig: { memoryIncrease: "20%", maxMemory: "4Gi" },
      targetType: "pod",
      enabled: true,
      cooldownSeconds: 120,
      maxRetries: 2,
      requiresApproval: true,
    },
    {
      name: "Rollback Failed Deployment",
      description: "Automatically rollback deployment if health checks fail after update",
      conditionType: "deployment_status",
      conditionConfig: { status: "failed", reason: "ProgressDeadlineExceeded" },
      actionType: "rollback",
      actionConfig: { toRevision: "previous" },
      targetType: "deployment",
      enabled: true,
      cooldownSeconds: 60,
      maxRetries: 1,
      requiresApproval: true,
    },
    {
      name: "Drain Unhealthy Node",
      description: "Drain workloads from node reporting NotReady status",
      conditionType: "node_status",
      conditionConfig: { status: "NotReady", duration: "5m" },
      actionType: "drain_node",
      actionConfig: { gracePeriod: 30, force: false },
      targetType: "node",
      enabled: false,
      cooldownSeconds: 600,
      maxRetries: 1,
      requiresApproval: true,
    },
    {
      name: "Clear Disk Space",
      description: "Clean up unused images and volumes when disk usage exceeds 85%",
      conditionType: "metric_threshold",
      conditionConfig: { metric: "disk_usage", threshold: 85, operator: "gt" },
      actionType: "cleanup",
      actionConfig: { pruneImages: true, pruneVolumes: false, olderThan: "7d" },
      targetType: "node",
      enabled: true,
      cooldownSeconds: 3600,
      maxRetries: 1,
      requiresApproval: false,
    },
  ];

  defaultRules.forEach(r => {
    const id = ruleIdCounter++;
    healingRules.set(id, { ...r, id, triggerCount: 0, successCount: 0 });
  });

  // Initialize sample patterns
  const samplePatterns: Omit<HealingPattern, "id">[] = [
    {
      patternName: "Memory Leak Recovery",
      symptomSignature: { memoryGrowth: "linear", duration: ">1h", restartCount: ">2" },
      successfulActions: ["restart", "increase_memory_limit"],
      failedActions: ["scale_up"],
      confidenceScore: 85,
      occurrenceCount: 12,
      lastOccurrence: new Date(),
    },
    {
      patternName: "Connection Pool Exhaustion",
      symptomSignature: { errorPattern: "connection refused", targetService: "database" },
      successfulActions: ["restart_pods", "increase_pool_size"],
      failedActions: [],
      confidenceScore: 92,
      occurrenceCount: 5,
      lastOccurrence: new Date(),
    },
  ];

  samplePatterns.forEach(p => {
    const id = patternIdCounter++;
    healingPatterns.set(id, { ...p, id });
  });
};

initializeDefaultRules();

// AI Functions
async function analyzeSymptoms(symptoms: Record<string, unknown>): Promise<{
  diagnosis: string;
  recommendedActions: string[];
  confidence: number;
}> {
  try {
    const prompt = `Analyze these infrastructure symptoms and recommend healing actions:

Symptoms:
${JSON.stringify(symptoms, null, 2)}

Provide:
1. Diagnosis of the issue
2. Recommended healing actions in order of priority
3. Confidence level (0-100)`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert SRE specializing in self-healing infrastructure and automated remediation." },
        { role: "user", content: prompt }
      ]
    });

    const content = response.choices[0]?.message?.content || "";
    
    // Parse response (simplified)
    return {
      diagnosis: content.split("\n")[0] || "Unable to diagnose",
      recommendedActions: ["restart", "scale_up", "check_logs"],
      confidence: 75,
    };
  } catch (error) {
    console.error("Symptom analysis error:", error);
    return {
      diagnosis: "AI analysis unavailable",
      recommendedActions: ["manual_investigation"],
      confidence: 0,
    };
  }
}

async function learnFromAction(action: HealingAction): Promise<void> {
  // Update or create pattern based on action outcome
  const existingPattern = Array.from(healingPatterns.values()).find(p =>
    p.symptomSignature.actionType === action.actionTaken
  );

  if (existingPattern) {
    existingPattern.occurrenceCount++;
    existingPattern.lastOccurrence = new Date();
    
    if (action.status === "success") {
      if (!existingPattern.successfulActions.includes(action.actionTaken)) {
        existingPattern.successfulActions.push(action.actionTaken);
      }
      existingPattern.confidenceScore = Math.min(100, existingPattern.confidenceScore + 2);
    } else if (action.status === "failed") {
      if (!existingPattern.failedActions.includes(action.actionTaken)) {
        existingPattern.failedActions.push(action.actionTaken);
      }
      existingPattern.confidenceScore = Math.max(0, existingPattern.confidenceScore - 5);
    }
  }
}

// Router
export const selfHealingRouter = router({
  // List all healing rules
  listRules: publicProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      targetType: z.enum(["container", "pod", "deployment", "service", "node", "all"]).optional(),
    }).optional())
    .query(({ input }) => {
      let result = Array.from(healingRules.values());
      
      if (input?.enabled !== undefined) {
        result = result.filter(r => r.enabled === input.enabled);
      }
      if (input?.targetType && input.targetType !== "all") {
        result = result.filter(r => r.targetType === input.targetType);
      }
      
      return result;
    }),

  // Get single rule
  getRule: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const rule = healingRules.get(input.id);
      if (!rule) throw new Error("Rule not found");
      return rule;
    }),

  // Create healing rule
  createRule: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      conditionType: z.string(),
      conditionConfig: z.record(z.unknown()),
      actionType: z.string(),
      actionConfig: z.record(z.unknown()),
      targetType: z.enum(["container", "pod", "deployment", "service", "node"]),
      targetSelector: z.record(z.string()).optional(),
      cooldownSeconds: z.number().min(0).optional().default(300),
      maxRetries: z.number().min(1).max(10).optional().default(3),
      requiresApproval: z.boolean().optional().default(false),
    }))
    .mutation(({ input }) => {
      const id = ruleIdCounter++;
      const rule: HealingRule = {
        id,
        name: input.name,
        description: input.description || "",
        conditionType: input.conditionType,
        conditionConfig: input.conditionConfig,
        actionType: input.actionType,
        actionConfig: input.actionConfig,
        targetType: input.targetType,
        targetSelector: input.targetSelector,
        enabled: true,
        cooldownSeconds: input.cooldownSeconds,
        maxRetries: input.maxRetries,
        requiresApproval: input.requiresApproval,
        triggerCount: 0,
        successCount: 0,
      };
      
      healingRules.set(id, rule);
      return rule;
    }),

  // Update healing rule
  updateRule: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      conditionConfig: z.record(z.unknown()).optional(),
      actionConfig: z.record(z.unknown()).optional(),
      cooldownSeconds: z.number().optional(),
      maxRetries: z.number().optional(),
      requiresApproval: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const rule = healingRules.get(input.id);
      if (!rule) throw new Error("Rule not found");
      
      if (input.name) rule.name = input.name;
      if (input.description) rule.description = input.description;
      if (input.conditionConfig) rule.conditionConfig = input.conditionConfig;
      if (input.actionConfig) rule.actionConfig = input.actionConfig;
      if (input.cooldownSeconds !== undefined) rule.cooldownSeconds = input.cooldownSeconds;
      if (input.maxRetries !== undefined) rule.maxRetries = input.maxRetries;
      if (input.requiresApproval !== undefined) rule.requiresApproval = input.requiresApproval;
      
      return rule;
    }),

  // Toggle rule enabled state
  toggleRule: publicProcedure
    .input(z.object({
      id: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(({ input }) => {
      const rule = healingRules.get(input.id);
      if (!rule) throw new Error("Rule not found");
      
      rule.enabled = input.enabled;
      return rule;
    }),

  // Delete rule
  deleteRule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      if (!healingRules.has(input.id)) throw new Error("Rule not found");
      healingRules.delete(input.id);
      return { success: true };
    }),

  // Get healing action history
  getHistory: publicProcedure
    .input(z.object({
      ruleId: z.number().optional(),
      status: z.enum(["pending", "executing", "success", "failed", "rolled_back", "all"]).optional(),
      limit: z.number().min(1).max(100).optional().default(50),
    }).optional())
    .query(({ input }) => {
      let result = Array.from(healingActions.values());
      
      if (input?.ruleId) {
        result = result.filter(a => a.ruleId === input.ruleId);
      }
      if (input?.status && input.status !== "all") {
        result = result.filter(a => a.status === input.status);
      }
      
      return result
        .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
        .slice(0, input?.limit || 50);
    }),

  // Trigger healing action manually
  triggerHealing: publicProcedure
    .input(z.object({
      ruleId: z.number(),
      targetResource: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const rule = healingRules.get(input.ruleId);
      if (!rule) throw new Error("Rule not found");
      
      const actionId = actionIdCounter++;
      const action: HealingAction = {
        id: actionId,
        ruleId: rule.id,
        ruleName: rule.name,
        targetResource: input.targetResource,
        triggerReason: input.reason || "Manual trigger",
        actionTaken: rule.actionType,
        status: "executing",
        executedAt: new Date(),
      };
      
      healingActions.set(actionId, action);
      
      // Update rule stats
      rule.triggerCount++;
      rule.lastTriggeredAt = new Date();
      
      // Simulate action execution
      setTimeout(async () => {
        const success = Math.random() > 0.2; // 80% success rate
        action.status = success ? "success" : "failed";
        action.completedAt = new Date();
        action.result = success 
          ? `Successfully executed ${rule.actionType} on ${input.targetResource}`
          : `Failed to execute ${rule.actionType}: simulated failure`;
        
        if (success) {
          rule.successCount++;
        }
        
        // Learn from action
        await learnFromAction(action);
      }, 2000);
      
      return action;
    }),

  // Approve pending action (for rules requiring approval)
  approveAction: publicProcedure
    .input(z.object({ actionId: z.number() }))
    .mutation(({ input }) => {
      const action = healingActions.get(input.actionId);
      if (!action) throw new Error("Action not found");
      if (action.status !== "pending") throw new Error("Action is not pending approval");
      
      action.status = "executing";
      
      // Simulate execution after approval
      setTimeout(() => {
        action.status = "success";
        action.completedAt = new Date();
        action.result = "Action completed after approval";
      }, 1500);
      
      return action;
    }),

  // Rollback action
  rollbackAction: publicProcedure
    .input(z.object({ actionId: z.number() }))
    .mutation(({ input }) => {
      const action = healingActions.get(input.actionId);
      if (!action) throw new Error("Action not found");
      
      action.status = "rolled_back";
      action.rollbackAction = `Rolled back ${action.actionTaken}`;
      
      return action;
    }),

  // Get learned patterns
  getPatterns: publicProcedure.query(() => {
    return Array.from(healingPatterns.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
  }),

  // Analyze symptoms and get recommendations
  analyzeSymptoms: publicProcedure
    .input(z.object({
      symptoms: z.record(z.unknown()),
    }))
    .mutation(async ({ input }) => {
      return await analyzeSymptoms(input.symptoms);
    }),

  // Get dashboard stats
  getStats: publicProcedure.query(() => {
    const rules = Array.from(healingRules.values());
    const actions = Array.from(healingActions.values());
    const patterns = Array.from(healingPatterns.values());
    
    const totalActions = actions.length;
    const successfulActions = actions.filter(a => a.status === "success").length;
    const failedActions = actions.filter(a => a.status === "failed").length;
    
    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      totalActions,
      successfulActions,
      failedActions,
      successRate: totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 0,
      pendingApprovals: actions.filter(a => a.status === "pending").length,
      learnedPatterns: patterns.length,
      avgConfidence: patterns.length > 0 
        ? Math.round(patterns.reduce((sum, p) => sum + p.confidenceScore, 0) / patterns.length)
        : 0,
    };
  }),

  // Get rule effectiveness
  getRuleEffectiveness: publicProcedure.query(() => {
    return Array.from(healingRules.values())
      .filter(r => r.triggerCount > 0)
      .map(r => ({
        id: r.id,
        name: r.name,
        triggerCount: r.triggerCount,
        successCount: r.successCount,
        successRate: Math.round((r.successCount / r.triggerCount) * 100),
        lastTriggered: r.lastTriggeredAt,
      }))
      .sort((a, b) => b.triggerCount - a.triggerCount);
  }),
});
