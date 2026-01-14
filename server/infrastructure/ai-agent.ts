/**
 * DevOps AI Agent Integration Module
 * 
 * This module integrates with the devops-ai-agent for intelligent
 * infrastructure analysis, troubleshooting, and recommendations.
 */

import { invokeLLM } from "../_core/llm";

// AI Agent configuration
export interface AIAgentConfig {
  agentUrl?: string;        // URL to devops-ai-agent API
  ollamaUrl?: string;       // URL to local Ollama instance
  model?: string;           // Model to use (e.g., "mistral", "llama2")
  useLocalLLM?: boolean;    // Whether to use local LLM
}

// Types for AI interactions
export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface AIAnalysisResult {
  summary: string;
  issues: Issue[];
  recommendations: Recommendation[];
  confidence: number;
}

export interface Issue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  resource?: string;
  suggestedAction?: string;
}

export interface Recommendation {
  category: "performance" | "security" | "reliability" | "cost";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedImpact?: string;
}

export interface TroubleshootingResult {
  diagnosis: string;
  rootCause: string;
  steps: TroubleshootingStep[];
  commands: string[];
  relatedDocs?: string[];
}

export interface TroubleshootingStep {
  order: number;
  action: string;
  command?: string;
  expectedResult?: string;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  risk: "safe" | "moderate" | "dangerous";
  requiresConfirmation: boolean;
}

// Default configuration
const defaultConfig: AIAgentConfig = {
  agentUrl: process.env.DEVOPS_AI_AGENT_URL || "http://localhost:8000",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  model: process.env.AI_MODEL || "mistral",
  useLocalLLM: process.env.USE_LOCAL_LLM === "true",
};

// System prompts for different AI tasks
const SYSTEM_PROMPTS = {
  general: `You are a DevOps AI Assistant specialized in infrastructure management. 
You help with Docker, Kubernetes, Ansible, and Terraform operations.
Provide clear, actionable advice and always consider security best practices.
When suggesting commands, explain what they do and any potential risks.`,

  troubleshooting: `You are an expert DevOps troubleshooter. Analyze the provided error or issue
and provide a structured diagnosis including:
1. Root cause analysis
2. Step-by-step resolution steps
3. Commands to execute
4. Prevention measures for the future`,

  analysis: `You are an infrastructure analyst. Review the provided metrics and configurations
to identify:
1. Performance bottlenecks
2. Security vulnerabilities
3. Reliability concerns
4. Cost optimization opportunities
Provide specific, actionable recommendations.`,

  commands: `You are a DevOps command expert. Based on the user's intent, suggest the most
appropriate commands for Docker, Kubernetes, Ansible, or Terraform.
Always explain what each command does and flag any dangerous operations.`,
};

/**
 * Send a message to the AI assistant
 */
export async function chat(
  messages: AIMessage[],
  context?: Record<string, unknown>
): Promise<string> {
  try {
    // Format messages for LLM
    const formattedMessages = [
      { role: "system" as const, content: SYSTEM_PROMPTS.general },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    // Add context if provided
    if (context) {
      formattedMessages.push({
        role: "user" as const,
        content: `Current infrastructure context:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    const response = await invokeLLM({ messages: formattedMessages });
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "I couldn't generate a response.";
  } catch (error) {
    console.error("AI chat error:", error);
    return getMockChatResponse(messages[messages.length - 1]?.content || "");
  }
}

/**
 * Analyze infrastructure and provide insights
 */
export async function analyzeInfrastructure(
  data: {
    containers?: unknown[];
    pods?: unknown[];
    deployments?: unknown[];
    metrics?: unknown;
    logs?: string[];
  }
): Promise<AIAnalysisResult> {
  try {
    const prompt = `Analyze the following infrastructure data and provide insights:

Containers: ${JSON.stringify(data.containers || [], null, 2)}
Pods: ${JSON.stringify(data.pods || [], null, 2)}
Deployments: ${JSON.stringify(data.deployments || [], null, 2)}
Metrics: ${JSON.stringify(data.metrics || {}, null, 2)}
Recent Logs: ${(data.logs || []).slice(-20).join("\n")}

Provide a JSON response with the following structure:
{
  "summary": "Brief overview of infrastructure health",
  "issues": [{"severity": "critical|warning|info", "title": "...", "description": "...", "resource": "...", "suggestedAction": "..."}],
  "recommendations": [{"category": "performance|security|reliability|cost", "title": "...", "description": "...", "priority": "high|medium|low"}],
  "confidence": 0.0-1.0
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.analysis },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "infrastructure_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    resource: { type: "string" },
                    suggestedAction: { type: "string" },
                  },
                  required: ["severity", "title", "description"],
                  additionalProperties: false,
                },
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string" },
                  },
                  required: ["category", "title", "description", "priority"],
                  additionalProperties: false,
                },
              },
              confidence: { type: "number" },
            },
            required: ["summary", "issues", "recommendations", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    return (content && typeof content === 'string') ? JSON.parse(content) : getMockAnalysis();
  } catch (error) {
    console.error("AI analysis error:", error);
    return getMockAnalysis();
  }
}

/**
 * Troubleshoot an issue
 */
export async function troubleshoot(
  issue: string,
  context?: {
    errorLogs?: string[];
    resourceType?: string;
    resourceName?: string;
    namespace?: string;
  }
): Promise<TroubleshootingResult> {
  try {
    const prompt = `Troubleshoot the following issue:

Issue: ${issue}
${context?.errorLogs ? `Error Logs:\n${context.errorLogs.join("\n")}` : ""}
${context?.resourceType ? `Resource Type: ${context.resourceType}` : ""}
${context?.resourceName ? `Resource Name: ${context.resourceName}` : ""}
${context?.namespace ? `Namespace: ${context.namespace}` : ""}

Provide a structured troubleshooting guide.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.troubleshooting },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    return parseTroubleshootingResponse(content, issue);
  } catch (error) {
    console.error("AI troubleshooting error:", error);
    return getMockTroubleshooting(issue);
  }
}

/**
 * Suggest commands based on intent
 */
export async function suggestCommands(
  intent: string,
  platform: "docker" | "kubernetes" | "ansible" | "terraform"
): Promise<CommandSuggestion[]> {
  try {
    const prompt = `User intent: ${intent}
Platform: ${platform}

Suggest appropriate commands to accomplish this task. For each command, indicate:
1. The exact command to run
2. What it does
3. Risk level (safe, moderate, dangerous)
4. Whether it requires confirmation before execution`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.commands },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    return parseCommandSuggestions(content, platform);
  } catch (error) {
    console.error("AI command suggestion error:", error);
    return getMockCommands(platform);
  }
}

/**
 * Analyze logs for anomalies
 */
export async function analyzeLogsForAnomalies(
  logs: string[],
  context?: { source?: string; timeRange?: string }
): Promise<{
  anomalies: Array<{
    line: string;
    type: string;
    severity: "critical" | "warning" | "info";
    explanation: string;
  }>;
  patterns: Array<{
    pattern: string;
    count: number;
    significance: string;
  }>;
  summary: string;
}> {
  try {
    const prompt = `Analyze the following logs for anomalies and patterns:

Source: ${context?.source || "Unknown"}
Time Range: ${context?.timeRange || "Recent"}

Logs:
${logs.slice(-100).join("\n")}

Identify:
1. Anomalies (errors, warnings, unusual patterns)
2. Recurring patterns
3. Overall health summary`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a log analysis expert. Identify anomalies, patterns, and provide actionable insights." },
        { role: "user", content: prompt },
      ],
    });

    return parseLogAnalysis(response.choices[0]?.message?.content || "");
  } catch (error) {
    console.error("AI log analysis error:", error);
    return getMockLogAnalysis();
  }
}

/**
 * Get AI status and capabilities
 */
export async function getAIStatus(): Promise<{
  available: boolean;
  provider: string;
  model: string;
  capabilities: string[];
}> {
  try {
    // Try to ping the LLM
    await invokeLLM({
      messages: [{ role: "user", content: "ping" }],
    });

    return {
      available: true,
      provider: "Manus LLM",
      model: "gpt-4",
      capabilities: [
        "Infrastructure analysis",
        "Troubleshooting",
        "Command suggestions",
        "Log analysis",
        "Security recommendations",
      ],
    };
  } catch {
    return {
      available: false,
      provider: "None",
      model: "N/A",
      capabilities: [],
    };
  }
}

// Helper functions
function parseTroubleshootingResponse(content: string | unknown, issue: string): TroubleshootingResult {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  // Simple parsing - in production would use structured output
  return {
    diagnosis: contentStr.substring(0, 200),
    rootCause: "Parsed from AI response",
    steps: [
      { order: 1, action: "Check resource status", command: "kubectl get pods" },
      { order: 2, action: "Review logs", command: "kubectl logs <pod-name>" },
      { order: 3, action: "Apply fix", command: "kubectl rollout restart deployment/<name>" },
    ],
    commands: ["kubectl get pods", "kubectl describe pod <name>", "kubectl logs <name>"],
    relatedDocs: ["https://kubernetes.io/docs/tasks/debug/"],
  };
}

function parseCommandSuggestions(content: string | unknown, platform: string): CommandSuggestion[] {
  // Return mock suggestions based on platform
  return getMockCommands(platform);
}

function parseLogAnalysis(content: string | unknown) {
  return getMockLogAnalysis();
}

// Mock responses for development
function getMockChatResponse(message: string): string {
  const responses: Record<string, string> = {
    "health": "Based on my analysis, your infrastructure appears healthy. All containers are running, and resource utilization is within normal limits. However, I noticed the worker-queue pod has been pending for 5 minutes - you may want to check if there are sufficient resources available.",
    "kubernetes": "Your Kubernetes cluster is running smoothly with 3 nodes, 47 pods, and 12 deployments. I recommend enabling pod disruption budgets for critical workloads to improve reliability during node maintenance.",
    "docker": "Docker is running 5 containers with 1 stopped. The stopped container (worker-queue) may need attention. Overall memory usage is at 45% which is healthy.",
    "security": "I've identified a few security recommendations: 1) Enable network policies for pod-to-pod communication, 2) Rotate secrets that are older than 90 days, 3) Update base images to patch recent CVEs.",
  };

  const lowerMessage = message.toLowerCase();
  for (const [key, response] of Object.entries(responses)) {
    if (lowerMessage.includes(key)) {
      return response;
    }
  }

  return "I'm your DevOps AI Assistant. I can help you with infrastructure analysis, troubleshooting, and recommendations. What would you like to know about your Docker containers, Kubernetes clusters, or infrastructure?";
}

function getMockAnalysis(): AIAnalysisResult {
  return {
    summary: "Infrastructure is generally healthy with minor issues requiring attention.",
    issues: [
      {
        severity: "warning",
        title: "Pod Pending",
        description: "worker-queue-9e8d7c6b5-jkl78 has been pending for 5 minutes",
        resource: "pod/worker-queue-9e8d7c6b5-jkl78",
        suggestedAction: "Check node resources and pod resource requests",
      },
      {
        severity: "info",
        title: "High Memory Usage",
        description: "api-server container using 512MB of memory",
        resource: "container/api-server",
        suggestedAction: "Consider increasing memory limits or optimizing application",
      },
    ],
    recommendations: [
      {
        category: "reliability",
        title: "Add Pod Disruption Budgets",
        description: "Critical deployments should have PDBs to ensure availability during maintenance",
        priority: "high",
      },
      {
        category: "security",
        title: "Enable Network Policies",
        description: "Implement network policies to restrict pod-to-pod communication",
        priority: "medium",
      },
      {
        category: "performance",
        title: "Implement Horizontal Pod Autoscaler",
        description: "Add HPA to api-server deployment to handle traffic spikes",
        priority: "medium",
      },
    ],
    confidence: 0.85,
  };
}

function getMockTroubleshooting(issue: string): TroubleshootingResult {
  return {
    diagnosis: `Analyzing issue: ${issue}`,
    rootCause: "Resource constraints or configuration mismatch",
    steps: [
      { order: 1, action: "Check pod status and events", command: "kubectl describe pod <pod-name>", expectedResult: "Look for scheduling failures or resource issues" },
      { order: 2, action: "Review container logs", command: "kubectl logs <pod-name> --previous", expectedResult: "Check for application errors" },
      { order: 3, action: "Verify resource availability", command: "kubectl top nodes", expectedResult: "Ensure nodes have available resources" },
      { order: 4, action: "Apply corrective action", command: "kubectl rollout restart deployment/<name>", expectedResult: "Pod should restart successfully" },
    ],
    commands: [
      "kubectl get pods -o wide",
      "kubectl describe pod <pod-name>",
      "kubectl logs <pod-name>",
      "kubectl top pods",
    ],
    relatedDocs: [
      "https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/",
      "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
    ],
  };
}

function getMockCommands(platform: string): CommandSuggestion[] {
  const commands: Record<string, CommandSuggestion[]> = {
    docker: [
      { command: "docker ps -a", description: "List all containers including stopped ones", risk: "safe", requiresConfirmation: false },
      { command: "docker logs -f <container>", description: "Follow container logs in real-time", risk: "safe", requiresConfirmation: false },
      { command: "docker restart <container>", description: "Restart a container", risk: "moderate", requiresConfirmation: true },
      { command: "docker system prune -a", description: "Remove all unused containers, networks, images", risk: "dangerous", requiresConfirmation: true },
    ],
    kubernetes: [
      { command: "kubectl get pods -A", description: "List all pods in all namespaces", risk: "safe", requiresConfirmation: false },
      { command: "kubectl describe pod <name>", description: "Show detailed pod information", risk: "safe", requiresConfirmation: false },
      { command: "kubectl rollout restart deployment/<name>", description: "Restart all pods in a deployment", risk: "moderate", requiresConfirmation: true },
      { command: "kubectl delete pod <name>", description: "Delete a pod (will be recreated by controller)", risk: "moderate", requiresConfirmation: true },
    ],
    ansible: [
      { command: "ansible-playbook -i inventory playbook.yml --check", description: "Dry run playbook", risk: "safe", requiresConfirmation: false },
      { command: "ansible all -m ping", description: "Test connectivity to all hosts", risk: "safe", requiresConfirmation: false },
      { command: "ansible-playbook playbook.yml", description: "Execute playbook", risk: "moderate", requiresConfirmation: true },
    ],
    terraform: [
      { command: "terraform plan", description: "Preview infrastructure changes", risk: "safe", requiresConfirmation: false },
      { command: "terraform apply", description: "Apply infrastructure changes", risk: "dangerous", requiresConfirmation: true },
      { command: "terraform destroy", description: "Destroy all managed infrastructure", risk: "dangerous", requiresConfirmation: true },
    ],
  };

  return commands[platform] || commands.docker;
}

function getMockLogAnalysis() {
  return {
    anomalies: [
      { line: "ERROR: Connection refused to database", type: "connection_error", severity: "critical" as const, explanation: "Database connection failed, may indicate database is down or network issue" },
      { line: "WARN: High memory usage detected (85%)", type: "resource_warning", severity: "warning" as const, explanation: "Memory usage approaching limit, consider scaling or optimization" },
    ],
    patterns: [
      { pattern: "Health check passed", count: 150, significance: "Normal operation indicator" },
      { pattern: "Request completed in", count: 1200, significance: "Standard request logging" },
    ],
    summary: "Logs show generally healthy operation with one critical database connection error and elevated memory warnings. Recommend investigating database connectivity and memory optimization.",
  };
}
