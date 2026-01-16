CREATE TABLE `audit_log_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`triggerConditions` json NOT NULL,
	`notifyEmail` boolean NOT NULL DEFAULT true,
	`notifySlack` boolean NOT NULL DEFAULT false,
	`notifyWebhook` boolean NOT NULL DEFAULT false,
	`webhookUrl` varchar(500),
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`cooldownMinutes` int NOT NULL DEFAULT 15,
	`lastTriggeredAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`triggerCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_log_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`actionTypes` json,
	`resourceTypes` json,
	`riskLevels` json,
	`retentionDays` int NOT NULL DEFAULT 90,
	`archiveEnabled` boolean NOT NULL DEFAULT false,
	`archiveLocation` varchar(500),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastAppliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_log_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log_saved_queries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`teamId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`filters` json NOT NULL,
	`columns` json,
	`sortBy` varchar(100),
	`sortOrder` enum('asc','desc') DEFAULT 'desc',
	`isShared` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_log_saved_queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userEmail` varchar(320),
	`userName` varchar(255),
	`teamId` int,
	`action` enum('login','logout','login_failed','password_changed','mfa_enabled','mfa_disabled','create','read','update','delete','deploy','rollback','scale','restart','stop','start','team_create','team_update','team_delete','member_invite','member_remove','member_role_change','config_change','secret_access','secret_update','ai_query','ai_recommendation_applied','export','import','admin_action','system_config_change') NOT NULL,
	`resourceType` varchar(100),
	`resourceId` varchar(255),
	`resourceName` varchar(255),
	`description` text NOT NULL,
	`previousState` json,
	`newState` json,
	`ipAddress` varchar(45),
	`userAgent` varchar(500),
	`requestId` varchar(64),
	`sessionId` varchar(64),
	`country` varchar(2),
	`city` varchar(100),
	`status` enum('success','failure','partial') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`isSuspicious` boolean NOT NULL DEFAULT false,
	`suspiciousReason` text,
	`duration` int,
	`metadata` json,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`userId` int,
	`activityType` enum('member_joined','member_left','member_role_changed','resource_added','resource_removed','settings_changed','team_created','team_updated') NOT NULL,
	`description` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`token` varchar(64) NOT NULL,
	`invitedBy` int NOT NULL,
	`personalMessage` text,
	`status` enum('pending','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member','viewer') NOT NULL DEFAULT 'member',
	`permissions` json,
	`status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
	`invitedBy` int,
	`invitedAt` timestamp,
	`acceptedAt` timestamp,
	`lastActiveAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`resourceType` enum('application','cluster','connection','autoscaling_rule','scheduled_scaling','ab_test','canary_deployment','prometheus_config','email_config') NOT NULL,
	`resourceId` int NOT NULL,
	`accessLevel` enum('full','read_write','read_only') NOT NULL DEFAULT 'full',
	`addedBy` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`parentTeamId` int,
	`ownerId` int NOT NULL,
	`settings` json,
	`logoUrl` varchar(500),
	`primaryColor` varchar(7) DEFAULT '#3B82F6',
	`maxMembers` int DEFAULT 10,
	`maxApplications` int DEFAULT 5,
	`maxClusters` int DEFAULT 3,
	`plan` enum('free','starter','professional','enterprise') NOT NULL DEFAULT 'free',
	`billingEmail` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`suspendedAt` timestamp,
	`suspendedReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `teams_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`deviceType` varchar(50),
	`browser` varchar(100),
	`os` varchar(100),
	`ipAddress` varchar(45),
	`country` varchar(2),
	`city` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
