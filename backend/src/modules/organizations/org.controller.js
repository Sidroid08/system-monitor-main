import { createOrganizationSchema } from './org.schemas.js';
import {
  createOrganization,
  getOrganizations,
  getOrganizationById,
} from './org.repository.js';

export async function createOrg(req, res, next) {
  try {
    const payload = createOrganizationSchema.parse(req.body);
    const organization = await createOrganization(payload);

    return res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
}

export async function listOrgs(req, res, next) {
  try {
    const organizations = await getOrganizations();

    return res.status(200).json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrgById(req, res, next) {
  try {
    const { id } = req.params;
    const organization = await getOrganizationById(id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
}