import {
  createAwsAccount,
  getAwsAccountsByOrganization,
} from './aws.repository.js';
import { createAwsAccountSchema } from './aws.schemas.js';
import { syncAwsAccountInstances } from './aws.sync.js';

export async function createAws(req, res, next) {
  try {
    const payload = createAwsAccountSchema.parse(req.body);
    const awsAccount = await createAwsAccount(payload);

    return res.status(201).json({
      success: true,
      data: awsAccount,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAws(req, res, next) {
  try {
    const { organizationId } = req.query;
    const awsAccounts = await getAwsAccountsByOrganization({ organizationId });

    return res.status(200).json({
      success: true,
      data: awsAccounts,
    });
  } catch (error) {
    next(error);
  }
}

export async function syncAws(req, res, next) {
  try {
    const { id } = req.params;
    const result = await syncAwsAccountInstances(id);

    return res.status(200).json({
      success: true,
      message: 'AWS sync completed',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}