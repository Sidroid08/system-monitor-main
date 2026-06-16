-- Align migration history with the current Prisma schema.
-- This preserves the existing data model and adds tables/columns already used by the backend.

-- CreateTable
CREATE TABLE `alert_rules` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `promql` TEXT NOT NULL,
    `condition` ENUM('GT', 'GTE', 'LT', 'LTE', 'EQ') NOT NULL,
    `threshold` DOUBLE NOT NULL,
    `forCycles` INTEGER NOT NULL DEFAULT 1,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `state` ENUM('INACTIVE', 'PENDING', 'FIRING') NOT NULL DEFAULT 'INACTIVE',
    `pendingSince` DATETIME(3) NULL,
    `lastEvaluatedAt` DATETIME(3) NULL,
    `lastFiredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `alert_rules_organizationId_idx`(`organizationId`),
    INDEX `alert_rules_state_idx`(`state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `alerts`
    ADD COLUMN `ruleId` VARCHAR(191) NULL,
    ADD COLUMN `labels` TEXT NULL;

-- CreateIndex
CREATE INDEX `alerts_ruleId_idx` ON `alerts`(`ruleId`);

-- CreateTable
CREATE TABLE `notification_channels` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('EMAIL', 'SLACK', 'WEBHOOK') NOT NULL,
    `config` TEXT NOT NULL,
    `minSeverity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notification_channels_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `awsAccountId` VARCHAR(191) NOT NULL,
    `status` ENUM('STARTED', 'SUCCESS', 'FAILED') NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `resourcesDiscovered` INTEGER NOT NULL DEFAULT 0,

    INDEX `sync_logs_organizationId_idx`(`organizationId`),
    INDEX `sync_logs_awsAccountId_idx`(`awsAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `alert_rules` ADD CONSTRAINT `alert_rules_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `alert_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_channels` ADD CONSTRAINT `notification_channels_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_awsAccountId_fkey` FOREIGN KEY (`awsAccountId`) REFERENCES `aws_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
