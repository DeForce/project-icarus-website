CREATE TABLE `campaign_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`ship_name` text NOT NULL,
	`current_date` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_entity_keys` (
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`entity_id` text NOT NULL,
	PRIMARY KEY(`kind`, `key`),
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_package_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `information_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `information_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`public_summary` text,
	`received_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`sequence` integer,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `package_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`package_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload_json` text,
	`effective_date` text,
	`source` text,
	FOREIGN KEY (`package_id`) REFERENCES `information_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_package_changes_package_entity` ON `package_changes` (`package_id`,`entity_id`);