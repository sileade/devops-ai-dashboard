import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

// Core user table backing auth flow
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Applications/Environments - isolated contexts for multi-app management
export const applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  environment: mysqlEnum("environment", ["development", "staging", "production"]).default("development").notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

// Infrastructure connections (Docker hosts, K8s clusters, etc.)
export const infrastructureConnections = mysqlTable("infrastructure_connections", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["docker", "podman", "kubernetes", "ansible", "terraform"]).notNull(),
  host: varchar("host", { length: 500 }),
  port: int("port"),
  connectionConfig: json("connectionConfig"),
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("disconnected").notNull(),
  lastChecked: timestamp("lastChecked"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InfrastructureConnection = typeof infrastructureConnections.$inferSelect;
export type InsertInfrastructureConnection = typeof infrastructureConnections.$inferInsert;

// Deployment history for audit and rollback
export const deploymentHistory = mysqlTable("deployment_history", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["docker", "kubernetes", "ansible", "terraform"]).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceName: varchar("resourceName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "running", "success", "failed", "cancelled"]).default("pending").notNull(),
  details: json("details"),
  logs: text("logs"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type DeploymentHistory = typeof deploymentHistory.$inferSelect;
export type InsertDeploymentHistory = typeof deploymentHistory.$inferInsert;

// AI Knowledge base entries for learning
export const knowledgeEntries = mysqlTable("knowledge_entries", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  category: varchar("category", { length: 100 }).notNull(),
  problem: text("problem").notNull(),
  solution: text("solution").notNull(),
  confidence: int("confidence").default(50).notNull(),
  successCount: int("successCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  humanVerified: boolean("humanVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type InsertKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

// Notifications and alerts
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  type: mysqlEnum("type", ["info", "warning", "error", "success"]).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// User preferences
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  defaultApplicationId: int("defaultApplicationId"),
  theme: mysqlEnum("theme", ["dark", "light", "system"]).default("dark").notNull(),
  sidebarCollapsed: boolean("sidebarCollapsed").default(false).notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  emailAlerts: boolean("emailAlerts").default(false).notNull(),
  refreshInterval: int("refreshInterval").default(30).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// Saved commands/scripts for quick access
export const savedCommands = mysqlTable("saved_commands", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["docker", "kubectl", "ansible", "terraform", "shell"]).notNull(),
  command: text("command").notNull(),
  description: text("description"),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedCommand = typeof savedCommands.$inferSelect;
export type InsertSavedCommand = typeof savedCommands.$inferInsert;

// AI Chat messages for persistent history
// Note: Uses conversationId as foreign key to chat_sessions
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  suggestions: json("suggestions").$type<string[]>(),
  commands: json("commands").$type<{ command: string; description: string }[]>(),
  feedback: mysqlEnum("feedback", ["positive", "negative"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Chat sessions for grouping messages
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  userId: int("userId"),
  userOpenId: varchar("userOpenId", { length: 64 }),
  title: varchar("title", { length: 255 }).default("New Chat"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

// Metrics history for long-term trend analysis
export const metricsHistory = mysqlTable("metrics_history", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  source: mysqlEnum("source", ["docker", "kubernetes", "system"]).default("system").notNull(),
  resourceType: mysqlEnum("resourceType", ["container", "pod", "node", "cluster"]).default("cluster").notNull(),
  resourceId: varchar("resourceId", { length: 255 }),
  cpuPercent: int("cpuPercent").notNull(),
  memoryPercent: int("memoryPercent").notNull(),
  memoryUsedMb: int("memoryUsedMb"),
  memoryTotalMb: int("memoryTotalMb"),
  networkRxBytes: int("networkRxBytes"),
  networkTxBytes: int("networkTxBytes"),
  diskUsedGb: int("diskUsedGb"),
  diskTotalGb: int("diskTotalGb"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type MetricsHistory = typeof metricsHistory.$inferSelect;
export type InsertMetricsHistory = typeof metricsHistory.$inferInsert;

// Alert thresholds for configurable alerting
export const alertThresholds = mysqlTable("alert_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "disk", "network"]).notNull(),
  resourceType: mysqlEnum("resourceType", ["container", "pod", "node", "cluster"]).default("cluster").notNull(),
  resourcePattern: varchar("resourcePattern", { length: 255 }),
  warningThreshold: int("warningThreshold").notNull(),
  criticalThreshold: int("criticalThreshold").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  cooldownMinutes: int("cooldownMinutes").default(5).notNull(),
  lastTriggered: timestamp("lastTriggered"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertThreshold = typeof alertThresholds.$inferSelect;
export type InsertAlertThreshold = typeof alertThresholds.$inferInsert;

// Alert history for tracking triggered alerts
export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  thresholdId: int("thresholdId"),
  applicationId: int("applicationId"),
  severity: mysqlEnum("severity", ["warning", "critical"]).notNull(),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "disk", "network"]).notNull(),
  resourceType: mysqlEnum("resourceType", ["container", "pod", "node", "cluster"]).default("cluster").notNull(),
  resourceId: varchar("resourceId", { length: 255 }),
  currentValue: int("currentValue").notNull(),
  thresholdValue: int("thresholdValue").notNull(),
  message: text("message").notNull(),
  isAcknowledged: boolean("isAcknowledged").default(false).notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = typeof alertHistory.$inferInsert;


// Auto-scaling rules for AI-powered resource management
export const autoscalingRules = mysqlTable("autoscaling_rules", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  resourceType: mysqlEnum("resourceType", ["deployment", "container", "pod", "service"]).notNull(),
  resourcePattern: varchar("resourcePattern", { length: 255 }).notNull(),
  namespace: varchar("namespace", { length: 255 }),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "requests", "custom"]).notNull(),
  scaleUpThreshold: int("scaleUpThreshold").notNull(),
  scaleDownThreshold: int("scaleDownThreshold").notNull(),
  minReplicas: int("minReplicas").default(1).notNull(),
  maxReplicas: int("maxReplicas").default(10).notNull(),
  cooldownSeconds: int("cooldownSeconds").default(300).notNull(),
  scaleUpStep: int("scaleUpStep").default(1).notNull(),
  scaleDownStep: int("scaleDownStep").default(1).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  aiAssisted: boolean("aiAssisted").default(true).notNull(),
  lastScaledAt: timestamp("lastScaledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutoscalingRule = typeof autoscalingRules.$inferSelect;
export type InsertAutoscalingRule = typeof autoscalingRules.$inferInsert;

// Auto-scaling history for tracking scaling actions
export const autoscalingHistory = mysqlTable("autoscaling_history", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  applicationId: int("applicationId"),
  action: mysqlEnum("action", ["scale_up", "scale_down", "no_action", "pending_approval", "rejected", "failed"]).notNull(),
  previousReplicas: int("previousReplicas").notNull(),
  newReplicas: int("newReplicas").notNull(),
  triggerMetric: varchar("triggerMetric", { length: 50 }).notNull(),
  triggerValue: int("triggerValue").notNull(),
  thresholdValue: int("thresholdValue").notNull(),
  aiAnalysis: text("aiAnalysis"),
  aiConfidence: int("aiConfidence"),
  aiRecommendation: text("aiRecommendation"),
  executedBy: mysqlEnum("executedBy", ["ai", "manual", "scheduled"]).default("ai").notNull(),
  approvedBy: int("approvedBy"),
  status: mysqlEnum("status", ["pending", "executing", "completed", "failed", "cancelled"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  executionTimeMs: int("executionTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type AutoscalingHistory = typeof autoscalingHistory.$inferSelect;
export type InsertAutoscalingHistory = typeof autoscalingHistory.$inferInsert;

// AI scaling predictions for proactive scaling
export const aiScalingPredictions = mysqlTable("ai_scaling_predictions", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  applicationId: int("applicationId"),
  predictedMetricValue: int("predictedMetricValue").notNull(),
  predictedTime: timestamp("predictedTime").notNull(),
  recommendedReplicas: int("recommendedReplicas").notNull(),
  confidence: int("confidence").notNull(),
  reasoning: text("reasoning").notNull(),
  dataPointsAnalyzed: int("dataPointsAnalyzed").notNull(),
  patternDetected: varchar("patternDetected", { length: 100 }),
  isActedUpon: boolean("isActedUpon").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiScalingPrediction = typeof aiScalingPredictions.$inferSelect;
export type InsertAiScalingPrediction = typeof aiScalingPredictions.$inferInsert;


// Scheduled scaling for predictable load patterns
export const scheduledScaling = mysqlTable("scheduled_scaling", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetType: mysqlEnum("targetType", ["deployment", "container", "service"]).default("deployment").notNull(),
  targetName: varchar("targetName", { length: 255 }).notNull(),
  namespace: varchar("namespace", { length: 255 }),
  cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  targetReplicas: int("targetReplicas").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  nextExecutionAt: timestamp("nextExecutionAt"),
  executionCount: int("executionCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledScaling = typeof scheduledScaling.$inferSelect;
export type InsertScheduledScaling = typeof scheduledScaling.$inferInsert;

// Scheduled scaling execution history
export const scheduledScalingHistory = mysqlTable("scheduled_scaling_history", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("scheduleId").notNull(),
  previousReplicas: int("previousReplicas").notNull(),
  targetReplicas: int("targetReplicas").notNull(),
  actualReplicas: int("actualReplicas"),
  status: mysqlEnum("status", ["pending", "executing", "completed", "failed", "skipped"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  executionTimeMs: int("executionTimeMs"),
  scheduledFor: timestamp("scheduledFor").notNull(),
  executedAt: timestamp("executedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledScalingHistory = typeof scheduledScalingHistory.$inferSelect;
export type InsertScheduledScalingHistory = typeof scheduledScalingHistory.$inferInsert;

// A/B test experiments for autoscaling rules
export const abTestExperiments = mysqlTable("ab_test_experiments", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetType: mysqlEnum("targetType", ["deployment", "container", "service"]).default("deployment").notNull(),
  targetName: varchar("targetName", { length: 255 }).notNull(),
  namespace: varchar("namespace", { length: 255 }),
  status: mysqlEnum("status", ["draft", "running", "paused", "completed", "cancelled"]).default("draft").notNull(),
  // Variant A (Control)
  variantAName: varchar("variantAName", { length: 100 }).default("Control").notNull(),
  variantAScaleUpThreshold: int("variantAScaleUpThreshold").notNull(),
  variantAScaleDownThreshold: int("variantAScaleDownThreshold").notNull(),
  variantACooldown: int("variantACooldown").default(300).notNull(),
  variantAMinReplicas: int("variantAMinReplicas").default(1).notNull(),
  variantAMaxReplicas: int("variantAMaxReplicas").default(10).notNull(),
  // Variant B (Treatment)
  variantBName: varchar("variantBName", { length: 100 }).default("Treatment").notNull(),
  variantBScaleUpThreshold: int("variantBScaleUpThreshold").notNull(),
  variantBScaleDownThreshold: int("variantBScaleDownThreshold").notNull(),
  variantBCooldown: int("variantBCooldown").default(300).notNull(),
  variantBMinReplicas: int("variantBMinReplicas").default(1).notNull(),
  variantBMaxReplicas: int("variantBMaxReplicas").default(10).notNull(),
  // Traffic split
  trafficSplitPercent: int("trafficSplitPercent").default(50).notNull(), // % to variant B
  // Duration
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  durationHours: int("durationHours").default(24).notNull(),
  // Winner
  winnerVariant: mysqlEnum("winnerVariant", ["A", "B", "inconclusive"]),
  winnerConfidence: int("winnerConfidence"),
  winnerReason: text("winnerReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AbTestExperiment = typeof abTestExperiments.$inferSelect;
export type InsertAbTestExperiment = typeof abTestExperiments.$inferInsert;

// A/B test metrics for each variant
export const abTestMetrics = mysqlTable("ab_test_metrics", {
  id: int("id").autoincrement().primaryKey(),
  experimentId: int("experimentId").notNull(),
  variant: mysqlEnum("variant", ["A", "B"]).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  // Performance metrics
  avgCpuPercent: int("avgCpuPercent").notNull(),
  avgMemoryPercent: int("avgMemoryPercent").notNull(),
  avgResponseTimeMs: int("avgResponseTimeMs"),
  errorRate: int("errorRate"), // per 10000 requests
  // Scaling metrics
  scaleUpCount: int("scaleUpCount").default(0).notNull(),
  scaleDownCount: int("scaleDownCount").default(0).notNull(),
  avgReplicaCount: int("avgReplicaCount").notNull(),
  // Cost metrics (estimated)
  estimatedCostUnits: int("estimatedCostUnits"),
  // Stability metrics
  oscillationCount: int("oscillationCount").default(0).notNull(), // rapid up/down cycles
  cooldownViolations: int("cooldownViolations").default(0).notNull(),
});

export type AbTestMetric = typeof abTestMetrics.$inferSelect;
export type InsertAbTestMetric = typeof abTestMetrics.$inferInsert;
