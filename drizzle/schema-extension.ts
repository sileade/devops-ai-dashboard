import { mysqlTable, int, varchar, text, timestamp, json, boolean, decimal, mysqlEnum } from "drizzle-orm/mysql-core";

// ==================== INCIDENT COMMANDER ====================

export const incidents = mysqlTable("incidents", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low"]).notNull(),
  status: mysqlEnum("status", ["detected", "investigating", "mitigating", "resolved"]).notNull().default("detected"),
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  rootCause: text("root_cause"),
  affectedResources: json("affected_resources"),
  aiAnalysis: text("ai_analysis"),
  assignedTo: int("assigned_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const incidentActions = mysqlTable("incident_actions", {
  id: int("id").primaryKey().autoincrement(),
  incidentId: int("incident_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  description: text("description"),
  executedBy: mysqlEnum("executed_by", ["ai", "human"]).notNull(),
  status: mysqlEnum("status", ["pending", "executing", "completed", "failed"]).notNull(),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const runbooks = mysqlTable("runbooks", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerConditions: json("trigger_conditions"),
  steps: json("steps").notNull(),
  autoExecute: boolean("auto_execute").default(false),
  requiresApproval: boolean("requires_approval").default(true),
  cooldownSeconds: int("cooldown_seconds").default(300),
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: int("execution_count").default(0),
  successCount: int("success_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const runbookExecutions = mysqlTable("runbook_executions", {
  id: int("id").primaryKey().autoincrement(),
  runbookId: int("runbook_id").notNull(),
  incidentId: int("incident_id"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).notNull(),
  triggeredBy: mysqlEnum("triggered_by", ["auto", "manual"]).notNull(),
  approvedBy: int("approved_by"),
  stepResults: json("step_results"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ==================== SECURITY GUARDIAN ====================

export const securityScans = mysqlTable("security_scans", {
  id: int("id").primaryKey().autoincrement(),
  scanType: mysqlEnum("scan_type", ["container", "kubernetes", "secrets", "compliance", "dependencies"]).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).notNull().default("queued"),
  findingsCount: int("findings_count").default(0),
  criticalCount: int("critical_count").default(0),
  highCount: int("high_count").default(0),
  mediumCount: int("medium_count").default(0),
  lowCount: int("low_count").default(0),
  report: json("report"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const vulnerabilities = mysqlTable("vulnerabilities", {
  id: int("id").primaryKey().autoincrement(),
  scanId: int("scan_id").notNull(),
  cveId: varchar("cve_id", { length: 50 }),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low", "info"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  affectedPackage: varchar("affected_package", { length: 255 }),
  installedVersion: varchar("installed_version", { length: 100 }),
  fixedVersion: varchar("fixed_version", { length: 100 }),
  remediation: text("remediation"),
  status: mysqlEnum("status", ["open", "acknowledged", "fixed", "ignored"]).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const securityPolicies = mysqlTable("security_policies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  policyType: varchar("policy_type", { length: 100 }).notNull(),
  rules: json("rules").notNull(),
  enabled: boolean("enabled").default(true),
  enforcementLevel: mysqlEnum("enforcement_level", ["audit", "warn", "block"]).notNull().default("warn"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const complianceReports = mysqlTable("compliance_reports", {
  id: int("id").primaryKey().autoincrement(),
  framework: varchar("framework", { length: 100 }).notNull(), // SOC2, HIPAA, PCI-DSS, etc.
  status: mysqlEnum("status", ["compliant", "non_compliant", "partial"]).notNull(),
  score: int("score"),
  totalControls: int("total_controls"),
  passedControls: int("passed_controls"),
  failedControls: int("failed_controls"),
  findings: json("findings"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

// ==================== COST OPTIMIZER ====================

export const costRecords = mysqlTable("cost_records", {
  id: int("id").primaryKey().autoincrement(),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }).notNull(),
  resourceName: varchar("resource_name", { length: 255 }),
  provider: varchar("provider", { length: 50 }), // aws, gcp, azure, on-prem
  costAmount: decimal("cost_amount", { precision: 10, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  tags: json("tags"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const costRecommendations = mysqlTable("cost_recommendations", {
  id: int("id").primaryKey().autoincrement(),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }).notNull(),
  recommendationType: mysqlEnum("recommendation_type", [
    "rightsize", "terminate", "reserved", "spot", "schedule", "storage_tier"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  currentCost: decimal("current_cost", { precision: 10, scale: 4 }),
  estimatedSavings: decimal("estimated_savings", { precision: 10, scale: 4 }),
  savingsPercent: int("savings_percent"),
  risk: mysqlEnum("risk", ["low", "medium", "high"]).notNull().default("low"),
  status: mysqlEnum("status", ["pending", "applied", "dismissed"]).notNull().default("pending"),
  aiReasoning: text("ai_reasoning"),
  createdAt: timestamp("created_at").defaultNow(),
  appliedAt: timestamp("applied_at"),
});

export const budgetAlerts = mysqlTable("budget_alerts", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  budgetAmount: decimal("budget_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  period: mysqlEnum("period", ["daily", "weekly", "monthly"]).notNull(),
  thresholdPercent: int("threshold_percent").notNull().default(80),
  resourceFilter: json("resource_filter"),
  enabled: boolean("enabled").default(true),
  lastAlertedAt: timestamp("last_alerted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== CI/CD ORCHESTRATOR ====================

export const pipelines = mysqlTable("pipelines", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  repository: varchar("repository", { length: 255 }),
  branch: varchar("branch", { length: 100 }),
  pipelineType: mysqlEnum("pipeline_type", ["build", "deploy", "test", "release", "full"]).notNull(),
  config: json("config").notNull(),
  status: mysqlEnum("status", ["active", "paused", "disabled"]).default("active"),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: mysqlEnum("last_run_status", ["success", "failed", "cancelled"]),
  totalRuns: int("total_runs").default(0),
  successRate: int("success_rate").default(0),
  avgDurationSeconds: int("avg_duration_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const pipelineRuns = mysqlTable("pipeline_runs", {
  id: int("id").primaryKey().autoincrement(),
  pipelineId: int("pipeline_id").notNull(),
  runNumber: int("run_number").notNull(),
  status: mysqlEnum("status", ["queued", "running", "success", "failed", "cancelled"]).notNull(),
  triggeredBy: varchar("triggered_by", { length: 100 }),
  triggerType: mysqlEnum("trigger_type", ["manual", "push", "schedule", "api"]).notNull(),
  commitSha: varchar("commit_sha", { length: 40 }),
  branch: varchar("branch", { length: 100 }),
  stages: json("stages"),
  logs: text("logs"),
  artifacts: json("artifacts"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  durationSeconds: int("duration_seconds"),
});

export const pipelineOptimizations = mysqlTable("pipeline_optimizations", {
  id: int("id").primaryKey().autoincrement(),
  pipelineId: int("pipeline_id").notNull(),
  optimizationType: mysqlEnum("optimization_type", [
    "caching", "parallelization", "test_selection", "resource_allocation", "stage_ordering"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  estimatedTimeSavings: int("estimated_time_savings"), // seconds
  estimatedCostSavings: decimal("estimated_cost_savings", { precision: 10, scale: 2 }),
  aiReasoning: text("ai_reasoning"),
  status: mysqlEnum("status", ["suggested", "applied", "dismissed"]).notNull().default("suggested"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== DOCUMENTATION GENERATOR ====================

export const generatedDocs = mysqlTable("generated_docs", {
  id: int("id").primaryKey().autoincrement(),
  docType: mysqlEnum("doc_type", [
    "architecture", "runbook", "api", "changelog", "readme", "onboarding"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  format: mysqlEnum("format", ["markdown", "html", "pdf"]).notNull().default("markdown"),
  sourceType: varchar("source_type", { length: 100 }),
  sourceId: varchar("source_id", { length: 255 }),
  version: int("version").default(1),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  generatedBy: mysqlEnum("generated_by", ["ai", "manual"]).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const docTemplates = mysqlTable("doc_templates", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  docType: varchar("doc_type", { length: 100 }).notNull(),
  template: text("template").notNull(),
  variables: json("variables"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== SELF-HEALING ENGINE ====================

export const healingRules = mysqlTable("healing_rules", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  conditionType: varchar("condition_type", { length: 100 }).notNull(),
  conditionConfig: json("condition_config").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  actionConfig: json("action_config").notNull(),
  targetType: mysqlEnum("target_type", ["container", "pod", "deployment", "service", "node"]).notNull(),
  targetSelector: json("target_selector"),
  enabled: boolean("enabled").default(true),
  cooldownSeconds: int("cooldown_seconds").default(300),
  maxRetries: int("max_retries").default(3),
  requiresApproval: boolean("requires_approval").default(false),
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: int("trigger_count").default(0),
  successCount: int("success_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const healingActions = mysqlTable("healing_actions", {
  id: int("id").primaryKey().autoincrement(),
  ruleId: int("rule_id").notNull(),
  targetResource: varchar("target_resource", { length: 255 }).notNull(),
  triggerReason: text("trigger_reason"),
  actionTaken: text("action_taken"),
  status: mysqlEnum("status", ["pending", "executing", "success", "failed", "rolled_back"]).notNull(),
  result: text("result"),
  rollbackAction: text("rollback_action"),
  executedAt: timestamp("executed_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const healingPatterns = mysqlTable("healing_patterns", {
  id: int("id").primaryKey().autoincrement(),
  patternName: varchar("pattern_name", { length: 255 }).notNull(),
  symptomSignature: json("symptom_signature").notNull(),
  successfulActions: json("successful_actions"),
  failedActions: json("failed_actions"),
  confidenceScore: int("confidence_score").default(0),
  occurrenceCount: int("occurrence_count").default(0),
  lastOccurrence: timestamp("last_occurrence"),
  learnedAt: timestamp("learned_at").defaultNow(),
});

// ==================== AI LEARNING & FEEDBACK ====================

export const aiLearningFeedback = mysqlTable("ai_learning_feedback", {
  id: int("id").primaryKey().autoincrement(),
  module: varchar("module", { length: 100 }).notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  context: json("context"),
  aiSuggestion: text("ai_suggestion"),
  userAction: text("user_action"),
  feedbackType: mysqlEnum("feedback_type", ["positive", "negative", "correction"]).notNull(),
  feedbackDetails: text("feedback_details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiModelPerformance = mysqlTable("ai_model_performance", {
  id: int("id").primaryKey().autoincrement(),
  module: varchar("module", { length: 100 }).notNull(),
  metricType: varchar("metric_type", { length: 100 }).notNull(),
  metricValue: decimal("metric_value", { precision: 10, scale: 4 }),
  sampleSize: int("sample_size"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});
