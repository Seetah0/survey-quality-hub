CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text NOT NULL,
	`bytes` integer NOT NULL,
	`type` text NOT NULL,
	`kind` text NOT NULL,
	`rows` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_owner_created` ON `reports` (`owner`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `reports_owner_hash` ON `reports` (`owner`,`hash`);