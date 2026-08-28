CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_portfolio_type` ON `account` (`portfolio_id`,`type`);--> statement-breakpoint
CREATE TABLE `app_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eri_record` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`fund` text NOT NULL,
	`isin` text NOT NULL,
	`reporting_period_start` text NOT NULL,
	`reporting_period_end` text NOT NULL,
	`fund_distribution_date` text NOT NULL,
	`eri_per_unit` text NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`source` text NOT NULL,
	`source_document` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`applicable_units` text DEFAULT '0' NOT NULL,
	`total_amount` text DEFAULT '0' NOT NULL,
	`applied_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_eri_record_portfolio_period` ON `eri_record` (`portfolio_id`,`reporting_period_end`);--> statement-breakpoint
CREATE TABLE `holding` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`units` text DEFAULT '0' NOT NULL,
	`original_cost` text DEFAULT '0' NOT NULL,
	`eri_adjustment` text DEFAULT '0' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_holding_account_symbol` ON `holding` (`account_id`,`symbol`);--> statement-breakpoint
CREATE TABLE `market_price` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`market_timestamp` text NOT NULL,
	`price` text NOT NULL,
	`previous_close` text,
	`change` text,
	`change_percent` text,
	`fifty_two_week_high` text,
	`fifty_two_week_low` text,
	`source` text NOT NULL,
	`retrieved_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_price_symbol_timestamp` ON `market_price` (`symbol`,`market_timestamp`);--> statement-breakpoint
CREATE INDEX `idx_market_price_symbol_retrieved` ON `market_price` (`symbol`,`retrieved_at`);--> statement-breakpoint
CREATE TABLE `portfolio` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`isin` text NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`initial_investment` text NOT NULL,
	`start_date` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_calculation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`tax_year` text NOT NULL,
	`calculation_type` text NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tax_calculation_portfolio_year` ON `tax_calculation` (`portfolio_id`,`tax_year`);--> statement-breakpoint
CREATE TABLE `tax_profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year` text NOT NULL,
	`employment_income` text DEFAULT '0' NOT NULL,
	`other_taxable_income` text DEFAULT '0' NOT NULL,
	`other_dividend_income` text DEFAULT '0' NOT NULL,
	`other_capital_gains` text DEFAULT '0' NOT NULL,
	`capital_losses` text DEFAULT '0' NOT NULL,
	`pension_contributions` text DEFAULT '0' NOT NULL,
	`personal_allowance_override` text,
	`isa_allowance_used` text DEFAULT '0' NOT NULL,
	`mode` text DEFAULT 'simple' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_profile_tax_year_unique` ON `tax_profile` (`tax_year`);--> statement-breakpoint
CREATE TABLE `tax_year` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`isa_allowance` text NOT NULL,
	`cgt_annual_exemption` text NOT NULL,
	`cgt_basic_rate` text NOT NULL,
	`cgt_higher_rate` text NOT NULL,
	`dividend_allowance` text NOT NULL,
	`dividend_basic_rate` text NOT NULL,
	`dividend_higher_rate` text NOT NULL,
	`dividend_additional_rate` text NOT NULL,
	`personal_allowance` text NOT NULL,
	`basic_rate_band` text NOT NULL,
	`additional_rate_threshold` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`source_note` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_year_label_unique` ON `tax_year` (`label`);--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portfolio_id` integer NOT NULL,
	`account_id` integer,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`symbol` text NOT NULL,
	`units` text DEFAULT '0' NOT NULL,
	`price` text DEFAULT '0' NOT NULL,
	`gross_value` text DEFAULT '0' NOT NULL,
	`cost_basis` text DEFAULT '0' NOT NULL,
	`realised_gain` text DEFAULT '0' NOT NULL,
	`eri_adjustment` text DEFAULT '0' NOT NULL,
	`estimated_tax` text DEFAULT '0' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`group_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolio`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_portfolio_date` ON `transaction` (`portfolio_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transaction_account_date` ON `transaction` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transaction_group` ON `transaction` (`group_id`);