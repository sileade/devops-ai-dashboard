CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`environment` enum('development','staging','production') NOT NULL DEFAULT 'development',
	`color` varchar(7) DEFAULT '#3B82F6',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployment_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('docker','kubernetes','ansible','terraform') NOT NULL,
	`action` varchar(100) NOT NULL,
	`resourceName` varchar(255),
	`status` enum('pending','running','success','failed','cancelled') NOT NULL DEFAULT 'pending',
	`details` json,
	`logs` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `deployment_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infrastructure_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('docker','podman','kubernetes','ansible','terraform') NOT NULL,
	`host` varchar(500),
	`port` int,
	`connectionConfig` json,
	`status` enum('connected','disconnected','error') NOT NULL DEFAULT 'disconnected',
	`lastChecked` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `infrastructure_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int,
	`category` varchar(100) NOT NULL,
	`problem` text NOT NULL,
	`solution` text NOT NULL,
	`confidence` int NOT NULL DEFAULT 50,
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`humanVerified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`applicationId` int,
	`type` enum('info','warning','error','success') NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`source` varchar(100),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`applicationId` int,
	`name` varchar(255) NOT NULL,
	`type` enum('docker','kubectl','ansible','terraform','shell') NOT NULL,
	`command` text NOT NULL,
	`description` text,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`defaultApplicationId` int,
	`theme` enum('dark','light','system') NOT NULL DEFAULT 'dark',
	`sidebarCollapsed` boolean NOT NULL DEFAULT false,
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`emailAlerts` boolean NOT NULL DEFAULT false,
	`refreshInterval` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
