import { listLogsQuerySchema } from './logs.schemas.js';
import * as defaultRepo from './logs.repository.js';

export function makeLogsController(deps = {}) {
  const repo = deps.repo ?? defaultRepo;

  async function listLogs(req, res) {
    const parsed = listLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { limit, ...filters } = parsed.data;
    const organizationId = req.user.organizationId;

    const { rows, nextCursor } = await repo.listLogs(organizationId, { ...filters, limit });
    return res.json({ data: rows, nextCursor });
  }

  async function getLog(req, res) {
    const organizationId = req.user.organizationId;
    const entry = await repo.findLogById(req.params.id, organizationId);
    if (!entry) return res.status(404).json({ error: 'Log entry not found' });
    return res.json(entry);
  }

  return { listLogs, getLog };
}

const defaultController = makeLogsController();
export const { listLogs, getLog } = defaultController;
