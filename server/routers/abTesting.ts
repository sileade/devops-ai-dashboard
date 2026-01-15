import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getAbTestExperiments,
  getAbTestExperimentById,
  createAbTestExperiment,
  updateAbTestExperiment,
  deleteAbTestExperiment,
  getAbTestMetrics,
  recordAbTestMetrics,
  calculateAbTestStats,
  startAbTest,
  completeAbTest,
} from "../db";
import { invokeLLM } from "../_core/llm";

export const abTestingRouter = router({
  // Get all experiments
  list: publicProcedure
    .input(z.object({
      applicationId: z.number().optional(),
      status: z.enum(["draft", "running", "paused", "completed", "cancelled"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      return await getAbTestExperiments(input);
    }),

  // Get single experiment
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const experiment = await getAbTestExperimentById(input.id);
      if (!experiment) return null;

      const stats = await calculateAbTestStats(input.id);
      return { ...experiment, stats };
    }),

  // Create experiment
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      targetType: z.enum(["deployment", "container", "service"]),
      targetName: z.string().min(1).max(255),
      namespace: z.string().optional(),
      // Variant A
      variantAName: z.string().default("Control"),
      variantAScaleUpThreshold: z.number().min(1).max(100),
      variantAScaleDownThreshold: z.number().min(1).max(100),
      variantACooldown: z.number().min(60).max(3600).default(300),
      variantAMinReplicas: z.number().min(0).max(100).default(1),
      variantAMaxReplicas: z.number().min(1).max(100).default(10),
      // Variant B
      variantBName: z.string().default("Treatment"),
      variantBScaleUpThreshold: z.number().min(1).max(100),
      variantBScaleDownThreshold: z.number().min(1).max(100),
      variantBCooldown: z.number().min(60).max(3600).default(300),
      variantBMinReplicas: z.number().min(0).max(100).default(1),
      variantBMaxReplicas: z.number().min(1).max(100).default(10),
      // Settings
      trafficSplitPercent: z.number().min(10).max(90).default(50),
      durationHours: z.number().min(1).max(168).default(24),
      applicationId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createAbTestExperiment(input);
      
      if (!id) {
        throw new Error("Failed to create A/B test experiment");
      }
      
      return { id, success: true };
    }),

  // Update experiment
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      variantAName: z.string().optional(),
      variantBName: z.string().optional(),
      trafficSplitPercent: z.number().min(10).max(90).optional(),
      durationHours: z.number().min(1).max(168).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const success = await updateAbTestExperiment(id, updates);
      return { success };
    }),

  // Delete experiment
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const experiment = await getAbTestExperimentById(input.id);
      if (experiment?.status === "running") {
        throw new Error("Cannot delete a running experiment. Stop it first.");
      }
      
      const success = await deleteAbTestExperiment(input.id);
      return { success };
    }),

  // Start experiment
  start: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const experiment = await getAbTestExperimentById(input.id);
      if (!experiment) {
        throw new Error("Experiment not found");
      }
      
      if (experiment.status !== "draft" && experiment.status !== "paused") {
        throw new Error("Can only start draft or paused experiments");
      }
      
      const success = await startAbTest(input.id);
      return { success };
    }),

  // Pause experiment
  pause: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const experiment = await getAbTestExperimentById(input.id);
      if (!experiment) {
        throw new Error("Experiment not found");
      }
      
      if (experiment.status !== "running") {
        throw new Error("Can only pause running experiments");
      }
      
      const success = await updateAbTestExperiment(input.id, { status: "paused" });
      return { success };
    }),

  // Stop and analyze experiment
  complete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const experiment = await getAbTestExperimentById(input.id);
      if (!experiment) {
        throw new Error("Experiment not found");
      }
      
      // Calculate final stats
      const stats = await calculateAbTestStats(input.id);
      
      // Generate AI analysis
      let aiReason = "";
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an expert in autoscaling optimization. Analyze A/B test results and provide a concise recommendation."
            },
            {
              role: "user",
              content: `Analyze this A/B test for autoscaling rules:

Experiment: ${experiment.name}
Target: ${experiment.targetName}

Variant A (${experiment.variantAName}):
- Scale Up Threshold: ${experiment.variantAScaleUpThreshold}%
- Scale Down Threshold: ${experiment.variantAScaleDownThreshold}%
- Cooldown: ${experiment.variantACooldown}s
- Replicas: ${experiment.variantAMinReplicas}-${experiment.variantAMaxReplicas}
- Results: Avg CPU ${stats.variantA.avgCpu}%, Avg Memory ${stats.variantA.avgMemory}%, Avg Replicas ${stats.variantA.avgReplicas}, Scale Ops ${stats.variantA.totalScaleOps}, Oscillations ${stats.variantA.oscillations}

Variant B (${experiment.variantBName}):
- Scale Up Threshold: ${experiment.variantBScaleUpThreshold}%
- Scale Down Threshold: ${experiment.variantBScaleDownThreshold}%
- Cooldown: ${experiment.variantBCooldown}s
- Replicas: ${experiment.variantBMinReplicas}-${experiment.variantBMaxReplicas}
- Results: Avg CPU ${stats.variantB.avgCpu}%, Avg Memory ${stats.variantB.avgMemory}%, Avg Replicas ${stats.variantB.avgReplicas}, Scale Ops ${stats.variantB.totalScaleOps}, Oscillations ${stats.variantB.oscillations}

Sample sizes: A=${stats.sampleSize.A}, B=${stats.sampleSize.B}

Provide a 2-3 sentence recommendation on which variant performed better and why.`
            }
          ]
        });
        
        const content = response.choices[0]?.message?.content;
        aiReason = typeof content === "string" ? content : "Analysis completed.";
      } catch {
        aiReason = `Based on metrics analysis: Variant ${stats.recommendation} showed ${stats.recommendation === "A" ? "fewer" : "more"} oscillations and ${stats.recommendation === "A" ? "lower" : "higher"} average replica count.`;
      }
      
      const success = await completeAbTest(
        input.id,
        stats.recommendation,
        stats.confidence,
        aiReason
      );
      
      return {
        success,
        winner: stats.recommendation,
        confidence: stats.confidence,
        reason: aiReason,
        stats,
      };
    }),

  // Get experiment metrics
  getMetrics: publicProcedure
    .input(z.object({
      experimentId: z.number(),
      variant: z.enum(["A", "B"]).optional(),
    }))
    .query(async ({ input }) => {
      return await getAbTestMetrics(input.experimentId, input.variant);
    }),

  // Record metrics (called by autoscaling engine)
  recordMetrics: publicProcedure
    .input(z.object({
      experimentId: z.number(),
      variant: z.enum(["A", "B"]),
      avgCpuPercent: z.number(),
      avgMemoryPercent: z.number(),
      avgResponseTimeMs: z.number().optional(),
      errorRate: z.number().optional(),
      scaleUpCount: z.number().default(0),
      scaleDownCount: z.number().default(0),
      avgReplicaCount: z.number(),
      estimatedCostUnits: z.number().optional(),
      oscillationCount: z.number().default(0),
      cooldownViolations: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const id = await recordAbTestMetrics(input);
      return { id, success: !!id };
    }),

  // Get statistics
  getStats: publicProcedure
    .input(z.object({ experimentId: z.number() }))
    .query(async ({ input }) => {
      return await calculateAbTestStats(input.experimentId);
    }),

  // Apply winner configuration
  applyWinner: publicProcedure
    .input(z.object({ experimentId: z.number() }))
    .mutation(async ({ input }) => {
      const experiment = await getAbTestExperimentById(input.experimentId);
      if (!experiment) {
        throw new Error("Experiment not found");
      }
      
      if (experiment.status !== "completed" || !experiment.winnerVariant) {
        throw new Error("Experiment must be completed with a winner to apply");
      }
      
      if (experiment.winnerVariant === "inconclusive") {
        throw new Error("Cannot apply inconclusive results");
      }
      
      // Return the winning configuration for the user to apply
      const winnerConfig = experiment.winnerVariant === "A" ? {
        scaleUpThreshold: experiment.variantAScaleUpThreshold,
        scaleDownThreshold: experiment.variantAScaleDownThreshold,
        cooldown: experiment.variantACooldown,
        minReplicas: experiment.variantAMinReplicas,
        maxReplicas: experiment.variantAMaxReplicas,
      } : {
        scaleUpThreshold: experiment.variantBScaleUpThreshold,
        scaleDownThreshold: experiment.variantBScaleDownThreshold,
        cooldown: experiment.variantBCooldown,
        minReplicas: experiment.variantBMinReplicas,
        maxReplicas: experiment.variantBMaxReplicas,
      };
      
      return {
        success: true,
        winnerVariant: experiment.winnerVariant,
        config: winnerConfig,
        message: `Apply these settings to your autoscaling rule for ${experiment.targetName}`,
      };
    }),
});
