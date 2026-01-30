/**
 * AI Cost Optimizer Router (FinOps)
 * 
 * Provides real-time cost monitoring, optimization recommendations,
 * and automated cost reduction with AI-powered insights.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// Types
interface CostRecord {
  id: number;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  provider: string;
  costAmount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  tags: Record<string, string>;
  utilizationPercent?: number;
}

interface CostRecommendation {
  id: number;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  recommendationType: "rightsize" | "terminate" | "reserved" | "spot" | "schedule" | "storage_tier";
  title: string;
  description: string;
  currentCost: number;
  estimatedSavings: number;
  savingsPercent: number;
  risk: "low" | "medium" | "high";
  status: "pending" | "applied" | "dismissed";
  aiReasoning: string;
  createdAt: Date;
}

interface BudgetAlert {
  id: number;
  name: string;
  budgetAmount: number;
  currency: string;
  period: "daily" | "weekly" | "monthly";
  thresholdPercent: number;
  currentSpend: number;
  resourceFilter?: Record<string, string>;
  enabled: boolean;
  triggered: boolean;
}

interface CostForecast {
  period: string;
  predictedCost: number;
  confidence: number;
  trend: "increasing" | "stable" | "decreasing";
  factors: string[];
}

// In-memory storage
const costRecords: Map<number, CostRecord> = new Map();
const recommendations: Map<number, CostRecommendation> = new Map();
const budgetAlerts: Map<number, BudgetAlert> = new Map();
let costIdCounter = 1;
let recIdCounter = 1;
let alertIdCounter = 1;

// Initialize sample data
const initializeSampleData = () => {
  // Sample cost records
  const sampleCosts: Omit<CostRecord, "id">[] = [
    { resourceType: "ec2", resourceId: "i-1234567890abcdef0", resourceName: "web-server-1", provider: "aws", costAmount: 156.50, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "production", team: "backend" }, utilizationPercent: 15 },
    { resourceType: "ec2", resourceId: "i-0987654321fedcba0", resourceName: "api-server-1", provider: "aws", costAmount: 312.00, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "production", team: "backend" }, utilizationPercent: 45 },
    { resourceType: "rds", resourceId: "db-prod-main", resourceName: "production-db", provider: "aws", costAmount: 450.00, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "production", team: "data" }, utilizationPercent: 60 },
    { resourceType: "s3", resourceId: "bucket-logs-archive", resourceName: "logs-archive", provider: "aws", costAmount: 89.00, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "production", team: "devops" } },
    { resourceType: "eks", resourceId: "cluster-prod", resourceName: "production-cluster", provider: "aws", costAmount: 720.00, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "production", team: "platform" }, utilizationPercent: 55 },
    { resourceType: "ec2", resourceId: "i-dev-unused-001", resourceName: "dev-test-server", provider: "aws", costAmount: 78.25, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "development", team: "qa" }, utilizationPercent: 2 },
    { resourceType: "ebs", resourceId: "vol-unused-snapshot", resourceName: "old-snapshots", provider: "aws", costAmount: 45.00, currency: "USD", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), tags: { env: "backup" } },
  ];

  sampleCosts.forEach(c => {
    const id = costIdCounter++;
    costRecords.set(id, { ...c, id });
  });

  // Sample recommendations
  const sampleRecs: Omit<CostRecommendation, "id" | "createdAt">[] = [
    {
      resourceType: "ec2",
      resourceId: "i-1234567890abcdef0",
      resourceName: "web-server-1",
      recommendationType: "rightsize",
      title: "Downsize underutilized EC2 instance",
      description: "Instance is running at 15% CPU utilization. Consider downsizing from m5.xlarge to m5.large.",
      currentCost: 156.50,
      estimatedSavings: 78.25,
      savingsPercent: 50,
      risk: "low",
      status: "pending",
      aiReasoning: "Based on 30-day usage patterns, this instance consistently operates below 20% CPU and 30% memory utilization. Downsizing would maintain performance while reducing costs by 50%."
    },
    {
      resourceType: "ec2",
      resourceId: "i-dev-unused-001",
      resourceName: "dev-test-server",
      recommendationType: "terminate",
      title: "Terminate idle development server",
      description: "This development server has been idle for 14 days with only 2% utilization.",
      currentCost: 78.25,
      estimatedSavings: 78.25,
      savingsPercent: 100,
      risk: "medium",
      status: "pending",
      aiReasoning: "No significant workload detected in the past 2 weeks. Server appears to be abandoned test infrastructure."
    },
    {
      resourceType: "ec2",
      resourceId: "i-0987654321fedcba0",
      resourceName: "api-server-1",
      recommendationType: "reserved",
      title: "Convert to Reserved Instance",
      description: "This instance has been running continuously for 6 months. A 1-year reserved instance would save 40%.",
      currentCost: 312.00,
      estimatedSavings: 124.80,
      savingsPercent: 40,
      risk: "low",
      status: "pending",
      aiReasoning: "Stable workload with consistent usage pattern indicates this is a long-term resource. Reserved pricing would significantly reduce costs."
    },
    {
      resourceType: "s3",
      resourceId: "bucket-logs-archive",
      resourceName: "logs-archive",
      recommendationType: "storage_tier",
      title: "Move old logs to Glacier",
      description: "80% of objects in this bucket haven't been accessed in 90 days. Consider S3 Glacier for archival.",
      currentCost: 89.00,
      estimatedSavings: 71.20,
      savingsPercent: 80,
      risk: "low",
      status: "pending",
      aiReasoning: "Access pattern analysis shows most objects are write-once, read-rarely. Glacier storage class is ideal for this use case."
    },
    {
      resourceType: "eks",
      resourceId: "cluster-prod",
      resourceName: "production-cluster",
      recommendationType: "spot",
      title: "Use Spot instances for non-critical workloads",
      description: "30% of cluster workloads are fault-tolerant batch jobs suitable for Spot instances.",
      currentCost: 720.00,
      estimatedSavings: 180.00,
      savingsPercent: 25,
      risk: "medium",
      status: "pending",
      aiReasoning: "Analysis of pod specifications shows several workloads marked as non-critical with restart policies. These are ideal candidates for Spot instances."
    }
  ];

  sampleRecs.forEach(r => {
    const id = recIdCounter++;
    recommendations.set(id, { ...r, id, createdAt: new Date() });
  });

  // Sample budget alerts
  const sampleAlerts: Omit<BudgetAlert, "id">[] = [
    { name: "Monthly Cloud Budget", budgetAmount: 2000, currency: "USD", period: "monthly", thresholdPercent: 80, currentSpend: 1850.75, enabled: true, triggered: true },
    { name: "Development Environment", budgetAmount: 500, currency: "USD", period: "monthly", thresholdPercent: 90, currentSpend: 156.50, resourceFilter: { env: "development" }, enabled: true, triggered: false },
  ];

  sampleAlerts.forEach(a => {
    const id = alertIdCounter++;
    budgetAlerts.set(id, { ...a, id });
  });
};

initializeSampleData();

// AI Analysis Functions
async function generateCostInsights(costs: CostRecord[]): Promise<string> {
  try {
    const summary = costs.map(c => 
      `- ${c.resourceName} (${c.resourceType}): $${c.costAmount} | Utilization: ${c.utilizationPercent || 'N/A'}%`
    ).join("\n");

    const totalCost = costs.reduce((sum, c) => sum + c.costAmount, 0);

    const prompt = `Analyze this cloud infrastructure cost data and provide optimization insights:

Total Monthly Cost: $${totalCost.toFixed(2)}

Resources:
${summary}

Provide:
1. Cost distribution analysis
2. Top optimization opportunities
3. Anomalies or unusual spending patterns
4. Recommendations for immediate savings`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a FinOps expert specializing in cloud cost optimization and resource management." },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0]?.message?.content || "Unable to generate insights";
  } catch (error) {
    console.error("Cost analysis error:", error);
    return "AI analysis unavailable";
  }
}

async function generateForecast(costs: CostRecord[]): Promise<CostForecast[]> {
  const totalCurrent = costs.reduce((sum, c) => sum + c.costAmount, 0);
  
  // Simple forecast based on current spending
  return [
    {
      period: "Next Week",
      predictedCost: totalCurrent * 0.25,
      confidence: 0.9,
      trend: "stable",
      factors: ["Consistent workload patterns", "No scheduled changes"]
    },
    {
      period: "Next Month",
      predictedCost: totalCurrent * 1.05,
      confidence: 0.75,
      trend: "increasing",
      factors: ["Historical growth trend", "Upcoming feature release"]
    },
    {
      period: "Next Quarter",
      predictedCost: totalCurrent * 3.15,
      confidence: 0.6,
      trend: "increasing",
      factors: ["Projected user growth", "Infrastructure expansion plans"]
    }
  ];
}

// Router
export const costOptimizerRouter = router({
  // Get cost breakdown
  getCosts: publicProcedure
    .input(z.object({
      provider: z.string().optional(),
      resourceType: z.string().optional(),
      tags: z.record(z.string()).optional(),
    }).optional())
    .query(({ input }) => {
      let result = Array.from(costRecords.values());
      
      if (input?.provider) {
        result = result.filter(c => c.provider === input.provider);
      }
      if (input?.resourceType) {
        result = result.filter(c => c.resourceType === input.resourceType);
      }
      if (input?.tags) {
        result = result.filter(c => {
          for (const [key, value] of Object.entries(input.tags!)) {
            if (c.tags[key] !== value) return false;
          }
          return true;
        });
      }
      
      return result;
    }),

  // Get cost summary
  getSummary: publicProcedure.query(() => {
    const costs = Array.from(costRecords.values());
    const totalCost = costs.reduce((sum, c) => sum + c.costAmount, 0);
    
    // Group by resource type
    const byResourceType: Record<string, number> = {};
    costs.forEach(c => {
      byResourceType[c.resourceType] = (byResourceType[c.resourceType] || 0) + c.costAmount;
    });
    
    // Group by provider
    const byProvider: Record<string, number> = {};
    costs.forEach(c => {
      byProvider[c.provider] = (byProvider[c.provider] || 0) + c.costAmount;
    });
    
    // Group by tag (env)
    const byEnvironment: Record<string, number> = {};
    costs.forEach(c => {
      const env = c.tags.env || "untagged";
      byEnvironment[env] = (byEnvironment[env] || 0) + c.costAmount;
    });
    
    return {
      totalCost,
      currency: "USD",
      period: "monthly",
      byResourceType,
      byProvider,
      byEnvironment,
      resourceCount: costs.length,
    };
  }),

  // Get optimization recommendations
  getRecommendations: publicProcedure
    .input(z.object({
      status: z.enum(["pending", "applied", "dismissed", "all"]).optional(),
      risk: z.enum(["low", "medium", "high", "all"]).optional(),
    }).optional())
    .query(({ input }) => {
      let result = Array.from(recommendations.values());
      
      if (input?.status && input.status !== "all") {
        result = result.filter(r => r.status === input.status);
      }
      if (input?.risk && input.risk !== "all") {
        result = result.filter(r => r.risk === input.risk);
      }
      
      return result.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
    }),

  // Apply recommendation
  applyRecommendation: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      const rec = recommendations.get(input.id);
      if (!rec) throw new Error("Recommendation not found");
      
      rec.status = "applied";
      
      // Update cost record if exists
      for (const cost of costRecords.values()) {
        if (cost.resourceId === rec.resourceId) {
          cost.costAmount -= rec.estimatedSavings;
          break;
        }
      }
      
      return rec;
    }),

  // Dismiss recommendation
  dismissRecommendation: publicProcedure
    .input(z.object({
      id: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const rec = recommendations.get(input.id);
      if (!rec) throw new Error("Recommendation not found");
      
      rec.status = "dismissed";
      return rec;
    }),

  // Get AI insights
  getInsights: publicProcedure.mutation(async () => {
    const costs = Array.from(costRecords.values());
    const insights = await generateCostInsights(costs);
    return { insights };
  }),

  // Get cost forecast
  getForecast: publicProcedure.query(async () => {
    const costs = Array.from(costRecords.values());
    return await generateForecast(costs);
  }),

  // List budget alerts
  listBudgetAlerts: publicProcedure.query(() => {
    return Array.from(budgetAlerts.values());
  }),

  // Create budget alert
  createBudgetAlert: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      budgetAmount: z.number().positive(),
      currency: z.string().optional().default("USD"),
      period: z.enum(["daily", "weekly", "monthly"]),
      thresholdPercent: z.number().min(1).max(100).optional().default(80),
      resourceFilter: z.record(z.string()).optional(),
    }))
    .mutation(({ input }) => {
      const id = alertIdCounter++;
      const alert: BudgetAlert = {
        id,
        name: input.name,
        budgetAmount: input.budgetAmount,
        currency: input.currency,
        period: input.period,
        thresholdPercent: input.thresholdPercent,
        currentSpend: 0,
        resourceFilter: input.resourceFilter,
        enabled: true,
        triggered: false,
      };
      
      budgetAlerts.set(id, alert);
      return alert;
    }),

  // Toggle budget alert
  toggleBudgetAlert: publicProcedure
    .input(z.object({
      id: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(({ input }) => {
      const alert = budgetAlerts.get(input.id);
      if (!alert) throw new Error("Budget alert not found");
      
      alert.enabled = input.enabled;
      return alert;
    }),

  // Delete budget alert
  deleteBudgetAlert: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      if (!budgetAlerts.has(input.id)) throw new Error("Budget alert not found");
      budgetAlerts.delete(input.id);
      return { success: true };
    }),

  // Get dashboard stats
  getStats: publicProcedure.query(() => {
    const costs = Array.from(costRecords.values());
    const recs = Array.from(recommendations.values());
    const alerts = Array.from(budgetAlerts.values());
    
    const totalCost = costs.reduce((sum, c) => sum + c.costAmount, 0);
    const potentialSavings = recs
      .filter(r => r.status === "pending")
      .reduce((sum, r) => sum + r.estimatedSavings, 0);
    const appliedSavings = recs
      .filter(r => r.status === "applied")
      .reduce((sum, r) => sum + r.estimatedSavings, 0);
    
    return {
      totalMonthlyCost: totalCost,
      potentialSavings,
      appliedSavings,
      savingsPercent: totalCost > 0 ? Math.round((potentialSavings / totalCost) * 100) : 0,
      pendingRecommendations: recs.filter(r => r.status === "pending").length,
      triggeredAlerts: alerts.filter(a => a.triggered && a.enabled).length,
      resourcesTracked: costs.length,
    };
  }),

  // Identify idle resources
  getIdleResources: publicProcedure.query(() => {
    return Array.from(costRecords.values())
      .filter(c => c.utilizationPercent !== undefined && c.utilizationPercent < 10)
      .map(c => ({
        ...c,
        wastedCost: c.costAmount * (1 - (c.utilizationPercent || 0) / 100),
      }));
  }),
});
