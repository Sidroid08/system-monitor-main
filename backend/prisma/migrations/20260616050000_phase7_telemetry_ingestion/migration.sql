-- Phase 7 telemetry ingestion foundation.
-- Additive migration: creates tenant-scoped logs and custom metric sample tables.

-- CreateTable
CREATE TABLE `log_entries` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `level` ENUM('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL') NOT NULL DEFAULT 'INFO',
    `message` VARCHAR(5000) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `source` VARCHAR(100) NULL,
    `environment` VARCHAR(50) NULL,
    `traceId` VARCHAR(128) NULL,
    `spanId` VARCHAR(64) NULL,
    `requestId` VARCHAR(128) NULL,
    `attributes` JSON NULL,
    `ingestionSource` ENUM('API_KEY', 'SYSTEM', 'WORKER') NOT NULL DEFAULT 'API_KEY',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `log_entries_organizationId_timestamp_id_idx`(`organizationId`, `timestamp`, `id`),
    INDEX `log_entries_organizationId_serviceId_timestamp_id_idx`(`organizationId`, `serviceId`, `timestamp`, `id`),
    INDEX `log_entries_organizationId_level_timestamp_id_idx`(`organizationId`, `level`, `timestamp`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metric_samples` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `name` VARCHAR(200) NOT NULL,
    `type` ENUM('GAUGE', 'COUNTER', 'HISTOGRAM') NOT NULL DEFAULT 'GAUGE',
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(50) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `tags` JSON NULL,
    `ingestionSource` ENUM('API_KEY', 'SYSTEM', 'WORKER') NOT NULL DEFAULT 'API_KEY',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `metric_samples_organizationId_name_timestamp_id_idx`(`organizationId`, `name`, `timestamp`, `id`),
    INDEX `metric_samples_organizationId_serviceId_timestamp_id_idx`(`organizationId`, `serviceId`, `timestamp`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `log_entries` ADD CONSTRAINT `log_entries_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metric_samples` ADD CONSTRAINT `metric_samples_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
