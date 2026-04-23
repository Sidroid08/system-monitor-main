import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { env } from '../../config/env.js';
import { upsertInstance } from '../instances/instances.repository.js';
import {
  findAwsAccountById,
  insertSyncLog,
  updateAwsAccountSyncTimestamp,
} from './aws.repository.js';

function buildEc2Client(awsAccount) {
  const config = { region: awsAccount.region || env.aws.syncDefaultRegion };

  if (awsAccount.authMode === 'STATIC_KEYS') {
    config.credentials = {
      accessKeyId: awsAccount.accessKeyId,
      secretAccessKey: awsAccount.secretAccessKey,
    };
  }

  return new EC2Client(config);
}

function tagsToMap(tags = []) {
  return Object.fromEntries((tags || []).map((tag) => [tag.Key, tag.Value]));
}

function mapInstanceStatus(state) {
  switch (state) {
    case 'running':
      return 'RUNNING';
    case 'stopped':
    case 'stopping':
      return 'STOPPED';
    case 'terminated':
      return 'TERMINATED';
    default:
      return 'UNKNOWN';
  }
}

export async function syncAwsAccountInstances(awsAccountId) {
  const awsAccount = await findAwsAccountById(awsAccountId);

  if (!awsAccount) {
    const error = new Error('AWS account not found');
    error.statusCode = 404;
    throw error;
  }

  await insertSyncLog({
    awsAccountId,
    status: 'started',
    message: 'Sync started',
  });

  const client = buildEc2Client(awsAccount);
  const discovered = [];
  let nextToken;

  try {
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
            orgLabel: null,
            serviceLabel: service,
            lastSeenAt: new Date(),
          };

          await upsertInstance(record);
          discovered.push(record);
        }
      }
    } while (nextToken);

    await updateAwsAccountSyncTimestamp(awsAccountId);

    await insertSyncLog({
      awsAccountId,
      status: 'success',
      message: 'Sync completed',
      discoveredCount: discovered.length,
    });

    return {
      awsAccountId,
      organizationId: awsAccount.organizationId,
      region: awsAccount.region,
      discoveredCount: discovered.length,
      instances: discovered,
    };
  } catch (error) {
    await insertSyncLog({
      awsAccountId,
      status: 'failed',
      message: error.message,
      discoveredCount: discovered.length,
    });

    throw error;
  }
}