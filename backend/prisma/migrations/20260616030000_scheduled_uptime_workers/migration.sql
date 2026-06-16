-- Phase 4 scheduled uptime worker metadata.
-- Additive migration: supports efficient due-service scans and derived status streaks.

ALTER TABLE `monitored_services`
  ADD COLUMN `nextCheckAt` DATETIME(3) NULL,
  ADD COLUMN `lastCheckSource` VARCHAR(40) NULL,
  ADD COLUMN `consecutiveFailures` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `consecutiveSuccesses` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `monitored_services_organizationId_isActive_nextCheckAt_idx`
  ON `monitored_services`(`organizationId`, `isActive`, `nextCheckAt`);
