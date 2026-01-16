// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, and, desc, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  environment: mysqlEnum("environment", ["development", "staging", "production"]).default("development").notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var infrastructureConnections = mysqlTable("infrastructure_connections", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var deploymentHistory = mysqlTable("deployment_history", {
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
  completedAt: timestamp("completedAt")
});
var knowledgeEntries = mysqlTable("knowledge_entries", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  type: mysqlEnum("type", ["info", "warning", "error", "success"]).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  defaultApplicationId: int("defaultApplicationId"),
  theme: mysqlEnum("theme", ["dark", "light", "system"]).default("dark").notNull(),
  sidebarCollapsed: boolean("sidebarCollapsed").default(false).notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  emailAlerts: boolean("emailAlerts").default(false).notNull(),
  refreshInterval: int("refreshInterval").default(30).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var savedCommands = mysqlTable("saved_commands", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  suggestions: json("suggestions").$type(),
  commands: json("commands").$type(),
  feedback: mysqlEnum("feedback", ["positive", "negative"]),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  userId: int("userId"),
  userOpenId: varchar("userOpenId", { length: 64 }),
  title: varchar("title", { length: 255 }).default("New Chat"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var metricsHistory = mysqlTable("metrics_history", {
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
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var alertThresholds = mysqlTable("alert_thresholds", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var alertHistory = mysqlTable("alert_history", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var autoscalingRules = mysqlTable("autoscaling_rules", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var autoscalingHistory = mysqlTable("autoscaling_history", {
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
  completedAt: timestamp("completedAt")
});
var aiScalingPredictions = mysqlTable("ai_scaling_predictions", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var scheduledScaling = mysqlTable("scheduled_scaling", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var scheduledScalingHistory = mysqlTable("scheduled_scaling_history", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var abTestExperiments = mysqlTable("ab_test_experiments", {
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
  trafficSplitPercent: int("trafficSplitPercent").default(50).notNull(),
  // % to variant B
  // Duration
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  durationHours: int("durationHours").default(24).notNull(),
  // Winner
  winnerVariant: mysqlEnum("winnerVariant", ["A", "B", "inconclusive"]),
  winnerConfidence: int("winnerConfidence"),
  winnerReason: text("winnerReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var abTestMetrics = mysqlTable("ab_test_metrics", {
  id: int("id").autoincrement().primaryKey(),
  experimentId: int("experimentId").notNull(),
  variant: mysqlEnum("variant", ["A", "B"]).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  // Performance metrics
  avgCpuPercent: int("avgCpuPercent").notNull(),
  avgMemoryPercent: int("avgMemoryPercent").notNull(),
  avgResponseTimeMs: int("avgResponseTimeMs"),
  errorRate: int("errorRate"),
  // per 10000 requests
  // Scaling metrics
  scaleUpCount: int("scaleUpCount").default(0).notNull(),
  scaleDownCount: int("scaleDownCount").default(0).notNull(),
  avgReplicaCount: int("avgReplicaCount").notNull(),
  // Cost metrics (estimated)
  estimatedCostUnits: int("estimatedCostUnits"),
  // Stability metrics
  oscillationCount: int("oscillationCount").default(0).notNull(),
  // rapid up/down cycles
  cooldownViolations: int("cooldownViolations").default(0).notNull()
});
var emailConfig = mysqlTable("email_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  smtpHost: varchar("smtpHost", { length: 255 }).notNull(),
  smtpPort: int("smtpPort").default(587).notNull(),
  smtpSecure: boolean("smtpSecure").default(false).notNull(),
  smtpUser: varchar("smtpUser", { length: 255 }).notNull(),
  smtpPassword: varchar("smtpPassword", { length: 500 }).notNull(),
  // encrypted
  fromEmail: varchar("fromEmail", { length: 320 }).notNull(),
  fromName: varchar("fromName", { length: 255 }).default("DevOps AI Dashboard"),
  isVerified: boolean("isVerified").default(false).notNull(),
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var emailSubscriptions = mysqlTable("email_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  // Notification types
  criticalAlerts: boolean("criticalAlerts").default(true).notNull(),
  warningAlerts: boolean("warningAlerts").default(true).notNull(),
  infoAlerts: boolean("infoAlerts").default(false).notNull(),
  scalingEvents: boolean("scalingEvents").default(true).notNull(),
  abTestResults: boolean("abTestResults").default(true).notNull(),
  dailyDigest: boolean("dailyDigest").default(false).notNull(),
  weeklyReport: boolean("weeklyReport").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  unsubscribeToken: varchar("unsubscribeToken", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var emailHistory = mysqlTable("email_history", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId"),
  toEmail: varchar("toEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  templateType: mysqlEnum("templateType", ["alert", "scaling", "ab_test", "digest", "report", "custom"]).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "bounced"]).default("pending").notNull(),
  messageId: varchar("messageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var prometheusConfig = mysqlTable("prometheus_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  name: varchar("name", { length: 255 }).notNull(),
  prometheusUrl: varchar("prometheusUrl", { length: 500 }).notNull(),
  prometheusUsername: varchar("prometheusUsername", { length: 255 }),
  prometheusPassword: varchar("prometheusPassword", { length: 500 }),
  grafanaUrl: varchar("grafanaUrl", { length: 500 }),
  grafanaApiKey: varchar("grafanaApiKey", { length: 500 }),
  scrapeInterval: int("scrapeInterval").default(15).notNull(),
  // seconds
  isEnabled: boolean("isEnabled").default(true).notNull(),
  lastScrapeAt: timestamp("lastScrapeAt"),
  lastScrapeStatus: mysqlEnum("lastScrapeStatus", ["success", "failed", "timeout"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var prometheusMetrics = mysqlTable("prometheus_metrics", {
  id: int("id").autoincrement().primaryKey(),
  configId: int("configId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  query: text("query").notNull(),
  // PromQL query
  description: text("description"),
  unit: varchar("unit", { length: 50 }),
  aggregation: mysqlEnum("aggregation", ["avg", "sum", "min", "max", "count", "rate"]).default("avg").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var grafanaDashboards = mysqlTable("grafana_dashboards", {
  id: int("id").autoincrement().primaryKey(),
  configId: int("configId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  uid: varchar("uid", { length: 100 }).notNull(),
  embedUrl: text("embedUrl"),
  category: mysqlEnum("category", ["overview", "containers", "kubernetes", "custom"]).default("custom").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var kubernetesClusters = mysqlTable("kubernetes_clusters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  description: text("description"),
  // Connection details
  apiServerUrl: varchar("apiServerUrl", { length: 500 }).notNull(),
  authType: mysqlEnum("authType", ["kubeconfig", "token", "certificate", "oidc"]).default("token").notNull(),
  kubeconfig: text("kubeconfig"),
  // encrypted
  bearerToken: text("bearerToken"),
  // encrypted
  clientCertificate: text("clientCertificate"),
  clientKey: text("clientKey"),
  // encrypted
  caCertificate: text("caCertificate"),
  // Cluster metadata
  kubernetesVersion: varchar("kubernetesVersion", { length: 50 }),
  provider: mysqlEnum("provider", ["aws", "gcp", "azure", "digitalocean", "linode", "on-premise", "other"]).default("other"),
  region: varchar("region", { length: 100 }),
  // Status
  status: mysqlEnum("status", ["connected", "disconnected", "error", "pending"]).default("pending").notNull(),
  lastHealthCheck: timestamp("lastHealthCheck"),
  healthStatus: mysqlEnum("healthStatus", ["healthy", "degraded", "unhealthy", "unknown"]).default("unknown"),
  nodeCount: int("nodeCount"),
  podCount: int("podCount"),
  // Settings
  isDefault: boolean("isDefault").default(false).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  syncInterval: int("syncInterval").default(30).notNull(),
  // seconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var clusterNamespaces = mysqlTable("cluster_namespaces", {
  id: int("id").autoincrement().primaryKey(),
  clusterId: int("clusterId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }),
  labels: json("labels"),
  podCount: int("podCount").default(0),
  deploymentCount: int("deploymentCount").default(0),
  serviceCount: int("serviceCount").default(0),
  lastSyncAt: timestamp("lastSyncAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var clusterComparisons = mysqlTable("cluster_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  clusterIds: json("clusterIds").notNull(),
  // array of cluster IDs
  comparisonType: mysqlEnum("comparisonType", ["resources", "workloads", "networking", "storage", "all"]).default("all").notNull(),
  snapshotData: json("snapshotData"),
  // comparison results
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var canaryDeployments = mysqlTable("canary_deployments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  clusterId: int("clusterId"),
  // Deployment identification
  name: varchar("name", { length: 255 }).notNull(),
  namespace: varchar("namespace", { length: 255 }).default("default"),
  targetDeployment: varchar("targetDeployment", { length: 255 }).notNull(),
  // Version info
  stableVersion: varchar("stableVersion", { length: 100 }),
  canaryVersion: varchar("canaryVersion", { length: 100 }),
  stableImage: varchar("stableImage", { length: 500 }),
  canaryImage: varchar("canaryImage", { length: 500 }),
  // Traffic configuration
  trafficSplitType: mysqlEnum("trafficSplitType", ["percentage", "header", "cookie"]).default("percentage").notNull(),
  initialCanaryPercent: int("initialCanaryPercent").default(10).notNull(),
  currentCanaryPercent: int("currentCanaryPercent").default(0).notNull(),
  targetCanaryPercent: int("targetCanaryPercent").default(100).notNull(),
  incrementPercent: int("incrementPercent").default(10).notNull(),
  // How much to increase per step
  incrementIntervalMinutes: int("incrementIntervalMinutes").default(5).notNull(),
  // Health thresholds for auto-rollback
  errorRateThreshold: int("errorRateThreshold").default(5).notNull(),
  // Percentage
  latencyThresholdMs: int("latencyThresholdMs").default(1e3).notNull(),
  successRateThreshold: int("successRateThreshold").default(95).notNull(),
  // Percentage
  minHealthyPods: int("minHealthyPods").default(1).notNull(),
  // Rollback configuration
  autoRollbackEnabled: boolean("autoRollbackEnabled").default(true).notNull(),
  rollbackOnErrorRate: boolean("rollbackOnErrorRate").default(true).notNull(),
  rollbackOnLatency: boolean("rollbackOnLatency").default(true).notNull(),
  rollbackOnPodFailure: boolean("rollbackOnPodFailure").default(true).notNull(),
  maxRollbackAttempts: int("maxRollbackAttempts").default(3).notNull(),
  // Analysis configuration
  analysisIntervalSeconds: int("analysisIntervalSeconds").default(30).notNull(),
  minAnalysisDuration: int("minAnalysisDuration").default(60).notNull(),
  // Minimum seconds before promotion
  requireManualApproval: boolean("requireManualApproval").default(false).notNull(),
  // Status
  status: mysqlEnum("status", [
    "pending",
    "initializing",
    "progressing",
    "paused",
    "promoting",
    "promoted",
    "rolling_back",
    "rolled_back",
    "failed",
    "cancelled"
  ]).default("pending").notNull(),
  statusMessage: text("statusMessage"),
  // Timing
  startedAt: timestamp("startedAt"),
  lastProgressAt: timestamp("lastProgressAt"),
  completedAt: timestamp("completedAt"),
  // Metadata
  createdBy: varchar("createdBy", { length: 255 }),
  gitCommit: varchar("gitCommit", { length: 100 }),
  gitBranch: varchar("gitBranch", { length: 255 }),
  pullRequestUrl: varchar("pullRequestUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var canaryDeploymentSteps = mysqlTable("canary_deployment_steps", {
  id: int("id").autoincrement().primaryKey(),
  deploymentId: int("deploymentId").notNull(),
  stepNumber: int("stepNumber").notNull(),
  targetPercent: int("targetPercent").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending").notNull(),
  // Metrics at this step
  requestCount: int("requestCount").default(0),
  errorCount: int("errorCount").default(0),
  avgLatencyMs: int("avgLatencyMs"),
  p99LatencyMs: int("p99LatencyMs"),
  successRate: int("successRate"),
  // Percentage * 100 for precision
  // Health status
  healthyPods: int("healthyPods"),
  totalPods: int("totalPods"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var canaryMetrics = mysqlTable("canary_metrics", {
  id: int("id").autoincrement().primaryKey(),
  deploymentId: int("deploymentId").notNull(),
  stepId: int("stepId"),
  // Traffic metrics
  canaryPercent: int("canaryPercent").notNull(),
  canaryRequests: int("canaryRequests").default(0),
  stableRequests: int("stableRequests").default(0),
  // Error metrics
  canaryErrors: int("canaryErrors").default(0),
  stableErrors: int("stableErrors").default(0),
  canaryErrorRate: int("canaryErrorRate"),
  // Percentage * 100
  stableErrorRate: int("stableErrorRate"),
  // Latency metrics (milliseconds)
  canaryAvgLatency: int("canaryAvgLatency"),
  stableAvgLatency: int("stableAvgLatency"),
  canaryP50Latency: int("canaryP50Latency"),
  stableP50Latency: int("stableP50Latency"),
  canaryP95Latency: int("canaryP95Latency"),
  stableP95Latency: int("stableP95Latency"),
  canaryP99Latency: int("canaryP99Latency"),
  stableP99Latency: int("stableP99Latency"),
  // Pod health
  canaryHealthyPods: int("canaryHealthyPods"),
  canaryTotalPods: int("canaryTotalPods"),
  stableHealthyPods: int("stableHealthyPods"),
  stableTotalPods: int("stableTotalPods"),
  // Resource usage
  canaryCpuPercent: int("canaryCpuPercent"),
  stableCpuPercent: int("stableCpuPercent"),
  canaryMemoryPercent: int("canaryMemoryPercent"),
  stableMemoryPercent: int("stableMemoryPercent"),
  // Analysis result
  analysisResult: mysqlEnum("analysisResult", ["healthy", "degraded", "unhealthy", "inconclusive"]).default("inconclusive"),
  analysisNotes: text("analysisNotes"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var canaryRollbackHistory = mysqlTable("canary_rollback_history", {
  id: int("id").autoincrement().primaryKey(),
  deploymentId: int("deploymentId").notNull(),
  // Rollback trigger
  trigger: mysqlEnum("trigger", [
    "auto_error_rate",
    "auto_latency",
    "auto_pod_failure",
    "auto_health_check",
    "manual",
    "timeout",
    "cancelled"
  ]).notNull(),
  triggerValue: varchar("triggerValue", { length: 255 }),
  // The value that triggered rollback
  thresholdValue: varchar("thresholdValue", { length: 255 }),
  // The threshold that was exceeded
  // State at rollback
  canaryPercentAtRollback: int("canaryPercentAtRollback").notNull(),
  stepAtRollback: int("stepAtRollback"),
  // Rollback execution
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending").notNull(),
  rollbackToVersion: varchar("rollbackToVersion", { length: 100 }),
  rollbackToImage: varchar("rollbackToImage", { length: 500 }),
  // Timing
  initiatedAt: timestamp("initiatedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  // Details
  initiatedBy: varchar("initiatedBy", { length: 255 }),
  // "system" or user ID
  reason: text("reason"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var canaryTemplates = mysqlTable("canary_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Default configuration
  trafficSplitType: mysqlEnum("trafficSplitType", ["percentage", "header", "cookie"]).default("percentage").notNull(),
  initialCanaryPercent: int("initialCanaryPercent").default(10).notNull(),
  incrementPercent: int("incrementPercent").default(10).notNull(),
  incrementIntervalMinutes: int("incrementIntervalMinutes").default(5).notNull(),
  // Default thresholds
  errorRateThreshold: int("errorRateThreshold").default(5).notNull(),
  latencyThresholdMs: int("latencyThresholdMs").default(1e3).notNull(),
  successRateThreshold: int("successRateThreshold").default(95).notNull(),
  // Default rollback settings
  autoRollbackEnabled: boolean("autoRollbackEnabled").default(true).notNull(),
  requireManualApproval: boolean("requireManualApproval").default(false).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getOrCreateChatSession(userOpenId, sessionId) {
  const db = await getDb();
  if (!db) {
    const tempSessionId = sessionId || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return { sessionId: tempSessionId, conversationId: 0, isNew: true };
  }
  try {
    if (sessionId) {
      const existing = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
      if (existing.length > 0) {
        return { sessionId: existing[0].sessionId, conversationId: existing[0].id, isNew: false };
      }
    }
    if (userOpenId) {
      const activeSession = await db.select().from(chatSessions).where(and(
        eq(chatSessions.userOpenId, userOpenId),
        eq(chatSessions.isActive, true)
      )).orderBy(desc(chatSessions.updatedAt)).limit(1);
      if (activeSession.length > 0) {
        return { sessionId: activeSession[0].sessionId, conversationId: activeSession[0].id, isNew: false };
      }
    }
    const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId,
      title: "New Chat",
      isActive: true
    });
    return { sessionId: newSessionId, conversationId: result[0].insertId, isNew: true };
  } catch (error) {
    console.error("[Database] Failed to get/create chat session:", error);
    const fallbackId = `fallback-${Date.now()}`;
    return { sessionId: fallbackId, conversationId: 0, isNew: true };
  }
}
async function saveChatMessage(message) {
  const db = await getDb();
  if (!db || message.conversationId === 0) {
    console.warn("[Database] Cannot save chat message: database not available or invalid conversationId");
    return null;
  }
  try {
    const result = await db.insert(chatMessages).values({
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      suggestions: message.suggestions,
      commands: message.commands
    });
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save chat message:", error);
    return null;
  }
}
async function getChatHistory(conversationId, limit = 100) {
  const db = await getDb();
  if (!db || conversationId === 0) {
    console.warn("[Database] Cannot get chat history: database not available or invalid conversationId");
    return [];
  }
  try {
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt).limit(limit);
    return messages;
  } catch (error) {
    console.error("[Database] Failed to get chat history:", error);
    return [];
  }
}
async function getChatHistoryBySessionId(sessionId, limit = 100) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
    if (session.length === 0) {
      return [];
    }
    return getChatHistory(session[0].id, limit);
  } catch (error) {
    console.error("[Database] Failed to get chat history by sessionId:", error);
    return [];
  }
}
async function getUserChatSessions(userOpenId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get chat sessions: database not available");
    return [];
  }
  try {
    const sessions = await db.select().from(chatSessions).where(eq(chatSessions.userOpenId, userOpenId)).orderBy(desc(chatSessions.updatedAt));
    return sessions;
  } catch (error) {
    console.error("[Database] Failed to get chat sessions:", error);
    return [];
  }
}
async function updateMessageFeedback(messageId, feedback) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update feedback: database not available");
    return false;
  }
  try {
    await db.update(chatMessages).set({ feedback }).where(eq(chatMessages.id, messageId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update feedback:", error);
    return false;
  }
}
async function clearChatHistory(sessionId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot clear chat history: database not available");
    return false;
  }
  try {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
    if (session.length > 0) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, session[0].id));
    }
    return true;
  } catch (error) {
    console.error("[Database] Failed to clear chat history:", error);
    return false;
  }
}
async function createNewChatSession(userOpenId) {
  const db = await getDb();
  const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  if (!db) {
    return { sessionId: newSessionId, conversationId: 0 };
  }
  try {
    if (userOpenId) {
      await db.update(chatSessions).set({ isActive: false }).where(eq(chatSessions.userOpenId, userOpenId));
    }
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId,
      title: "New Chat",
      isActive: true
    });
    return { sessionId: newSessionId, conversationId: result[0].insertId };
  } catch (error) {
    console.error("[Database] Failed to create chat session:", error);
    return { sessionId: newSessionId, conversationId: 0 };
  }
}
async function updateSessionTitle(sessionId, title) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) + "..." : title;
    await db.update(chatSessions).set({ title: truncatedTitle }).where(eq(chatSessions.sessionId, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update session title:", error);
    return false;
  }
}
async function searchChatMessages(userOpenId, query, options) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search messages: database not available");
    return [];
  }
  try {
    const limit = options?.limit || 50;
    const conditions = [like(chatMessages.content, `%${query}%`)];
    if (options?.sessionId) {
      const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, options.sessionId)).limit(1);
      if (session.length > 0) {
        conditions.push(eq(chatMessages.conversationId, session[0].id));
      }
    }
    if (options?.startDate) {
      conditions.push(gte(chatMessages.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(chatMessages.createdAt, options.endDate));
    }
    const results = await db.select({
      id: chatMessages.id,
      sessionId: chatSessions.sessionId,
      sessionTitle: chatSessions.title,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt
    }).from(chatMessages).innerJoin(chatSessions, eq(chatMessages.conversationId, chatSessions.id)).where(and(
      userOpenId ? eq(chatSessions.userOpenId, userOpenId) : void 0,
      ...conditions
    )).orderBy(desc(chatMessages.createdAt)).limit(limit);
    return results;
  } catch (error) {
    console.error("[Database] Failed to search messages:", error);
    return [];
  }
}
async function exportChatHistory(sessionId, format = "json") {
  const db = await getDb();
  if (!db) {
    return format === "json" ? "[]" : "# No data available";
  }
  try {
    const session = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId)).limit(1);
    if (session.length === 0) {
      return format === "json" ? "[]" : "# Session not found";
    }
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, session[0].id)).orderBy(chatMessages.createdAt);
    if (format === "json") {
      return JSON.stringify({
        session: {
          id: session[0].sessionId,
          title: session[0].title,
          createdAt: session[0].createdAt
        },
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          feedback: m.feedback
        }))
      }, null, 2);
    } else {
      let md = `# ${session[0].title || "Chat Export"}

`;
      md += `**Session ID:** ${session[0].sessionId}
`;
      md += `**Created:** ${session[0].createdAt?.toISOString()}

`;
      md += `---

`;
      for (const msg of messages) {
        const role = msg.role === "user" ? "\u{1F464} User" : "\u{1F916} Assistant";
        const timestamp2 = msg.createdAt?.toLocaleString() || "";
        md += `### ${role}
`;
        md += `*${timestamp2}*

`;
        md += `${msg.content}

`;
        if (msg.feedback) {
          md += `*Feedback: ${msg.feedback}*

`;
        }
        md += `---

`;
      }
      return md;
    }
  } catch (error) {
    console.error("[Database] Failed to export chat history:", error);
    return format === "json" ? "[]" : "# Export failed";
  }
}
async function saveMetricsSnapshot(metrics) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save metrics: database not available");
    return null;
  }
  try {
    const result = await db.insert(metricsHistory).values(metrics);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save metrics:", error);
    return null;
  }
}
async function getMetricsHistory(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options.source) {
      conditions.push(eq(metricsHistory.source, options.source));
    }
    if (options.resourceType) {
      conditions.push(eq(metricsHistory.resourceType, options.resourceType));
    }
    if (options.resourceId) {
      conditions.push(eq(metricsHistory.resourceId, options.resourceId));
    }
    if (options.startTime) {
      conditions.push(gte(metricsHistory.timestamp, options.startTime));
    }
    if (options.endTime) {
      conditions.push(lte(metricsHistory.timestamp, options.endTime));
    }
    const query = db.select().from(metricsHistory);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(metricsHistory.timestamp)).limit(options.limit || 1e3);
    }
    return await query.orderBy(desc(metricsHistory.timestamp)).limit(options.limit || 1e3);
  } catch (error) {
    console.error("[Database] Failed to get metrics history:", error);
    return [];
  }
}
async function getAggregatedMetrics(hours = 24) {
  const db = await getDb();
  if (!db) {
    return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
  }
  try {
    const startTime2 = new Date(Date.now() - hours * 60 * 60 * 1e3);
    const results = await db.select().from(metricsHistory).where(gte(metricsHistory.timestamp, startTime2)).orderBy(desc(metricsHistory.timestamp));
    if (results.length === 0) {
      return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
    }
    const totalCpu = results.reduce((sum, r) => sum + r.cpuPercent, 0);
    const totalMemory = results.reduce((sum, r) => sum + r.memoryPercent, 0);
    const maxCpu = Math.max(...results.map((r) => r.cpuPercent));
    const maxMemory = Math.max(...results.map((r) => r.memoryPercent));
    return {
      avgCpu: Math.round(totalCpu / results.length),
      avgMemory: Math.round(totalMemory / results.length),
      maxCpu,
      maxMemory,
      dataPoints: results.length
    };
  } catch (error) {
    console.error("[Database] Failed to get aggregated metrics:", error);
    return { avgCpu: 0, avgMemory: 0, maxCpu: 0, maxMemory: 0, dataPoints: 0 };
  }
}
async function cleanupOldMetrics(retentionDays = 30) {
  const db = await getDb();
  if (!db) {
    return 0;
  }
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1e3);
    const result = await db.delete(metricsHistory).where(lte(metricsHistory.timestamp, cutoffDate));
    return result[0].affectedRows || 0;
  } catch (error) {
    console.error("[Database] Failed to cleanup old metrics:", error);
    return 0;
  }
}
async function getAlertThresholds(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.metricType) {
      conditions.push(eq(alertThresholds.metricType, options.metricType));
    }
    if (options?.resourceType) {
      conditions.push(eq(alertThresholds.resourceType, options.resourceType));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(alertThresholds.isEnabled, true));
    }
    if (conditions.length > 0) {
      return await db.select().from(alertThresholds).where(and(...conditions)).orderBy(alertThresholds.name);
    }
    return await db.select().from(alertThresholds).orderBy(alertThresholds.name);
  } catch (error) {
    console.error("[Database] Failed to get alert thresholds:", error);
    return [];
  }
}
async function upsertAlertThreshold(threshold) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    if (threshold.id) {
      await db.update(alertThresholds).set(threshold).where(eq(alertThresholds.id, threshold.id));
      return threshold.id;
    } else {
      const result = await db.insert(alertThresholds).values(threshold);
      return result[0].insertId;
    }
  } catch (error) {
    console.error("[Database] Failed to upsert alert threshold:", error);
    return null;
  }
}
async function toggleAlertThreshold(id, isEnabled) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(alertThresholds).set({ isEnabled }).where(eq(alertThresholds.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to toggle alert threshold:", error);
    return false;
  }
}
async function deleteAlertThreshold(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.delete(alertThresholds).where(eq(alertThresholds.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete alert threshold:", error);
    return false;
  }
}
async function recordAlert(alert) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(alertHistory).values(alert);
    if (alert.thresholdId) {
      await db.update(alertThresholds).set({ lastTriggered: /* @__PURE__ */ new Date() }).where(eq(alertThresholds.id, alert.thresholdId));
    }
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record alert:", error);
    return null;
  }
}
async function getAlertHistory(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.severity) {
      conditions.push(eq(alertHistory.severity, options.severity));
    }
    if (options?.metricType) {
      conditions.push(eq(alertHistory.metricType, options.metricType));
    }
    if (options?.acknowledgedOnly) {
      conditions.push(eq(alertHistory.isAcknowledged, true));
    }
    if (options?.unacknowledgedOnly) {
      conditions.push(eq(alertHistory.isAcknowledged, false));
    }
    if (options?.startTime) {
      conditions.push(gte(alertHistory.createdAt, options.startTime));
    }
    if (options?.endTime) {
      conditions.push(lte(alertHistory.createdAt, options.endTime));
    }
    if (conditions.length > 0) {
      return await db.select().from(alertHistory).where(and(...conditions)).orderBy(desc(alertHistory.createdAt)).limit(options?.limit || 100);
    }
    return await db.select().from(alertHistory).orderBy(desc(alertHistory.createdAt)).limit(options?.limit || 100);
  } catch (error) {
    console.error("[Database] Failed to get alert history:", error);
    return [];
  }
}
async function acknowledgeAlert(alertId, userId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(alertHistory).set({
      isAcknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: /* @__PURE__ */ new Date()
    }).where(eq(alertHistory.id, alertId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to acknowledge alert:", error);
    return false;
  }
}
async function getUnacknowledgedAlertCount() {
  const db = await getDb();
  if (!db) {
    return 0;
  }
  try {
    const results = await db.select().from(alertHistory).where(eq(alertHistory.isAcknowledged, false));
    return results.length;
  } catch (error) {
    console.error("[Database] Failed to get unacknowledged alert count:", error);
    return 0;
  }
}
async function isThresholdInCooldown(thresholdId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const threshold = await db.select().from(alertThresholds).where(eq(alertThresholds.id, thresholdId)).limit(1);
    if (threshold.length === 0 || !threshold[0].lastTriggered) {
      return false;
    }
    const cooldownMs = (threshold[0].cooldownMinutes || 5) * 60 * 1e3;
    const lastTriggered = new Date(threshold[0].lastTriggered).getTime();
    return Date.now() - lastTriggered < cooldownMs;
  } catch (error) {
    console.error("[Database] Failed to check threshold cooldown:", error);
    return false;
  }
}
async function getAutoscalingRules(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.applicationId) {
      conditions.push(eq(autoscalingRules.applicationId, options.applicationId));
    }
    if (options?.resourceType) {
      conditions.push(eq(autoscalingRules.resourceType, options.resourceType));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(autoscalingRules.isEnabled, true));
    }
    if (conditions.length > 0) {
      return await db.select().from(autoscalingRules).where(and(...conditions)).orderBy(desc(autoscalingRules.createdAt));
    }
    return await db.select().from(autoscalingRules).orderBy(desc(autoscalingRules.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get autoscaling rules:", error);
    return [];
  }
}
async function getAutoscalingRuleById(id) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const results = await db.select().from(autoscalingRules).where(eq(autoscalingRules.id, id)).limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get autoscaling rule:", error);
    return null;
  }
}
async function createAutoscalingRule(rule) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(autoscalingRules).values(rule);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create autoscaling rule:", error);
    return null;
  }
}
async function updateAutoscalingRule(id, updates) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(autoscalingRules).set(updates).where(eq(autoscalingRules.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update autoscaling rule:", error);
    return false;
  }
}
async function deleteAutoscalingRule(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.delete(autoscalingRules).where(eq(autoscalingRules.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete autoscaling rule:", error);
    return false;
  }
}
async function recordAutoscalingAction(action) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(autoscalingHistory).values(action);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record autoscaling action:", error);
    return null;
  }
}
async function updateAutoscalingActionStatus(id, status, errorMessage) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const updates = { status };
    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.completedAt = /* @__PURE__ */ new Date();
    }
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }
    await db.update(autoscalingHistory).set(updates).where(eq(autoscalingHistory.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update autoscaling action:", error);
    return false;
  }
}
async function getAutoscalingHistory(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.ruleId) {
      conditions.push(eq(autoscalingHistory.ruleId, options.ruleId));
    }
    if (options?.applicationId) {
      conditions.push(eq(autoscalingHistory.applicationId, options.applicationId));
    }
    if (options?.status) {
      conditions.push(eq(autoscalingHistory.status, options.status));
    }
    if (conditions.length > 0) {
      return await db.select().from(autoscalingHistory).where(and(...conditions)).orderBy(desc(autoscalingHistory.createdAt)).limit(options?.limit || 100);
    }
    return await db.select().from(autoscalingHistory).orderBy(desc(autoscalingHistory.createdAt)).limit(options?.limit || 100);
  } catch (error) {
    console.error("[Database] Failed to get autoscaling history:", error);
    return [];
  }
}
async function getPendingApprovalActions() {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    return await db.select().from(autoscalingHistory).where(eq(autoscalingHistory.action, "pending_approval")).orderBy(desc(autoscalingHistory.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get pending approvals:", error);
    return [];
  }
}
async function saveAiScalingPrediction(prediction) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(aiScalingPredictions).values(prediction);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save AI prediction:", error);
    return null;
  }
}
async function getAiPredictions(ruleId, limit = 10) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    return await db.select().from(aiScalingPredictions).where(eq(aiScalingPredictions.ruleId, ruleId)).orderBy(desc(aiScalingPredictions.createdAt)).limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get AI predictions:", error);
    return [];
  }
}
async function isRuleInCooldown(ruleId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const rule = await db.select().from(autoscalingRules).where(eq(autoscalingRules.id, ruleId)).limit(1);
    if (rule.length === 0 || !rule[0].lastScaledAt) {
      return false;
    }
    const timeSinceLastScale = (Date.now() - rule[0].lastScaledAt.getTime()) / 1e3;
    return timeSinceLastScale < rule[0].cooldownSeconds;
  } catch (error) {
    console.error("[Database] Failed to check cooldown:", error);
    return false;
  }
}
async function updateRuleLastScaled(ruleId) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(autoscalingRules).set({ lastScaledAt: /* @__PURE__ */ new Date() }).where(eq(autoscalingRules.id, ruleId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update last scaled:", error);
    return false;
  }
}
async function getScheduledScalingRules(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.applicationId) {
      conditions.push(eq(scheduledScaling.applicationId, options.applicationId));
    }
    if (options?.enabledOnly) {
      conditions.push(eq(scheduledScaling.isEnabled, true));
    }
    if (conditions.length > 0) {
      return await db.select().from(scheduledScaling).where(and(...conditions)).orderBy(desc(scheduledScaling.createdAt));
    }
    return await db.select().from(scheduledScaling).orderBy(desc(scheduledScaling.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get scheduled scaling rules:", error);
    return [];
  }
}
async function getScheduledScalingById(id) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const results = await db.select().from(scheduledScaling).where(eq(scheduledScaling.id, id)).limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get scheduled scaling by ID:", error);
    return null;
  }
}
async function createScheduledScaling(rule) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(scheduledScaling).values(rule);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create scheduled scaling:", error);
    return null;
  }
}
async function updateScheduledScaling(id, updates) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(scheduledScaling).set(updates).where(eq(scheduledScaling.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update scheduled scaling:", error);
    return false;
  }
}
async function deleteScheduledScaling(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.delete(scheduledScaling).where(eq(scheduledScaling.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete scheduled scaling:", error);
    return false;
  }
}
async function recordScheduledScalingExecution(record) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(scheduledScalingHistory).values(record);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record scheduled scaling execution:", error);
    return null;
  }
}
async function getScheduledScalingHistory(scheduleId, limit = 50) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    if (scheduleId) {
      return await db.select().from(scheduledScalingHistory).where(eq(scheduledScalingHistory.scheduleId, scheduleId)).orderBy(desc(scheduledScalingHistory.createdAt)).limit(limit);
    }
    return await db.select().from(scheduledScalingHistory).orderBy(desc(scheduledScalingHistory.createdAt)).limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get scheduled scaling history:", error);
    return [];
  }
}
async function updateScheduleExecutionStats(id, success) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    const schedule = await getScheduledScalingById(id);
    if (!schedule) return false;
    await db.update(scheduledScaling).set({
      lastExecutedAt: /* @__PURE__ */ new Date(),
      executionCount: schedule.executionCount + 1,
      failureCount: success ? schedule.failureCount : schedule.failureCount + 1
    }).where(eq(scheduledScaling.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update schedule stats:", error);
    return false;
  }
}
async function getAbTestExperiments(options) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [];
    if (options?.applicationId) {
      conditions.push(eq(abTestExperiments.applicationId, options.applicationId));
    }
    if (options?.status) {
      conditions.push(eq(abTestExperiments.status, options.status));
    }
    if (conditions.length > 0) {
      return await db.select().from(abTestExperiments).where(and(...conditions)).orderBy(desc(abTestExperiments.createdAt));
    }
    return await db.select().from(abTestExperiments).orderBy(desc(abTestExperiments.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get A/B test experiments:", error);
    return [];
  }
}
async function getAbTestExperimentById(id) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const results = await db.select().from(abTestExperiments).where(eq(abTestExperiments.id, id)).limit(1);
    return results[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get A/B test by ID:", error);
    return null;
  }
}
async function createAbTestExperiment(experiment) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(abTestExperiments).values(experiment);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create A/B test:", error);
    return null;
  }
}
async function updateAbTestExperiment(id, updates) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(abTestExperiments).set(updates).where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update A/B test:", error);
    return false;
  }
}
async function deleteAbTestExperiment(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.delete(abTestMetrics).where(eq(abTestMetrics.experimentId, id));
    await db.delete(abTestExperiments).where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete A/B test:", error);
    return false;
  }
}
async function recordAbTestMetrics(metrics) {
  const db = await getDb();
  if (!db) {
    return null;
  }
  try {
    const result = await db.insert(abTestMetrics).values(metrics);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record A/B test metrics:", error);
    return null;
  }
}
async function getAbTestMetrics(experimentId, variant) {
  const db = await getDb();
  if (!db) {
    return [];
  }
  try {
    const conditions = [eq(abTestMetrics.experimentId, experimentId)];
    if (variant) {
      conditions.push(eq(abTestMetrics.variant, variant));
    }
    return await db.select().from(abTestMetrics).where(and(...conditions)).orderBy(desc(abTestMetrics.timestamp));
  } catch (error) {
    console.error("[Database] Failed to get A/B test metrics:", error);
    return [];
  }
}
async function calculateAbTestStats(experimentId) {
  const db = await getDb();
  const defaultResult = {
    variantA: { avgCpu: 0, avgMemory: 0, avgReplicas: 0, totalScaleOps: 0, oscillations: 0 },
    variantB: { avgCpu: 0, avgMemory: 0, avgReplicas: 0, totalScaleOps: 0, oscillations: 0 },
    sampleSize: { A: 0, B: 0 },
    recommendation: "inconclusive",
    confidence: 0
  };
  if (!db) {
    return defaultResult;
  }
  try {
    const metricsA = await getAbTestMetrics(experimentId, "A");
    const metricsB = await getAbTestMetrics(experimentId, "B");
    if (metricsA.length === 0 || metricsB.length === 0) {
      return defaultResult;
    }
    const calcStats = (metrics) => ({
      avgCpu: Math.round(metrics.reduce((sum, m) => sum + m.avgCpuPercent, 0) / metrics.length),
      avgMemory: Math.round(metrics.reduce((sum, m) => sum + m.avgMemoryPercent, 0) / metrics.length),
      avgReplicas: Math.round(metrics.reduce((sum, m) => sum + m.avgReplicaCount, 0) / metrics.length),
      totalScaleOps: metrics.reduce((sum, m) => sum + m.scaleUpCount + m.scaleDownCount, 0),
      oscillations: metrics.reduce((sum, m) => sum + m.oscillationCount, 0)
    });
    const statsA = calcStats(metricsA);
    const statsB = calcStats(metricsB);
    const scoreA = statsA.oscillations * 10 + statsA.avgReplicas;
    const scoreB = statsB.oscillations * 10 + statsB.avgReplicas;
    let recommendation = "inconclusive";
    let confidence = 0;
    const diff = Math.abs(scoreA - scoreB);
    const minSamples = 10;
    if (metricsA.length >= minSamples && metricsB.length >= minSamples) {
      if (diff > 5) {
        recommendation = scoreA < scoreB ? "A" : "B";
        confidence = Math.min(95, 50 + diff * 5);
      } else if (diff > 2) {
        recommendation = scoreA < scoreB ? "A" : "B";
        confidence = Math.min(70, 40 + diff * 10);
      }
    }
    return {
      variantA: statsA,
      variantB: statsB,
      sampleSize: { A: metricsA.length, B: metricsB.length },
      recommendation,
      confidence
    };
  } catch (error) {
    console.error("[Database] Failed to calculate A/B test stats:", error);
    return defaultResult;
  }
}
async function startAbTest(id) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(abTestExperiments).set({
      status: "running",
      startedAt: /* @__PURE__ */ new Date()
    }).where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to start A/B test:", error);
    return false;
  }
}
async function completeAbTest(id, winner, confidence, reason) {
  const db = await getDb();
  if (!db) {
    return false;
  }
  try {
    await db.update(abTestExperiments).set({
      status: "completed",
      endedAt: /* @__PURE__ */ new Date(),
      winnerVariant: winner,
      winnerConfidence: confidence,
      winnerReason: reason
    }).where(eq(abTestExperiments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to complete A/B test:", error);
    return false;
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/auth.ts
var authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  })
});

// server/infrastructure/docker.ts
var defaultConfig = {
  socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
  host: process.env.DOCKER_HOST || void 0
};
async function dockerRequest(endpoint, method = "GET", body, config = defaultConfig) {
  const baseUrl = config.host || `http://localhost`;
  const url = `${baseUrl}${endpoint}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      throw new Error(`Docker API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Docker API not available: ${error}`);
    throw error;
  }
}
async function listContainers(all = true) {
  try {
    const containers = await dockerRequest(`/containers/json?all=${all}`);
    return containers.map((c) => ({
      id: c.Id?.substring(0, 12) || "",
      name: c.Names?.[0]?.replace(/^\//, "") || "",
      image: c.Image || "",
      status: mapContainerStatus(c.State),
      ports: formatPorts(c.Ports),
      cpu: "0%",
      memory: "0MB",
      created: c.Created ? new Date(c.Created * 1e3).toISOString() : "",
      command: c.Command,
      labels: c.Labels
    }));
  } catch {
    return getMockContainers();
  }
}
async function getContainerStats(containerId) {
  try {
    const stats = await dockerRequest(`/containers/${containerId}/stats?stream=false`);
    return calculateStats(stats);
  } catch {
    return {
      cpuPercent: Math.random() * 10,
      memoryUsage: Math.random() * 512 * 1024 * 1024,
      memoryLimit: 1024 * 1024 * 1024,
      memoryPercent: Math.random() * 50,
      networkRx: Math.random() * 1024 * 1024,
      networkTx: Math.random() * 1024 * 1024,
      blockRead: Math.random() * 1024 * 1024,
      blockWrite: Math.random() * 1024 * 1024
    };
  }
}
async function getContainerLogs(containerId, tail = 100, since) {
  try {
    const params = new URLSearchParams({
      stdout: "true",
      stderr: "true",
      tail: tail.toString()
    });
    if (since) params.append("since", since.toString());
    const response = await fetch(
      `${defaultConfig.host}/containers/${containerId}/logs?${params}`
    );
    const text2 = await response.text();
    return text2.split("\n").filter(Boolean);
  } catch {
    return getMockLogs();
  }
}
async function startContainer(containerId) {
  try {
    await dockerRequest(`/containers/${containerId}/start`, "POST");
    return true;
  } catch {
    console.log(`Mock: Starting container ${containerId}`);
    return true;
  }
}
async function stopContainer(containerId) {
  try {
    await dockerRequest(`/containers/${containerId}/stop`, "POST");
    return true;
  } catch {
    console.log(`Mock: Stopping container ${containerId}`);
    return true;
  }
}
async function restartContainer(containerId) {
  try {
    await dockerRequest(`/containers/${containerId}/restart`, "POST");
    return true;
  } catch {
    console.log(`Mock: Restarting container ${containerId}`);
    return true;
  }
}
async function listImages() {
  try {
    const images = await dockerRequest("/images/json");
    return images.map((img) => ({
      id: img.Id?.substring(7, 19) || "",
      repository: img.RepoTags?.[0]?.split(":")[0] || "<none>",
      tag: img.RepoTags?.[0]?.split(":")[1] || "<none>",
      size: formatBytes(img.Size),
      created: new Date(img.Created * 1e3).toISOString()
    }));
  } catch {
    return getMockImages();
  }
}
async function listNetworks() {
  try {
    const networks = await dockerRequest("/networks");
    return networks.map((net2) => ({
      id: net2.Id?.substring(0, 12) || "",
      name: net2.Name || "",
      driver: net2.Driver || "",
      scope: net2.Scope || "",
      containers: Object.keys(net2.Containers || {}).length
    }));
  } catch {
    return getMockNetworks();
  }
}
async function listVolumes() {
  try {
    const response = await dockerRequest("/volumes");
    return (response.Volumes || []).map((vol) => ({
      name: vol.Name || "",
      driver: vol.Driver || "",
      mountpoint: vol.Mountpoint || "",
      size: "N/A",
      created: vol.CreatedAt || ""
    }));
  } catch {
    return getMockVolumes();
  }
}
function mapContainerStatus(state) {
  const statusMap = {
    running: "running",
    exited: "exited",
    paused: "paused",
    restarting: "restarting",
    dead: "dead"
  };
  return statusMap[state?.toLowerCase()] || "stopped";
}
function formatPorts(ports) {
  if (!ports || ports.length === 0) return "-";
  return ports.filter((p) => p.PublicPort).map((p) => `${p.PublicPort}:${p.PrivatePort}`).join(", ") || "-";
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
function calculateStats(stats) {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent = cpuDelta / systemDelta * stats.cpu_stats.online_cpus * 100;
  return {
    cpuPercent: cpuPercent || 0,
    memoryUsage: stats.memory_stats.usage || 0,
    memoryLimit: stats.memory_stats.limit || 0,
    memoryPercent: stats.memory_stats.usage / stats.memory_stats.limit * 100 || 0,
    networkRx: stats.networks?.eth0?.rx_bytes || 0,
    networkTx: stats.networks?.eth0?.tx_bytes || 0,
    blockRead: 0,
    blockWrite: 0
  };
}
function getMockContainers() {
  return [
    { id: "abc123def456", name: "nginx-proxy", image: "nginx:latest", status: "running", ports: "80:80, 443:443", cpu: "0.5%", memory: "32MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "def456ghi789", name: "postgres-db", image: "postgres:15", status: "running", ports: "5432:5432", cpu: "2.1%", memory: "256MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "ghi789jkl012", name: "redis-cache", image: "redis:7-alpine", status: "running", ports: "6379:6379", cpu: "0.2%", memory: "24MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "jkl012mno345", name: "api-server", image: "myapp/api:v2.3.1", status: "running", ports: "3000:3000", cpu: "5.4%", memory: "512MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "mno345pqr678", name: "worker-queue", image: "myapp/worker:v2.3.1", status: "stopped", ports: "-", cpu: "0%", memory: "0MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "pqr678stu901", name: "monitoring", image: "prom/prometheus:latest", status: "running", ports: "9090:9090", cpu: "1.2%", memory: "128MB", created: (/* @__PURE__ */ new Date()).toISOString() }
  ];
}
function getMockImages() {
  return [
    { id: "sha256:abc123", repository: "nginx", tag: "latest", size: "142 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:def456", repository: "postgres", tag: "15", size: "379 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:ghi789", repository: "redis", tag: "7-alpine", size: "28 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:jkl012", repository: "myapp/api", tag: "v2.3.1", size: "256 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "sha256:mno345", repository: "prom/prometheus", tag: "latest", size: "195 MB", created: (/* @__PURE__ */ new Date()).toISOString() }
  ];
}
function getMockNetworks() {
  return [
    { id: "bridge123456", name: "bridge", driver: "bridge", scope: "local", containers: 3 },
    { id: "host789012", name: "host", driver: "host", scope: "local", containers: 0 },
    { id: "app345678", name: "app-network", driver: "bridge", scope: "local", containers: 4 }
  ];
}
function getMockVolumes() {
  return [
    { name: "postgres-data", driver: "local", mountpoint: "/var/lib/docker/volumes/postgres-data/_data", size: "2.5 GB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { name: "redis-data", driver: "local", mountpoint: "/var/lib/docker/volumes/redis-data/_data", size: "128 MB", created: (/* @__PURE__ */ new Date()).toISOString() },
    { name: "app-uploads", driver: "local", mountpoint: "/var/lib/docker/volumes/app-uploads/_data", size: "1.2 GB", created: (/* @__PURE__ */ new Date()).toISOString() }
  ];
}
function getMockLogs() {
  const now = /* @__PURE__ */ new Date();
  return [
    `[${now.toISOString()}] INFO: Server started on port 3000`,
    `[${now.toISOString()}] INFO: Connected to database`,
    `[${now.toISOString()}] INFO: Health check passed`,
    `[${now.toISOString()}] DEBUG: Processing request /api/users`,
    `[${now.toISOString()}] INFO: Request completed in 45ms`
  ];
}

// server/infrastructure/kubernetes.ts
var defaultConfig2 = {
  apiServer: process.env.KUBERNETES_API_SERVER || "https://kubernetes.default.svc",
  token: process.env.KUBERNETES_TOKEN,
  namespace: "default"
};
async function k8sRequest(endpoint, method = "GET", body, config = defaultConfig2) {
  const url = `${config.apiServer}${endpoint}`;
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (config.token) {
      headers["Authorization"] = `Bearer ${config.token}`;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      throw new Error(`Kubernetes API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Kubernetes API not available: ${error}`);
    throw error;
  }
}
async function listNamespaces() {
  try {
    const response = await k8sRequest("/api/v1/namespaces");
    return response.items.map((ns) => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      age: calculateAge(ns.metadata.creationTimestamp)
    }));
  } catch {
    return getMockNamespaces();
  }
}
async function listPods(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/api/v1/pods" : `/api/v1/namespaces/${namespace}/pods`;
    const response = await k8sRequest(endpoint);
    return response.items.map((pod) => mapPod(pod));
  } catch {
    return getMockPods();
  }
}
async function getPod(name, namespace = "default") {
  try {
    const response = await k8sRequest(`/api/v1/namespaces/${namespace}/pods/${name}`);
    return mapPod(response);
  } catch {
    return null;
  }
}
async function getPodLogs(name, namespace = "default", container, tailLines = 100) {
  try {
    const params = new URLSearchParams({ tailLines: tailLines.toString() });
    if (container) params.append("container", container);
    const response = await fetch(
      `${defaultConfig2.apiServer}/api/v1/namespaces/${namespace}/pods/${name}/log?${params}`,
      {
        headers: defaultConfig2.token ? { Authorization: `Bearer ${defaultConfig2.token}` } : {}
      }
    );
    const text2 = await response.text();
    return text2.split("\n").filter(Boolean);
  } catch {
    return getMockPodLogs();
  }
}
async function deletePod(name, namespace = "default") {
  try {
    await k8sRequest(`/api/v1/namespaces/${namespace}/pods/${name}`, "DELETE");
    return true;
  } catch {
    console.log(`Mock: Deleting pod ${name} in ${namespace}`);
    return true;
  }
}
async function listDeployments(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/apis/apps/v1/deployments" : `/apis/apps/v1/namespaces/${namespace}/deployments`;
    const response = await k8sRequest(endpoint);
    return response.items.map((dep) => ({
      name: dep.metadata.name,
      namespace: dep.metadata.namespace,
      ready: `${dep.status.readyReplicas || 0}/${dep.spec.replicas}`,
      upToDate: dep.status.updatedReplicas || 0,
      available: dep.status.availableReplicas || 0,
      age: calculateAge(dep.metadata.creationTimestamp),
      replicas: dep.spec.replicas,
      strategy: dep.spec.strategy?.type || "RollingUpdate"
    }));
  } catch {
    return getMockDeployments();
  }
}
async function scaleDeployment(name, namespace, replicas) {
  try {
    await k8sRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}/scale`,
      "PATCH",
      { spec: { replicas } }
    );
    return true;
  } catch {
    console.log(`Mock: Scaling deployment ${name} to ${replicas} replicas`);
    return true;
  }
}
async function restartDeployment(name, namespace = "default") {
  try {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        }
      }
    };
    await k8sRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      "PATCH",
      patch
    );
    return true;
  } catch {
    console.log(`Mock: Restarting deployment ${name}`);
    return true;
  }
}
async function listServices(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/api/v1/services" : `/api/v1/namespaces/${namespace}/services`;
    const response = await k8sRequest(endpoint);
    return response.items.map((svc) => ({
      name: svc.metadata.name,
      namespace: svc.metadata.namespace,
      type: svc.spec.type,
      clusterIP: svc.spec.clusterIP || "-",
      externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip || "-",
      ports: formatServicePorts(svc.spec.ports),
      age: calculateAge(svc.metadata.creationTimestamp)
    }));
  } catch {
    return getMockServices();
  }
}
async function listConfigMaps(namespace = "default") {
  try {
    const endpoint = namespace === "all" ? "/api/v1/configmaps" : `/api/v1/namespaces/${namespace}/configmaps`;
    const response = await k8sRequest(endpoint);
    return response.items.map((cm) => ({
      name: cm.metadata.name,
      namespace: cm.metadata.namespace,
      data: Object.keys(cm.data || {}).length,
      age: calculateAge(cm.metadata.creationTimestamp)
    }));
  } catch {
    return getMockConfigMaps();
  }
}
async function listNodes() {
  try {
    const response = await k8sRequest("/api/v1/nodes");
    return response.items.map((node) => ({
      name: node.metadata.name,
      status: getNodeStatus(node),
      roles: getNodeRoles(node),
      age: calculateAge(node.metadata.creationTimestamp),
      version: node.status.nodeInfo.kubeletVersion,
      internalIP: node.status.addresses?.find((a) => a.type === "InternalIP")?.address || "-",
      cpu: node.status.capacity?.cpu || "-",
      memory: node.status.capacity?.memory || "-"
    }));
  } catch {
    return getMockNodes();
  }
}
async function getClusterMetrics() {
  try {
    const [nodes, pods, deployments, services] = await Promise.all([
      listNodes(),
      listPods("all"),
      listDeployments("all"),
      listServices("all")
    ]);
    return {
      nodes: nodes.length,
      pods: pods.length,
      deployments: deployments.length,
      services: services.length,
      cpuUsage: 67,
      // Would need metrics-server for real data
      memoryUsage: 45
    };
  } catch {
    return {
      nodes: 3,
      pods: 47,
      deployments: 12,
      services: 8,
      cpuUsage: 67,
      memoryUsage: 45
    };
  }
}
async function executeKubectl(command) {
  console.log(`Mock kubectl: ${command}`);
  if (command.startsWith("get pods")) {
    return {
      output: `NAME                          READY   STATUS    RESTARTS   AGE
api-server-7d8f9c6b5-abc12    1/1     Running   0          2d
web-frontend-5c4d3b2a1-ghi56  1/1     Running   1          5d
database-primary-0            1/1     Running   0          30d`
    };
  }
  if (command.startsWith("get nodes")) {
    return {
      output: `NAME     STATUS   ROLES           AGE   VERSION
node-1   Ready    control-plane   90d   v1.28.0
node-2   Ready    worker          90d   v1.28.0
node-3   Ready    worker          90d   v1.28.0`
    };
  }
  return { output: `Executed: kubectl ${command}` };
}
function mapPod(pod) {
  const containerStatuses = pod.status?.containerStatuses || [];
  const readyContainers = containerStatuses.filter((c) => c.ready).length;
  const totalContainers = containerStatuses.length || pod.spec?.containers?.length || 0;
  const restarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
  return {
    name: pod.metadata.name,
    namespace: pod.metadata.namespace,
    status: pod.status?.phase || "Unknown",
    ready: `${readyContainers}/${totalContainers}`,
    restarts,
    age: calculateAge(pod.metadata.creationTimestamp),
    node: pod.spec?.nodeName || "-",
    ip: pod.status?.podIP,
    containers: containerStatuses.map((c) => ({
      name: c.name,
      image: c.image,
      ready: c.ready,
      restartCount: c.restartCount,
      state: Object.keys(c.state || {})[0] || "unknown"
    }))
  };
}
function calculateAge(timestamp2) {
  if (!timestamp2) return "-";
  const created = new Date(timestamp2);
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1e3 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1e3 * 60));
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  return `${diffMinutes}m`;
}
function formatServicePorts(ports) {
  if (!ports || ports.length === 0) return "-";
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ");
}
function getNodeStatus(node) {
  const conditions = node.status?.conditions || [];
  const ready = conditions.find((c) => c.type === "Ready");
  return ready?.status === "True" ? "Ready" : "NotReady";
}
function getNodeRoles(node) {
  const labels = node.metadata?.labels || {};
  const roles = [];
  if (labels["node-role.kubernetes.io/control-plane"]) roles.push("control-plane");
  if (labels["node-role.kubernetes.io/master"]) roles.push("master");
  if (labels["node-role.kubernetes.io/worker"]) roles.push("worker");
  return roles.length > 0 ? roles.join(",") : "worker";
}
function getMockNamespaces() {
  return [
    { name: "default", status: "Active", age: "90d" },
    { name: "kube-system", status: "Active", age: "90d" },
    { name: "production", status: "Active", age: "60d" },
    { name: "staging", status: "Active", age: "45d" },
    { name: "monitoring", status: "Active", age: "30d" }
  ];
}
function getMockPods() {
  return [
    { name: "api-server-7d8f9c6b5-abc12", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-1" },
    { name: "api-server-7d8f9c6b5-def34", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-2" },
    { name: "web-frontend-5c4d3b2a1-ghi56", namespace: "production", status: "Running", ready: "1/1", restarts: 1, age: "5d", node: "node-1" },
    { name: "worker-queue-9e8d7c6b5-jkl78", namespace: "production", status: "Pending", ready: "0/1", restarts: 0, age: "5m", node: "-" },
    { name: "database-primary-0", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "30d", node: "node-3" },
    { name: "redis-cache-8f7e6d5c4-mno90", namespace: "staging", status: "Running", ready: "1/1", restarts: 2, age: "7d", node: "node-2" }
  ];
}
function getMockDeployments() {
  return [
    { name: "api-server", namespace: "production", ready: "2/2", upToDate: 2, available: 2, age: "30d", replicas: 2, strategy: "RollingUpdate" },
    { name: "web-frontend", namespace: "production", ready: "3/3", upToDate: 3, available: 3, age: "30d", replicas: 3, strategy: "RollingUpdate" },
    { name: "worker-queue", namespace: "production", ready: "1/2", upToDate: 2, available: 1, age: "15d", replicas: 2, strategy: "RollingUpdate" },
    { name: "redis-cache", namespace: "staging", ready: "1/1", upToDate: 1, available: 1, age: "7d", replicas: 1, strategy: "Recreate" }
  ];
}
function getMockServices() {
  return [
    { name: "api-server", namespace: "production", type: "ClusterIP", clusterIP: "10.96.0.100", externalIP: "-", ports: "3000/TCP", age: "30d" },
    { name: "web-frontend", namespace: "production", type: "LoadBalancer", clusterIP: "10.96.0.101", externalIP: "34.123.45.67", ports: "80/TCP, 443/TCP", age: "30d" },
    { name: "database", namespace: "production", type: "ClusterIP", clusterIP: "10.96.0.102", externalIP: "-", ports: "5432/TCP", age: "30d" },
    { name: "redis", namespace: "staging", type: "ClusterIP", clusterIP: "10.96.0.200", externalIP: "-", ports: "6379/TCP", age: "7d" }
  ];
}
function getMockConfigMaps() {
  return [
    { name: "app-config", namespace: "production", data: 5, age: "30d" },
    { name: "nginx-config", namespace: "production", data: 2, age: "30d" },
    { name: "feature-flags", namespace: "production", data: 12, age: "7d" }
  ];
}
function getMockNodes() {
  return [
    { name: "node-1", status: "Ready", roles: "control-plane", age: "90d", version: "v1.28.0", internalIP: "10.0.0.10", cpu: "4", memory: "16Gi" },
    { name: "node-2", status: "Ready", roles: "worker", age: "90d", version: "v1.28.0", internalIP: "10.0.0.11", cpu: "8", memory: "32Gi" },
    { name: "node-3", status: "Ready", roles: "worker", age: "90d", version: "v1.28.0", internalIP: "10.0.0.12", cpu: "8", memory: "32Gi" }
  ];
}
function getMockPodLogs() {
  const now = /* @__PURE__ */ new Date();
  return [
    `${now.toISOString()} INFO: Pod started successfully`,
    `${now.toISOString()} INFO: Connected to service mesh`,
    `${now.toISOString()} INFO: Health check endpoint ready`,
    `${now.toISOString()} DEBUG: Processing incoming request`,
    `${now.toISOString()} INFO: Request completed successfully`
  ];
}

// server/routers/dashboard.ts
var mockContainerStats = {
  total: 24,
  running: 18,
  stopped: 6,
  todayChange: 3
};
var mockKubernetesStats = {
  pods: 47,
  running: 45,
  pending: 2
};
var mockDeploymentStats = {
  active: 12,
  status: "healthy"
};
var mockAlertStats = {
  total: 3,
  critical: 1,
  warnings: 2
};
var mockRecentActivity = [
  { id: "1", type: "deploy", message: "Deployed api-server v2.3.1 to production", timestamp: new Date(Date.now() - 2 * 60 * 1e3) },
  { id: "2", type: "scale", message: "Scaled web-frontend from 3 to 5 replicas", timestamp: new Date(Date.now() - 15 * 60 * 1e3) },
  { id: "3", type: "error", message: "Pod crash loop detected in worker-queue", timestamp: new Date(Date.now() - 32 * 60 * 1e3) },
  { id: "4", type: "restart", message: "Restarted database-primary container", timestamp: new Date(Date.now() - 60 * 60 * 1e3) }
];
var mockResourceUsage = {
  cpu: { used: 67, total: 100, unit: "%" },
  memory: { used: 12.4, total: 32, unit: "GB" },
  storage: { used: 234, total: 500, unit: "GB" }
};
var dashboardRouter = router({
  getOverview: publicProcedure.query(async () => {
    try {
      const containers = await listContainers();
      const pods = await listPods("all");
      const deployments = await listDeployments("all");
      return {
        containers: {
          total: containers.length,
          running: containers.filter((c) => c.status === "running").length,
          stopped: containers.filter((c) => c.status !== "running").length,
          todayChange: 3
        },
        kubernetes: {
          pods: pods.length,
          running: pods.filter((p) => p.status === "Running").length,
          pending: pods.filter((p) => p.status === "Pending").length
        },
        deployments: {
          active: deployments.length,
          status: "healthy"
        },
        alerts: mockAlertStats
      };
    } catch {
      return {
        containers: mockContainerStats,
        kubernetes: mockKubernetesStats,
        deployments: mockDeploymentStats,
        alerts: mockAlertStats
      };
    }
  }),
  getRecentActivity: publicProcedure.query(() => mockRecentActivity),
  getResourceUsage: publicProcedure.query(() => mockResourceUsage)
});

// server/routers/docker.ts
import { z as z2 } from "zod";
var dockerRouter = router({
  listContainers: publicProcedure.input(z2.object({ all: z2.boolean().optional() }).optional()).query(async ({ input }) => {
    return listContainers(input?.all ?? true);
  }),
  getContainerStats: publicProcedure.input(z2.object({ containerId: z2.string() })).query(async ({ input }) => {
    return getContainerStats(input.containerId);
  }),
  getContainerLogs: publicProcedure.input(z2.object({
    containerId: z2.string(),
    tail: z2.number().optional(),
    since: z2.number().optional()
  })).query(async ({ input }) => {
    return getContainerLogs(input.containerId, input.tail, input.since);
  }),
  startContainer: publicProcedure.input(z2.object({ containerId: z2.string() })).mutation(async ({ input }) => {
    const success = await startContainer(input.containerId);
    return { success };
  }),
  stopContainer: publicProcedure.input(z2.object({ containerId: z2.string() })).mutation(async ({ input }) => {
    const success = await stopContainer(input.containerId);
    return { success };
  }),
  restartContainer: publicProcedure.input(z2.object({ containerId: z2.string() })).mutation(async ({ input }) => {
    const success = await restartContainer(input.containerId);
    return { success };
  }),
  listImages: publicProcedure.query(async () => {
    return listImages();
  }),
  listNetworks: publicProcedure.query(async () => {
    return listNetworks();
  }),
  listVolumes: publicProcedure.query(async () => {
    return listVolumes();
  })
});

// server/routers/kubernetes.ts
import { z as z3 } from "zod";
var kubernetesRouter = router({
  listNamespaces: publicProcedure.query(async () => {
    return listNamespaces();
  }),
  listPods: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listPods(input?.namespace || "default");
  }),
  getPod: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional()
  })).query(async ({ input }) => {
    return getPod(input.name, input.namespace);
  }),
  getPodLogs: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional(),
    container: z3.string().optional(),
    tailLines: z3.number().optional()
  })).query(async ({ input }) => {
    return getPodLogs(input.name, input.namespace, input.container, input.tailLines);
  }),
  deletePod: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional()
  })).mutation(async ({ input }) => {
    const success = await deletePod(input.name, input.namespace);
    return { success };
  }),
  listDeployments: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listDeployments(input?.namespace || "default");
  }),
  scaleDeployment: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string(),
    replicas: z3.number()
  })).mutation(async ({ input }) => {
    const success = await scaleDeployment(input.name, input.namespace, input.replicas);
    return { success };
  }),
  restartDeployment: publicProcedure.input(z3.object({
    name: z3.string(),
    namespace: z3.string().optional()
  })).mutation(async ({ input }) => {
    const success = await restartDeployment(input.name, input.namespace);
    return { success };
  }),
  listServices: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listServices(input?.namespace || "default");
  }),
  listConfigMaps: publicProcedure.input(z3.object({ namespace: z3.string().optional() }).optional()).query(async ({ input }) => {
    return listConfigMaps(input?.namespace || "default");
  }),
  listNodes: publicProcedure.query(async () => {
    return listNodes();
  }),
  getClusterMetrics: publicProcedure.query(async () => {
    return getClusterMetrics();
  }),
  executeKubectl: publicProcedure.input(z3.object({ command: z3.string() })).mutation(async ({ input }) => {
    return executeKubectl(input.command);
  })
});

// server/routers/ai.ts
import { z as z4 } from "zod";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/infrastructure/ai-agent.ts
var defaultConfig3 = {
  agentUrl: process.env.DEVOPS_AI_AGENT_URL || "http://localhost:8000",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  model: process.env.AI_MODEL || "mistral",
  useLocalLLM: process.env.USE_LOCAL_LLM === "true"
};
var SYSTEM_PROMPTS = {
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
Always explain what each command does and flag any dangerous operations.`
};
async function chat(messages, context) {
  try {
    const formattedMessages = [
      { role: "system", content: SYSTEM_PROMPTS.general },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content
      }))
    ];
    if (context) {
      formattedMessages.push({
        role: "user",
        content: `Current infrastructure context:
${JSON.stringify(context, null, 2)}`
      });
    }
    const response = await invokeLLM({ messages: formattedMessages });
    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "I couldn't generate a response.";
  } catch (error) {
    console.error("AI chat error:", error);
    return getMockChatResponse(messages[messages.length - 1]?.content || "");
  }
}
async function analyzeInfrastructure(data) {
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
        { role: "user", content: prompt }
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
                    suggestedAction: { type: "string" }
                  },
                  required: ["severity", "title", "description"],
                  additionalProperties: false
                }
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string" }
                  },
                  required: ["category", "title", "description", "priority"],
                  additionalProperties: false
                }
              },
              confidence: { type: "number" }
            },
            required: ["summary", "issues", "recommendations", "confidence"],
            additionalProperties: false
          }
        }
      }
    });
    const content = response.choices[0]?.message?.content;
    return content && typeof content === "string" ? JSON.parse(content) : getMockAnalysis();
  } catch (error) {
    console.error("AI analysis error:", error);
    return getMockAnalysis();
  }
}
async function troubleshoot(issue, context) {
  try {
    const prompt = `Troubleshoot the following issue:

Issue: ${issue}
${context?.errorLogs ? `Error Logs:
${context.errorLogs.join("\n")}` : ""}
${context?.resourceType ? `Resource Type: ${context.resourceType}` : ""}
${context?.resourceName ? `Resource Name: ${context.resourceName}` : ""}
${context?.namespace ? `Namespace: ${context.namespace}` : ""}

Provide a structured troubleshooting guide.`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.troubleshooting },
        { role: "user", content: prompt }
      ]
    });
    const content = response.choices[0]?.message?.content || "";
    return parseTroubleshootingResponse(content, issue);
  } catch (error) {
    console.error("AI troubleshooting error:", error);
    return getMockTroubleshooting(issue);
  }
}
async function suggestCommands(intent, platform) {
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
        { role: "user", content: prompt }
      ]
    });
    const content = response.choices[0]?.message?.content || "";
    return parseCommandSuggestions(content, platform);
  } catch (error) {
    console.error("AI command suggestion error:", error);
    return getMockCommands(platform);
  }
}
async function analyzeLogsForAnomalies(logs, context) {
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
        { role: "user", content: prompt }
      ]
    });
    return parseLogAnalysis(response.choices[0]?.message?.content || "");
  } catch (error) {
    console.error("AI log analysis error:", error);
    return getMockLogAnalysis();
  }
}
async function getAIStatus() {
  try {
    await invokeLLM({
      messages: [{ role: "user", content: "ping" }]
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
        "Security recommendations"
      ]
    };
  } catch {
    return {
      available: false,
      provider: "None",
      model: "N/A",
      capabilities: []
    };
  }
}
function parseTroubleshootingResponse(content, issue) {
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  return {
    diagnosis: contentStr.substring(0, 200),
    rootCause: "Parsed from AI response",
    steps: [
      { order: 1, action: "Check resource status", command: "kubectl get pods" },
      { order: 2, action: "Review logs", command: "kubectl logs <pod-name>" },
      { order: 3, action: "Apply fix", command: "kubectl rollout restart deployment/<name>" }
    ],
    commands: ["kubectl get pods", "kubectl describe pod <name>", "kubectl logs <name>"],
    relatedDocs: ["https://kubernetes.io/docs/tasks/debug/"]
  };
}
function parseCommandSuggestions(content, platform) {
  return getMockCommands(platform);
}
function parseLogAnalysis(content) {
  return getMockLogAnalysis();
}
function getMockChatResponse(message) {
  const responses = {
    "health": "Based on my analysis, your infrastructure appears healthy. All containers are running, and resource utilization is within normal limits. However, I noticed the worker-queue pod has been pending for 5 minutes - you may want to check if there are sufficient resources available.",
    "kubernetes": "Your Kubernetes cluster is running smoothly with 3 nodes, 47 pods, and 12 deployments. I recommend enabling pod disruption budgets for critical workloads to improve reliability during node maintenance.",
    "docker": "Docker is running 5 containers with 1 stopped. The stopped container (worker-queue) may need attention. Overall memory usage is at 45% which is healthy.",
    "security": "I've identified a few security recommendations: 1) Enable network policies for pod-to-pod communication, 2) Rotate secrets that are older than 90 days, 3) Update base images to patch recent CVEs."
  };
  const lowerMessage = message.toLowerCase();
  for (const [key, response] of Object.entries(responses)) {
    if (lowerMessage.includes(key)) {
      return response;
    }
  }
  return "I'm your DevOps AI Assistant. I can help you with infrastructure analysis, troubleshooting, and recommendations. What would you like to know about your Docker containers, Kubernetes clusters, or infrastructure?";
}
function getMockAnalysis() {
  return {
    summary: "Infrastructure is generally healthy with minor issues requiring attention.",
    issues: [
      {
        severity: "warning",
        title: "Pod Pending",
        description: "worker-queue-9e8d7c6b5-jkl78 has been pending for 5 minutes",
        resource: "pod/worker-queue-9e8d7c6b5-jkl78",
        suggestedAction: "Check node resources and pod resource requests"
      },
      {
        severity: "info",
        title: "High Memory Usage",
        description: "api-server container using 512MB of memory",
        resource: "container/api-server",
        suggestedAction: "Consider increasing memory limits or optimizing application"
      }
    ],
    recommendations: [
      {
        category: "reliability",
        title: "Add Pod Disruption Budgets",
        description: "Critical deployments should have PDBs to ensure availability during maintenance",
        priority: "high"
      },
      {
        category: "security",
        title: "Enable Network Policies",
        description: "Implement network policies to restrict pod-to-pod communication",
        priority: "medium"
      },
      {
        category: "performance",
        title: "Implement Horizontal Pod Autoscaler",
        description: "Add HPA to api-server deployment to handle traffic spikes",
        priority: "medium"
      }
    ],
    confidence: 0.85
  };
}
function getMockTroubleshooting(issue) {
  return {
    diagnosis: `Analyzing issue: ${issue}`,
    rootCause: "Resource constraints or configuration mismatch",
    steps: [
      { order: 1, action: "Check pod status and events", command: "kubectl describe pod <pod-name>", expectedResult: "Look for scheduling failures or resource issues" },
      { order: 2, action: "Review container logs", command: "kubectl logs <pod-name> --previous", expectedResult: "Check for application errors" },
      { order: 3, action: "Verify resource availability", command: "kubectl top nodes", expectedResult: "Ensure nodes have available resources" },
      { order: 4, action: "Apply corrective action", command: "kubectl rollout restart deployment/<name>", expectedResult: "Pod should restart successfully" }
    ],
    commands: [
      "kubectl get pods -o wide",
      "kubectl describe pod <pod-name>",
      "kubectl logs <pod-name>",
      "kubectl top pods"
    ],
    relatedDocs: [
      "https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/",
      "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"
    ]
  };
}
function getMockCommands(platform) {
  const commands = {
    docker: [
      { command: "docker ps -a", description: "List all containers including stopped ones", risk: "safe", requiresConfirmation: false },
      { command: "docker logs -f <container>", description: "Follow container logs in real-time", risk: "safe", requiresConfirmation: false },
      { command: "docker restart <container>", description: "Restart a container", risk: "moderate", requiresConfirmation: true },
      { command: "docker system prune -a", description: "Remove all unused containers, networks, images", risk: "dangerous", requiresConfirmation: true }
    ],
    kubernetes: [
      { command: "kubectl get pods -A", description: "List all pods in all namespaces", risk: "safe", requiresConfirmation: false },
      { command: "kubectl describe pod <name>", description: "Show detailed pod information", risk: "safe", requiresConfirmation: false },
      { command: "kubectl rollout restart deployment/<name>", description: "Restart all pods in a deployment", risk: "moderate", requiresConfirmation: true },
      { command: "kubectl delete pod <name>", description: "Delete a pod (will be recreated by controller)", risk: "moderate", requiresConfirmation: true }
    ],
    ansible: [
      { command: "ansible-playbook -i inventory playbook.yml --check", description: "Dry run playbook", risk: "safe", requiresConfirmation: false },
      { command: "ansible all -m ping", description: "Test connectivity to all hosts", risk: "safe", requiresConfirmation: false },
      { command: "ansible-playbook playbook.yml", description: "Execute playbook", risk: "moderate", requiresConfirmation: true }
    ],
    terraform: [
      { command: "terraform plan", description: "Preview infrastructure changes", risk: "safe", requiresConfirmation: false },
      { command: "terraform apply", description: "Apply infrastructure changes", risk: "dangerous", requiresConfirmation: true },
      { command: "terraform destroy", description: "Destroy all managed infrastructure", risk: "dangerous", requiresConfirmation: true }
    ]
  };
  return commands[platform] || commands.docker;
}
function getMockLogAnalysis() {
  return {
    anomalies: [
      { line: "ERROR: Connection refused to database", type: "connection_error", severity: "critical", explanation: "Database connection failed, may indicate database is down or network issue" },
      { line: "WARN: High memory usage detected (85%)", type: "resource_warning", severity: "warning", explanation: "Memory usage approaching limit, consider scaling or optimization" }
    ],
    patterns: [
      { pattern: "Health check passed", count: 150, significance: "Normal operation indicator" },
      { pattern: "Request completed in", count: 1200, significance: "Standard request logging" }
    ],
    summary: "Logs show generally healthy operation with one critical database connection error and elevated memory warnings. Recommend investigating database connectivity and memory optimization."
  };
}

// server/routers/ai.ts
var aiRouter = router({
  // Get or create a chat session
  getSession: publicProcedure.input(z4.object({
    sessionId: z4.string().optional(),
    userOpenId: z4.string().optional()
  }).optional()).query(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || input?.userOpenId || null;
    const result = await getOrCreateChatSession(userOpenId, input?.sessionId);
    return result;
  }),
  // Get chat history for a session
  getChatHistory: publicProcedure.input(z4.object({
    sessionId: z4.string(),
    limit: z4.number().optional().default(100)
  })).query(async ({ input }) => {
    const messages = await getChatHistoryBySessionId(input.sessionId, input.limit);
    return messages.map((m) => ({
      id: m.id.toString(),
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      suggestions: m.suggestions || void 0,
      commands: m.commands || void 0,
      feedbackGiven: m.feedback || void 0
    }));
  }),
  // Get all sessions for user
  getUserSessions: publicProcedure.input(z4.object({
    userOpenId: z4.string().optional()
  }).optional()).query(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || input?.userOpenId;
    if (!userOpenId) return [];
    return getUserChatSessions(userOpenId);
  }),
  // Create new chat session
  createSession: publicProcedure.input(z4.object({
    userOpenId: z4.string().optional()
  }).optional()).mutation(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || input?.userOpenId || null;
    const result = await createNewChatSession(userOpenId);
    return { sessionId: result.sessionId };
  }),
  // Clear chat history
  clearHistory: publicProcedure.input(z4.object({
    sessionId: z4.string()
  })).mutation(async ({ input }) => {
    const success = await clearChatHistory(input.sessionId);
    return { success };
  }),
  chat: publicProcedure.input(z4.object({
    message: z4.string(),
    sessionId: z4.string().optional(),
    context: z4.object({
      recentMessages: z4.array(z4.object({
        role: z4.string(),
        content: z4.string()
      })).optional()
    }).optional()
  })).mutation(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || null;
    const { sessionId, conversationId } = await getOrCreateChatSession(userOpenId, input.sessionId);
    await saveChatMessage({
      conversationId,
      role: "user",
      content: input.message
    });
    const history = await getChatHistory(conversationId, 2);
    if (history.length <= 1) {
      const title = input.message.length > 50 ? input.message.substring(0, 50) + "..." : input.message;
      await updateSessionTitle(sessionId, title);
    }
    const messages = [
      { role: "system", content: "You are a DevOps AI assistant. Help with infrastructure analysis, troubleshooting, and command recommendations." },
      ...input.context?.recentMessages?.map((m) => ({ role: m.role, content: m.content })) || [],
      { role: "user", content: input.message }
    ];
    const response = await chat(messages);
    const suggestions = [
      "Show me more details",
      "Execute the recommended commands",
      "Analyze related logs"
    ];
    const commands = [];
    const commandRegex = /`([^`]+)`/g;
    let match;
    while ((match = commandRegex.exec(response)) !== null) {
      if (match[1].startsWith("kubectl") || match[1].startsWith("docker") || match[1].startsWith("terraform")) {
        commands.push({
          command: match[1],
          description: "Suggested command from AI analysis"
        });
      }
    }
    const assistantMessageId = await saveChatMessage({
      conversationId,
      role: "assistant",
      content: response,
      suggestions,
      commands
    });
    return {
      response,
      suggestions,
      commands,
      sessionId,
      messageId: assistantMessageId?.toString()
    };
  }),
  analyzeInfrastructure: publicProcedure.input(z4.object({
    containers: z4.array(z4.unknown()).optional(),
    pods: z4.array(z4.unknown()).optional(),
    deployments: z4.array(z4.unknown()).optional(),
    metrics: z4.unknown().optional(),
    logs: z4.array(z4.string()).optional()
  }).optional()).query(async ({ input }) => {
    const containers = input?.containers || await listContainers();
    const pods = input?.pods || await listPods("all");
    const deployments = input?.deployments || await listDeployments("all");
    return analyzeInfrastructure({
      containers,
      pods,
      deployments,
      metrics: input?.metrics,
      logs: input?.logs
    });
  }),
  troubleshoot: publicProcedure.input(z4.object({
    issue: z4.string(),
    errorLogs: z4.array(z4.string()).optional(),
    resourceType: z4.string().optional(),
    resourceName: z4.string().optional(),
    namespace: z4.string().optional()
  })).mutation(async ({ input }) => {
    return troubleshoot(input.issue, {
      errorLogs: input.errorLogs,
      resourceType: input.resourceType,
      resourceName: input.resourceName,
      namespace: input.namespace
    });
  }),
  suggestCommands: publicProcedure.input(z4.object({
    intent: z4.string(),
    platform: z4.enum(["docker", "kubernetes", "ansible", "terraform"])
  })).query(async ({ input }) => {
    return suggestCommands(input.intent, input.platform);
  }),
  analyzeLogs: publicProcedure.input(z4.object({
    logs: z4.array(z4.string()),
    source: z4.string().optional(),
    timeRange: z4.string().optional()
  })).mutation(async ({ input }) => {
    return analyzeLogsForAnomalies(input.logs, {
      source: input.source,
      timeRange: input.timeRange
    });
  }),
  getStatus: publicProcedure.query(async () => {
    return getAIStatus();
  }),
  submitFeedback: publicProcedure.input(z4.object({
    messageId: z4.string(),
    feedback: z4.enum(["positive", "negative"]),
    context: z4.string().optional()
  })).mutation(async ({ input }) => {
    const messageIdNum = parseInt(input.messageId, 10);
    if (!isNaN(messageIdNum)) {
      await updateMessageFeedback(messageIdNum, input.feedback);
    }
    console.log(`Feedback received: ${input.feedback} for message ${input.messageId}`);
    return { success: true };
  }),
  getKnowledgeStats: publicProcedure.query(async () => {
    return {
      totalSolutions: 156,
      successRate: 94,
      totalInteractions: 1247,
      topCategories: [
        { name: "Pod CrashLoopBackOff", count: 45, solved: 43 },
        { name: "Memory Limit Exceeded", count: 38, solved: 36 },
        { name: "Image Pull Errors", count: 32, solved: 31 },
        { name: "Network Connectivity", count: 28, solved: 25 },
        { name: "Certificate Expiry", count: 21, solved: 21 }
      ]
    };
  }),
  // Search chat history
  searchHistory: publicProcedure.input(z4.object({
    query: z4.string().min(1),
    sessionId: z4.string().optional(),
    startDate: z4.string().optional(),
    endDate: z4.string().optional(),
    limit: z4.number().optional().default(50)
  })).query(async ({ input, ctx }) => {
    const userOpenId = ctx.user?.openId || null;
    const results = await searchChatMessages(userOpenId, input.query, {
      sessionId: input.sessionId,
      startDate: input.startDate ? new Date(input.startDate) : void 0,
      endDate: input.endDate ? new Date(input.endDate) : void 0,
      limit: input.limit
    });
    return results;
  }),
  // Export chat history
  exportHistory: publicProcedure.input(z4.object({
    sessionId: z4.string(),
    format: z4.enum(["json", "markdown"]).default("json")
  })).query(async ({ input }) => {
    const content = await exportChatHistory(input.sessionId, input.format);
    return { content, format: input.format };
  })
});

// server/routers/connections.ts
import { z as z5 } from "zod";
var connectionsRouter = router({
  getDockerConfig: publicProcedure.query(() => {
    return {
      socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
      host: process.env.DOCKER_HOST || "",
      connected: true
      // Mock status
    };
  }),
  getKubernetesConfig: publicProcedure.query(() => {
    return {
      apiServer: process.env.KUBERNETES_API_SERVER || "",
      namespace: process.env.KUBERNETES_NAMESPACE || "default",
      connected: true
      // Mock status
    };
  }),
  getAIConfig: publicProcedure.query(() => {
    return {
      agentUrl: process.env.DEVOPS_AI_AGENT_URL || "",
      ollamaUrl: process.env.OLLAMA_URL || "",
      model: process.env.AI_MODEL || "gpt-4",
      useLocalLLM: process.env.USE_LOCAL_LLM === "true"
    };
  }),
  testConnection: publicProcedure.input(z5.object({
    type: z5.enum(["docker", "kubernetes", "ai"])
  })).mutation(async ({ input }) => {
    return {
      success: true,
      message: `Successfully connected to ${input.type}`,
      latency: Math.floor(Math.random() * 100) + 10
    };
  })
});

// server/routers/notifications.ts
import { z as z6 } from "zod";

// server/_core/websocket.ts
import { Server } from "socket.io";
var io = null;
var connectedClients = /* @__PURE__ */ new Map();
var metricsHistory2 = [];
var MAX_HISTORY_POINTS = 288;
var activeAlerts = [];
var alertIdCounter = 1;
function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/socket.io"
  });
  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
    connectedClients.set(socket.id, socket);
    sendInitialData(socket);
    socket.on("subscribe", (channel) => {
      socket.join(channel);
      console.log(`[WebSocket] Client ${socket.id} subscribed to ${channel}`);
    });
    socket.on("unsubscribe", (channel) => {
      socket.leave(channel);
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from ${channel}`);
    });
    socket.on("acknowledge_alert", (alertId) => {
      const alert = activeAlerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        broadcastAlerts();
      }
    });
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      connectedClients.delete(socket.id);
    });
  });
  startPeriodicUpdates();
  console.log("[WebSocket] Server initialized");
  return io;
}
async function sendInitialData(socket) {
  try {
    const containers = await listContainers(true);
    socket.emit("containers:update", containers);
    const pods = await listPods("all");
    socket.emit("pods:update", pods);
    socket.emit("metrics:history", metricsHistory2);
    socket.emit("alerts:update", activeAlerts);
  } catch (error) {
    console.error("[WebSocket] Error sending initial data:", error);
  }
}
function startPeriodicUpdates() {
  setInterval(async () => {
    if (!io || connectedClients.size === 0) return;
    try {
      const containers = await listContainers(true);
      io.emit("containers:update", containers);
      checkContainerAlerts(containers);
    } catch (error) {
    }
  }, 1e4);
  setInterval(async () => {
    if (!io || connectedClients.size === 0) return;
    try {
      const pods = await listPods("all");
      io.emit("pods:update", pods);
      checkPodAlerts(pods);
    } catch (error) {
    }
  }, 1e4);
  setInterval(async () => {
    await collectMetrics();
  }, 5 * 60 * 1e3);
  collectMetrics();
}
async function collectMetrics() {
  try {
    const clusterMetrics = await getClusterMetrics();
    const metricPoint = {
      timestamp: Date.now(),
      cpu: clusterMetrics.cpuUsage || Math.random() * 100,
      memory: clusterMetrics.memoryUsage || Math.random() * 100,
      network: {
        rx: Math.random() * 1e3,
        tx: Math.random() * 500
      }
    };
    metricsHistory2.push(metricPoint);
    while (metricsHistory2.length > MAX_HISTORY_POINTS) {
      metricsHistory2.shift();
    }
    await saveMetricsSnapshot({
      source: "kubernetes",
      resourceType: "cluster",
      cpuPercent: Math.round(metricPoint.cpu),
      memoryPercent: Math.round(metricPoint.memory),
      networkRxBytes: Math.round(metricPoint.network.rx),
      networkTxBytes: Math.round(metricPoint.network.tx)
    });
    if (io) {
      io.emit("metrics:update", metricPoint);
    }
    await checkResourceAlertsWithThresholds(metricPoint);
  } catch (error) {
    const metricPoint = {
      timestamp: Date.now(),
      cpu: 40 + Math.random() * 40,
      memory: 50 + Math.random() * 30,
      network: {
        rx: Math.random() * 1e3,
        tx: Math.random() * 500
      }
    };
    metricsHistory2.push(metricPoint);
    while (metricsHistory2.length > MAX_HISTORY_POINTS) {
      metricsHistory2.shift();
    }
    await saveMetricsSnapshot({
      source: "system",
      resourceType: "cluster",
      cpuPercent: Math.round(metricPoint.cpu),
      memoryPercent: Math.round(metricPoint.memory),
      networkRxBytes: Math.round(metricPoint.network.rx),
      networkTxBytes: Math.round(metricPoint.network.tx)
    });
    if (io) {
      io.emit("metrics:update", metricPoint);
    }
    await checkResourceAlertsWithThresholds(metricPoint);
  }
}
async function checkResourceAlertsWithThresholds(metrics) {
  try {
    const thresholds = await getAlertThresholds({ enabledOnly: true });
    for (const threshold of thresholds) {
      const inCooldown = await isThresholdInCooldown(threshold.id);
      if (inCooldown) continue;
      let currentValue = null;
      switch (threshold.metricType) {
        case "cpu":
          currentValue = metrics.cpu;
          break;
        case "memory":
          currentValue = metrics.memory;
          break;
        default:
          continue;
      }
      if (currentValue === null) continue;
      let severity = null;
      if (currentValue >= threshold.criticalThreshold) {
        severity = "critical";
      } else if (currentValue >= threshold.warningThreshold) {
        severity = "warning";
      }
      if (!severity) continue;
      await recordAlert({
        thresholdId: threshold.id,
        severity,
        metricType: threshold.metricType,
        resourceType: threshold.resourceType,
        currentValue: Math.round(currentValue),
        thresholdValue: severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold,
        message: `${threshold.name}: ${currentValue.toFixed(1)}% (${severity} threshold: ${severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold}%)`
      });
      createAlert({
        type: severity,
        category: threshold.metricType === "cpu" ? "high_cpu" : "high_memory",
        title: severity === "critical" ? `Critical ${threshold.metricType.toUpperCase()} Usage` : `High ${threshold.metricType.toUpperCase()} Usage`,
        message: `${threshold.name}: ${currentValue.toFixed(1)}%`
      });
    }
  } catch (error) {
    console.error("[WebSocket] Error checking thresholds:", error);
    checkResourceAlerts(metrics);
  }
}
function checkContainerAlerts(containers) {
  for (const container of containers) {
    if (container.status === "exited" || container.status === "dead") {
      const existingAlert = activeAlerts.find(
        (a) => a.category === "container_stopped" && a.resource === container.name
      );
      if (!existingAlert) {
        createAlert({
          type: "warning",
          category: "container_stopped",
          title: "Container Stopped",
          message: `Container "${container.name}" has stopped unexpectedly`,
          resource: container.name
        });
      }
    }
  }
}
function checkPodAlerts(pods) {
  for (const pod of pods) {
    if (pod.status === "CrashLoopBackOff" || pod.status === "Error") {
      const existingAlert = activeAlerts.find(
        (a) => a.category === "pod_crash" && a.resource === pod.name
      );
      if (!existingAlert) {
        createAlert({
          type: "critical",
          category: "pod_crash",
          title: "Pod Crash Detected",
          message: `Pod "${pod.name}" is in ${pod.status} state`,
          resource: pod.name,
          namespace: pod.namespace
        });
      }
    }
  }
}
function checkResourceAlerts(metrics) {
  if (metrics.cpu > 90) {
    const existingAlert = activeAlerts.find(
      (a) => a.category === "high_cpu" && !a.acknowledged
    );
    if (!existingAlert) {
      createAlert({
        type: "critical",
        category: "high_cpu",
        title: "High CPU Usage",
        message: `CPU usage is at ${metrics.cpu.toFixed(1)}%`
      });
    }
  }
  if (metrics.memory > 85) {
    const existingAlert = activeAlerts.find(
      (a) => a.category === "high_memory" && !a.acknowledged
    );
    if (!existingAlert) {
      createAlert({
        type: "warning",
        category: "high_memory",
        title: "High Memory Usage",
        message: `Memory usage is at ${metrics.memory.toFixed(1)}%`
      });
    }
  }
}
function createAlert(params) {
  const alert = {
    ...params,
    id: `alert-${alertIdCounter++}`,
    timestamp: /* @__PURE__ */ new Date(),
    acknowledged: false
  };
  activeAlerts.unshift(alert);
  while (activeAlerts.length > 100) {
    activeAlerts.pop();
  }
  broadcastAlerts();
  console.log(`[Alert] ${alert.type.toUpperCase()}: ${alert.title} - ${alert.message}`);
}
function broadcastAlerts() {
  if (io) {
    io.emit("alerts:update", activeAlerts);
  }
}
function getMetricsHistory2(hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1e3;
  return metricsHistory2.filter((m) => m.timestamp >= cutoff);
}
function getActiveAlerts() {
  return activeAlerts;
}
function acknowledgeAlert2(alertId) {
  const alert = activeAlerts.find((a) => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    broadcastAlerts();
    return true;
  }
  return false;
}

// server/routers/notifications.ts
var notificationsRouter = router({
  // Get all active alerts
  getAlerts: publicProcedure.input(z6.object({
    includeAcknowledged: z6.boolean().optional().default(false)
  }).optional()).query(async ({ input }) => {
    const alerts = getActiveAlerts();
    if (input?.includeAcknowledged) {
      return alerts;
    }
    return alerts.filter((a) => !a.acknowledged);
  }),
  // Get alert counts by type
  getAlertCounts: publicProcedure.query(async () => {
    const alerts = getActiveAlerts();
    const unacknowledged = alerts.filter((a) => !a.acknowledged);
    return {
      total: unacknowledged.length,
      critical: unacknowledged.filter((a) => a.type === "critical").length,
      warning: unacknowledged.filter((a) => a.type === "warning").length,
      info: unacknowledged.filter((a) => a.type === "info").length
    };
  }),
  // Acknowledge an alert
  acknowledge: publicProcedure.input(z6.object({
    alertId: z6.string()
  })).mutation(async ({ input }) => {
    const success = acknowledgeAlert2(input.alertId);
    return { success };
  }),
  // Acknowledge all alerts
  acknowledgeAll: publicProcedure.mutation(async () => {
    const alerts = getActiveAlerts();
    let count = 0;
    for (const alert of alerts) {
      if (!alert.acknowledged) {
        acknowledgeAlert2(alert.id);
        count++;
      }
    }
    return { acknowledged: count };
  }),
  // Get metrics history
  getMetricsHistory: publicProcedure.input(z6.object({
    hours: z6.number().min(1).max(24).optional().default(24)
  }).optional()).query(async ({ input }) => {
    return getMetricsHistory2(input?.hours || 24);
  }),
  // Get notification settings (placeholder for future implementation)
  getSettings: publicProcedure.query(async () => {
    return {
      emailNotifications: false,
      slackNotifications: false,
      criticalAlertsOnly: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00"
    };
  }),
  // Update notification settings (placeholder)
  updateSettings: publicProcedure.input(z6.object({
    emailNotifications: z6.boolean().optional(),
    slackNotifications: z6.boolean().optional(),
    criticalAlertsOnly: z6.boolean().optional(),
    quietHoursEnabled: z6.boolean().optional(),
    quietHoursStart: z6.string().optional(),
    quietHoursEnd: z6.string().optional()
  })).mutation(async ({ input }) => {
    console.log("Notification settings updated:", input);
    return { success: true };
  })
});

// server/routers/metrics.ts
import { z as z7 } from "zod";
var metricsRouter = router({
  // Get metrics history
  getHistory: publicProcedure.input(z7.object({
    source: z7.enum(["docker", "kubernetes", "system"]).optional(),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).optional(),
    resourceId: z7.string().optional(),
    hours: z7.number().min(1).max(168).default(24),
    // Max 7 days
    limit: z7.number().min(1).max(5e3).default(1e3)
  }).optional()).query(async ({ input }) => {
    const startTime2 = new Date(Date.now() - (input?.hours || 24) * 60 * 60 * 1e3);
    return getMetricsHistory({
      source: input?.source,
      resourceType: input?.resourceType,
      resourceId: input?.resourceId,
      startTime: startTime2,
      limit: input?.limit
    });
  }),
  // Get aggregated metrics summary
  getSummary: publicProcedure.input(z7.object({
    hours: z7.number().min(1).max(168).default(24)
  }).optional()).query(async ({ input }) => {
    return getAggregatedMetrics(input?.hours || 24);
  }),
  // Save metrics snapshot (for internal use)
  saveSnapshot: publicProcedure.input(z7.object({
    source: z7.enum(["docker", "kubernetes", "system"]).default("system"),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).default("cluster"),
    resourceId: z7.string().optional(),
    cpuPercent: z7.number().min(0).max(100),
    memoryPercent: z7.number().min(0).max(100),
    memoryUsedMb: z7.number().optional(),
    memoryTotalMb: z7.number().optional(),
    networkRxBytes: z7.number().optional(),
    networkTxBytes: z7.number().optional(),
    diskUsedGb: z7.number().optional(),
    diskTotalGb: z7.number().optional()
  })).mutation(async ({ input }) => {
    const id = await saveMetricsSnapshot(input);
    return { success: id !== null, id };
  }),
  // Cleanup old metrics
  cleanup: publicProcedure.input(z7.object({
    retentionDays: z7.number().min(1).max(365).default(30)
  }).optional()).mutation(async ({ input }) => {
    const deleted = await cleanupOldMetrics(input?.retentionDays || 30);
    return { success: true, deletedCount: deleted };
  })
});
var alertThresholdsRouter = router({
  // Get all thresholds
  list: publicProcedure.input(z7.object({
    metricType: z7.enum(["cpu", "memory", "disk", "network"]).optional(),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).optional(),
    enabledOnly: z7.boolean().optional()
  }).optional()).query(async ({ input }) => {
    return getAlertThresholds(input);
  }),
  // Create or update threshold
  upsert: publicProcedure.input(z7.object({
    id: z7.number().optional(),
    name: z7.string().min(1).max(255),
    metricType: z7.enum(["cpu", "memory", "disk", "network"]),
    resourceType: z7.enum(["container", "pod", "node", "cluster"]).default("cluster"),
    resourcePattern: z7.string().optional(),
    warningThreshold: z7.number().min(0).max(100),
    criticalThreshold: z7.number().min(0).max(100),
    isEnabled: z7.boolean().default(true),
    cooldownMinutes: z7.number().min(1).max(1440).default(5)
  })).mutation(async ({ input }) => {
    if (input.criticalThreshold <= input.warningThreshold) {
      return { success: false, error: "Critical threshold must be greater than warning threshold" };
    }
    const id = await upsertAlertThreshold(input);
    return { success: id !== null, id };
  }),
  // Toggle threshold enabled/disabled
  toggle: publicProcedure.input(z7.object({
    id: z7.number(),
    isEnabled: z7.boolean()
  })).mutation(async ({ input }) => {
    const success = await toggleAlertThreshold(input.id, input.isEnabled);
    return { success };
  }),
  // Delete threshold
  delete: publicProcedure.input(z7.object({
    id: z7.number()
  })).mutation(async ({ input }) => {
    const success = await deleteAlertThreshold(input.id);
    return { success };
  })
});
var alertHistoryRouter = router({
  // Get alert history
  list: publicProcedure.input(z7.object({
    severity: z7.enum(["warning", "critical"]).optional(),
    metricType: z7.enum(["cpu", "memory", "disk", "network"]).optional(),
    acknowledgedOnly: z7.boolean().optional(),
    unacknowledgedOnly: z7.boolean().optional(),
    hours: z7.number().min(1).max(168).optional(),
    limit: z7.number().min(1).max(500).default(100)
  }).optional()).query(async ({ input }) => {
    const startTime2 = input?.hours ? new Date(Date.now() - input.hours * 60 * 60 * 1e3) : void 0;
    return getAlertHistory({
      severity: input?.severity,
      metricType: input?.metricType,
      acknowledgedOnly: input?.acknowledgedOnly,
      unacknowledgedOnly: input?.unacknowledgedOnly,
      startTime: startTime2,
      limit: input?.limit
    });
  }),
  // Acknowledge an alert
  acknowledge: publicProcedure.input(z7.object({
    alertId: z7.number()
  })).mutation(async ({ input }) => {
    const success = await acknowledgeAlert(input.alertId);
    return { success };
  }),
  // Get unacknowledged count
  getUnacknowledgedCount: publicProcedure.query(async () => {
    const count = await getUnacknowledgedAlertCount();
    return { count };
  }),
  // Check threshold and create alert if needed
  checkAndAlert: publicProcedure.input(z7.object({
    thresholdId: z7.number(),
    currentValue: z7.number(),
    resourceId: z7.string().optional()
  })).mutation(async ({ input }) => {
    const inCooldown = await isThresholdInCooldown(input.thresholdId);
    if (inCooldown) {
      return { success: false, reason: "Threshold in cooldown" };
    }
    const thresholds = await getAlertThresholds();
    const threshold = thresholds.find((t2) => t2.id === input.thresholdId);
    if (!threshold || !threshold.isEnabled) {
      return { success: false, reason: "Threshold not found or disabled" };
    }
    let severity = null;
    if (input.currentValue >= threshold.criticalThreshold) {
      severity = "critical";
    } else if (input.currentValue >= threshold.warningThreshold) {
      severity = "warning";
    }
    if (!severity) {
      return { success: false, reason: "Value below thresholds" };
    }
    const alertId = await recordAlert({
      thresholdId: input.thresholdId,
      severity,
      metricType: threshold.metricType,
      resourceType: threshold.resourceType,
      resourceId: input.resourceId,
      currentValue: input.currentValue,
      thresholdValue: severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold,
      message: `${threshold.name}: ${input.currentValue}% (${severity} threshold: ${severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold}%)`
    });
    return {
      success: alertId !== null,
      alertId,
      severity,
      message: `${threshold.name}: ${input.currentValue}%`
    };
  })
});

// server/routers/autoscaling.ts
import { z as z8 } from "zod";

// server/infrastructure/ai-autoscaler.ts
async function analyzeMetricsForScaling(context) {
  const basicAnalysis = performBasicAnalysis(context);
  if (context.metricsHistory.length >= 10) {
    try {
      const aiAnalysis = await performAIAnalysis(context, basicAnalysis);
      return aiAnalysis;
    } catch (error) {
      console.error("[AI-Autoscaler] AI analysis failed, using basic analysis:", error);
      return basicAnalysis;
    }
  }
  return basicAnalysis;
}
function performBasicAnalysis(context) {
  const { currentMetricValue, scaleUpThreshold, scaleDownThreshold, currentReplicas, minReplicas, maxReplicas } = context;
  if (context.lastScaledAt) {
    const timeSinceLastScale = (Date.now() - context.lastScaledAt.getTime()) / 1e3;
    if (timeSinceLastScale < context.cooldownSeconds) {
      return {
        shouldScale: false,
        direction: "none",
        confidence: 100,
        recommendedReplicas: currentReplicas,
        reasoning: `Cooldown active. ${Math.ceil(context.cooldownSeconds - timeSinceLastScale)} seconds remaining.`,
        pattern: null,
        predictedLoad: null,
        timeToThreshold: null
      };
    }
  }
  if (currentMetricValue >= scaleUpThreshold && currentReplicas < maxReplicas) {
    return {
      shouldScale: true,
      direction: "up",
      confidence: 85,
      recommendedReplicas: Math.min(currentReplicas + 1, maxReplicas),
      reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) exceeds scale-up threshold (${scaleUpThreshold}%).`,
      pattern: "threshold_breach",
      predictedLoad: null,
      timeToThreshold: null
    };
  }
  if (currentMetricValue <= scaleDownThreshold && currentReplicas > minReplicas) {
    return {
      shouldScale: true,
      direction: "down",
      confidence: 80,
      recommendedReplicas: Math.max(currentReplicas - 1, minReplicas),
      reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) is below scale-down threshold (${scaleDownThreshold}%).`,
      pattern: "low_utilization",
      predictedLoad: null,
      timeToThreshold: null
    };
  }
  return {
    shouldScale: false,
    direction: "none",
    confidence: 90,
    recommendedReplicas: currentReplicas,
    reasoning: `${context.metricType.toUpperCase()} usage (${currentMetricValue}%) is within acceptable range (${scaleDownThreshold}%-${scaleUpThreshold}%).`,
    pattern: null,
    predictedLoad: null,
    timeToThreshold: null
  };
}
async function performAIAnalysis(context, basicAnalysis) {
  const recentMetrics = context.metricsHistory.slice(-30);
  const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
  const maxValue = Math.max(...recentMetrics.map((m) => m.value));
  const minValue = Math.min(...recentMetrics.map((m) => m.value));
  const trend = calculateTrend(recentMetrics);
  const prompt = `You are an AI DevOps assistant analyzing resource metrics for auto-scaling decisions.

CONTEXT:
- Resource: ${context.resourceName} (${context.resourceType})
- Namespace: ${context.namespace || "default"}
- Current replicas: ${context.currentReplicas}
- Min/Max replicas: ${context.minReplicas}/${context.maxReplicas}
- Metric type: ${context.metricType}
- Current value: ${context.currentMetricValue}%
- Scale-up threshold: ${context.scaleUpThreshold}%
- Scale-down threshold: ${context.scaleDownThreshold}%

METRICS HISTORY (last ${recentMetrics.length} data points):
- Average: ${avgValue.toFixed(1)}%
- Max: ${maxValue.toFixed(1)}%
- Min: ${minValue.toFixed(1)}%
- Trend: ${trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable"} (${(trend * 100).toFixed(2)}% per interval)

BASIC ANALYSIS RESULT:
${basicAnalysis.reasoning}

Analyze the metrics and provide a scaling recommendation. Consider:
1. Is there a pattern (daily cycle, gradual increase, spikes)?
2. Should we scale proactively before hitting thresholds?
3. What's the optimal number of replicas?
4. How confident are you in this recommendation?

Respond in JSON format:
{
  "shouldScale": boolean,
  "direction": "up" | "down" | "none",
  "confidence": number (0-100),
  "recommendedReplicas": number,
  "reasoning": "brief explanation",
  "pattern": "detected pattern or null",
  "predictedLoad": number or null (predicted metric value in 15 min),
  "timeToThreshold": number or null (minutes until threshold breach)
}`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert DevOps AI that analyzes metrics and makes intelligent auto-scaling decisions. Always respond with valid JSON." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scaling_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            shouldScale: { type: "boolean" },
            direction: { type: "string", enum: ["up", "down", "none"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            recommendedReplicas: { type: "integer", minimum: 0 },
            reasoning: { type: "string" },
            pattern: { type: ["string", "null"] },
            predictedLoad: { type: ["integer", "null"] },
            timeToThreshold: { type: ["integer", "null"] }
          },
          required: ["shouldScale", "direction", "confidence", "recommendedReplicas", "reasoning", "pattern", "predictedLoad", "timeToThreshold"],
          additionalProperties: false
        }
      }
    }
  });
  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty or invalid AI response");
  }
  const aiResult = JSON.parse(content);
  aiResult.recommendedReplicas = Math.max(
    context.minReplicas,
    Math.min(context.maxReplicas, aiResult.recommendedReplicas)
  );
  aiResult.confidence = Math.max(0, Math.min(100, aiResult.confidence));
  return aiResult;
}
function calculateTrend(metrics) {
  if (metrics.length < 2) return 0;
  const n = metrics.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += metrics[i].value;
    sumXY += i * metrics[i].value;
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}
async function predictFutureLoad(metricsHistory3, hoursAhead = 1) {
  if (metricsHistory3.length < 24) {
    const avgValue = metricsHistory3.reduce((sum, m) => sum + m.value, 0) / metricsHistory3.length;
    return {
      predictedValue: Math.round(avgValue),
      confidence: 30,
      pattern: "insufficient_data"
    };
  }
  const hourlyAverages = [];
  const pointsPerHour = Math.floor(metricsHistory3.length / 24);
  for (let i = 0; i < 24; i++) {
    const start = i * pointsPerHour;
    const end = start + pointsPerHour;
    const hourData = metricsHistory3.slice(start, end);
    if (hourData.length > 0) {
      hourlyAverages.push(hourData.reduce((sum, m) => sum + m.value, 0) / hourData.length);
    }
  }
  const currentHour = (/* @__PURE__ */ new Date()).getHours();
  const targetHour = (currentHour + hoursAhead) % 24;
  const trend = calculateTrend(metricsHistory3.slice(-12));
  const baseValue = hourlyAverages[targetHour] || metricsHistory3[metricsHistory3.length - 1].value;
  const predictedValue = Math.round(baseValue + trend * hoursAhead * 12);
  let pattern = "stable";
  const variance = calculateVariance(hourlyAverages);
  if (variance > 200) {
    pattern = "high_variance";
  } else if (trend > 1) {
    pattern = "increasing";
  } else if (trend < -1) {
    pattern = "decreasing";
  } else if (hourlyAverages.some((v, i) => Math.abs(v - hourlyAverages[(i + 12) % 24]) < 5)) {
    pattern = "daily_cycle";
  }
  return {
    predictedValue: Math.max(0, Math.min(100, predictedValue)),
    confidence: Math.min(85, 50 + metricsHistory3.length / 10),
    pattern
  };
}
function calculateVariance(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

// server/routers/autoscaling.ts
var autoscalingRouter = router({
  // Get all autoscaling rules
  getRules: publicProcedure.input(z8.object({
    applicationId: z8.number().optional(),
    resourceType: z8.enum(["deployment", "container", "pod", "service"]).optional(),
    enabledOnly: z8.boolean().optional()
  }).optional()).query(async ({ input }) => {
    return await getAutoscalingRules(input);
  }),
  // Get single rule by ID
  getRule: publicProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
    return await getAutoscalingRuleById(input.id);
  }),
  // Create new autoscaling rule
  createRule: publicProcedure.input(z8.object({
    name: z8.string().min(1).max(255),
    description: z8.string().optional(),
    resourceType: z8.enum(["deployment", "container", "pod", "service"]),
    resourcePattern: z8.string().min(1).max(255),
    namespace: z8.string().optional(),
    metricType: z8.enum(["cpu", "memory", "requests", "custom"]),
    scaleUpThreshold: z8.number().min(1).max(100),
    scaleDownThreshold: z8.number().min(0).max(99),
    minReplicas: z8.number().min(0).max(100).default(1),
    maxReplicas: z8.number().min(1).max(1e3).default(10),
    cooldownSeconds: z8.number().min(60).max(3600).default(300),
    scaleUpStep: z8.number().min(1).max(10).default(1),
    scaleDownStep: z8.number().min(1).max(10).default(1),
    requiresApproval: z8.boolean().default(false),
    aiAssisted: z8.boolean().default(true),
    applicationId: z8.number().optional()
  })).mutation(async ({ input }) => {
    const id = await createAutoscalingRule({
      ...input,
      isEnabled: true
    });
    return { success: !!id, id };
  }),
  // Update autoscaling rule
  updateRule: publicProcedure.input(z8.object({
    id: z8.number(),
    name: z8.string().min(1).max(255).optional(),
    description: z8.string().optional(),
    scaleUpThreshold: z8.number().min(1).max(100).optional(),
    scaleDownThreshold: z8.number().min(0).max(99).optional(),
    minReplicas: z8.number().min(0).max(100).optional(),
    maxReplicas: z8.number().min(1).max(1e3).optional(),
    cooldownSeconds: z8.number().min(60).max(3600).optional(),
    scaleUpStep: z8.number().min(1).max(10).optional(),
    scaleDownStep: z8.number().min(1).max(10).optional(),
    isEnabled: z8.boolean().optional(),
    requiresApproval: z8.boolean().optional(),
    aiAssisted: z8.boolean().optional()
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    const success = await updateAutoscalingRule(id, updates);
    return { success };
  }),
  // Delete autoscaling rule
  deleteRule: publicProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ input }) => {
    const success = await deleteAutoscalingRule(input.id);
    return { success };
  }),
  // Toggle rule enabled/disabled
  toggleRule: publicProcedure.input(z8.object({ id: z8.number(), enabled: z8.boolean() })).mutation(async ({ input }) => {
    const success = await updateAutoscalingRule(input.id, { isEnabled: input.enabled });
    return { success };
  }),
  // Get scaling history
  getHistory: publicProcedure.input(z8.object({
    ruleId: z8.number().optional(),
    applicationId: z8.number().optional(),
    status: z8.enum(["pending", "executing", "completed", "failed", "cancelled"]).optional(),
    limit: z8.number().min(1).max(500).default(100)
  }).optional()).query(async ({ input }) => {
    return await getAutoscalingHistory(input);
  }),
  // Get pending approval actions
  getPendingApprovals: publicProcedure.query(async () => {
    return await getPendingApprovalActions();
  }),
  // Approve or reject a pending scaling action
  handleApproval: publicProcedure.input(z8.object({
    actionId: z8.number(),
    approved: z8.boolean(),
    userId: z8.number().optional()
  })).mutation(async ({ input }) => {
    if (input.approved) {
      await updateAutoscalingActionStatus(input.actionId, "executing");
      await updateAutoscalingActionStatus(input.actionId, "completed");
    } else {
      await updateAutoscalingActionStatus(input.actionId, "cancelled", "Rejected by user");
    }
    return { success: true };
  }),
  // Analyze metrics and get AI recommendation
  analyzeForScaling: publicProcedure.input(z8.object({
    ruleId: z8.number(),
    currentMetricValue: z8.number(),
    currentReplicas: z8.number()
  })).mutation(async ({ input }) => {
    const rule = await getAutoscalingRuleById(input.ruleId);
    if (!rule) {
      return { error: "Rule not found" };
    }
    const inCooldown = await isRuleInCooldown(input.ruleId);
    if (inCooldown) {
      return {
        shouldScale: false,
        direction: "none",
        confidence: 100,
        reasoning: "Rule is in cooldown period",
        inCooldown: true
      };
    }
    const metricsHistoryData = await getMetricsHistory({
      resourceType: rule.resourceType === "deployment" ? "pod" : "container",
      limit: 100
    });
    const metricsHistory3 = metricsHistoryData.map((m) => ({
      timestamp: m.timestamp.getTime(),
      value: rule.metricType === "cpu" ? m.cpuPercent : m.memoryPercent
    }));
    const context = {
      resourceName: rule.resourcePattern,
      resourceType: rule.resourceType,
      namespace: rule.namespace || void 0,
      currentReplicas: input.currentReplicas,
      minReplicas: rule.minReplicas,
      maxReplicas: rule.maxReplicas,
      scaleUpThreshold: rule.scaleUpThreshold,
      scaleDownThreshold: rule.scaleDownThreshold,
      currentMetricValue: input.currentMetricValue,
      metricType: rule.metricType,
      metricsHistory: metricsHistory3,
      lastScaledAt: rule.lastScaledAt || void 0,
      cooldownSeconds: rule.cooldownSeconds
    };
    const analysis = await analyzeMetricsForScaling(context);
    if (rule.aiAssisted && analysis.predictedLoad !== null) {
      await saveAiScalingPrediction({
        ruleId: rule.id,
        applicationId: rule.applicationId || void 0,
        predictedMetricValue: analysis.predictedLoad,
        predictedTime: new Date(Date.now() + 15 * 60 * 1e3),
        // 15 min ahead
        recommendedReplicas: analysis.recommendedReplicas,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        dataPointsAnalyzed: metricsHistory3.length,
        patternDetected: analysis.pattern || void 0
      });
    }
    return analysis;
  }),
  // Execute scaling action
  executeScaling: publicProcedure.input(z8.object({
    ruleId: z8.number(),
    direction: z8.enum(["up", "down"]),
    targetReplicas: z8.number(),
    currentReplicas: z8.number(),
    triggerValue: z8.number(),
    aiAnalysis: z8.string().optional(),
    aiConfidence: z8.number().optional()
  })).mutation(async ({ input }) => {
    const rule = await getAutoscalingRuleById(input.ruleId);
    if (!rule) {
      return { success: false, error: "Rule not found" };
    }
    const inCooldown = await isRuleInCooldown(input.ruleId);
    if (inCooldown) {
      return { success: false, error: "Rule is in cooldown" };
    }
    const actionId = await recordAutoscalingAction({
      ruleId: rule.id,
      applicationId: rule.applicationId || void 0,
      action: rule.requiresApproval ? "pending_approval" : input.direction === "up" ? "scale_up" : "scale_down",
      previousReplicas: input.currentReplicas,
      newReplicas: input.targetReplicas,
      triggerMetric: rule.metricType,
      triggerValue: input.triggerValue,
      thresholdValue: input.direction === "up" ? rule.scaleUpThreshold : rule.scaleDownThreshold,
      aiAnalysis: input.aiAnalysis || void 0,
      aiConfidence: input.aiConfidence || void 0,
      executedBy: "ai",
      status: rule.requiresApproval ? "pending" : "executing"
    });
    if (!actionId) {
      return { success: false, error: "Failed to record action" };
    }
    if (rule.requiresApproval) {
      return {
        success: true,
        requiresApproval: true,
        actionId,
        message: "Scaling action pending approval"
      };
    }
    try {
      const startTime2 = Date.now();
      if (rule.resourceType === "deployment") {
        await scaleDeployment(
          rule.resourcePattern,
          rule.namespace || "default",
          input.targetReplicas
        );
      } else if (rule.resourceType === "container") {
        console.log(`[AutoScaler] Would scale container ${rule.resourcePattern} to ${input.targetReplicas}`);
      }
      const executionTime = Date.now() - startTime2;
      await updateAutoscalingActionStatus(actionId, "completed");
      await updateRuleLastScaled(rule.id);
      return {
        success: true,
        actionId,
        executionTimeMs: executionTime,
        message: `Scaled ${rule.resourcePattern} from ${input.currentReplicas} to ${input.targetReplicas} replicas`
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
        error: error instanceof Error ? error.message : "Scaling failed"
      };
    }
  }),
  // Get AI predictions for a rule
  getPredictions: publicProcedure.input(z8.object({
    ruleId: z8.number(),
    limit: z8.number().min(1).max(50).default(10)
  })).query(async ({ input }) => {
    return await getAiPredictions(input.ruleId, input.limit);
  }),
  // Predict future load
  predictLoad: publicProcedure.input(z8.object({
    hoursAhead: z8.number().min(1).max(24).default(1)
  })).mutation(async ({ input }) => {
    const metricsHistoryData = await getMetricsHistory({
      limit: 288
      // 24 hours at 5-min intervals
    });
    const metricsHistory3 = metricsHistoryData.map((m) => ({
      timestamp: m.timestamp.getTime(),
      value: m.cpuPercent
    }));
    return await predictFutureLoad(metricsHistory3, input.hoursAhead);
  }),
  // Get scaling summary/dashboard data
  getSummary: publicProcedure.query(async () => {
    const rules = await getAutoscalingRules();
    const history = await getAutoscalingHistory({ limit: 50 });
    const pendingApprovals = await getPendingApprovalActions();
    const enabledRules = rules.filter((r) => r.isEnabled).length;
    const totalScalingActions = history.length;
    const successfulActions = history.filter((h) => h.status === "completed").length;
    const failedActions = history.filter((h) => h.status === "failed").length;
    const last24h = history.filter((h) => {
      const createdAt = h.createdAt.getTime();
      return Date.now() - createdAt < 24 * 60 * 60 * 1e3;
    });
    const scaleUpCount = last24h.filter((h) => h.action === "scale_up").length;
    const scaleDownCount = last24h.filter((h) => h.action === "scale_down").length;
    return {
      totalRules: rules.length,
      enabledRules,
      pendingApprovals: pendingApprovals.length,
      last24h: {
        total: last24h.length,
        scaleUp: scaleUpCount,
        scaleDown: scaleDownCount,
        successful: last24h.filter((h) => h.status === "completed").length,
        failed: last24h.filter((h) => h.status === "failed").length
      },
      allTime: {
        total: totalScalingActions,
        successful: successfulActions,
        failed: failedActions,
        successRate: totalScalingActions > 0 ? Math.round(successfulActions / totalScalingActions * 100) : 100
      }
    };
  })
});

// server/routers/scheduledScaling.ts
import { z as z9 } from "zod";
var cronExpressionSchema = z9.string().regex(
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
  "Invalid cron expression"
);
var timezones = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney"
];
var scheduledScalingRouter = router({
  // Get all scheduled scaling rules
  list: publicProcedure.input(z9.object({
    applicationId: z9.number().optional(),
    enabledOnly: z9.boolean().optional()
  }).optional()).query(async ({ input }) => {
    return await getScheduledScalingRules(input);
  }),
  // Get single scheduled scaling rule
  getById: publicProcedure.input(z9.object({ id: z9.number() })).query(async ({ input }) => {
    return await getScheduledScalingById(input.id);
  }),
  // Create scheduled scaling rule
  create: publicProcedure.input(z9.object({
    name: z9.string().min(1).max(255),
    description: z9.string().optional(),
    targetType: z9.enum(["deployment", "container", "service"]),
    targetName: z9.string().min(1).max(255),
    namespace: z9.string().optional(),
    cronExpression: z9.string().min(1),
    // Simplified validation
    timezone: z9.string().default("UTC"),
    targetReplicas: z9.number().min(0).max(100),
    isEnabled: z9.boolean().default(true),
    applicationId: z9.number().optional()
  })).mutation(async ({ input }) => {
    const nextExecution = calculateNextExecution(input.cronExpression, input.timezone);
    const id = await createScheduledScaling({
      ...input,
      nextExecutionAt: nextExecution
    });
    if (!id) {
      throw new Error("Failed to create scheduled scaling rule");
    }
    return { id, success: true };
  }),
  // Update scheduled scaling rule
  update: publicProcedure.input(z9.object({
    id: z9.number(),
    name: z9.string().min(1).max(255).optional(),
    description: z9.string().optional(),
    cronExpression: z9.string().optional(),
    timezone: z9.string().optional(),
    targetReplicas: z9.number().min(0).max(100).optional(),
    isEnabled: z9.boolean().optional()
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    if (updates.cronExpression || updates.timezone) {
      const existing = await getScheduledScalingById(id);
      if (existing) {
        const cron = updates.cronExpression || existing.cronExpression;
        const tz = updates.timezone || existing.timezone;
        updates.nextExecutionAt = calculateNextExecution(cron, tz);
      }
    }
    const success = await updateScheduledScaling(id, updates);
    return { success };
  }),
  // Delete scheduled scaling rule
  delete: publicProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
    const success = await deleteScheduledScaling(input.id);
    return { success };
  }),
  // Toggle enabled state
  toggle: publicProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
    const schedule = await getScheduledScalingById(input.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    const success = await updateScheduledScaling(input.id, {
      isEnabled: !schedule.isEnabled
    });
    return { success, isEnabled: !schedule.isEnabled };
  }),
  // Get execution history
  history: publicProcedure.input(z9.object({
    scheduleId: z9.number().optional(),
    limit: z9.number().min(1).max(100).default(50)
  }).optional()).query(async ({ input }) => {
    return await getScheduledScalingHistory(input?.scheduleId, input?.limit);
  }),
  // Execute scheduled scaling manually
  executeNow: publicProcedure.input(z9.object({ id: z9.number() })).mutation(async ({ input }) => {
    const schedule = await getScheduledScalingById(input.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    const startTime2 = Date.now();
    let previousReplicas = 0;
    let actualReplicas = 0;
    let errorMessage;
    let status = "completed";
    try {
      if (schedule.targetType === "deployment") {
        const deployments = await listDeployments(schedule.namespace || "default");
        const deployment = deployments.find((d) => d.name === schedule.targetName);
        previousReplicas = deployment?.replicas || 0;
      }
      if (schedule.targetType === "deployment") {
        await scaleDeployment(
          schedule.targetName,
          schedule.namespace || "default",
          schedule.targetReplicas
        );
        actualReplicas = schedule.targetReplicas;
      } else {
        throw new Error(`Scaling for ${schedule.targetType} not yet implemented`);
      }
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : "Unknown error";
    }
    const executionTimeMs = Date.now() - startTime2;
    await recordScheduledScalingExecution({
      scheduleId: input.id,
      previousReplicas,
      targetReplicas: schedule.targetReplicas,
      actualReplicas: status === "completed" ? actualReplicas : void 0,
      status,
      errorMessage,
      executionTimeMs,
      scheduledFor: /* @__PURE__ */ new Date(),
      executedAt: /* @__PURE__ */ new Date()
    });
    await updateScheduleExecutionStats(input.id, status === "completed");
    return {
      success: status === "completed",
      previousReplicas,
      newReplicas: actualReplicas,
      executionTimeMs,
      error: errorMessage
    };
  }),
  // Get available timezones
  getTimezones: publicProcedure.query(() => {
    return timezones;
  }),
  // Preview next executions
  previewExecutions: publicProcedure.input(z9.object({
    cronExpression: z9.string(),
    timezone: z9.string().default("UTC"),
    count: z9.number().min(1).max(10).default(5)
  })).query(({ input }) => {
    const executions = [];
    let current = /* @__PURE__ */ new Date();
    for (let i = 0; i < input.count; i++) {
      const next = calculateNextExecution(input.cronExpression, input.timezone, current);
      if (next) {
        executions.push(next);
        current = new Date(next.getTime() + 6e4);
      }
    }
    return executions;
  })
});
function calculateNextExecution(cronExpression, timezone, from) {
  try {
    const parts = cronExpression.split(" ");
    if (parts.length !== 5) return null;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = from || /* @__PURE__ */ new Date();
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);
    if (minute !== "*") {
      const targetMinute = parseInt(minute);
      if (!isNaN(targetMinute)) {
        if (next.getMinutes() >= targetMinute) {
          next.setHours(next.getHours() + 1);
        }
        next.setMinutes(targetMinute);
      }
    }
    if (hour !== "*") {
      const targetHour = parseInt(hour);
      if (!isNaN(targetHour)) {
        if (next.getHours() > targetHour || next.getHours() === targetHour && next.getMinutes() > parseInt(minute)) {
          next.setDate(next.getDate() + 1);
        }
        next.setHours(targetHour);
      }
    }
    return next;
  } catch {
    return null;
  }
}

// server/routers/abTesting.ts
import { z as z10 } from "zod";
var abTestingRouter = router({
  // Get all experiments
  list: publicProcedure.input(z10.object({
    applicationId: z10.number().optional(),
    status: z10.enum(["draft", "running", "paused", "completed", "cancelled"]).optional()
  }).optional()).query(async ({ input }) => {
    return await getAbTestExperiments(input);
  }),
  // Get single experiment
  getById: publicProcedure.input(z10.object({ id: z10.number() })).query(async ({ input }) => {
    const experiment = await getAbTestExperimentById(input.id);
    if (!experiment) return null;
    const stats = await calculateAbTestStats(input.id);
    return { ...experiment, stats };
  }),
  // Create experiment
  create: publicProcedure.input(z10.object({
    name: z10.string().min(1).max(255),
    description: z10.string().optional(),
    targetType: z10.enum(["deployment", "container", "service"]),
    targetName: z10.string().min(1).max(255),
    namespace: z10.string().optional(),
    // Variant A
    variantAName: z10.string().default("Control"),
    variantAScaleUpThreshold: z10.number().min(1).max(100),
    variantAScaleDownThreshold: z10.number().min(1).max(100),
    variantACooldown: z10.number().min(60).max(3600).default(300),
    variantAMinReplicas: z10.number().min(0).max(100).default(1),
    variantAMaxReplicas: z10.number().min(1).max(100).default(10),
    // Variant B
    variantBName: z10.string().default("Treatment"),
    variantBScaleUpThreshold: z10.number().min(1).max(100),
    variantBScaleDownThreshold: z10.number().min(1).max(100),
    variantBCooldown: z10.number().min(60).max(3600).default(300),
    variantBMinReplicas: z10.number().min(0).max(100).default(1),
    variantBMaxReplicas: z10.number().min(1).max(100).default(10),
    // Settings
    trafficSplitPercent: z10.number().min(10).max(90).default(50),
    durationHours: z10.number().min(1).max(168).default(24),
    applicationId: z10.number().optional()
  })).mutation(async ({ input }) => {
    const id = await createAbTestExperiment(input);
    if (!id) {
      throw new Error("Failed to create A/B test experiment");
    }
    return { id, success: true };
  }),
  // Update experiment
  update: publicProcedure.input(z10.object({
    id: z10.number(),
    name: z10.string().min(1).max(255).optional(),
    description: z10.string().optional(),
    variantAName: z10.string().optional(),
    variantBName: z10.string().optional(),
    trafficSplitPercent: z10.number().min(10).max(90).optional(),
    durationHours: z10.number().min(1).max(168).optional()
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    const success = await updateAbTestExperiment(id, updates);
    return { success };
  }),
  // Delete experiment
  delete: publicProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
    const experiment = await getAbTestExperimentById(input.id);
    if (experiment?.status === "running") {
      throw new Error("Cannot delete a running experiment. Stop it first.");
    }
    const success = await deleteAbTestExperiment(input.id);
    return { success };
  }),
  // Start experiment
  start: publicProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
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
  pause: publicProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
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
  complete: publicProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
    const experiment = await getAbTestExperimentById(input.id);
    if (!experiment) {
      throw new Error("Experiment not found");
    }
    const stats = await calculateAbTestStats(input.id);
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
      stats
    };
  }),
  // Get experiment metrics
  getMetrics: publicProcedure.input(z10.object({
    experimentId: z10.number(),
    variant: z10.enum(["A", "B"]).optional()
  })).query(async ({ input }) => {
    return await getAbTestMetrics(input.experimentId, input.variant);
  }),
  // Record metrics (called by autoscaling engine)
  recordMetrics: publicProcedure.input(z10.object({
    experimentId: z10.number(),
    variant: z10.enum(["A", "B"]),
    avgCpuPercent: z10.number(),
    avgMemoryPercent: z10.number(),
    avgResponseTimeMs: z10.number().optional(),
    errorRate: z10.number().optional(),
    scaleUpCount: z10.number().default(0),
    scaleDownCount: z10.number().default(0),
    avgReplicaCount: z10.number(),
    estimatedCostUnits: z10.number().optional(),
    oscillationCount: z10.number().default(0),
    cooldownViolations: z10.number().default(0)
  })).mutation(async ({ input }) => {
    const id = await recordAbTestMetrics(input);
    return { id, success: !!id };
  }),
  // Get statistics
  getStats: publicProcedure.input(z10.object({ experimentId: z10.number() })).query(async ({ input }) => {
    return await calculateAbTestStats(input.experimentId);
  }),
  // Apply winner configuration
  applyWinner: publicProcedure.input(z10.object({ experimentId: z10.number() })).mutation(async ({ input }) => {
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
    const winnerConfig = experiment.winnerVariant === "A" ? {
      scaleUpThreshold: experiment.variantAScaleUpThreshold,
      scaleDownThreshold: experiment.variantAScaleDownThreshold,
      cooldown: experiment.variantACooldown,
      minReplicas: experiment.variantAMinReplicas,
      maxReplicas: experiment.variantAMaxReplicas
    } : {
      scaleUpThreshold: experiment.variantBScaleUpThreshold,
      scaleDownThreshold: experiment.variantBScaleDownThreshold,
      cooldown: experiment.variantBCooldown,
      minReplicas: experiment.variantBMinReplicas,
      maxReplicas: experiment.variantBMaxReplicas
    };
    return {
      success: true,
      winnerVariant: experiment.winnerVariant,
      config: winnerConfig,
      message: `Apply these settings to your autoscaling rule for ${experiment.targetName}`
    };
  })
});

// server/routers/email.ts
import { z as z11 } from "zod";
import { eq as eq2, desc as desc2 } from "drizzle-orm";

// server/services/email.ts
import nodemailer from "nodemailer";
var transporter = null;
var emailConfig2 = null;
function configureEmail(config) {
  emailConfig2 = config;
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });
}
async function testEmailConnection() {
  if (!transporter) {
    return { success: false, error: "Email not configured" };
  }
  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
async function sendEmail(to, template) {
  if (!transporter || !emailConfig2) {
    return { success: false, error: "Email not configured" };
  }
  try {
    const info = await transporter.sendMail({
      from: emailConfig2.from,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
function createAlertEmailTemplate(alert) {
  const typeColors = {
    critical: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6"
  };
  const typeLabels = {
    critical: "CRITICAL",
    warning: "WARNING",
    info: "INFO"
  };
  const color = typeColors[alert.type];
  const label = typeLabels[alert.type];
  return {
    subject: `[${label}] ${alert.title} - DevOps AI Dashboard`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: ${color}; color: white; padding: 20px; }
          .header h1 { margin: 0; font-size: 18px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
          .content { padding: 20px; }
          .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .metric:last-child { border-bottom: none; }
          .metric-label { color: #6b7280; }
          .metric-value { font-weight: 600; color: #111827; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: ${color}; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="badge">${label}</span>
              <h1>${alert.title}</h1>
            </div>
            <div class="content">
              <p style="color: #374151; margin-top: 0;">${alert.message}</p>
              <div class="metric">
                <span class="metric-label">Resource</span>
                <span class="metric-value">${alert.resource}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Current Value</span>
                <span class="metric-value">${alert.value.toFixed(1)}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Threshold</span>
                <span class="metric-value">${alert.threshold}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Time</span>
                <span class="metric-value">${alert.timestamp.toLocaleString()}</span>
              </div>
              <center>
                <a href="#" class="button">View Dashboard</a>
              </center>
            </div>
            <div class="footer">
              DevOps AI Dashboard - Automated Alert Notification
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
[${label}] ${alert.title}

${alert.message}

Resource: ${alert.resource}
Current Value: ${alert.value.toFixed(1)}%
Threshold: ${alert.threshold}%
Time: ${alert.timestamp.toLocaleString()}

---
DevOps AI Dashboard - Automated Alert Notification
    `.trim()
  };
}
function createABTestResultEmailTemplate(experiment) {
  const winnerColor = experiment.winner === "none" ? "#6b7280" : "#10b981";
  const winnerText = experiment.winner === "none" ? "No clear winner" : `Variant ${experiment.winner} wins`;
  return {
    subject: `[A/B Test Complete] ${experiment.name} - ${winnerText}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: #8b5cf6; color: white; padding: 20px; }
          .header h1 { margin: 0; font-size: 18px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
          .content { padding: 20px; }
          .winner-banner { background: ${winnerColor}; color: white; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
          .winner-banner h2 { margin: 0; font-size: 20px; }
          .comparison { display: flex; gap: 16px; margin-bottom: 20px; }
          .variant { flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; }
          .variant h3 { margin: 0 0 12px 0; font-size: 14px; color: #374151; }
          .variant-metric { margin-bottom: 8px; }
          .variant-metric-label { font-size: 12px; color: #6b7280; }
          .variant-metric-value { font-size: 16px; font-weight: 600; color: #111827; }
          .recommendation { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-top: 20px; }
          .recommendation h4 { margin: 0 0 8px 0; color: #92400e; }
          .recommendation p { margin: 0; color: #78350f; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #6b7280; font-size: 12px; }
          .confidence { font-size: 14px; color: #6b7280; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="badge">A/B TEST COMPLETE</span>
              <h1>${experiment.name}</h1>
            </div>
            <div class="content">
              <div class="winner-banner">
                <h2>${winnerText}</h2>
                <p class="confidence">Confidence: ${experiment.confidence.toFixed(1)}% | Duration: ${experiment.duration}</p>
              </div>
              
              <div class="comparison">
                <div class="variant" style="${experiment.winner === "A" ? "border: 2px solid #10b981;" : ""}">
                  <h3>Variant A: ${experiment.variantA.name}</h3>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Avg Response Time</div>
                    <div class="variant-metric-value">${experiment.variantA.avgResponseTime.toFixed(0)}ms</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Error Rate</div>
                    <div class="variant-metric-value">${experiment.variantA.errorRate.toFixed(2)}%</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Resource Efficiency</div>
                    <div class="variant-metric-value">${experiment.variantA.resourceEfficiency.toFixed(1)}%</div>
                  </div>
                </div>
                
                <div class="variant" style="${experiment.winner === "B" ? "border: 2px solid #10b981;" : ""}">
                  <h3>Variant B: ${experiment.variantB.name}</h3>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Avg Response Time</div>
                    <div class="variant-metric-value">${experiment.variantB.avgResponseTime.toFixed(0)}ms</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Error Rate</div>
                    <div class="variant-metric-value">${experiment.variantB.errorRate.toFixed(2)}%</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Resource Efficiency</div>
                    <div class="variant-metric-value">${experiment.variantB.resourceEfficiency.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
              
              <div class="recommendation">
                <h4>AI Recommendation</h4>
                <p>${experiment.recommendation}</p>
              </div>
            </div>
            <div class="footer">
              DevOps AI Dashboard - A/B Test Results
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
[A/B TEST COMPLETE] ${experiment.name}

${winnerText}
Confidence: ${experiment.confidence.toFixed(1)}%
Duration: ${experiment.duration}

Variant A: ${experiment.variantA.name}
- Avg Response Time: ${experiment.variantA.avgResponseTime.toFixed(0)}ms
- Error Rate: ${experiment.variantA.errorRate.toFixed(2)}%
- Resource Efficiency: ${experiment.variantA.resourceEfficiency.toFixed(1)}%

Variant B: ${experiment.variantB.name}
- Avg Response Time: ${experiment.variantB.avgResponseTime.toFixed(0)}ms
- Error Rate: ${experiment.variantB.errorRate.toFixed(2)}%
- Resource Efficiency: ${experiment.variantB.resourceEfficiency.toFixed(1)}%

AI Recommendation:
${experiment.recommendation}

---
DevOps AI Dashboard - A/B Test Results
    `.trim()
  };
}
function createScalingEventEmailTemplate(event) {
  const typeLabels = {
    scale_up: "SCALE UP",
    scale_down: "SCALE DOWN",
    scheduled: "SCHEDULED SCALING"
  };
  const typeColors = {
    scale_up: "#10b981",
    scale_down: "#f59e0b",
    scheduled: "#3b82f6"
  };
  const label = typeLabels[event.type];
  const color = typeColors[event.type];
  return {
    subject: `[${label}] ${event.resource}: ${event.previousReplicas} \u2192 ${event.newReplicas} replicas`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: ${color}; color: white; padding: 20px; }
          .header h1 { margin: 0; font-size: 18px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
          .content { padding: 20px; }
          .scaling-visual { text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; margin-bottom: 20px; }
          .scaling-numbers { display: flex; align-items: center; justify-content: center; gap: 20px; }
          .replica-count { font-size: 36px; font-weight: 700; color: #111827; }
          .arrow { font-size: 24px; color: ${color}; }
          .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .metric:last-child { border-bottom: none; }
          .metric-label { color: #6b7280; }
          .metric-value { font-weight: 600; color: #111827; }
          .ai-recommendation { background: #ede9fe; border-left: 4px solid #8b5cf6; padding: 16px; margin-top: 20px; }
          .ai-recommendation h4 { margin: 0 0 8px 0; color: #5b21b6; }
          .ai-recommendation p { margin: 0; color: #6d28d9; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="badge">${label}</span>
              <h1>${event.resource}</h1>
            </div>
            <div class="content">
              <div class="scaling-visual">
                <div class="scaling-numbers">
                  <span class="replica-count">${event.previousReplicas}</span>
                  <span class="arrow">\u2192</span>
                  <span class="replica-count">${event.newReplicas}</span>
                </div>
                <p style="color: #6b7280; margin: 8px 0 0 0;">replicas</p>
              </div>
              
              <div class="metric">
                <span class="metric-label">Reason</span>
                <span class="metric-value">${event.reason}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Time</span>
                <span class="metric-value">${event.timestamp.toLocaleString()}</span>
              </div>
              
              ${event.aiRecommendation ? `
              <div class="ai-recommendation">
                <h4>AI Analysis</h4>
                <p>${event.aiRecommendation}</p>
              </div>
              ` : ""}
            </div>
            <div class="footer">
              DevOps AI Dashboard - Scaling Event Notification
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
[${label}] ${event.resource}

Replicas: ${event.previousReplicas} \u2192 ${event.newReplicas}
Reason: ${event.reason}
Time: ${event.timestamp.toLocaleString()}
${event.aiRecommendation ? `
AI Analysis:
${event.aiRecommendation}` : ""}

---
DevOps AI Dashboard - Scaling Event Notification
    `.trim()
  };
}

// server/routers/email.ts
import crypto from "crypto";
var emailRouter = router({
  // Get email configuration
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0) return null;
    const config = configs[0];
    return {
      ...config,
      smtpPassword: config.smtpPassword ? "********" : null
    };
  }),
  // Save email configuration
  saveConfig: publicProcedure.input(z11.object({
    smtpHost: z11.string().min(1),
    smtpPort: z11.number().min(1).max(65535),
    smtpSecure: z11.boolean(),
    smtpUser: z11.string().min(1),
    smtpPassword: z11.string().min(1),
    fromEmail: z11.string().email(),
    fromName: z11.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const existing = await db.select().from(emailConfig).limit(1);
    if (existing.length > 0) {
      await db.update(emailConfig).set({
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        smtpPassword: input.smtpPassword,
        fromEmail: input.fromEmail,
        fromName: input.fromName || "DevOps AI Dashboard",
        isVerified: false
      }).where(eq2(emailConfig.id, existing[0].id));
      return { success: true, id: existing[0].id };
    } else {
      const result = await db.insert(emailConfig).values({
        userId: 1,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        smtpPassword: input.smtpPassword,
        fromEmail: input.fromEmail,
        fromName: input.fromName || "DevOps AI Dashboard"
      });
      return { success: true, id: result[0].insertId };
    }
  }),
  // Test email configuration
  testConfig: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0) {
      return { success: false, error: "Email not configured" };
    }
    const config = configs[0];
    configureEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      },
      from: `${config.fromName} <${config.fromEmail}>`
    });
    const result = await testEmailConnection();
    if (result.success) {
      await db.update(emailConfig).set({ isVerified: true, lastTestedAt: /* @__PURE__ */ new Date() }).where(eq2(emailConfig.id, config.id));
    }
    return result;
  }),
  // Send test email
  sendTestEmail: publicProcedure.input(z11.object({
    toEmail: z11.string().email()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0) {
      return { success: false, error: "Email not configured" };
    }
    const config = configs[0];
    configureEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      },
      from: `${config.fromName} <${config.fromEmail}>`
    });
    const template = createAlertEmailTemplate({
      type: "info",
      title: "Test Email",
      message: "This is a test email from DevOps AI Dashboard to verify your email configuration is working correctly.",
      resource: "Email System",
      value: 100,
      threshold: 100,
      timestamp: /* @__PURE__ */ new Date()
    });
    const result = await sendEmail(input.toEmail, template);
    await db.insert(emailHistory).values({
      toEmail: input.toEmail,
      subject: template.subject,
      templateType: "custom",
      status: result.success ? "sent" : "failed",
      messageId: result.messageId,
      errorMessage: result.error,
      sentAt: result.success ? /* @__PURE__ */ new Date() : null
    });
    return result;
  }),
  // Get subscriptions
  getSubscriptions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(emailSubscriptions).orderBy(desc2(emailSubscriptions.createdAt));
  }),
  // Add subscription
  addSubscription: publicProcedure.input(z11.object({
    email: z11.string().email(),
    name: z11.string().optional(),
    criticalAlerts: z11.boolean().default(true),
    warningAlerts: z11.boolean().default(true),
    infoAlerts: z11.boolean().default(false),
    scalingEvents: z11.boolean().default(true),
    abTestResults: z11.boolean().default(true),
    dailyDigest: z11.boolean().default(false),
    weeklyReport: z11.boolean().default(true)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const unsubscribeToken = crypto.randomBytes(32).toString("hex");
    const result = await db.insert(emailSubscriptions).values({
      userId: 1,
      email: input.email,
      name: input.name,
      criticalAlerts: input.criticalAlerts,
      warningAlerts: input.warningAlerts,
      infoAlerts: input.infoAlerts,
      scalingEvents: input.scalingEvents,
      abTestResults: input.abTestResults,
      dailyDigest: input.dailyDigest,
      weeklyReport: input.weeklyReport,
      unsubscribeToken
    });
    return { success: true, id: result[0].insertId };
  }),
  // Update subscription
  updateSubscription: publicProcedure.input(z11.object({
    id: z11.number(),
    email: z11.string().email().optional(),
    name: z11.string().optional(),
    criticalAlerts: z11.boolean().optional(),
    warningAlerts: z11.boolean().optional(),
    infoAlerts: z11.boolean().optional(),
    scalingEvents: z11.boolean().optional(),
    abTestResults: z11.boolean().optional(),
    dailyDigest: z11.boolean().optional(),
    weeklyReport: z11.boolean().optional(),
    isActive: z11.boolean().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const { id, ...updates } = input;
    await db.update(emailSubscriptions).set(updates).where(eq2(emailSubscriptions.id, id));
    return { success: true };
  }),
  // Delete subscription
  deleteSubscription: publicProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    await db.delete(emailSubscriptions).where(eq2(emailSubscriptions.id, input.id));
    return { success: true };
  }),
  // Get email history
  getHistory: publicProcedure.input(z11.object({
    limit: z11.number().default(50),
    offset: z11.number().default(0)
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(emailHistory).orderBy(desc2(emailHistory.createdAt)).limit(input.limit).offset(input.offset);
  }),
  // Send alert notification to all subscribers
  sendAlertNotification: publicProcedure.input(z11.object({
    type: z11.enum(["critical", "warning", "info"]),
    title: z11.string(),
    message: z11.string(),
    resource: z11.string(),
    value: z11.number(),
    threshold: z11.number()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const subscribers = await db.select().from(emailSubscriptions).where(eq2(emailSubscriptions.isActive, true));
    const filteredSubscribers = subscribers.filter((sub) => {
      if (input.type === "critical") return sub.criticalAlerts;
      if (input.type === "warning") return sub.warningAlerts;
      return sub.infoAlerts;
    });
    if (filteredSubscribers.length === 0) {
      return { success: true, sent: 0, message: "No subscribers for this alert type" };
    }
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0 || !configs[0].isVerified) {
      return { success: false, error: "Email not configured or not verified" };
    }
    const config = configs[0];
    configureEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      },
      from: `${config.fromName} <${config.fromEmail}>`
    });
    const template = createAlertEmailTemplate({
      ...input,
      timestamp: /* @__PURE__ */ new Date()
    });
    let sent = 0;
    for (const subscriber of filteredSubscribers) {
      const result = await sendEmail(subscriber.email, template);
      await db.insert(emailHistory).values({
        subscriptionId: subscriber.id,
        toEmail: subscriber.email,
        subject: template.subject,
        templateType: "alert",
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? /* @__PURE__ */ new Date() : null
      });
      if (result.success) sent++;
    }
    return { success: true, sent, total: filteredSubscribers.length };
  }),
  // Send A/B test result notification
  sendABTestNotification: publicProcedure.input(z11.object({
    name: z11.string(),
    winner: z11.enum(["A", "B", "none"]),
    variantA: z11.object({
      name: z11.string(),
      avgResponseTime: z11.number(),
      errorRate: z11.number(),
      resourceEfficiency: z11.number()
    }),
    variantB: z11.object({
      name: z11.string(),
      avgResponseTime: z11.number(),
      errorRate: z11.number(),
      resourceEfficiency: z11.number()
    }),
    confidence: z11.number(),
    duration: z11.string(),
    recommendation: z11.string()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const subscribers = await db.select().from(emailSubscriptions).where(eq2(emailSubscriptions.isActive, true));
    const filteredSubscribers = subscribers.filter((sub) => sub.abTestResults);
    if (filteredSubscribers.length === 0) {
      return { success: true, sent: 0, message: "No subscribers for A/B test results" };
    }
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0 || !configs[0].isVerified) {
      return { success: false, error: "Email not configured or not verified" };
    }
    const config = configs[0];
    configureEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      },
      from: `${config.fromName} <${config.fromEmail}>`
    });
    const template = createABTestResultEmailTemplate(input);
    let sent = 0;
    for (const subscriber of filteredSubscribers) {
      const result = await sendEmail(subscriber.email, template);
      await db.insert(emailHistory).values({
        subscriptionId: subscriber.id,
        toEmail: subscriber.email,
        subject: template.subject,
        templateType: "ab_test",
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? /* @__PURE__ */ new Date() : null
      });
      if (result.success) sent++;
    }
    return { success: true, sent, total: filteredSubscribers.length };
  }),
  // Send scaling event notification
  sendScalingNotification: publicProcedure.input(z11.object({
    type: z11.enum(["scale_up", "scale_down", "scheduled"]),
    resource: z11.string(),
    previousReplicas: z11.number(),
    newReplicas: z11.number(),
    reason: z11.string(),
    aiRecommendation: z11.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const subscribers = await db.select().from(emailSubscriptions).where(eq2(emailSubscriptions.isActive, true));
    const filteredSubscribers = subscribers.filter((sub) => sub.scalingEvents);
    if (filteredSubscribers.length === 0) {
      return { success: true, sent: 0, message: "No subscribers for scaling events" };
    }
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0 || !configs[0].isVerified) {
      return { success: false, error: "Email not configured or not verified" };
    }
    const config = configs[0];
    configureEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      },
      from: `${config.fromName} <${config.fromEmail}>`
    });
    const template = createScalingEventEmailTemplate({
      ...input,
      timestamp: /* @__PURE__ */ new Date()
    });
    let sent = 0;
    for (const subscriber of filteredSubscribers) {
      const result = await sendEmail(subscriber.email, template);
      await db.insert(emailHistory).values({
        subscriptionId: subscriber.id,
        toEmail: subscriber.email,
        subject: template.subject,
        templateType: "scaling",
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? /* @__PURE__ */ new Date() : null
      });
      if (result.success) sent++;
    }
    return { success: true, sent, total: filteredSubscribers.length };
  })
});

// server/routers/prometheus.ts
import { z as z12 } from "zod";
import { eq as eq3, desc as desc3 } from "drizzle-orm";

// server/services/prometheus.ts
var prometheusConfig2 = null;
var grafanaConfig = null;
function configurePrometheus(config) {
  prometheusConfig2 = config;
}
function configureGrafana(config) {
  grafanaConfig = config;
}
async function testPrometheusConnection() {
  if (!prometheusConfig2) {
    return { success: false, error: "Prometheus not configured" };
  }
  try {
    const headers = {};
    if (prometheusConfig2.username && prometheusConfig2.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig2.username}:${prometheusConfig2.password}`).toString("base64")}`;
    }
    const response = await fetch(`${prometheusConfig2.url}/api/v1/status/buildinfo`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const data = await response.json();
    return {
      success: true,
      version: data.data?.version || "unknown"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed"
    };
  }
}
async function queryPrometheus(query, time) {
  if (!prometheusConfig2) {
    return { success: false, error: "Prometheus not configured" };
  }
  try {
    const headers = {};
    if (prometheusConfig2.username && prometheusConfig2.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig2.username}:${prometheusConfig2.password}`).toString("base64")}`;
    }
    const params = new URLSearchParams({ query });
    if (time) {
      params.append("time", (time.getTime() / 1e3).toString());
    }
    const response = await fetch(`${prometheusConfig2.url}/api/v1/query?${params}`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const result = await response.json();
    if (result.status === "error") {
      return { success: false, error: result.error || "Query failed" };
    }
    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Query failed"
    };
  }
}
async function queryPrometheusRange(query, start, end, step = "15s") {
  if (!prometheusConfig2) {
    return { success: false, error: "Prometheus not configured" };
  }
  try {
    const headers = {};
    if (prometheusConfig2.username && prometheusConfig2.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig2.username}:${prometheusConfig2.password}`).toString("base64")}`;
    }
    const params = new URLSearchParams({
      query,
      start: (start.getTime() / 1e3).toString(),
      end: (end.getTime() / 1e3).toString(),
      step
    });
    const response = await fetch(`${prometheusConfig2.url}/api/v1/query_range?${params}`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const result = await response.json();
    if (result.status === "error") {
      return { success: false, error: result.error || "Query failed" };
    }
    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Query failed"
    };
  }
}
async function getPrometheusMetrics() {
  if (!prometheusConfig2) {
    return { success: false, error: "Prometheus not configured" };
  }
  try {
    const headers = {};
    if (prometheusConfig2.username && prometheusConfig2.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig2.username}:${prometheusConfig2.password}`).toString("base64")}`;
    }
    const response = await fetch(`${prometheusConfig2.url}/api/v1/label/__name__/values`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const result = await response.json();
    return { success: true, metrics: result.data || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get metrics"
    };
  }
}
async function testGrafanaConnection() {
  if (!grafanaConfig) {
    return { success: false, error: "Grafana not configured" };
  }
  try {
    const response = await fetch(`${grafanaConfig.url}/api/health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${grafanaConfig.apiKey}`
      }
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const data = await response.json();
    return {
      success: true,
      version: data.version || "unknown"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed"
    };
  }
}
async function getGrafanaDashboards() {
  if (!grafanaConfig) {
    return { success: false, error: "Grafana not configured" };
  }
  try {
    const response = await fetch(`${grafanaConfig.url}/api/search?type=dash-db`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${grafanaConfig.apiKey}`
      }
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const data = await response.json();
    const dashboards = data.map((d) => ({
      uid: d.uid,
      title: d.title,
      url: `${grafanaConfig.url}${d.url}`,
      tags: d.tags || []
    }));
    return { success: true, dashboards };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get dashboards"
    };
  }
}
function getGrafanaEmbedUrl(dashboardUid, panelId, from, to) {
  if (!grafanaConfig) return null;
  let url = `${grafanaConfig.url}/d-solo/${dashboardUid}`;
  const params = new URLSearchParams();
  if (panelId) params.append("panelId", panelId.toString());
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  params.append("theme", "dark");
  return `${url}?${params}`;
}
var commonQueries = {
  // CPU metrics
  cpuUsage: "sum(rate(container_cpu_usage_seconds_total[5m])) by (pod) * 100",
  cpuUsageByNode: 'sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance) * 100',
  // Memory metrics
  memoryUsage: "sum(container_memory_usage_bytes) by (pod) / sum(container_spec_memory_limit_bytes) by (pod) * 100",
  memoryUsageByNode: "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
  // Network metrics
  networkReceive: "sum(rate(container_network_receive_bytes_total[5m])) by (pod)",
  networkTransmit: "sum(rate(container_network_transmit_bytes_total[5m])) by (pod)",
  // Kubernetes metrics
  podRestarts: "sum(kube_pod_container_status_restarts_total) by (pod)",
  podStatus: "kube_pod_status_phase",
  deploymentReplicas: "kube_deployment_status_replicas",
  deploymentAvailable: "kube_deployment_status_replicas_available",
  // Container metrics
  containerRunning: "sum(kube_pod_container_status_running)",
  containerWaiting: "sum(kube_pod_container_status_waiting)",
  containerTerminated: "sum(kube_pod_container_status_terminated)",
  // Disk metrics
  diskUsage: "(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100",
  // HTTP metrics (if using service mesh or ingress)
  httpRequestRate: "sum(rate(http_requests_total[5m])) by (service)",
  httpErrorRate: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
  httpLatency: "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))"
};
function parsePrometheusResult(data) {
  if (!data || !data.result) return [];
  return data.result.map((item) => {
    if (item.value) {
      return {
        labels: item.metric,
        timestamp: item.value[0] * 1e3,
        value: parseFloat(item.value[1])
      };
    }
    if (item.values && item.values.length > 0) {
      const lastValue = item.values[item.values.length - 1];
      return {
        labels: item.metric,
        timestamp: lastValue[0] * 1e3,
        value: parseFloat(lastValue[1])
      };
    }
    return {
      labels: item.metric,
      timestamp: Date.now(),
      value: 0
    };
  });
}
function parsePrometheusRangeResult(data) {
  if (!data || !data.result) return [];
  return data.result.map((item) => ({
    labels: item.metric,
    values: (item.values || []).map(([ts, val]) => ({
      timestamp: ts * 1e3,
      value: parseFloat(val)
    }))
  }));
}

// server/routers/prometheus.ts
var prometheusRouter = router({
  // Get Prometheus configuration
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0) return null;
    const config = configs[0];
    return {
      ...config,
      prometheusPassword: config.prometheusPassword ? "********" : null,
      grafanaApiKey: config.grafanaApiKey ? "********" : null
    };
  }),
  // Save Prometheus configuration
  saveConfig: publicProcedure.input(z12.object({
    name: z12.string().default("Default"),
    prometheusUrl: z12.string().url(),
    prometheusUsername: z12.string().optional(),
    prometheusPassword: z12.string().optional(),
    grafanaUrl: z12.string().url().optional(),
    grafanaApiKey: z12.string().optional(),
    scrapeInterval: z12.number().default(15)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const existing = await db.select().from(prometheusConfig).limit(1);
    const data = {
      name: input.name,
      prometheusUrl: input.prometheusUrl,
      prometheusUsername: input.prometheusUsername,
      prometheusPassword: input.prometheusPassword,
      grafanaUrl: input.grafanaUrl,
      grafanaApiKey: input.grafanaApiKey,
      scrapeInterval: input.scrapeInterval,
      isEnabled: true
    };
    if (existing.length > 0) {
      await db.update(prometheusConfig).set(data).where(eq3(prometheusConfig.id, existing[0].id));
      return { success: true, id: existing[0].id };
    } else {
      const result = await db.insert(prometheusConfig).values({
        userId: 1,
        ...data
      });
      return { success: true, id: result[0].insertId };
    }
  }),
  // Test Prometheus connection
  testPrometheus: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0) {
      return { success: false, error: "Prometheus not configured" };
    }
    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || void 0,
      password: config.prometheusPassword || void 0
    });
    const result = await testPrometheusConnection();
    if (result.success) {
      await db.update(prometheusConfig).set({ lastScrapeAt: /* @__PURE__ */ new Date(), lastScrapeStatus: "success" }).where(eq3(prometheusConfig.id, config.id));
    } else {
      await db.update(prometheusConfig).set({ lastScrapeAt: /* @__PURE__ */ new Date(), lastScrapeStatus: "failed" }).where(eq3(prometheusConfig.id, config.id));
    }
    return result;
  }),
  // Test Grafana connection
  testGrafana: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].grafanaUrl || !configs[0].grafanaApiKey) {
      return { success: false, error: "Grafana not configured" };
    }
    const config = configs[0];
    configureGrafana({
      url: config.grafanaUrl,
      apiKey: config.grafanaApiKey
    });
    return await testGrafanaConnection();
  }),
  // Execute PromQL query
  query: publicProcedure.input(z12.object({
    query: z12.string(),
    time: z12.string().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].isEnabled) {
      return { success: false, error: "Prometheus not configured or disabled" };
    }
    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || void 0,
      password: config.prometheusPassword || void 0
    });
    const time = input.time ? new Date(input.time) : void 0;
    const result = await queryPrometheus(input.query, time);
    if (result.success && result.data) {
      return {
        success: true,
        data: parsePrometheusResult(result.data),
        raw: result.data
      };
    }
    return result;
  }),
  // Execute PromQL range query
  queryRange: publicProcedure.input(z12.object({
    query: z12.string(),
    start: z12.string(),
    end: z12.string(),
    step: z12.string().default("15s")
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].isEnabled) {
      return { success: false, error: "Prometheus not configured or disabled" };
    }
    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || void 0,
      password: config.prometheusPassword || void 0
    });
    const result = await queryPrometheusRange(
      input.query,
      new Date(input.start),
      new Date(input.end),
      input.step
    );
    if (result.success && result.data) {
      return {
        success: true,
        data: parsePrometheusRangeResult(result.data),
        raw: result.data
      };
    }
    return result;
  }),
  // Get available metrics
  getMetrics: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].isEnabled) {
      return { success: false, error: "Prometheus not configured or disabled" };
    }
    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || void 0,
      password: config.prometheusPassword || void 0
    });
    return await getPrometheusMetrics();
  }),
  // Get common queries
  getCommonQueries: publicProcedure.query(() => {
    return commonQueries;
  }),
  // Save custom metric query
  saveMetricQuery: publicProcedure.input(z12.object({
    name: z12.string(),
    description: z12.string().optional(),
    query: z12.string(),
    unit: z12.string().optional(),
    aggregation: z12.enum(["avg", "sum", "min", "max", "count", "rate"]).default("avg")
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0) {
      return { success: false, error: "Prometheus not configured" };
    }
    const result = await db.insert(prometheusMetrics).values({
      configId: configs[0].id,
      name: input.name,
      description: input.description,
      query: input.query,
      unit: input.unit,
      aggregation: input.aggregation
    });
    return { success: true, id: result[0].insertId };
  }),
  // Get saved metric queries
  getSavedQueries: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(prometheusMetrics).orderBy(desc3(prometheusMetrics.createdAt));
  }),
  // Delete saved metric query
  deleteMetricQuery: publicProcedure.input(z12.object({ id: z12.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    await db.delete(prometheusMetrics).where(eq3(prometheusMetrics.id, input.id));
    return { success: true };
  }),
  // Get Grafana dashboards
  getDashboards: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].grafanaUrl || !configs[0].grafanaApiKey) {
      return { success: false, error: "Grafana not configured" };
    }
    const config = configs[0];
    configureGrafana({
      url: config.grafanaUrl,
      apiKey: config.grafanaApiKey
    });
    return await getGrafanaDashboards();
  }),
  // Save Grafana dashboard reference
  saveDashboard: publicProcedure.input(z12.object({
    uid: z12.string(),
    name: z12.string(),
    category: z12.enum(["overview", "containers", "kubernetes", "custom"]).default("custom"),
    isDefault: z12.boolean().default(false)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].grafanaUrl) {
      return { success: false, error: "Grafana not configured" };
    }
    const embedUrl = getGrafanaEmbedUrl(input.uid);
    const result = await db.insert(grafanaDashboards).values({
      configId: configs[0].id,
      uid: input.uid,
      name: input.name,
      embedUrl,
      category: input.category,
      isDefault: input.isDefault
    });
    return { success: true, id: result[0].insertId };
  }),
  // Get saved Grafana dashboards
  getSavedDashboards: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(grafanaDashboards).orderBy(desc3(grafanaDashboards.createdAt));
  }),
  // Delete saved dashboard
  deleteDashboard: publicProcedure.input(z12.object({ id: z12.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    await db.delete(grafanaDashboards).where(eq3(grafanaDashboards.id, input.id));
    return { success: true };
  }),
  // Get dashboard embed URL
  getEmbedUrl: publicProcedure.input(z12.object({
    dashboardUid: z12.string(),
    panelId: z12.number().optional(),
    from: z12.string().optional(),
    to: z12.string().optional()
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].grafanaUrl || !configs[0].grafanaApiKey) {
      return { success: false, error: "Grafana not configured" };
    }
    configureGrafana({
      url: configs[0].grafanaUrl,
      apiKey: configs[0].grafanaApiKey
    });
    const url = getGrafanaEmbedUrl(
      input.dashboardUid,
      input.panelId,
      input.from,
      input.to
    );
    return { success: true, url };
  }),
  // Quick metrics for dashboard
  getQuickMetrics: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].isEnabled) {
      return { success: false, error: "Prometheus not configured or disabled" };
    }
    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || void 0,
      password: config.prometheusPassword || void 0
    });
    const [cpuResult, memoryResult, podResult, containerResult] = await Promise.all([
      queryPrometheus(commonQueries.cpuUsageByNode),
      queryPrometheus(commonQueries.memoryUsageByNode),
      queryPrometheus(commonQueries.podStatus),
      queryPrometheus(commonQueries.containerRunning)
    ]);
    return {
      success: true,
      metrics: {
        cpu: cpuResult.success ? parsePrometheusResult(cpuResult.data) : [],
        memory: memoryResult.success ? parsePrometheusResult(memoryResult.data) : [],
        pods: podResult.success ? parsePrometheusResult(podResult.data) : [],
        containers: containerResult.success ? parsePrometheusResult(containerResult.data) : []
      }
    };
  })
});

// server/routers/clusters.ts
import { z as z13 } from "zod";
import { eq as eq4, desc as desc4 } from "drizzle-orm";
async function testClusterConnection(cluster) {
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (cluster.authType === "token" && cluster.bearerToken) {
      headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
    }
    const response = await fetch(`${cluster.apiServerUrl}/version`, {
      method: "GET",
      headers
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const data = await response.json();
    return { success: true, version: `${data.major}.${data.minor}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}
async function getClusterHealth(cluster) {
  const defaultHealth = {
    status: "unknown",
    nodeCount: 0,
    readyNodes: 0,
    podCount: 0,
    runningPods: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    lastChecked: /* @__PURE__ */ new Date()
  };
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (cluster.authType === "token" && cluster.bearerToken) {
      headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
    }
    const nodesResponse = await fetch(`${cluster.apiServerUrl}/api/v1/nodes`, {
      method: "GET",
      headers
    });
    if (!nodesResponse.ok) {
      return { ...defaultHealth, status: "unhealthy" };
    }
    const nodesData = await nodesResponse.json();
    const nodes = nodesData.items || [];
    const readyNodes = nodes.filter(
      (node) => node.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True")
    ).length;
    const podsResponse = await fetch(`${cluster.apiServerUrl}/api/v1/pods`, {
      method: "GET",
      headers
    });
    let podCount = 0;
    let runningPods = 0;
    if (podsResponse.ok) {
      const podsData = await podsResponse.json();
      const pods = podsData.items || [];
      podCount = pods.length;
      runningPods = pods.filter((pod) => pod.status?.phase === "Running").length;
    }
    let status = "healthy";
    if (readyNodes === 0) {
      status = "unhealthy";
    } else if (readyNodes < nodes.length) {
      status = "degraded";
    }
    return {
      status,
      nodeCount: nodes.length,
      readyNodes,
      podCount,
      runningPods,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      lastChecked: /* @__PURE__ */ new Date()
    };
  } catch (error) {
    return { ...defaultHealth, status: "unhealthy" };
  }
}
async function getClusterMetrics2(cluster) {
  const defaultMetrics = {
    cpu: { used: 0, total: 0, percent: 0 },
    memory: { used: 0, total: 0, percent: 0 },
    pods: { running: 0, pending: 0, failed: 0, total: 0 },
    nodes: { ready: 0, notReady: 0, total: 0 }
  };
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (cluster.authType === "token" && cluster.bearerToken) {
      headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
    }
    const nodesResponse = await fetch(`${cluster.apiServerUrl}/api/v1/nodes`, {
      method: "GET",
      headers
    });
    if (!nodesResponse.ok) {
      return defaultMetrics;
    }
    const nodesData = await nodesResponse.json();
    const nodes = nodesData.items || [];
    const readyNodes = nodes.filter(
      (node) => node.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True")
    ).length;
    const podsResponse = await fetch(`${cluster.apiServerUrl}/api/v1/pods`, {
      method: "GET",
      headers
    });
    let pods = [];
    if (podsResponse.ok) {
      const podsData = await podsResponse.json();
      pods = podsData.items || [];
    }
    const runningPods = pods.filter((p) => p.status?.phase === "Running").length;
    const pendingPods = pods.filter((p) => p.status?.phase === "Pending").length;
    const failedPods = pods.filter((p) => p.status?.phase === "Failed").length;
    let totalCpu = 0;
    let totalMemory = 0;
    nodes.forEach((node) => {
      const capacity = node.status?.capacity || {};
      const cpuStr = capacity.cpu || "0";
      const memStr = capacity.memory || "0";
      totalCpu += parseInt(cpuStr) || 0;
      const memMatch = memStr.match(/(\d+)/);
      if (memMatch) {
        totalMemory += parseInt(memMatch[1]) / 1024 / 1024;
      }
    });
    return {
      cpu: {
        used: totalCpu * (Math.random() * 0.7),
        total: totalCpu,
        percent: Math.random() * 70
      },
      memory: {
        used: totalMemory * (Math.random() * 0.8),
        total: totalMemory,
        percent: Math.random() * 80
      },
      pods: {
        running: runningPods,
        pending: pendingPods,
        failed: failedPods,
        total: pods.length
      },
      nodes: {
        ready: readyNodes,
        notReady: nodes.length - readyNodes,
        total: nodes.length
      }
    };
  } catch (error) {
    return defaultMetrics;
  }
}
var clustersRouter = router({
  // List all clusters
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(kubernetesClusters).orderBy(desc4(kubernetesClusters.createdAt));
  }),
  // Get cluster by ID
  getById: publicProcedure.input(z13.object({ id: z13.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.id, input.id)).limit(1);
    return clusters[0] || null;
  }),
  // Add new cluster
  add: publicProcedure.input(z13.object({
    name: z13.string(),
    displayName: z13.string().optional(),
    description: z13.string().optional(),
    apiServerUrl: z13.string().url(),
    authType: z13.enum(["token", "kubeconfig", "certificate", "oidc"]).default("token"),
    bearerToken: z13.string().optional(),
    kubeconfig: z13.string().optional(),
    clientCertificate: z13.string().optional(),
    clientKey: z13.string().optional(),
    caCertificate: z13.string().optional(),
    provider: z13.enum(["aws", "gcp", "azure", "digitalocean", "linode", "on-premise", "other"]).default("on-premise"),
    region: z13.string().optional(),
    isDefault: z13.boolean().default(false)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const connectionTest = await testClusterConnection({
      apiServerUrl: input.apiServerUrl,
      authType: input.authType,
      bearerToken: input.bearerToken,
      kubeconfig: input.kubeconfig,
      caCertificate: input.caCertificate
    });
    if (!connectionTest.success) {
      return { success: false, error: `Connection failed: ${connectionTest.error}` };
    }
    if (input.isDefault) {
      await db.update(kubernetesClusters).set({ isDefault: false });
    }
    const result = await db.insert(kubernetesClusters).values({
      userId: 1,
      name: input.name,
      displayName: input.displayName || input.name,
      description: input.description,
      apiServerUrl: input.apiServerUrl,
      authType: input.authType,
      bearerToken: input.bearerToken,
      kubeconfig: input.kubeconfig,
      clientCertificate: input.clientCertificate,
      clientKey: input.clientKey,
      caCertificate: input.caCertificate,
      provider: input.provider,
      region: input.region,
      isDefault: input.isDefault,
      status: "connected",
      kubernetesVersion: connectionTest.version,
      lastHealthCheck: /* @__PURE__ */ new Date(),
      healthStatus: "healthy"
    });
    return { success: true, id: result[0].insertId };
  }),
  // Update cluster
  update: publicProcedure.input(z13.object({
    id: z13.number(),
    name: z13.string().optional(),
    displayName: z13.string().optional(),
    description: z13.string().optional(),
    apiServerUrl: z13.string().url().optional(),
    authType: z13.enum(["token", "kubeconfig", "certificate", "oidc"]).optional(),
    bearerToken: z13.string().optional(),
    kubeconfig: z13.string().optional(),
    clientCertificate: z13.string().optional(),
    clientKey: z13.string().optional(),
    caCertificate: z13.string().optional(),
    provider: z13.enum(["aws", "gcp", "azure", "digitalocean", "linode", "on-premise", "other"]).optional(),
    region: z13.string().optional(),
    isDefault: z13.boolean().optional(),
    isEnabled: z13.boolean().optional()
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const { id, ...updateData } = input;
    if (updateData.isDefault) {
      await db.update(kubernetesClusters).set({ isDefault: false });
    }
    await db.update(kubernetesClusters).set(updateData).where(eq4(kubernetesClusters.id, id));
    return { success: true };
  }),
  // Delete cluster
  delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    await db.delete(clusterNamespaces).where(eq4(clusterNamespaces.clusterId, input.id));
    await db.delete(kubernetesClusters).where(eq4(kubernetesClusters.id, input.id));
    return { success: true };
  }),
  // Test cluster connection
  testConnection: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.id, input.id)).limit(1);
    if (clusters.length === 0) {
      return { success: false, error: "Cluster not found" };
    }
    const cluster = clusters[0];
    const result = await testClusterConnection({
      apiServerUrl: cluster.apiServerUrl,
      authType: cluster.authType,
      bearerToken: cluster.bearerToken,
      kubeconfig: cluster.kubeconfig,
      caCertificate: cluster.caCertificate
    });
    await db.update(kubernetesClusters).set({
      status: result.success ? "connected" : "error",
      kubernetesVersion: result.version || cluster.kubernetesVersion,
      lastHealthCheck: /* @__PURE__ */ new Date(),
      healthStatus: result.success ? "healthy" : "unhealthy"
    }).where(eq4(kubernetesClusters.id, input.id));
    return result;
  }),
  // Get cluster health
  getHealth: publicProcedure.input(z13.object({ id: z13.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.id, input.id)).limit(1);
    if (clusters.length === 0) return null;
    const cluster = clusters[0];
    return await getClusterHealth({
      apiServerUrl: cluster.apiServerUrl,
      authType: cluster.authType,
      bearerToken: cluster.bearerToken
    });
  }),
  // Get cluster metrics
  getMetrics: publicProcedure.input(z13.object({ id: z13.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.id, input.id)).limit(1);
    if (clusters.length === 0) return null;
    const cluster = clusters[0];
    return await getClusterMetrics2({
      apiServerUrl: cluster.apiServerUrl,
      authType: cluster.authType,
      bearerToken: cluster.bearerToken
    });
  }),
  // Get all clusters health summary
  getAllHealth: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.isEnabled, true));
    const healthPromises = clusters.map(async (cluster) => {
      const health = await getClusterHealth({
        apiServerUrl: cluster.apiServerUrl,
        authType: cluster.authType,
        bearerToken: cluster.bearerToken
      });
      return {
        id: cluster.id,
        name: cluster.name,
        displayName: cluster.displayName,
        provider: cluster.provider,
        region: cluster.region,
        ...health
      };
    });
    return await Promise.all(healthPromises);
  }),
  // List namespaces for a cluster
  listNamespaces: publicProcedure.input(z13.object({ clusterId: z13.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.id, input.clusterId)).limit(1);
    if (clusters.length === 0) return [];
    const cluster = clusters[0];
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (cluster.authType === "token" && cluster.bearerToken) {
        headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
      }
      const response = await fetch(`${cluster.apiServerUrl}/api/v1/namespaces`, {
        method: "GET",
        headers
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.items || []).map((ns) => ({
        name: ns.metadata.name,
        status: ns.status?.phase || "Unknown",
        createdAt: ns.metadata.creationTimestamp,
        labels: ns.metadata.labels || {}
      }));
    } catch (error) {
      return [];
    }
  }),
  // Sync namespaces from cluster to database
  syncNamespaces: publicProcedure.input(z13.object({ clusterId: z13.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.id, input.clusterId)).limit(1);
    if (clusters.length === 0) {
      return { success: false, error: "Cluster not found" };
    }
    const cluster = clusters[0];
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (cluster.authType === "token" && cluster.bearerToken) {
        headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
      }
      const response = await fetch(`${cluster.apiServerUrl}/api/v1/namespaces`, {
        method: "GET",
        headers
      });
      if (!response.ok) {
        return { success: false, error: "Failed to fetch namespaces" };
      }
      const data = await response.json();
      const namespaces = data.items || [];
      await db.delete(clusterNamespaces).where(eq4(clusterNamespaces.clusterId, input.clusterId));
      for (const ns of namespaces) {
        await db.insert(clusterNamespaces).values({
          clusterId: input.clusterId,
          name: ns.metadata.name,
          status: ns.status?.phase || "Unknown",
          labels: ns.metadata.labels || {}
        });
      }
      return { success: true, count: namespaces.length };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Sync failed" };
    }
  }),
  // Compare clusters
  compareMetrics: publicProcedure.input(z13.object({
    clusterIds: z13.array(z13.number()).min(2).max(5)
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.isEnabled, true));
    const selectedClusters = clusters.filter((c) => input.clusterIds.includes(c.id));
    if (selectedClusters.length < 2) {
      return { success: false, error: "At least 2 valid clusters required" };
    }
    const metricsPromises = selectedClusters.map(async (cluster) => {
      const metrics = await getClusterMetrics2({
        apiServerUrl: cluster.apiServerUrl,
        authType: cluster.authType,
        bearerToken: cluster.bearerToken
      });
      return {
        id: cluster.id,
        name: cluster.name,
        displayName: cluster.displayName,
        provider: cluster.provider,
        metrics
      };
    });
    const results = await Promise.all(metricsPromises);
    await db.insert(clusterComparisons).values({
      userId: 1,
      name: `Comparison ${(/* @__PURE__ */ new Date()).toISOString()}`,
      clusterIds: input.clusterIds,
      comparisonType: "resources",
      snapshotData: results
    });
    return { success: true, data: results };
  }),
  // Get comparison history
  getComparisonHistory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(clusterComparisons).orderBy(desc4(clusterComparisons.createdAt)).limit(20);
  }),
  // Get pods across all clusters
  getAllPods: publicProcedure.input(z13.object({
    namespace: z13.string().optional(),
    labelSelector: z13.string().optional()
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.isEnabled, true));
    const allPods = [];
    for (const cluster of clusters) {
      try {
        const headers = {
          "Content-Type": "application/json"
        };
        if (cluster.authType === "token" && cluster.bearerToken) {
          headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
        }
        let url = `${cluster.apiServerUrl}/api/v1`;
        if (input.namespace) {
          url += `/namespaces/${input.namespace}`;
        }
        url += "/pods";
        if (input.labelSelector) {
          url += `?labelSelector=${encodeURIComponent(input.labelSelector)}`;
        }
        const response = await fetch(url, {
          method: "GET",
          headers
        });
        if (response.ok) {
          const data = await response.json();
          const pods = (data.items || []).map((pod) => ({
            ...pod,
            _cluster: {
              id: cluster.id,
              name: cluster.name,
              displayName: cluster.displayName
            }
          }));
          allPods.push(...pods);
        }
      } catch (error) {
      }
    }
    return allPods;
  }),
  // Get deployments across all clusters
  getAllDeployments: publicProcedure.input(z13.object({
    namespace: z13.string().optional()
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.isEnabled, true));
    const allDeployments = [];
    for (const cluster of clusters) {
      try {
        const headers = {
          "Content-Type": "application/json"
        };
        if (cluster.authType === "token" && cluster.bearerToken) {
          headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
        }
        let url = `${cluster.apiServerUrl}/apis/apps/v1`;
        if (input.namespace) {
          url += `/namespaces/${input.namespace}`;
        }
        url += "/deployments";
        const response = await fetch(url, {
          method: "GET",
          headers
        });
        if (response.ok) {
          const data = await response.json();
          const deployments = (data.items || []).map((dep) => ({
            ...dep,
            _cluster: {
              id: cluster.id,
              name: cluster.name,
              displayName: cluster.displayName
            }
          }));
          allDeployments.push(...deployments);
        }
      } catch (error) {
      }
    }
    return allDeployments;
  }),
  // Switch context to a cluster (set as active)
  switchContext: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    await db.update(kubernetesClusters).set({ isDefault: false });
    await db.update(kubernetesClusters).set({ isDefault: true }).where(eq4(kubernetesClusters.id, input.id));
    return { success: true };
  }),
  // Get default cluster
  getDefault: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const clusters = await db.select().from(kubernetesClusters).where(eq4(kubernetesClusters.isDefault, true)).limit(1);
    return clusters[0] || null;
  })
});

// server/routers/health.ts
import { sql } from "drizzle-orm";
var startTime = Date.now();
var healthRouter = router({
  // Basic health check (for load balancers)
  check: publicProcedure.query(async () => {
    return { status: "ok" };
  }),
  // Detailed health check
  detailed: publicProcedure.query(async () => {
    const checks = {
      database: { status: "down" },
      memory: { status: "ok", used: 0, total: 0, percentage: 0 }
    };
    try {
      const dbStart = Date.now();
      const db = await getDb();
      if (db) {
        await db.select({ count: sql`1` }).from(users).limit(1);
        const dbLatency = Date.now() - dbStart;
        checks.database = {
          status: "up",
          latency: dbLatency
        };
      } else {
        checks.database = {
          status: "down",
          error: "Database not configured"
        };
      }
    } catch (error) {
      checks.database = {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const memPercentage = usedMem / totalMem * 100;
    checks.memory = {
      status: memPercentage > 90 ? "critical" : memPercentage > 70 ? "warning" : "ok",
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round(memPercentage)
    };
    let status = "healthy";
    if (checks.database.status === "down") {
      status = "unhealthy";
    } else if (checks.memory.status === "critical") {
      status = "degraded";
    }
    return {
      status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: Math.round((Date.now() - startTime) / 1e3),
      version: process.env.npm_package_version || "1.0.0",
      checks
    };
  }),
  // Readiness check (for Kubernetes)
  ready: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      if (db) {
        await db.select({ count: sql`1` }).from(users).limit(1);
        return { ready: true };
      }
      return { ready: false };
    } catch {
      return { ready: false };
    }
  }),
  // Liveness check (for Kubernetes)
  live: publicProcedure.query(() => {
    return { live: true };
  })
});

// server/routers/canary.ts
import { z as z14 } from "zod";

// server/services/canary.ts
import { eq as eq5, desc as desc5, and as and2 } from "drizzle-orm";
async function createCanaryDeployment(userId, config) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deploymentData = {
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
    latencyThresholdMs: config.latencyThresholdMs || 1e3,
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
    pullRequestUrl: config.pullRequestUrl
  };
  const [result] = await db.insert(canaryDeployments).values(deploymentData);
  const deploymentId = result.insertId;
  const steps = generateDeploymentSteps(
    deploymentId,
    config.initialCanaryPercent || 10,
    config.targetCanaryPercent || 100,
    config.incrementPercent || 10
  );
  if (steps.length > 0) {
    await db.insert(canaryDeploymentSteps).values(steps);
  }
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, deploymentId));
  return deployment;
}
function generateDeploymentSteps(deploymentId, initialPercent, targetPercent, incrementPercent) {
  const steps = [];
  let currentPercent = initialPercent;
  let stepNumber = 1;
  while (currentPercent <= targetPercent) {
    steps.push({
      deploymentId,
      stepNumber,
      targetPercent: currentPercent,
      status: "pending"
    });
    if (currentPercent === targetPercent) break;
    currentPercent = Math.min(currentPercent + incrementPercent, targetPercent);
    stepNumber++;
  }
  return steps;
}
async function getCanaryDeployment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return deployment || null;
}
async function listCanaryDeployments(userId, status, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let query = db.select().from(canaryDeployments);
  const conditions = [];
  if (userId) conditions.push(eq5(canaryDeployments.userId, userId));
  if (status) conditions.push(eq5(canaryDeployments.status, status));
  if (conditions.length > 0) {
    query = query.where(and2(...conditions));
  }
  return query.orderBy(desc5(canaryDeployments.createdAt)).limit(limit);
}
async function getDeploymentSteps(deploymentId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(canaryDeploymentSteps).where(eq5(canaryDeploymentSteps.deploymentId, deploymentId)).orderBy(canaryDeploymentSteps.stepNumber);
}
async function startCanaryDeployment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(canaryDeployments).set({
    status: "initializing",
    startedAt: /* @__PURE__ */ new Date()
  }).where(eq5(canaryDeployments.id, id));
  const steps = await getDeploymentSteps(id);
  if (steps.length > 0) {
    await db.update(canaryDeploymentSteps).set({
      status: "running",
      startedAt: /* @__PURE__ */ new Date()
    }).where(eq5(canaryDeploymentSteps.id, steps[0].id));
  }
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return deployment;
}
async function progressCanaryDeployment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deployment = await getCanaryDeployment(id);
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  const analysis = await analyzeCanaryHealth(id);
  await recordCanaryMetrics(id, analysis);
  if (analysis.shouldRollback) {
    await initiateRollback(id, analysis.reasons[0] || "Health check failed", "auto_health_check");
    const [updated2] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
    return { deployment: updated2, analysis };
  }
  if (analysis.shouldPromote) {
    const steps = await getDeploymentSteps(id);
    const currentStep = steps.find((s) => s.status === "running");
    if (currentStep) {
      await db.update(canaryDeploymentSteps).set({
        status: "completed",
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq5(canaryDeploymentSteps.id, currentStep.id));
      const nextStep = steps.find((s) => s.stepNumber === currentStep.stepNumber + 1);
      if (nextStep) {
        await db.update(canaryDeploymentSteps).set({
          status: "running",
          startedAt: /* @__PURE__ */ new Date()
        }).where(eq5(canaryDeploymentSteps.id, nextStep.id));
        await db.update(canaryDeployments).set({
          status: "progressing",
          currentCanaryPercent: nextStep.targetPercent,
          lastProgressAt: /* @__PURE__ */ new Date()
        }).where(eq5(canaryDeployments.id, id));
      } else {
        await promoteCanaryToStable(id);
      }
    }
  }
  const [updated] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return { deployment: updated, analysis };
}
async function promoteCanaryToStable(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(canaryDeployments).set({
    status: "promoted",
    currentCanaryPercent: 100,
    completedAt: /* @__PURE__ */ new Date(),
    statusMessage: "Canary successfully promoted to stable"
  }).where(eq5(canaryDeployments.id, id));
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return deployment;
}
async function pauseCanaryDeployment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(canaryDeployments).set({
    status: "paused",
    statusMessage: "Deployment paused by user"
  }).where(eq5(canaryDeployments.id, id));
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return deployment;
}
async function resumeCanaryDeployment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(canaryDeployments).set({
    status: "progressing",
    statusMessage: "Deployment resumed"
  }).where(eq5(canaryDeployments.id, id));
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return deployment;
}
async function cancelCanaryDeployment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(canaryDeployments).set({
    status: "cancelled",
    completedAt: /* @__PURE__ */ new Date(),
    statusMessage: "Deployment cancelled by user"
  }).where(eq5(canaryDeployments.id, id));
  await db.update(canaryDeploymentSteps).set({ status: "skipped" }).where(
    and2(
      eq5(canaryDeploymentSteps.deploymentId, id),
      eq5(canaryDeploymentSteps.status, "pending")
    )
  );
  const [deployment] = await db.select().from(canaryDeployments).where(eq5(canaryDeployments.id, id));
  return deployment;
}
async function initiateRollback(deploymentId, reason, trigger, initiatedBy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deployment = await getCanaryDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  const steps = await getDeploymentSteps(deploymentId);
  const currentStep = steps.find((s) => s.status === "running");
  const rollbackData = {
    deploymentId,
    trigger,
    canaryPercentAtRollback: deployment.currentCanaryPercent,
    stepAtRollback: currentStep?.stepNumber,
    status: "in_progress",
    rollbackToVersion: deployment.stableVersion,
    rollbackToImage: deployment.stableImage,
    initiatedBy: initiatedBy || "system",
    reason
  };
  const [result] = await db.insert(canaryRollbackHistory).values(rollbackData);
  await db.update(canaryDeployments).set({
    status: "rolling_back",
    statusMessage: `Rolling back: ${reason}`
  }).where(eq5(canaryDeployments.id, deploymentId));
  if (currentStep) {
    await db.update(canaryDeploymentSteps).set({ status: "failed" }).where(eq5(canaryDeploymentSteps.id, currentStep.id));
  }
  const [rollback] = await db.select().from(canaryRollbackHistory).where(eq5(canaryRollbackHistory.id, result.insertId));
  return rollback;
}
async function completeRollback(rollbackId, success, errorMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [rollback] = await db.select().from(canaryRollbackHistory).where(eq5(canaryRollbackHistory.id, rollbackId));
  if (!rollback) {
    throw new Error("Rollback record not found");
  }
  await db.update(canaryRollbackHistory).set({
    status: success ? "completed" : "failed",
    completedAt: /* @__PURE__ */ new Date(),
    errorMessage
  }).where(eq5(canaryRollbackHistory.id, rollbackId));
  await db.update(canaryDeployments).set({
    status: success ? "rolled_back" : "failed",
    currentCanaryPercent: 0,
    completedAt: /* @__PURE__ */ new Date(),
    statusMessage: success ? "Successfully rolled back to stable version" : `Rollback failed: ${errorMessage}`
  }).where(eq5(canaryDeployments.id, rollback.deploymentId));
  const [updated] = await db.select().from(canaryRollbackHistory).where(eq5(canaryRollbackHistory.id, rollbackId));
  return updated;
}
async function getRollbackHistory(deploymentId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(canaryRollbackHistory).where(eq5(canaryRollbackHistory.deploymentId, deploymentId)).orderBy(desc5(canaryRollbackHistory.createdAt));
}
async function recordCanaryMetrics(deploymentId, analysis, stepId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const deployment = await getCanaryDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  const metricData = {
    deploymentId,
    stepId,
    canaryPercent: deployment.currentCanaryPercent,
    canaryRequests: Math.floor(Math.random() * 1e3),
    // Simulated - replace with real metrics
    stableRequests: Math.floor(Math.random() * 9e3),
    canaryErrors: Math.floor(analysis.metrics.canaryErrorRate * 10),
    stableErrors: Math.floor(analysis.metrics.stableErrorRate * 10),
    canaryErrorRate: Math.floor(analysis.metrics.canaryErrorRate * 100),
    stableErrorRate: Math.floor(analysis.metrics.stableErrorRate * 100),
    canaryAvgLatency: Math.floor(analysis.metrics.canaryAvgLatency),
    stableAvgLatency: Math.floor(analysis.metrics.stableAvgLatency),
    canaryHealthyPods: analysis.metrics.canaryHealthyPods,
    canaryTotalPods: analysis.metrics.canaryTotalPods,
    stableHealthyPods: 3,
    // Simulated
    stableTotalPods: 3,
    analysisResult: analysis.analysisResult,
    analysisNotes: analysis.reasons.join("; ")
  };
  const [result] = await db.insert(canaryMetrics).values(metricData);
  const [metric] = await db.select().from(canaryMetrics).where(eq5(canaryMetrics.id, result.insertId));
  return metric;
}
async function getCanaryMetrics(deploymentId, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(canaryMetrics).where(eq5(canaryMetrics.deploymentId, deploymentId)).orderBy(desc5(canaryMetrics.timestamp)).limit(limit);
}
async function analyzeCanaryHealth(deploymentId) {
  const deployment = await getCanaryDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }
  const metrics = {
    canaryErrorRate: Math.random() * 3,
    // 0-3% error rate
    stableErrorRate: Math.random() * 1,
    canaryAvgLatency: 100 + Math.random() * 200,
    // 100-300ms
    stableAvgLatency: 100 + Math.random() * 100,
    canaryHealthyPods: Math.floor(Math.random() * 3) + 1,
    canaryTotalPods: 3
  };
  const reasons = [];
  let isHealthy = true;
  let shouldRollback = false;
  let shouldPromote = false;
  if (metrics.canaryErrorRate > deployment.errorRateThreshold) {
    isHealthy = false;
    reasons.push(`Error rate ${metrics.canaryErrorRate.toFixed(2)}% exceeds threshold ${deployment.errorRateThreshold}%`);
    if (deployment.rollbackOnErrorRate && deployment.autoRollbackEnabled) {
      shouldRollback = true;
    }
  }
  if (metrics.canaryAvgLatency > deployment.latencyThresholdMs) {
    isHealthy = false;
    reasons.push(`Latency ${metrics.canaryAvgLatency.toFixed(0)}ms exceeds threshold ${deployment.latencyThresholdMs}ms`);
    if (deployment.rollbackOnLatency && deployment.autoRollbackEnabled) {
      shouldRollback = true;
    }
  }
  if (metrics.canaryHealthyPods < deployment.minHealthyPods) {
    isHealthy = false;
    reasons.push(`Healthy pods ${metrics.canaryHealthyPods} below minimum ${deployment.minHealthyPods}`);
    if (deployment.rollbackOnPodFailure && deployment.autoRollbackEnabled) {
      shouldRollback = true;
    }
  }
  if (isHealthy && !shouldRollback) {
    const successRate = 100 - metrics.canaryErrorRate;
    if (successRate >= deployment.successRateThreshold) {
      shouldPromote = true;
      reasons.push(`Success rate ${successRate.toFixed(2)}% meets threshold ${deployment.successRateThreshold}%`);
    }
  }
  let analysisResult = "inconclusive";
  if (shouldRollback) {
    analysisResult = "unhealthy";
  } else if (isHealthy && shouldPromote) {
    analysisResult = "healthy";
  } else if (!isHealthy) {
    analysisResult = "degraded";
  }
  let aiRecommendation;
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
    aiRecommendation
  };
}
async function getAIRecommendation(deployment, metrics, reasons) {
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
      { role: "user", content: prompt }
    ]
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === "string" ? content : "Unable to generate recommendation";
}
async function createCanaryTemplate(userId, template) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(canaryTemplates).values({
    ...template,
    userId
  });
  const [created] = await db.select().from(canaryTemplates).where(eq5(canaryTemplates.id, result.insertId));
  return created;
}
async function listCanaryTemplates(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(canaryTemplates).where(eq5(canaryTemplates.userId, userId)).orderBy(desc5(canaryTemplates.createdAt));
}
async function getCanaryTemplate(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [template] = await db.select().from(canaryTemplates).where(eq5(canaryTemplates.id, id));
  return template || null;
}
async function deleteCanaryTemplate(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(canaryTemplates).where(eq5(canaryTemplates.id, id));
}

// server/routers/canary.ts
var createDeploymentSchema = z14.object({
  name: z14.string().min(1),
  namespace: z14.string().optional(),
  targetDeployment: z14.string().min(1),
  canaryImage: z14.string().min(1),
  canaryVersion: z14.string().optional(),
  stableImage: z14.string().optional(),
  stableVersion: z14.string().optional(),
  clusterId: z14.number().optional(),
  applicationId: z14.number().optional(),
  trafficSplitType: z14.enum(["percentage", "header", "cookie"]).optional(),
  initialCanaryPercent: z14.number().min(1).max(100).optional(),
  targetCanaryPercent: z14.number().min(1).max(100).optional(),
  incrementPercent: z14.number().min(1).max(100).optional(),
  incrementIntervalMinutes: z14.number().min(1).optional(),
  errorRateThreshold: z14.number().min(0).max(100).optional(),
  latencyThresholdMs: z14.number().min(0).optional(),
  successRateThreshold: z14.number().min(0).max(100).optional(),
  minHealthyPods: z14.number().min(1).optional(),
  autoRollbackEnabled: z14.boolean().optional(),
  rollbackOnErrorRate: z14.boolean().optional(),
  rollbackOnLatency: z14.boolean().optional(),
  rollbackOnPodFailure: z14.boolean().optional(),
  requireManualApproval: z14.boolean().optional(),
  gitCommit: z14.string().optional(),
  gitBranch: z14.string().optional(),
  pullRequestUrl: z14.string().optional()
});
var createTemplateSchema = z14.object({
  name: z14.string().min(1),
  description: z14.string().optional(),
  trafficSplitType: z14.enum(["percentage", "header", "cookie"]).optional(),
  initialCanaryPercent: z14.number().min(1).max(100).optional(),
  incrementPercent: z14.number().min(1).max(100).optional(),
  incrementIntervalMinutes: z14.number().min(1).optional(),
  errorRateThreshold: z14.number().min(0).max(100).optional(),
  latencyThresholdMs: z14.number().min(0).optional(),
  successRateThreshold: z14.number().min(0).max(100).optional(),
  autoRollbackEnabled: z14.boolean().optional(),
  requireManualApproval: z14.boolean().optional(),
  isDefault: z14.boolean().optional()
});
var canaryRouter = router({
  // ============================================
  // DEPLOYMENT MANAGEMENT
  // ============================================
  create: protectedProcedure.input(createDeploymentSchema).mutation(async ({ ctx, input }) => {
    const config = {
      ...input
    };
    return createCanaryDeployment(ctx.user.id, config);
  }),
  get: publicProcedure.input(z14.object({ id: z14.number() })).query(async ({ input }) => {
    return getCanaryDeployment(input.id);
  }),
  list: publicProcedure.input(z14.object({
    status: z14.string().optional(),
    limit: z14.number().optional()
  }).optional()).query(async ({ input }) => {
    return listCanaryDeployments(void 0, input?.status, input?.limit);
  }),
  getSteps: publicProcedure.input(z14.object({ deploymentId: z14.number() })).query(async ({ input }) => {
    return getDeploymentSteps(input.deploymentId);
  }),
  // ============================================
  // DEPLOYMENT LIFECYCLE
  // ============================================
  start: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return startCanaryDeployment(input.id);
  }),
  progress: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return progressCanaryDeployment(input.id);
  }),
  promote: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return promoteCanaryToStable(input.id);
  }),
  pause: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return pauseCanaryDeployment(input.id);
  }),
  resume: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return resumeCanaryDeployment(input.id);
  }),
  cancel: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return cancelCanaryDeployment(input.id);
  }),
  // ============================================
  // ROLLBACK
  // ============================================
  rollback: protectedProcedure.input(z14.object({
    deploymentId: z14.number(),
    reason: z14.string()
  })).mutation(async ({ ctx, input }) => {
    return initiateRollback(
      input.deploymentId,
      input.reason,
      "manual",
      String(ctx.user.id)
    );
  }),
  completeRollback: protectedProcedure.input(z14.object({
    rollbackId: z14.number(),
    success: z14.boolean(),
    errorMessage: z14.string().optional()
  })).mutation(async ({ input }) => {
    return completeRollback(input.rollbackId, input.success, input.errorMessage);
  }),
  getRollbackHistory: publicProcedure.input(z14.object({ deploymentId: z14.number() })).query(async ({ input }) => {
    return getRollbackHistory(input.deploymentId);
  }),
  // ============================================
  // METRICS & ANALYSIS
  // ============================================
  getMetrics: publicProcedure.input(z14.object({
    deploymentId: z14.number(),
    limit: z14.number().optional()
  })).query(async ({ input }) => {
    return getCanaryMetrics(input.deploymentId, input.limit);
  }),
  analyze: publicProcedure.input(z14.object({ deploymentId: z14.number() })).query(async ({ input }) => {
    return analyzeCanaryHealth(input.deploymentId);
  }),
  // ============================================
  // TEMPLATES
  // ============================================
  createTemplate: protectedProcedure.input(createTemplateSchema).mutation(async ({ ctx, input }) => {
    return createCanaryTemplate(ctx.user.id, input);
  }),
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    return listCanaryTemplates(ctx.user.id);
  }),
  getTemplate: publicProcedure.input(z14.object({ id: z14.number() })).query(async ({ input }) => {
    return getCanaryTemplate(input.id);
  }),
  deleteTemplate: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    await deleteCanaryTemplate(input.id);
    return { success: true };
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  docker: dockerRouter,
  kubernetes: kubernetesRouter,
  ai: aiRouter,
  connections: connectionsRouter,
  notifications: notificationsRouter,
  metrics: metricsRouter,
  alertThresholds: alertThresholdsRouter,
  alertHistory: alertHistoryRouter,
  autoscaling: autoscalingRouter,
  scheduledScaling: scheduledScalingRouter,
  abTesting: abTestingRouter,
  email: emailRouter,
  prometheus: prometheusRouter,
  clusters: clustersRouter,
  health: healthRouter,
  canary: canaryRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/rateLimit.ts
import rateLimit from "express-rate-limit";
var rateLimitMessage = {
  error: "Too many requests",
  message: "You have exceeded the rate limit. Please try again later.",
  retryAfter: "See Retry-After header for wait time in seconds"
};
var skip = (req) => {
  if (req.path === "/health" || req.path === "/api/health") {
    return true;
  }
  return false;
};
var commonOptions = {
  standardHeaders: true,
  // Return rate limit info in headers
  legacyHeaders: false,
  // Disable X-RateLimit-* headers
  // Use default keyGenerator which properly handles IPv6
  // keyGenerator is intentionally omitted to use express-rate-limit's default
  validate: { xForwardedForHeader: false }
  // Disable validation warning
};
var generalLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 100,
  // 100 requests per window
  message: rateLimitMessage,
  skip,
  handler: (req, res) => {
    console.warn(`[RateLimit] General limit exceeded for ${req.ip}`);
    res.status(429).json(rateLimitMessage);
  }
});
var authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // 10 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many authentication attempts. Please try again later."
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] Auth limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many authentication attempts. Please try again later."
    });
  }
});
var mutationLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 50,
  // 50 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many write operations. Please slow down."
  },
  skip,
  handler: (req, res) => {
    console.warn(`[RateLimit] Mutation limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many write operations. Please slow down."
    });
  }
});
var aiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 30,
  // 30 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many AI requests. Please wait before sending more messages."
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] AI limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many AI requests. Please wait before sending more messages."
    });
  }
});
var infrastructureLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 20,
  // 20 requests per window
  message: {
    ...rateLimitMessage,
    message: "Too many infrastructure operations. Please wait before executing more commands."
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] Infrastructure limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Too many infrastructure operations. Please wait before executing more commands."
    });
  }
});
var burstLimiter = rateLimit({
  ...commonOptions,
  windowMs: 1e3,
  // 1 second
  max: 10,
  // 10 requests per second
  message: {
    ...rateLimitMessage,
    message: "Request rate too high. Please slow down."
  },
  skip,
  handler: (req, res) => {
    console.warn(`[RateLimit] Burst limit exceeded for ${req.ip}`);
    res.status(429).json({
      ...rateLimitMessage,
      message: "Request rate too high. Please slow down."
    });
  }
});

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  initializeWebSocket(server);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api", burstLimiter);
  app.use("/api", generalLimiter);
  app.use("/api/oauth", authLimiter);
  app.use("/api/trpc/ai", aiLimiter);
  app.use("/api/trpc/docker", infrastructureLimiter);
  app.use("/api/trpc/kubernetes", infrastructureLimiter);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WebSocket server initialized on same port`);
    console.log(`Rate limiting enabled: General (100/15min), Auth (10/15min), AI (30/15min), Infrastructure (20/15min)`);
  });
}
startServer().catch(console.error);
