import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

// Writes a Prometheus file_sd JSON file for a given AWS account.
// vmagent reads these files from the targets/ directory and scrapes node_exporter
// on each discovered private IP. The file is atomically replaced on every sync.
//
// Format per Prometheus file_sd spec:
// [{ "targets": ["10.0.1.1:9100"], "labels": { "job": "...", "organization_id": "..." } }]

export async function writeFileSdTargets(awsAccount, instances) {
  await fs.mkdir(env.targetsDirPath, { recursive: true });

  const runningInstances = instances.filter(
    (i) => i.status === 'RUNNING' && i.privateIp,
  );

  const groups = {};
  for (const inst of runningInstances) {
    const key = `${inst.orgLabel ?? inst.organizationId}::${inst.serviceLabel ?? 'ec2'}`;
    if (!groups[key]) {
      groups[key] = {
        targets: [],
        labels: {
          job: 'aws-ec2-node-exporter',
          organization_id: inst.organizationId,
          organization_name: inst.orgLabel ?? awsAccount.organization?.name ?? inst.organizationId,
          service: inst.serviceLabel ?? 'ec2',
          aws_account_id: awsAccount.accountId,
          aws_region: awsAccount.region,
        },
      };
    }
    groups[key].targets.push(`${inst.privateIp}:9100`);
  }

  const payload = JSON.stringify(Object.values(groups), null, 2);
  const filePath = path.join(env.targetsDirPath, `${awsAccount.id}.json`);

  // Atomic write: write to a temp file, then rename to avoid partial reads by vmagent.
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, filePath);

  return { filePath, targetCount: runningInstances.length };
}

// Removes the target file for an account (called when account is deleted/deactivated).
export async function removeFileSdTargets(awsAccountId) {
  const filePath = path.join(env.targetsDirPath, `${awsAccountId}.json`);
  await fs.rm(filePath, { force: true });
}
