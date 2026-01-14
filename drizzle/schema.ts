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
