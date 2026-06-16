import prisma from '../../lib/prisma.js';

export async function getOrganizationById(id) {
  return prisma.organization.findUnique({
    where: { id },
  });
}
