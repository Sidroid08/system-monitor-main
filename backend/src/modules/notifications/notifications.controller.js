import { ok } from '../../utils/apiResponse.js';
import { notFound } from '../../utils/errors.js';
import { dispatchAlert } from '../../lib/notifier.js';
import { createChannelSchema, updateChannelSchema } from './notifications.schemas.js';
import { createChannel, listChannels, findChannel, updateChannel, deleteChannel } from './notifications.repository.js';

export async function create(req, res) {
  const payload = createChannelSchema.parse(req.body);
  const channel = await createChannel({
    organizationId: req.user.organizationId,
    name: payload.name,
    type: payload.type,
    config: payload.config,
    minSeverity: payload.minSeverity,
  });
  return ok(res, { channel }, 'Notification channel created', 201);
}

export async function list(req, res) {
  const channels = await listChannels(req.user.organizationId);
  return ok(res, { channels }, 'Notification channels fetched');
}

export async function get(req, res) {
  const channel = await findChannel(req.params.id, req.user.organizationId);
  if (!channel) throw notFound('Notification channel not found');
  return ok(res, { channel }, 'Notification channel fetched');
}

export async function update(req, res) {
  const data = updateChannelSchema.parse(req.body);
  const result = await updateChannel(req.params.id, req.user.organizationId, data);
  if (result.count === 0) throw notFound('Notification channel not found');
  return ok(res, null, 'Notification channel updated');
}

export async function remove(req, res) {
  const result = await deleteChannel(req.params.id, req.user.organizationId);
  if (result.count === 0) throw notFound('Notification channel not found');
  return ok(res, null, 'Notification channel deleted');
}

// POST /api/notification-channels/:id/test — send a test alert to verify config.
export async function test(req, res) {
  const channel = await findChannel(req.params.id, req.user.organizationId);
  if (!channel) throw notFound('Notification channel not found');

  const fakeAlert = {
    id: 'test',
    organizationId: req.user.organizationId,
    title: 'Test alert from Sidroid',
    description: 'This is a test notification to verify your channel configuration.',
    severity: 'LOW',
    status: 'OPEN',
    triggeredAt: new Date(),
    labels: null,
  };

  await dispatchAlert(fakeAlert, null);
  return ok(res, null, 'Test notification dispatched');
}
