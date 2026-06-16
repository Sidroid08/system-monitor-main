-- Phase 3 service registry and manual uptime checks.
-- Additive migration: complements AWS inventory and metrics storage.

-- CreateTable
CREATE TABLE `monitored_services` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('HTTP', 'API', 'WEB', 'EC2', 'CUSTOM') NOT NULL,
    `environment` VARCHAR(191) NOT NULL DEFAULT 'production',
    `url` VARCHAR(191) NULL,
    `healthPath` VARCHAR(191) NULL,
    `method` ENUM('GET', 'HEAD') NOT NULL DEFAULT 'GET',
    `expectedStatusCode` INTEGER NOT NULL DEFAULT 200,
    `timeoutMs` INTEGER NOT NULL DEFAULT 5000,
    `intervalSeconds` INTEGER NOT NULL DEFAULT 60,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `tags` JSON NULL,
    `currentStatus` ENUM('UP', 'DOWN', 'DEGRADED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `lastCheckedAt` DATETIME(3) NULL,
    `lastResponseTimeMs` INTEGER NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `monitored_services_organizationId_slug_key`(`organizationId`, `slug`),
    INDEX `monitored_services_organizationId_idx`(`organizationId`),
    INDEX `monitored_services_organizationId_deletedAt_idx`(`organizationId`, `deletedAt`),
    INDEX `monitored_services_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uptime_checks` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `status` ENUM('UP', 'DOWN', 'DEGRADED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `httpStatusCode` INTEGER NULL,
    `responseTimeMs` INTEGER NULL,
    `errorMessage` VARCHAR(500) NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkSource` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `metadata` JSON NULL,

    INDEX `uptime_checks_organizationId_idx`(`organizationId`),
    INDEX `uptime_checks_serviceId_idx`(`serviceId`),
    INDEX `uptime_checks_organizationId_serviceId_checkedAt_idx`(`organizationId`, `serviceId`, `checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `monitored_services` ADD CONSTRAINT `monitored_services_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitored_services` ADD CONSTRAINT `monitored_services_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uptime_checks` ADD CONSTRAINT `uptime_checks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uptime_checks` ADD CONSTRAINT `uptime_checks_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `monitored_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
