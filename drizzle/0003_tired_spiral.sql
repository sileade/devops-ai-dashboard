CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thresholdId` int,
	`applicationId` int,
	`severity` enum('warning','critical') NOT NULL,
	`metricType` enum('cpu','memory','disk','network') NOT NULL,
	`resourceType` enum('container','pod','node','cluster') NOT NULL DEFAULT 'cluster',
	`resourceId` varchar(255),
	`currentValue` int NOT NULL,
	`thresholdValue` int NOT NULL,
	`message` text NOT NULL,
	`isAcknowledged` boolean NOT NULL DEFAULT false,
	`acknowledgedBy` int,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`metricType` enum('cpu','memory','disk','network') NOT NULL,
	`resourceType` enum('container','pod','node','cluster') NOT NULL DEFAULT 'cluster',
	`resourcePattern` varchar(255),
	`warningThreshold` int NOT NULL,
	`criticalThreshold` int NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`cooldownMinutes` int NOT NULL DEFAULT 5,
	`lastTriggered` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_thresholds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int,
	`source` enum('docker','kubernetes','system') NOT NULL DEFAULT 'system',
	`resourceType` enum('container','pod','node','cluster') NOT NULL DEFAULT 'cluster',
	`resourceId` varchar(255),
	`cpuPercent` int NOT NULL,
	`memoryPercent` int NOT NULL,
	`memoryUsedMb` int,
	`memoryTotalMb` int,
	`networkRxBytes` int,
	`networkTxBytes` int,
	`diskUsedGb` int,
	`diskTotalGb` int,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metrics_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `conversationId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_messages` DROP COLUMN `sessionId`;--> statement-breakpoint
ALTER TABLE `chat_messages` DROP COLUMN `userId`;--> statement-breakpoint
ALTER TABLE `chat_messages` DROP COLUMN `userOpenId`;