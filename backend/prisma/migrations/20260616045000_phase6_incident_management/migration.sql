-- Phase 6 incident management foundation.
-- Additive migration: creates incident lifecycle and timeline tables.

-- CreateTable
CREATE TABLE `incidents` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `alertId` VARCHAR(191) NULL,
    `alertRuleId` VARCHAR(191) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `severity` ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `source` ENUM('ALERT', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'MANUAL',
    `assignedToUserId` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `acknowledgedByUserId` VARCHAR(191) NULL,
    `resolvedByUserId` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `impactSummary` TEXT NULL,
    `rootCause` TEXT NULL,
    `resolutionSummary` TEXT NULL,
    `preventionNotes` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `incidents_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `incidents_organizationId_serviceId_idx`(`organizationId`, `serviceId`),
    INDEX `incidents_organizationId_severity_idx`(`organizationId`, `severity`),
    INDEX `incidents_organizationId_startedAt_idx`(`organizationId`, `startedAt`),
    INDEX `incidents_alertId_idx`(`alertId`),
    INDEX `incidents_alertRuleId_idx`(`alertRuleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incident_events` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `incidentId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `type` ENUM('CREATED', 'ACKNOWLEDGED', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENTED', 'RESOLVED', 'CLOSED', 'ALERT_LINKED', 'ALERT_RECOVERED', 'SYSTEM_UPDATE') NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `incident_events_incidentId_idx`(`incidentId`),
    INDEX `incident_events_organizationId_incidentId_idx`(`organizationId`, `incidentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incident_events` ADD CONSTRAINT `incident_events_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incident_events` ADD CONSTRAINT `incident_events_incidentId_fkey`
  FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
