-- Phase 2 SaaS identity and authorization foundation.
-- Additive migration: preserves legacy users.organizationId while adding memberships.

-- CreateTable
CREATE TABLE `organization_members` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `status` ENUM('ACTIVE', 'INVITED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organization_members_organizationId_userId_key`(`organizationId`, `userId`),
    INDEX `organization_members_userId_idx`(`userId`),
    INDEX `organization_members_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill current single-org users into membership rows.
INSERT INTO `organization_members` (`id`, `organizationId`, `userId`, `role`, `status`, `createdAt`, `updatedAt`)
SELECT
    UUID(),
    `organizationId`,
    `id`,
    CASE `role`
        WHEN 'ADMIN' THEN 'OWNER'
        WHEN 'MEMBER' THEN 'DEVELOPER'
        ELSE 'VIEWER'
    END,
    CASE `isActive`
        WHEN true THEN 'ACTIVE'
        ELSE 'DISABLED'
    END,
    `createdAt`,
    `updatedAt`
FROM `users`
WHERE `organizationId` IS NOT NULL;

-- AlterTable
ALTER TABLE `api_keys`
    ADD COLUMN `prefix` VARCHAR(191) NULL,
    ADD COLUMN `scopes` VARCHAR(191) NOT NULL DEFAULT '[]',
    ADD COLUMN `lastUsedAt` DATETIME(3) NULL,
    ADD COLUMN `revokedAt` DATETIME(3) NULL,
    ADD COLUMN `createdByUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `api_keys_prefix_key` ON `api_keys`(`prefix`);

-- CreateIndex
CREATE UNIQUE INDEX `api_keys_keyHash_key` ON `api_keys`(`keyHash`);

-- CreateIndex
CREATE INDEX `api_keys_createdByUserId_idx` ON `api_keys`(`createdByUserId`);

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organizationId_idx`(`organizationId`),
    INDEX `audit_logs_actorUserId_idx`(`actorUserId`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
