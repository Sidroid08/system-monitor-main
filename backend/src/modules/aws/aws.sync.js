import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { env } from '../../config/env.js';
import { writeFileSdTargets } from '../../lib/targetWriter.js';
import { upsertInstance, markInstancesTerminated } from '../instances/instances.repository.js';
import {
  findAwsAccountById,
  createSyncLog,
  finishSyncLog,
  updateAwsAccountSyncTimestamp,
} from './aws.repository.js';

function buildEc2Client(awsAccount) {
  const config = { region: awsAccount.region || env.aws.syncDefaultRegion };

  if (awsAccount.authMode === 'STATIC_KEYS') {
    if (!awsAccount.accessKeyId || !awsAccount.secretAccessKey) {
      const err = new Error('AWS account is missing static key credentials');
      err.statusCode = 400;
      throw err;
    }
    config.credentials = {
      accessKeyId: awsAccount.accessKeyId,
      secretAccessKey: awsAccount.secretAccessKey,
    };
  }

  return new EC2Client(config);
}

function tagsToMap(tags = []) {
  return Object.fromEntries(
    (tags || []).filter((t) => t.Key).map((t) => [t.Key, t.Value ?? '']),
  );
}

function mapInstanceStatus(state) {
  switch (state) {
    case 'running': return 'RUNNING';
    case 'stopped':
    case 'stopping': return 'STOPPED';
    case 'terminated': return 'TERMINATED';
    default: return 'UNKNOWN';
  }
}

export async function syncAwsAccountInstances(awsAccountId, options = {}) {
  const awsAccount = await findAwsAccountById(awsAccountId);

  if (!awsAccount) {
    const err = new Error('AWS account not found');
    err.statusCode = 404;
    throw err;
  }

  if (options.organizationId && awsAccount.organizationId !== options.organizationId) {
    const err = new Error('AWS account not found');
    err.statusCode = 404;
    throw err;
  }

  const syncLog = await createSyncLog({
    organizationId: awsAccount.organizationId,
    awsAccountId: awsAccount.id,
  });

  const discovered = [];
  let nextToken;

  try {
    const client = buildEc2Client(awsAccount);

    do {
      const command = new DescribeInstancesCommand({
        Filters: [
          { Name: 'instance-state-name', Values: ['pending', 'running', 'stopping', 'stopped'] },
          { Name: 'tag:Monitor', Values: ['true'] },
        ],
        NextToken: nextToken,
      });

      const response = await client.send(command);
      nextToken = response.NextToken;

      for (const reservation of response.Reservations ?? []) {
        for (const instance of reservation.Instances ?? []) {
          const tags = tagsToMap(instance.Tags);
          const service = tags.Service || 'ec2';
          const nodeName = tags.Node || tags.Name || instance.InstanceId;
          const orgLabel = tags.OrgName || awsAccount.organization?.name || awsAccount.organizationId;

          const record = {
            organizationId: awsAccount.organizationId,
            awsAccountId: awsAccount.id,
            instanceId: instance.InstanceId,
            instanceName: tags.Name || nodeName,
            hostname: nodeName,
            publicIp: instance.PublicIpAddress || null,
            privateIp: instance.PrivateIpAddress || null,
            region: awsAccount.region || env.aws.syncDefaultRegion,
            status: mapInstanceStatus(instance.State?.Name),
            serviceType: 'EC2',
            platform: instance.Platform === 'windows' ? 'WINDOWS' : 'LINUX',
            orgLabel,
            serviceLabel: service,
            lastSeenAt: new Date(),
          };

          await upsertInstance(record);
          discovered.push(record);
        }
      }
    } while (nextToken);

    // Mark instances that disappeared from AWS as TERMINATED.
    const seenIds = discovered.map((i) => i.instanceId);
    await markInstancesTerminated(awsAccount.id, seenIds);

    // Write file_sd JSON so vmagent picks up the current set of scrape targets.
    await writeFileSdTargets(awsAccount, discovered).catch(() => {
      // Non-fatal — sync succeeds even if target file write fails.
    });

    await updateAwsAccountSyncTimestamp(awsAccountId);
    await finishSyncLog(syncLog.id, { status: 'SUCCESS', resourcesDiscovered: discovered.length });

    return {
      awsAccountId,
      organizationId: awsAccount.organizationId,
      region: awsAccount.region,
      discoveredCount: discovered.length,
      syncLogId: syncLog.id,
    };
  } catch (error) {
    const message = error?.message ?? 'AWS sync failed';
    await finishSyncLog(syncLog.id, {
      status: 'FAILED',
      errorMessage: message,
      resourcesDiscovered: discovered.length,
    }).catch(() => {});
    throw error;
  }
}
