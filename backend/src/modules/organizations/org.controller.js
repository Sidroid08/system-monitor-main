import { conflict, notFound } from '../../utils/errors.js';
import { getOrganizationById } from './org.repository.js';

export async function createOrg() {
  throw conflict('Organizations are created during registration');
}

export async function listOrgs(req, res) {
  const organization = await getOrganizationById(req.user.organizationId);
  if (!organization) throw notFound('Organization not found');

  return res.status(200).json({
    success: true,
    data: [organization],
  });
}

export async function getOrgById(req, res) {
  if (req.params.id !== req.user.organizationId) {
    throw notFound('Organization not found');
  }

  const organization = await getOrganizationById(req.user.organizationId);
  if (!organization) throw notFound('Organization not found');

  return res.status(200).json({
    success: true,
    data: organization,
  });
}
