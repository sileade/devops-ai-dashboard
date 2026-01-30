/**
 * AI Incident Commander Router
 * 
 * Provides autonomous incident detection, diagnosis, and remediation
 * with human-in-the-loop for critical decisions.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// Types
interface Incident {
  id: number;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "detected" | "investigating" | "mitigating" | "resolved";
  detectedAt: Date;
  resolvedAt?: Date;
  rootCause?: string;
  affectedResources: string[];
  aiAnalysis?: string;
  actions: IncidentAction[];
}

interface IncidentAction {
  id: number;
  actionType: string;
  description: string;
  executedBy: "ai" | "human";
  status: "pending" | "executing" | "completed" | "failed";
  result?: string;
  createdAt: Date;
}

interface Runbook {
  id: number;
  name: string;
  description: string;
  triggerConditions: Record<string, unknown>;
  steps: RunbookStep[];
  autoExecute: boolean;
  requiresApproval: boolean;
}

interface RunbookStep {
  order: number;
  name: string;
  action: string;
  command?: string;
  expectedResult?: string;
  rollbackCommand?: string;
}

// In-memory storage (replace with database in production)
const incidents: Map<number, Incident> = new Map();
const runbooks: Map<number, Runbook> = new Map();
let incidentIdCounter = 1;
let runbookIdCounter = 1;

// Initialize with sample runbooks
const initializeRunbooks = () => {
  const sampleRunbooks: Omit<Runbook, "id">[] = [
    {
      name: "Pod OOMKilled Recovery",
      description: "Automatically handle pods killed due to out of memory",
      triggerConditions: { event: "OOMKilled", resourceType: "pod" },
      steps: [
        { order: 1, name: "Analyze Memory Usage", action: "analyze", command: "kubectl top pod ${POD_NAME} -n ${NAMESPACE}" },
        { order: 2, name: "Check Memory Limits", action: "check", command: "kubectl get pod ${POD_NAME} -n ${NAMESPACE} -o jsonpath='{.spec.containers[*].resources}'" },
        { order: 3, name: "Increase Memory Limit", action: "patch", command: "kubectl patch deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} --patch '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"${CONTAINER_NAME}\",\"resources\":{\"limits\":{\"memory\":\"${NEW_MEMORY_LIMIT}\"}}}]}}}}'" },
        { order: 4, name: "Verify Recovery", action: "verify", command: "kubectl get pod -l app=${APP_LABEL} -n ${NAMESPACE}" }
      ],
      autoExecute: false,
      requiresApproval: true
    },
    {
      name: "High CPU Container Recovery",
      description: "Handle containers with sustained high CPU usage",
      triggerConditions: { metric: "cpu_usage", threshold: 90, duration: "5m" },
      steps: [
        { order: 1, name: "Identify Hot Processes", action: "analyze", command: "docker exec ${CONTAINER_ID} top -bn1" },
        { order: 2, name: "Check for Runaway Processes", action: "check" },
        { order: 3, name: "Scale Horizontally", action: "scale", command: "kubectl scale deployment ${DEPLOYMENT_NAME} --replicas=${NEW_REPLICAS}" },
        { order: 4, name: "Monitor Recovery", action: "monitor" }
      ],
      autoExecute: false,
      requiresApproval: true
    },
    {
      name: "Database Connection Pool Exhaustion",
      description: "Handle database connection pool exhaustion",
      triggerConditions: { error: "connection pool exhausted", resourceType: "database" },
      steps: [
        { order: 1, name: "Check Active Connections", action: "analyze" },
        { order: 2, name: "Identify Connection Leaks", action: "diagnose" },
        { order: 3, name: "Restart Affected Pods", action: "restart", command: "kubectl rollout restart deployment ${DEPLOYMENT_NAME}" },
        { order: 4, name: "Increase Pool Size", action: "configure" }
      ],
      autoExecute: false,
      requiresApproval: true
    }
  ];

  sampleRunbooks.forEach(rb => {
    const id = runbookIdCounter++;
    runbooks.set(id, { ...rb, id });
  });
};

initializeRunbooks();

// AI Analysis Functions
async function analyzeIncident(incident: Omit<Incident, "aiAnalysis">): Promise<string> {
  try {
    const prompt = `Analyze this infrastructure incident and provide root cause analysis:

Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Affected Resources: ${incident.affectedResources.join(", ")}

Provide:
1. Probable root cause
2. Impact assessment
3. Recommended immediate actions
4. Prevention measures for future`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert SRE/DevOps engineer specializing in incident response and root cause analysis." },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0]?.message?.content || "Unable to analyze incident";
  } catch (error) {
    console.error("AI incident analysis error:", error);
    return "AI analysis unavailable. Manual investigation required.";
  }
}

async function generatePostMortem(incident: Incident): Promise<string> {
  try {
    const actionsLog = incident.actions.map(a => 
      `- [${a.status}] ${a.actionType}: ${a.description} (by ${a.executedBy})`
    ).join("\n");

    const prompt = `Generate a post-mortem report for this incident:

Title: ${incident.title}
Severity: ${incident.severity}
Duration: ${incident.detectedAt.toISOString()} to ${incident.resolvedAt?.toISOString() || "ongoing"}
Root Cause: ${incident.rootCause || "Under investigation"}
Affected Resources: ${incident.affectedResources.join(", ")}

Actions Taken:
${actionsLog}

AI Analysis:
${incident.aiAnalysis}

Generate a structured post-mortem with:
1. Executive Summary
2. Timeline of Events
3. Root Cause Analysis
4. Impact Assessment
5. Actions Taken
6. Lessons Learned
7. Action Items for Prevention`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert at writing clear, actionable post-mortem reports for infrastructure incidents." },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0]?.message?.content || "Unable to generate post-mortem";
  } catch (error) {
    console.error("Post-mortem generation error:", error);
    return "Post-mortem generation failed. Please create manually.";
  }
}

async function suggestRunbook(incident: Incident): Promise<Runbook | null> {
  // Find matching runbook based on incident characteristics
  for (const [, runbook] of runbooks) {
    const conditions = runbook.triggerConditions;
    
    // Simple matching logic (can be enhanced with AI)
    if (incident.title.toLowerCase().includes("oom") && conditions.event === "OOMKilled") {
      return runbook;
    }
    if (incident.title.toLowerCase().includes("cpu") && conditions.metric === "cpu_usage") {
      return runbook;
    }
    if (incident.title.toLowerCase().includes("connection") && conditions.error?.includes("connection")) {
      return runbook;
    }
  }
  
  return null;
}

// Router
export const incidentCommanderRouter = router({
  // List all incidents
  list: publicProcedure
    .input(z.object({
      status: z.enum(["detected", "investigating", "mitigating", "resolved", "all"]).optional(),
      severity: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      limit: z.number().min(1).max(100).optional().default(50),
    }).optional())
    .query(({ input }) => {
      let result = Array.from(incidents.values());
      
      if (input?.status && input.status !== "all") {
        result = result.filter(i => i.status === input.status);
      }
      if (input?.severity && input.severity !== "all") {
        result = result.filter(i => i.severity === input.severity);
      }
      
      return result
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
        .slice(0, input?.limit || 50);
    }),

  // Get single incident
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const incident = incidents.get(input.id);
      if (!incident) throw new Error("Incident not found");
      return incident;
    }),

  // Create new incident (can be triggered by monitoring or manually)
  create: publicProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      affectedResources: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = incidentIdCounter++;
      
      const incident: Incident = {
        id,
        title: input.title,
        description: input.description || "",
        severity: input.severity,
        status: "detected",
        detectedAt: new Date(),
        affectedResources: input.affectedResources || [],
        actions: [],
      };
      
      // Perform AI analysis
      incident.aiAnalysis = await analyzeIncident(incident);
      
      incidents.set(id, incident);
      
      // Log initial action
      incident.actions.push({
        id: 1,
        actionType: "detection",
        description: "Incident detected and AI analysis completed",
        executedBy: "ai",
        status: "completed",
        result: "AI analysis generated",
        createdAt: new Date(),
      });
      
      return incident;
    }),

  // Update incident status
  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["detected", "investigating", "mitigating", "resolved"]),
      rootCause: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const incident = incidents.get(input.id);
      if (!incident) throw new Error("Incident not found");
      
      incident.status = input.status;
      if (input.rootCause) incident.rootCause = input.rootCause;
      if (input.status === "resolved") incident.resolvedAt = new Date();
      
      incident.actions.push({
        id: incident.actions.length + 1,
        actionType: "status_update",
        description: `Status changed to ${input.status}`,
        executedBy: "human",
        status: "completed",
        createdAt: new Date(),
      });
      
      return incident;
    }),

  // Acknowledge incident
  acknowledge: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      const incident = incidents.get(input.id);
      if (!incident) throw new Error("Incident not found");
      
      incident.status = "investigating";
      incident.actions.push({
        id: incident.actions.length + 1,
        actionType: "acknowledge",
        description: "Incident acknowledged and investigation started",
        executedBy: "human",
        status: "completed",
        createdAt: new Date(),
      });
      
      return incident;
    }),

  // Execute action on incident
  executeAction: publicProcedure
    .input(z.object({
      incidentId: z.number(),
      actionType: z.string(),
      description: z.string(),
      command: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const incident = incidents.get(input.incidentId);
      if (!incident) throw new Error("Incident not found");
      
      const action: IncidentAction = {
        id: incident.actions.length + 1,
        actionType: input.actionType,
        description: input.description,
        executedBy: "human",
        status: "executing",
        createdAt: new Date(),
      };
      
      incident.actions.push(action);
      
      // Simulate action execution
      setTimeout(() => {
        action.status = "completed";
        action.result = "Action completed successfully";
      }, 2000);
      
      return action;
    }),

  // Generate post-mortem
  generatePostMortem: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const incident = incidents.get(input.id);
      if (!incident) throw new Error("Incident not found");
      
      const postMortem = await generatePostMortem(incident);
      return { incidentId: input.id, postMortem };
    }),

  // Get suggested runbook for incident
  getSuggestedRunbook: publicProcedure
    .input(z.object({ incidentId: z.number() }))
    .query(async ({ input }) => {
      const incident = incidents.get(input.incidentId);
      if (!incident) throw new Error("Incident not found");
      
      return await suggestRunbook(incident);
    }),

  // List all runbooks
  listRunbooks: publicProcedure.query(() => {
    return Array.from(runbooks.values());
  }),

  // Get single runbook
  getRunbook: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const runbook = runbooks.get(input.id);
      if (!runbook) throw new Error("Runbook not found");
      return runbook;
    }),

  // Create runbook
  createRunbook: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      triggerConditions: z.record(z.unknown()),
      steps: z.array(z.object({
        order: z.number(),
        name: z.string(),
        action: z.string(),
        command: z.string().optional(),
        expectedResult: z.string().optional(),
        rollbackCommand: z.string().optional(),
      })),
      autoExecute: z.boolean().optional(),
      requiresApproval: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const id = runbookIdCounter++;
      const runbook: Runbook = {
        id,
        name: input.name,
        description: input.description || "",
        triggerConditions: input.triggerConditions,
        steps: input.steps,
        autoExecute: input.autoExecute ?? false,
        requiresApproval: input.requiresApproval ?? true,
      };
      
      runbooks.set(id, runbook);
      return runbook;
    }),

  // Execute runbook for incident
  executeRunbook: publicProcedure
    .input(z.object({
      incidentId: z.number(),
      runbookId: z.number(),
      variables: z.record(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const incident = incidents.get(input.incidentId);
      if (!incident) throw new Error("Incident not found");
      
      const runbook = runbooks.get(input.runbookId);
      if (!runbook) throw new Error("Runbook not found");
      
      // Log runbook execution start
      incident.actions.push({
        id: incident.actions.length + 1,
        actionType: "runbook_execution",
        description: `Started executing runbook: ${runbook.name}`,
        executedBy: "ai",
        status: "executing",
        createdAt: new Date(),
      });
      
      incident.status = "mitigating";
      
      // Simulate step-by-step execution
      const results: { step: number; status: string; output: string }[] = [];
      
      for (const step of runbook.steps) {
        results.push({
          step: step.order,
          status: "completed",
          output: `Step "${step.name}" executed successfully`,
        });
      }
      
      // Update action status
      const lastAction = incident.actions[incident.actions.length - 1];
      lastAction.status = "completed";
      lastAction.result = JSON.stringify(results);
      
      return { incidentId: input.incidentId, runbookId: input.runbookId, results };
    }),

  // Get incident statistics
  getStats: publicProcedure.query(() => {
    const allIncidents = Array.from(incidents.values());
    
    const stats = {
      total: allIncidents.length,
      bySeverity: {
        critical: allIncidents.filter(i => i.severity === "critical").length,
        high: allIncidents.filter(i => i.severity === "high").length,
        medium: allIncidents.filter(i => i.severity === "medium").length,
        low: allIncidents.filter(i => i.severity === "low").length,
      },
      byStatus: {
        detected: allIncidents.filter(i => i.status === "detected").length,
        investigating: allIncidents.filter(i => i.status === "investigating").length,
        mitigating: allIncidents.filter(i => i.status === "mitigating").length,
        resolved: allIncidents.filter(i => i.status === "resolved").length,
      },
      avgResolutionTime: calculateAvgResolutionTime(allIncidents),
      runbooksCount: runbooks.size,
    };
    
    return stats;
  }),
});

function calculateAvgResolutionTime(incidents: Incident[]): number {
  const resolved = incidents.filter(i => i.resolvedAt);
  if (resolved.length === 0) return 0;
  
  const totalTime = resolved.reduce((sum, i) => {
    return sum + (i.resolvedAt!.getTime() - i.detectedAt.getTime());
  }, 0);
  
  return Math.round(totalTime / resolved.length / 1000 / 60); // minutes
}
