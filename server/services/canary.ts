import { getDb } from "../db";
import {
  canaryDeployments,
  canaryDeploymentSteps,
  canaryMetrics,
  canaryRollbackHistory,
  canaryTemplates,
  type CanaryDeployment,
  type InsertCanaryDeployment,
  type CanaryDeploymentStep,
  type InsertCanaryDeploymentStep,
  type CanaryMetric,
  type InsertCanaryMetric,
  type CanaryRollbackHistory,
  type InsertCanaryRollbackHistory,
  type CanaryTemplate,
  type InsertCanaryTemplate,
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// Types for canary deployment operations
export interface CanaryDeploymentConfig {
  name: string;
  namespace?: string;
  targetDeployment: string;
  canaryImage: string;
  canaryVersion?: string;
  stableImage?: string;
  stableVersion?: string;
  clusterId?: number;
  applicationId?: number;
  
  // Traffic configuration
  trafficSplitType?: "percentage" | "header" | "cookie";
  initialCanaryPercent?: number;
  targetCanaryPercent?: number;
  incrementPercent?: number;
  incrementIntervalMinutes?: number;
  
  // Health thresholds
  errorRateThreshold?: number;
  latencyThresholdMs?: number;
  successRateThreshold?: number;
  minHealthyPods?: number;
  
  // Rollback settings
  autoRollbackEnabled?: boolean;
  rollbackOnErrorRate?: boolean;
  rollbackOnLatency?: boolean;
  rollbackOnPodFailure?: boolean;
  
  // Other settings
  requireManualApproval?: boolean;
  gitCommit?: string;
  gitBranch?: string;
  pullRequestUrl?: string;
}

export interface CanaryAnalysisResult {
  isHealthy: boolean;
  shouldRollback: boolean;
  shouldPromote: boolean;
  analysisResult: "healthy" | "degraded" | "unhealthy" | "inconclusive";
  reasons: string[];
  metrics: {
    canaryErrorRate: number;
    stableErrorRate: number;
    canaryAvgLatency: number;
    stableAvgLatency: number;
    canaryHealthyPods: number;
    canaryTotalPods: number;
  };
  aiRecommendation?: string;
}

// ============================================
// DEPLOYMENT MANAGEMENT
// ============================================

export async function createCanaryDeployment(
  userId: number,
  config: CanaryDeploymentConfig
): Promise<CanaryDeployment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const deploymentData: InsertCanaryDeployment = {
    userId,
    applicationId: config.applicationId,
    clusterId: config.clusterId,
    name: config.name,
    namespace: config.namespace || "default",
    targetDeployment: config.targetDeployment,
    stableVersion: config.stableVersion,
    canaryVersion: config.canaryVersion,
    stableImage: config.stableImage,
    canaryImage: config.canaryImage,
    trafficSplitType: config.trafficSplitType || "percentage",
    initialCanaryPercent: config.initialCanaryPercent || 10,
    currentCanaryPercent: 0,
    targetCanaryPercent: config.targetCanaryPercent || 100,
    incrementPercent: config.incrementPercent || 10,
    incrementIntervalMinutes: config.incrementIntervalMinutes || 5,
    errorRateThreshold: config.errorRateThreshold || 5,
    latencyThresholdMs: config.latencyThresholdMs || 1000,
    successRateThreshold: config.successRateThreshold || 95,
    minHealthyPods: config.minHealthyPods || 1,
    autoRollbackEnabled: config.autoRollbackEnabled ?? true,
    rollbackOnErrorRate: config.rollbackOnErrorRate ?? true,
    rollbackOnLatency: config.rollbackOnLatency ?? true,
    rollbackOnPodFailure: config.rollbackOnPodFailure ?? true,
    requireManualApproval: config.requireManualApproval ?? false,
    status: "pending",
    createdBy: String(userId),
    gitCommit: config.gitCommit,
    gitBranch: config.gitBranch,
    pullRequestUrl: config.pullRequestUrl,
  };
  
  const [result] = await db.insert(canaryDeployments).values(deploymentData);
  const deploymentId = result.insertId;
  
  // Create deployment steps based on configuration
  const steps = generateDeploymentSteps(
    deploymentId,
    config.initialCanaryPercent || 10,
    config.targetCanaryPercent || 100,
    config.incrementPercent || 10
  );
  
  if (steps.length > 0) {
    await db.insert(canaryDeploymentSteps).values(steps);
  }
  
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, deploymentId));
  
  return deployment;
}

function generateDeploymentSteps(
  deploymentId: number,
  initialPercent: number,
  targetPercent: number,
  incrementPercent: number
): InsertCanaryDeploymentStep[] {
  const steps: InsertCanaryDeploymentStep[] = [];
  let currentPercent = initialPercent;
  let stepNumber = 1;
  
  while (currentPercent <= targetPercent) {
    steps.push({
      deploymentId,
      stepNumber,
      targetPercent: currentPercent,
      status: "pending",
    });
    
    if (currentPercent === targetPercent) break;
    
    currentPercent = Math.min(currentPercent + incrementPercent, targetPercent);
    stepNumber++;
  }
  
  return steps;
}

export async function getCanaryDeployment(id: number): Promise<CanaryDeployment | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  return deployment || null;
}

export async function listCanaryDeployments(
  userId?: number,
  status?: string,
  limit = 50
): Promise<CanaryDeployment[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db.select().from(canaryDeployments);
  
  const conditions = [];
  if (userId) conditions.push(eq(canaryDeployments.userId, userId));
  if (status) conditions.push(eq(canaryDeployments.status, status as any));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(canaryDeployments.createdAt)).limit(limit);
}

export async function getDeploymentSteps(deploymentId: number): Promise<CanaryDeploymentStep[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(canaryDeploymentSteps)
    .where(eq(canaryDeploymentSteps.deploymentId, deploymentId))
    .orderBy(canaryDeploymentSteps.stepNumber);
}

// ============================================
// DEPLOYMENT LIFECYCLE
// ============================================

export async function startCanaryDeployment(id: number): Promise<CanaryDeployment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(canaryDeployments)
    .set({
      status: "initializing",
      startedAt: new Date(),
    })
    .where(eq(canaryDeployments.id, id));
  
  // Start first step
  const steps = await getDeploymentSteps(id);
  if (steps.length > 0) {
    await db
      .update(canaryDeploymentSteps)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(canaryDeploymentSteps.id, steps[0].id));
  }
  
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  
  return deployment;
}

export async function progressCanaryDeployment(id: number): Promise<{
  deployment: CanaryDeployment;
  analysis: CanaryAnalysisResult;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deployment = await getCanaryDeployment(id);
  
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  
  // Analyze current state
  const analysis = await analyzeCanaryHealth(id);
  
  // Record metrics
  await recordCanaryMetrics(id, analysis);
  
  if (analysis.shouldRollback) {
    // Trigger automatic rollback
    await initiateRollback(id, analysis.reasons[0] || "Health check failed", "auto_health_check");
    
    const [updated] = await db
      .select()
      .from(canaryDeployments)
      .where(eq(canaryDeployments.id, id));
    
    return { deployment: updated, analysis };
  }
  
  if (analysis.shouldPromote) {
    // Promote to next step or complete
    const steps = await getDeploymentSteps(id);
    const currentStep = steps.find(s => s.status === "running");
    
    if (currentStep) {
      // Complete current step
      await db
        .update(canaryDeploymentSteps)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(canaryDeploymentSteps.id, currentStep.id));
      
      // Find next step
      const nextStep = steps.find(s => s.stepNumber === currentStep.stepNumber + 1);
      
      if (nextStep) {
        // Start next step
        await db
          .update(canaryDeploymentSteps)
          .set({
            status: "running",
            startedAt: new Date(),
          })
          .where(eq(canaryDeploymentSteps.id, nextStep.id));
        
        // Update deployment progress
        await db
          .update(canaryDeployments)
          .set({
            status: "progressing",
            currentCanaryPercent: nextStep.targetPercent,
            lastProgressAt: new Date(),
          })
          .where(eq(canaryDeployments.id, id));
      } else {
        // All steps completed - promote to stable
        await promoteCanaryToStable(id);
      }
    }
  }
  
  const [updated] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  
  return { deployment: updated, analysis };
}

export async function promoteCanaryToStable(id: number): Promise<CanaryDeployment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(canaryDeployments)
    .set({
      status: "promoted",
      currentCanaryPercent: 100,
      completedAt: new Date(),
      statusMessage: "Canary successfully promoted to stable",
    })
    .where(eq(canaryDeployments.id, id));
  
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  
  return deployment;
}

export async function pauseCanaryDeployment(id: number): Promise<CanaryDeployment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(canaryDeployments)
    .set({
      status: "paused",
      statusMessage: "Deployment paused by user",
    })
    .where(eq(canaryDeployments.id, id));
  
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  
  return deployment;
}

export async function resumeCanaryDeployment(id: number): Promise<CanaryDeployment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(canaryDeployments)
    .set({
      status: "progressing",
      statusMessage: "Deployment resumed",
    })
    .where(eq(canaryDeployments.id, id));
  
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  
  return deployment;
}

export async function cancelCanaryDeployment(id: number): Promise<CanaryDeployment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(canaryDeployments)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      statusMessage: "Deployment cancelled by user",
    })
    .where(eq(canaryDeployments.id, id));
  
  // Mark all pending steps as skipped
  await db
    .update(canaryDeploymentSteps)
    .set({ status: "skipped" })
    .where(
      and(
        eq(canaryDeploymentSteps.deploymentId, id),
        eq(canaryDeploymentSteps.status, "pending")
      )
    );
  
  const [deployment] = await db
    .select()
    .from(canaryDeployments)
    .where(eq(canaryDeployments.id, id));
  
  return deployment;
}

// ============================================
// ROLLBACK MANAGEMENT
// ============================================

export async function initiateRollback(
  deploymentId: number,
  reason: string,
  trigger: "auto_error_rate" | "auto_latency" | "auto_pod_failure" | "auto_health_check" | "manual" | "timeout" | "cancelled",
  initiatedBy?: string
): Promise<CanaryRollbackHistory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deployment = await getCanaryDeployment(deploymentId);
  
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  
  // Get current step
  const steps = await getDeploymentSteps(deploymentId);
  const currentStep = steps.find(s => s.status === "running");
  
  // Create rollback record
  const rollbackData: InsertCanaryRollbackHistory = {
    deploymentId,
    trigger,
    canaryPercentAtRollback: deployment.currentCanaryPercent,
    stepAtRollback: currentStep?.stepNumber,
    status: "in_progress",
    rollbackToVersion: deployment.stableVersion,
    rollbackToImage: deployment.stableImage,
    initiatedBy: initiatedBy || "system",
    reason,
  };
  
  const [result] = await db.insert(canaryRollbackHistory).values(rollbackData);
  
  // Update deployment status
  await db
    .update(canaryDeployments)
    .set({
      status: "rolling_back",
      statusMessage: `Rolling back: ${reason}`,
    })
    .where(eq(canaryDeployments.id, deploymentId));
  
  // Mark current step as failed
  if (currentStep) {
    await db
      .update(canaryDeploymentSteps)
      .set({ status: "failed" })
      .where(eq(canaryDeploymentSteps.id, currentStep.id));
  }
  
  const [rollback] = await db
    .select()
    .from(canaryRollbackHistory)
    .where(eq(canaryRollbackHistory.id, result.insertId));
  
  return rollback;
}

export async function completeRollback(
  rollbackId: number,
  success: boolean,
  errorMessage?: string
): Promise<CanaryRollbackHistory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [rollback] = await db
    .select()
    .from(canaryRollbackHistory)
    .where(eq(canaryRollbackHistory.id, rollbackId));
  
  if (!rollback) {
    throw new Error("Rollback record not found");
  }
  
  // Update rollback status
  await db
    .update(canaryRollbackHistory)
    .set({
      status: success ? "completed" : "failed",
      completedAt: new Date(),
      errorMessage,
    })
    .where(eq(canaryRollbackHistory.id, rollbackId));
  
  // Update deployment status
  await db
    .update(canaryDeployments)
    .set({
      status: success ? "rolled_back" : "failed",
      currentCanaryPercent: 0,
      completedAt: new Date(),
      statusMessage: success
        ? "Successfully rolled back to stable version"
        : `Rollback failed: ${errorMessage}`,
    })
    .where(eq(canaryDeployments.id, rollback.deploymentId));
  
  const [updated] = await db
    .select()
    .from(canaryRollbackHistory)
    .where(eq(canaryRollbackHistory.id, rollbackId));
  
  return updated;
}

export async function getRollbackHistory(deploymentId: number): Promise<CanaryRollbackHistory[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(canaryRollbackHistory)
    .where(eq(canaryRollbackHistory.deploymentId, deploymentId))
    .orderBy(desc(canaryRollbackHistory.createdAt));
}

// ============================================
// METRICS & ANALYSIS
// ============================================

export async function recordCanaryMetrics(
  deploymentId: number,
  analysis: CanaryAnalysisResult,
  stepId?: number
): Promise<CanaryMetric> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deployment = await getCanaryDeployment(deploymentId);
  
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  
  const metricData: InsertCanaryMetric = {
    deploymentId,
    stepId,
    canaryPercent: deployment.currentCanaryPercent,
    canaryRequests: Math.floor(Math.random() * 1000), // Simulated - replace with real metrics
    stableRequests: Math.floor(Math.random() * 9000),
    canaryErrors: Math.floor(analysis.metrics.canaryErrorRate * 10),
    stableErrors: Math.floor(analysis.metrics.stableErrorRate * 10),
    canaryErrorRate: Math.floor(analysis.metrics.canaryErrorRate * 100),
    stableErrorRate: Math.floor(analysis.metrics.stableErrorRate * 100),
    canaryAvgLatency: Math.floor(analysis.metrics.canaryAvgLatency),
    stableAvgLatency: Math.floor(analysis.metrics.stableAvgLatency),
    canaryHealthyPods: analysis.metrics.canaryHealthyPods,
    canaryTotalPods: analysis.metrics.canaryTotalPods,
    stableHealthyPods: 3, // Simulated
    stableTotalPods: 3,
    analysisResult: analysis.analysisResult,
    analysisNotes: analysis.reasons.join("; "),
  };
  
  const [result] = await db.insert(canaryMetrics).values(metricData);
  
  const [metric] = await db
    .select()
    .from(canaryMetrics)
    .where(eq(canaryMetrics.id, result.insertId));
  
  return metric;
}

export async function getCanaryMetrics(
  deploymentId: number,
  limit = 100
): Promise<CanaryMetric[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(canaryMetrics)
    .where(eq(canaryMetrics.deploymentId, deploymentId))
    .orderBy(desc(canaryMetrics.timestamp))
    .limit(limit);
}

export async function analyzeCanaryHealth(deploymentId: number): Promise<CanaryAnalysisResult> {
  const deployment = await getCanaryDeployment(deploymentId);
  
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  
  // Simulate metrics collection (replace with real Prometheus/metrics integration)
  const metrics = {
    canaryErrorRate: Math.random() * 3, // 0-3% error rate
    stableErrorRate: Math.random() * 1,
    canaryAvgLatency: 100 + Math.random() * 200, // 100-300ms
    stableAvgLatency: 100 + Math.random() * 100,
    canaryHealthyPods: Math.floor(Math.random() * 3) + 1,
    canaryTotalPods: 3,
  };
  
  const reasons: string[] = [];
  let isHealthy = true;
  let shouldRollback = false;
  let shouldPromote = false;
  
  // Check error rate
  if (metrics.canaryErrorRate > deployment.errorRateThreshold) {
    isHealthy = false;
    reasons.push(`Error rate ${metrics.canaryErrorRate.toFixed(2)}% exceeds threshold ${deployment.errorRateThreshold}%`);
    if (deployment.rollbackOnErrorRate && deployment.autoRollbackEnabled) {
      shouldRollback = true;
    }
  }
  
  // Check latency
  if (metrics.canaryAvgLatency > deployment.latencyThresholdMs) {
    isHealthy = false;
    reasons.push(`Latency ${metrics.canaryAvgLatency.toFixed(0)}ms exceeds threshold ${deployment.latencyThresholdMs}ms`);
    if (deployment.rollbackOnLatency && deployment.autoRollbackEnabled) {
      shouldRollback = true;
    }
  }
  
  // Check pod health
  if (metrics.canaryHealthyPods < deployment.minHealthyPods) {
    isHealthy = false;
    reasons.push(`Healthy pods ${metrics.canaryHealthyPods} below minimum ${deployment.minHealthyPods}`);
    if (deployment.rollbackOnPodFailure && deployment.autoRollbackEnabled) {
      shouldRollback = true;
    }
  }
  
  // Determine if we should promote
  if (isHealthy && !shouldRollback) {
    const successRate = 100 - metrics.canaryErrorRate;
    if (successRate >= deployment.successRateThreshold) {
      shouldPromote = true;
      reasons.push(`Success rate ${successRate.toFixed(2)}% meets threshold ${deployment.successRateThreshold}%`);
    }
  }
  
  // Determine analysis result
  let analysisResult: "healthy" | "degraded" | "unhealthy" | "inconclusive" = "inconclusive";
  if (shouldRollback) {
    analysisResult = "unhealthy";
  } else if (isHealthy && shouldPromote) {
    analysisResult = "healthy";
  } else if (!isHealthy) {
    analysisResult = "degraded";
  }
  
  // Get AI recommendation if degraded
  let aiRecommendation: string | undefined;
  if (analysisResult === "degraded" || analysisResult === "unhealthy") {
    try {
      aiRecommendation = await getAIRecommendation(deployment, metrics, reasons);
    } catch (error) {
      console.error("Failed to get AI recommendation:", error);
    }
  }
  
  return {
    isHealthy,
    shouldRollback,
    shouldPromote,
    analysisResult,
    reasons,
    metrics,
    aiRecommendation,
  };
}

async function getAIRecommendation(
  deployment: CanaryDeployment,
  metrics: any,
  reasons: string[]
): Promise<string> {
  const prompt = `Analyze this canary deployment and provide a brief recommendation:

Deployment: ${deployment.name}
Target: ${deployment.targetDeployment}
Current Traffic: ${deployment.currentCanaryPercent}%
Canary Image: ${deployment.canaryImage}

Metrics:
- Canary Error Rate: ${metrics.canaryErrorRate.toFixed(2)}%
- Stable Error Rate: ${metrics.stableErrorRate.toFixed(2)}%
- Canary Latency: ${metrics.canaryAvgLatency.toFixed(0)}ms
- Stable Latency: ${metrics.stableAvgLatency.toFixed(0)}ms
- Healthy Pods: ${metrics.canaryHealthyPods}/${metrics.canaryTotalPods}

Issues: ${reasons.join(", ")}

Thresholds:
- Error Rate: ${deployment.errorRateThreshold}%
- Latency: ${deployment.latencyThresholdMs}ms
- Min Healthy Pods: ${deployment.minHealthyPods}

Provide a brief (2-3 sentences) recommendation on whether to rollback, pause, or continue the deployment.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a DevOps expert analyzing canary deployments. Be concise and actionable." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === 'string' ? content : "Unable to generate recommendation";
}

// ============================================
// TEMPLATES
// ============================================

export async function createCanaryTemplate(
  userId: number,
  template: Omit<InsertCanaryTemplate, "userId">
): Promise<CanaryTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(canaryTemplates).values({
    ...template,
    userId,
  });
  
  const [created] = await db
    .select()
    .from(canaryTemplates)
    .where(eq(canaryTemplates.id, result.insertId));
  
  return created;
}

export async function listCanaryTemplates(userId: number): Promise<CanaryTemplate[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(canaryTemplates)
    .where(eq(canaryTemplates.userId, userId))
    .orderBy(desc(canaryTemplates.createdAt));
}

export async function getCanaryTemplate(id: number): Promise<CanaryTemplate | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [template] = await db
    .select()
    .from(canaryTemplates)
    .where(eq(canaryTemplates.id, id));
  return template || null;
}

export async function deleteCanaryTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(canaryTemplates).where(eq(canaryTemplates.id, id));
}
