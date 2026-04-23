CREATE DATABASE IF NOT EXISTS sidroid;
USE sidroid;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  org_code VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_code (org_code),
  UNIQUE KEY uq_org_name (name)
);

CREATE TABLE IF NOT EXISTS organization_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner','admin','viewer') NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_user (organization_id, user_id),
  CONSTRAINT fk_org_members_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aws_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  region VARCHAR(32) NOT NULL,
  auth_type ENUM('access_key','iam_role') NOT NULL DEFAULT 'access_key',
  access_key_id VARCHAR(128) NULL,
  secret_access_key TEXT NULL,
  role_arn VARCHAR(255) NULL,
  external_id VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_aws_accounts_org (organization_id),
  CONSTRAINT fk_aws_accounts_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS instances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  aws_account_id BIGINT UNSIGNED NOT NULL,
  instance_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NULL,
  node_name VARCHAR(120) NULL,
  service VARCHAR(64) NOT NULL DEFAULT 'ec2',
  public_ip VARCHAR(64) NULL,
  private_ip VARCHAR(64) NULL,
  availability_zone VARCHAR(64) NULL,
  instance_type VARCHAR(64) NULL,
  state VARCHAR(32) NOT NULL,
  monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  discovered_tags JSON NULL,
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_instances_account_instance (aws_account_id, instance_id),
  KEY idx_instances_org (organization_id),
  KEY idx_instances_org_service (organization_id, service),
  CONSTRAINT fk_instances_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_instances_aws_account FOREIGN KEY (aws_account_id) REFERENCES aws_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aws_account_id BIGINT UNSIGNED NOT NULL,
  sync_type ENUM('ec2') NOT NULL DEFAULT 'ec2',
  status ENUM('started','success','failed') NOT NULL,
  message TEXT NULL,
  discovered_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sync_logs_account (aws_account_id),
  CONSTRAINT fk_sync_logs_aws_account FOREIGN KEY (aws_account_id) REFERENCES aws_accounts(id) ON DELETE CASCADE
);
