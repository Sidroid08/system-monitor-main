-- Phase 5 uptime-specific alert rules.
-- Adds a rule model that evaluates SERVICE_DOWN / SERVICE_DEGRADED /
-- RESPONSE_TIME_ABOVE / CONSECUTIVE_FAILURES conditions after every uptime check.
-- Separate from the PromQL-based alert_rules table (VictoriaMetrics evaluation).

-- CreateTable
CREATE TABLE `uptime_alert_rules` (
    `id`                    VARCHAR(191) NOT NULL,
    `organizationId`        VARCHAR(191) NOT NULL,
    `serviceId`             VARCHAR(191) NULL,
    `name`                  VARCHAR(191) NOT NULL,
    `type`                  ENUM('SERVICE_DOWN','SERVICE_DEGRADED','RESPONSE_TIME_ABOVE','CONSECUTIVE_FAILURES') NOT NULL,
    `severity`              ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `isActive`              BOOLEAN NOT NULL DEFAULT true,
    `threshold`             INTEGER NULL,
    `cooldownSeconds`       INTEGER NOT NULL DEFAULT 300,
    `notificationChannelId` VARCHAR(191) NULL,
    `createdByUserId`       VARCHAR(191) NULL,
    `lastFiredAt`           DATETIME(3) NULL,
    `lastResolvedAt`        DATETIME(3) NULL,
    `createdAt`             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`             DATETIME(3) NOT NULL,

    INDEX `uptime_alert_rules_organizationId_idx`(`organizationId`),
    INDEX `uptime_alert_rules_organizationId_serviceId_idx`(`organizationId`, `serviceId`),
    INDEX `uptime_alert_rules_organizationId_isActive_idx`(`organizationId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `uptime_alert_rules` ADD CONSTRAINT `uptime_alert_rules_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uptime_alert_rules` ADD CONSTRAINT `uptime_alert_rules_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `monitored_services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uptime_alert_rules` ADD CONSTRAINT `uptime_alert_rules_notificationChannelId_fkey`
  FOREIGN KEY (`notificationChannelId`) REFERENCES `notification_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uptime_alert_rules` ADD CONSTRAINT `uptime_alert_rules_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
