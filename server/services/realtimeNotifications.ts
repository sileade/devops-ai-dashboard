/**
 * Real-time Notifications Service
 * WebSocket-based notifications for critical audit log events
 */

import { getDb } from "../db";
import {
  auditLogs,
  users,
  teamMembers,
} from "../../drizzle/schema";
import { eq, and, desc, gte, inArray } from "drizzle-orm";

// ============================================
// TYPES
// ============================================

export type NotificationPriority = "critical" | "high" | "medium" | "low" | "info";
export type NotificationCategory = 
  | "security"
  | "deployment"
  | "scaling"
  | "error"
  | "team"
  | "system"
  | "audit";

export interface RealtimeNotification {
  id: string;
  type: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
  actionUrl?: string;
  read: boolean;
  userId?: number;
  teamId?: number;
}

export interface NotificationPreferences {
  userId: number;
  enableCritical: boolean;
  enableHigh: boolean;
  enableMedium: boolean;
  enableLow: boolean;
  enableInfo: boolean;
  categories: NotificationCategory[];
  emailNotifications: boolean;
  browserNotifications: boolean;
  soundEnabled: boolean;
}

// In-memory store for active connections and notifications
const activeConnections = new Map<number, Set<string>>(); // userId -> Set of connectionIds
const notificationHistory = new Map<number, RealtimeNotification[]>(); // userId -> notifications
const MAX_HISTORY_SIZE = 100;

// ============================================
// CONNECTION MANAGEMENT
// ============================================

export function registerConnection(userId: number, connectionId: string): void {
  if (!activeConnections.has(userId)) {
    activeConnections.set(userId, new Set());
  }
  activeConnections.get(userId)!.add(connectionId);
}

export function unregisterConnection(userId: number, connectionId: string): void {
  const connections = activeConnections.get(userId);
  if (connections) {
    connections.delete(connectionId);
    if (connections.size === 0) {
      activeConnections.delete(userId);
    }
  }
}

export function isUserOnline(userId: number): boolean {
  const connections = activeConnections.get(userId);
  return connections !== undefined && connections.size > 0;
}

export function getOnlineUsers(): number[] {
  return Array.from(activeConnections.keys());
}

// ============================================
// NOTIFICATION CREATION
// ============================================

export function createNotification(params: {
  type: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  userId?: number;
  teamId?: number;
}): RealtimeNotification {
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: params.type,
    priority: params.priority,
    title: params.title,
    message: params.message,
    timestamp: Date.now(),
    data: params.data,
    actionUrl: params.actionUrl,
    read: false,
    userId: params.userId,
    teamId: params.teamId,
  };
}

// ============================================
// NOTIFICATION DISPATCH
// ============================================

// Callback for sending notifications (to be set by WebSocket handler)
let notificationCallback: ((userId: number, notification: RealtimeNotification) => void) | null = null;

export function setNotificationCallback(
  callback: (userId: number, notification: RealtimeNotification) => void
): void {
  notificationCallback = callback;
}

export async function sendNotificationToUser(
  userId: number,
  notification: RealtimeNotification
): Promise<boolean> {
  // Store in history
  if (!notificationHistory.has(userId)) {
    notificationHistory.set(userId, []);
  }
  const history = notificationHistory.get(userId)!;
  history.unshift(notification);
  if (history.length > MAX_HISTORY_SIZE) {
    history.pop();
  }

  // Send via WebSocket if user is online
  if (notificationCallback && isUserOnline(userId)) {
    notificationCallback(userId, notification);
    return true;
  }
  return false;
}

export async function sendNotificationToTeam(
  teamId: number,
  notification: RealtimeNotification
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get all team members
  const members = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  let sentCount = 0;
  for (const member of members) {
    const sent = await sendNotificationToUser(member.userId, {
      ...notification,
      userId: member.userId,
    });
    if (sent) sentCount++;
  }
  return sentCount;
}

export async function broadcastNotification(
  notification: RealtimeNotification
): Promise<number> {
  let sentCount = 0;
  for (const userId of getOnlineUsers()) {
    const sent = await sendNotificationToUser(userId, {
      ...notification,
      userId,
    });
    if (sent) sentCount++;
  }
  return sentCount;
}

// ============================================
// AUDIT LOG EVENT HANDLERS
// ============================================

export async function notifyAuditEvent(auditLog: {
  id: number;
  action: string;
  resourceType?: string;
  resourceName?: string;
  riskLevel: string;
  status: string;
  userId?: number;
  teamId?: number;
  description?: string;
}): Promise<void> {
  // Only notify for high-risk or failed events
  if (auditLog.riskLevel !== "high" && auditLog.riskLevel !== "critical" && auditLog.status !== "failure") {
    return;
  }

  const priority = auditLog.riskLevel === "critical" ? "critical" : 
                   auditLog.riskLevel === "high" ? "high" : "medium";
  
  const type: NotificationCategory = 
    auditLog.action.includes("deploy") ? "deployment" :
    auditLog.action.includes("scale") ? "scaling" :
    auditLog.action.includes("login") || auditLog.action.includes("secret") ? "security" :
    auditLog.action.includes("team") ? "team" :
    auditLog.status === "failure" ? "error" : "audit";

  const notification = createNotification({
    type,
    priority,
    title: `${auditLog.action} - ${auditLog.status}`,
    message: auditLog.description || `${auditLog.action} on ${auditLog.resourceType || "resource"}`,
    data: {
      auditLogId: auditLog.id,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceName: auditLog.resourceName,
    },
    actionUrl: `/audit-log?id=${auditLog.id}`,
    userId: auditLog.userId,
    teamId: auditLog.teamId,
  });

  if (auditLog.teamId) {
    await sendNotificationToTeam(auditLog.teamId, notification);
  } else if (auditLog.userId) {
    await sendNotificationToUser(auditLog.userId, notification);
  } else {
    await broadcastNotification(notification);
  }
}

// ============================================
// NOTIFICATION HISTORY
// ============================================

export function getUserNotifications(
  userId: number,
  options: {
    limit?: number;
    unreadOnly?: boolean;
    categories?: NotificationCategory[];
    priorities?: NotificationPriority[];
  } = {}
): RealtimeNotification[] {
  const history = notificationHistory.get(userId) || [];
  let filtered = history;

  if (options.unreadOnly) {
    filtered = filtered.filter(n => !n.read);
  }
  if (options.categories && options.categories.length > 0) {
    filtered = filtered.filter(n => options.categories!.includes(n.type));
  }
  if (options.priorities && options.priorities.length > 0) {
    filtered = filtered.filter(n => options.priorities!.includes(n.priority));
  }

  return filtered.slice(0, options.limit || 50);
}

export function markNotificationAsRead(userId: number, notificationId: string): boolean {
  const history = notificationHistory.get(userId);
  if (!history) return false;

  const notification = history.find(n => n.id === notificationId);
  if (notification) {
    notification.read = true;
    return true;
  }
  return false;
}

export function markAllNotificationsAsRead(userId: number): number {
  const history = notificationHistory.get(userId);
  if (!history) return 0;

  let count = 0;
  for (const notification of history) {
    if (!notification.read) {
      notification.read = true;
      count++;
    }
  }
  return count;
}

export function getUnreadCount(userId: number): number {
  const history = notificationHistory.get(userId) || [];
  return history.filter(n => !n.read).length;
}

export function clearNotifications(userId: number): void {
  notificationHistory.delete(userId);
}

// ============================================
// SYSTEM NOTIFICATIONS
// ============================================

export async function notifyDeploymentStarted(params: {
  deploymentId: string;
  applicationName: string;
  version: string;
  environment: string;
  userId: number;
  teamId?: number;
}): Promise<void> {
  const notification = createNotification({
    type: "deployment",
    priority: "medium",
    title: "Deployment Started",
    message: `Deploying ${params.applicationName} v${params.version} to ${params.environment}`,
    data: params,
    actionUrl: `/deployments/${params.deploymentId}`,
    userId: params.userId,
    teamId: params.teamId,
  });

  if (params.teamId) {
    await sendNotificationToTeam(params.teamId, notification);
  } else {
    await sendNotificationToUser(params.userId, notification);
  }
}

export async function notifyDeploymentCompleted(params: {
  deploymentId: string;
  applicationName: string;
  version: string;
  environment: string;
  success: boolean;
  duration: number;
  userId: number;
  teamId?: number;
}): Promise<void> {
  const notification = createNotification({
    type: "deployment",
    priority: params.success ? "info" : "critical",
    title: params.success ? "Deployment Successful" : "Deployment Failed",
    message: `${params.applicationName} v${params.version} ${params.success ? "deployed" : "failed"} to ${params.environment} (${Math.round(params.duration / 1000)}s)`,
    data: params,
    actionUrl: `/deployments/${params.deploymentId}`,
    userId: params.userId,
    teamId: params.teamId,
  });

  if (params.teamId) {
    await sendNotificationToTeam(params.teamId, notification);
  } else {
    await sendNotificationToUser(params.userId, notification);
  }
}

export async function notifySecurityAlert(params: {
  alertType: "failed_login" | "suspicious_activity" | "unauthorized_access" | "secret_accessed";
  description: string;
  ipAddress?: string;
  userId?: number;
  teamId?: number;
}): Promise<void> {
  const notification = createNotification({
    type: "security",
    priority: "critical",
    title: "Security Alert",
    message: params.description,
    data: params,
    actionUrl: "/audit-log?risk=critical",
    userId: params.userId,
    teamId: params.teamId,
  });

  if (params.teamId) {
    await sendNotificationToTeam(params.teamId, notification);
  } else if (params.userId) {
    await sendNotificationToUser(params.userId, notification);
  } else {
    await broadcastNotification(notification);
  }
}

export async function notifyScalingEvent(params: {
  resourceType: "deployment" | "pod" | "container";
  resourceName: string;
  previousReplicas: number;
  newReplicas: number;
  reason: string;
  userId?: number;
  teamId?: number;
}): Promise<void> {
  const direction = params.newReplicas > params.previousReplicas ? "up" : "down";
  const notification = createNotification({
    type: "scaling",
    priority: "medium",
    title: `Scaled ${direction}`,
    message: `${params.resourceName}: ${params.previousReplicas} → ${params.newReplicas} replicas (${params.reason})`,
    data: params,
    actionUrl: "/autoscaling",
    userId: params.userId,
    teamId: params.teamId,
  });

  if (params.teamId) {
    await sendNotificationToTeam(params.teamId, notification);
  } else if (params.userId) {
    await sendNotificationToUser(params.userId, notification);
  } else {
    await broadcastNotification(notification);
  }
}

export async function notifySystemError(params: {
  errorType: string;
  message: string;
  stack?: string;
  component?: string;
  userId?: number;
  teamId?: number;
}): Promise<void> {
  const notification = createNotification({
    type: "error",
    priority: "high",
    title: `System Error: ${params.errorType}`,
    message: params.message,
    data: params,
    actionUrl: "/logs",
    userId: params.userId,
    teamId: params.teamId,
  });

  if (params.teamId) {
    await sendNotificationToTeam(params.teamId, notification);
  } else if (params.userId) {
    await sendNotificationToUser(params.userId, notification);
  } else {
    await broadcastNotification(notification);
  }
}
