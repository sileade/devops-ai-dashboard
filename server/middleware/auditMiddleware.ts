/**
 * Audit Logging Middleware
 * Automatically logs all tRPC procedure calls
 */

import { createAuditLog } from "../services/auditLog";

// Action risk levels mapping
const actionRiskLevels: Record<string, "low" | "medium" | "high" | "critical"> = {
  // Low risk - read operations
  "auth.me": "low",
  "dashboard.getOverview": "low",
  "dashboard.getActivity": "low",
  "docker.listContainers": "low",
  "kubernetes.listPods": "low",
  "teams.get": "low",
  "teams.getUserTeams": "low",
  "auditLog.getLogs": "low",
  
  // Medium risk - create/update operations
  "docker.createContainer": "medium",
  "kubernetes.createDeployment": "medium",
  "teams.create": "medium",
  "teams.update": "medium",
  "teams.createInvitation": "medium",
  "canary.create": "medium",
  "bluegreen.create": "medium",
  
  // High risk - delete/modify critical resources
  "docker.removeContainer": "high",
  "kubernetes.deleteDeployment": "high",
  "teams.delete": "high",
  "teams.removeMember": "high",
  "canary.rollback": "high",
  "bluegreen.switch": "high",
  "argocd.sync": "high",
  
  // Critical risk - admin/security operations
  "auth.logout": "medium",
  "teams.transferOwnership": "critical",
  "connections.update": "critical",
  "email.updateSettings": "high",
  "prometheus.updateSettings": "high",
  "auditLog.deleteOldLogs": "critical",
};

// Get risk level for an action
export function getActionRiskLevel(action: string): "low" | "medium" | "high" | "critical" {
  // Check exact match first
  if (actionRiskLevels[action]) {
    return actionRiskLevels[action];
  }
  
  // Check patterns
  if (action.includes("delete") || action.includes("remove")) {
    return "high";
  }
  if (action.includes("create") || action.includes("update")) {
    return "medium";
  }
  if (action.includes("get") || action.includes("list") || action.includes("query")) {
    return "low";
  }
  
  // Default to medium
  return "medium";
}

// Determine action type from procedure name
export function getActionType(procedureName: string): string {
  const parts = procedureName.split(".");
  const method = parts[parts.length - 1];
  
  if (method.startsWith("get") || method.startsWith("list") || method.startsWith("query")) {
    return "read";
  }
  if (method.startsWith("create") || method.startsWith("add")) {
    return "create";
  }
  if (method.startsWith("update") || method.startsWith("edit") || method.startsWith("set")) {
    return "update";
  }
  if (method.startsWith("delete") || method.startsWith("remove")) {
    return "delete";
  }
  if (method === "login" || method === "logout") {
    return method;
  }
  if (method.includes("deploy") || method.includes("rollback")) {
    return "deploy";
  }
  if (method.includes("scale")) {
    return "scale";
  }
  
  return "other";
}

// Get resource type from procedure path
export function getResourceType(procedureName: string): string {
  const parts = procedureName.split(".");
  if (parts.length > 0) {
    return parts[0];
  }
  return "unknown";
}

// Create audit log entry for a procedure call
export async function logProcedureCall(params: {
  userId: number;
  userEmail?: string;
  procedureName: string;
  input?: unknown;
  output?: unknown;
  error?: Error;
  duration: number;
  ipAddress?: string;
  userAgent?: string;
  teamId?: number;
}): Promise<void> {
  const {
    userId,
    userEmail,
    procedureName,
    input,
    output,
    error,
    duration,
    ipAddress,
    userAgent,
    teamId,
  } = params;
  
  const actionType = getActionType(procedureName);
  const resourceType = getResourceType(procedureName);
  const riskLevel = getActionRiskLevel(procedureName);
  
  // Skip logging for very low-risk read operations to reduce noise
  if (riskLevel === "low" && actionType === "read") {
    // Only log if it's a sensitive resource
    const sensitiveResources = ["auditLog", "teams", "connections", "email", "prometheus"];
    if (!sensitiveResources.includes(resourceType)) {
      return;
    }
  }
  
  // Determine status
  const status = error ? "failure" : "success";
  
  // Create description
  let description = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} operation on ${resourceType}`;
  if (error) {
    description += ` failed: ${error.message}`;
  }
  
  // Extract resource ID from input if available
  let resourceId: string | undefined;
  if (input && typeof input === "object") {
    const inputObj = input as Record<string, unknown>;
    resourceId = String(inputObj.id || inputObj.teamId || inputObj.containerId || inputObj.podName || "");
  }
  
  // Detect suspicious activity
  let isSuspicious = false;
  let suspiciousReason: string | undefined;
  
  // Check for suspicious patterns
  if (riskLevel === "critical" && status === "failure") {
    isSuspicious = true;
    suspiciousReason = "Failed critical operation";
  }
  
  // Multiple failed attempts would be detected by the anomaly detection service
  
  try {
    await createAuditLog(
      {
        userId,
        userEmail,
        ipAddress,
        userAgent,
        teamId,
      },
      {
        action: actionType as any,
        resourceType,
        resourceId,
        resourceName: resourceId,
        description,
        previousState: undefined,
        newState: status === "success" ? (output as Record<string, unknown>) : undefined,
        status,
        duration,
        errorMessage: error?.message,
        metadata: {
          procedureName,
          riskLevel,
          isSuspicious,
          suspiciousReason,
        },
      }
    );
  } catch (logError) {
    // Don't let audit logging failures affect the main operation
    console.error("Failed to create audit log:", logError);
  }
}

// Helper to wrap a procedure with audit logging
export function withAuditLogging<T>(
  procedureName: string,
  handler: () => Promise<T>,
  context: {
    userId: number;
    userEmail?: string;
    input?: unknown;
    ipAddress?: string;
    userAgent?: string;
    teamId?: number;
  }
): Promise<T> {
  const startTime = Date.now();
  
  return handler()
    .then((result) => {
      const duration = Date.now() - startTime;
      logProcedureCall({
        ...context,
        procedureName,
        output: result,
        duration,
      });
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      logProcedureCall({
        ...context,
        procedureName,
        error,
        duration,
      });
      throw error;
    });
}
