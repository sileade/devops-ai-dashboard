CREATE TABLE `cluster_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`clusterIds` json NOT NULL,
	`comparisonType` enum('resources','workloads','networking','storage','all') NOT NULL DEFAULT 'all',
	`snapshotData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cluster_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cluster_namespaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(50),
	`labels` json,
	`podCount` int DEFAULT 0,
	`deploymentCount` int DEFAULT 0,
	`serviceCount` int DEFAULT 0,
	`lastSyncAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cluster_namespaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`smtpHost` varchar(255) NOT NULL,
	`smtpPort` int NOT NULL DEFAULT 587,
	`smtpSecure` boolean NOT NULL DEFAULT false,
	`smtpUser` varchar(255) NOT NULL,
	`smtpPassword` varchar(500) NOT NULL,
	`fromEmail` varchar(320) NOT NULL,
	`fromName` varchar(255) DEFAULT 'DevOps AI Dashboard',
	`isVerified` boolean NOT NULL DEFAULT false,
	`lastTestedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int,
	`toEmail` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`templateType` enum('alert','scaling','ab_test','digest','report','custom') NOT NULL,
	`status` enum('pending','sent','failed','bounced') NOT NULL DEFAULT 'pending',
	`messageId` varchar(255),
	`errorMessage` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`criticalAlerts` boolean NOT NULL DEFAULT true,
	`warningAlerts` boolean NOT NULL DEFAULT true,
	`infoAlerts` boolean NOT NULL DEFAULT false,
	`scalingEvents` boolean NOT NULL DEFAULT true,
	`abTestResults` boolean NOT NULL DEFAULT true,
	`dailyDigest` boolean NOT NULL DEFAULT false,
	`weeklyReport` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`unsubscribeToken` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grafana_dashboards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`uid` varchar(100) NOT NULL,
	`embedUrl` text,
	`category` enum('overview','containers','kubernetes','custom') NOT NULL DEFAULT 'custom',
	`isDefault` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grafana_dashboards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kubernetes_clusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayName` varchar(255),
	`description` text,
	`apiServerUrl` varchar(500) NOT NULL,
	`authType` enum('kubeconfig','token','certificate','oidc') NOT NULL DEFAULT 'token',
	`kubeconfig` text,
	`bearerToken` text,
	`clientCertificate` text,
	`clientKey` text,
	`caCertificate` text,
	`kubernetesVersion` varchar(50),
	`provider` enum('aws','gcp','azure','digitalocean','linode','on-premise','other') DEFAULT 'other',
	`region` varchar(100),
	`status` enum('connected','disconnected','error','pending') NOT NULL DEFAULT 'pending',
	`lastHealthCheck` timestamp,
	`healthStatus` enum('healthy','degraded','unhealthy','unknown') DEFAULT 'unknown',
	`nodeCount` int,
	`podCount` int,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`syncInterval` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kubernetes_clusters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prometheus_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`applicationId` int,
	`name` varchar(255) NOT NULL,
	`prometheusUrl` varchar(500) NOT NULL,
	`prometheusUsername` varchar(255),
	`prometheusPassword` varchar(500),
	`grafanaUrl` varchar(500),
	`grafanaApiKey` varchar(500),
	`scrapeInterval` int NOT NULL DEFAULT 15,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastScrapeAt` timestamp,
	`lastScrapeStatus` enum('success','failed','timeout'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prometheus_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prometheus_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`query` text NOT NULL,
	`description` text,
	`unit` varchar(50),
	`aggregation` enum('avg','sum','min','max','count','rate') NOT NULL DEFAULT 'avg',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prometheus_metrics_id` PRIMARY KEY(`id`)
);
